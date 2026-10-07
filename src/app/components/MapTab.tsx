// ─────────────────────────────────────────────────────────────────────────────
// MapTab.tsx — Los Angeles County food places from OpenStreetMap (M9), near a ZIP code or the phone's location (M13).
// Pure Leaflet, no react-leaflet: the map is driven imperatively through refs. Specs:
// docs/superpowers/specs/2026-10-02-m9-real-map-design.md; docs/superpowers/specs/2026-10-07-m13-map-near-me-design.md
// (layout A: ZIP and My location on top, radius chips, the map with the search circle, the list below).
// Only what OSM and LA County Public Health list is shown, each labelled with its source and date (County sites carry
// a * and their age, D11); no ratings, no open/closed guess. The ZIP and the location live in memory only: never
// stored, sent or put in the URL (M13 D3).
// ─────────────────────────────────────────────────────────────────────────────

import "leaflet/dist/leaflet.css";
import "leaflet.markercluster/dist/MarkerCluster.css";
import "leaflet.markercluster/dist/MarkerCluster.Default.css";

import { useState, useEffect, useMemo, useRef } from "react";
import L from "leaflet";
import "leaflet.markercluster";
import { ArrowLeft, Navigation, Phone, Globe, MapPin, Utensils, ShoppingBag, Leaf } from "lucide-react";
import type { ResourceRow } from "../../lib/catalog";
import { zipPoint, withinMiles, RADII, countyPlaces, countyReportMailto, REPORT_EMAIL } from "../../lib/nearMe";
import {
  LA_BOX, LA_CENTER, inLaCounty, sortPlaces, osmUrl, osmEditUrl, osmNoteUrl, directionsUrl, formatAsOf, formatPhone,
  type PlaceType,
} from "../../lib/osmPlaces";

// "Free food" = food banks, pantries, meal sites and (M13 part 4) community fridges (D5).
const CAT: Record<PlaceType, { label: string; one: string; color: string; letter: string; Icon: React.ElementType }> = {
  "food-bank":        { label: "Free food",       one: "Free food",        color: "#1a5c39", letter: "F", Icon: Utensils },
  "farmers-market":   { label: "Farmers markets", one: "Farmers market",   color: "#8a5a12", letter: "M", Icon: ShoppingBag },
  "community-garden": { label: "Gardens",         one: "Community garden", color: "#2f6f86", letter: "G", Icon: Leaf },
};
const TYPES = Object.keys(CAT) as PlaceType[];
const LA_BOUNDS = L.latLngBounds([LA_BOX.south, LA_BOX.west], [LA_BOX.north, LA_BOX.east]);
const FIT = { padding: [12, 12] as [number, number] };
const METERS_PER_MI = 1609.344;
const YOUR_LOCATION = "your location";
const COPYRIGHT = "https://www.openstreetmap.org/copyright";
const HOURS_NOTE = "Hours can change — check before you go.";
// LA County Public Health's sites (decision 041): credited with their origin and age, and marked * (D11).
const COUNTY_CREDIT = "LA County Public Health, from 211LA food resources (May 2023), updated April 2024";
const COUNTY_TERMS = "https://egis-lacounty.hub.arcgis.com/pages/terms-of-use";
const COUNTY_NOTE = "* County listing from May 2023, last updated April 2024. Search the name or call 211 to check it's still open before you go.";

const fmtMi = (mi: number) => mi < 0.1 ? `${Math.round(mi * 5280)} ft` : `${mi.toFixed(1)} mi`;

function pinIcon(type: PlaceType, selected: boolean): L.DivIcon {
  const { color, letter } = CAT[type];
  const s = selected ? 40 : 30;
  return L.divIcon({
    html: `<div style="width:${s}px;height:${s}px;background:${selected ? color : "#fff"};border:2.5px solid ${color};border-radius:50%;
      display:flex;align-items:center;justify-content:center;box-shadow:0 2px 10px rgba(0,0,0,${selected ? 0.35 : 0.18});
      font-weight:900;font-size:${Math.round(s * 0.36)}px;color:${selected ? "#fff" : color};font-family:sans-serif">${letter}</div>`,
    className: "", iconSize: [s, s], iconAnchor: [s / 2, s / 2],
  });
}

function clusterIcon(cluster: any): L.DivIcon {
  const n: number = cluster.getChildCount();
  const s = n < 10 ? 36 : n < 50 ? 42 : 48;
  return L.divIcon({
    html: `<div style="width:${s}px;height:${s}px;background:#1a5c39;color:#fff;border:2.5px solid #fff;border-radius:50%;
      display:flex;align-items:center;justify-content:center;font-weight:900;font-size:${Math.round(s * 0.35)}px;
      box-shadow:0 2px 10px rgba(0,0,0,0.3)">${n}</div>`,
    className: "", iconSize: [s, s], iconAnchor: [s / 2, s / 2],
  });
}

const USER_ICON = L.divIcon({
  html: `<div style="width:18px;height:18px;background:#2563eb;border:3px solid white;border-radius:50%;box-shadow:0 0 0 5px rgba(37,99,235,0.22),0 2px 8px rgba(0,0,0,0.25)"></div>`,
  className: "", iconSize: [18, 18], iconAnchor: [9, 9],
});

// A ZIP's centre: a plain pin, not a place.
const ZIP_ICON = L.divIcon({
  html: `<svg width="26" height="34" viewBox="0 0 26 34"><path d="M13 33C13 33 25 20.5 25 12.5A12 12 0 0 0 1 12.5C1 20.5 13 33 13 33Z"
    fill="#1f2937" stroke="#fff" stroke-width="2"/><circle cx="13" cy="12.5" r="4.5" fill="#fff"/></svg>`,
  className: "", iconSize: [26, 34], iconAnchor: [13, 33],
});

function PlaceCard({ place, miles, headingRef }: { place: ResourceRow; miles: number | undefined; headingRef: React.Ref<HTMLHeadingElement> }) {
  const cat = CAT[place.type];
  const county = place.source === "lacounty";
  const btn = "flex items-center justify-center gap-1.5 rounded-2xl text-xs font-bold px-2";
  // D12: OSM places get an anonymous OSM note; County places an email, only once the owner has an address.
  const report = !county ? osmNoteUrl(place) : REPORT_EMAIL ? countyReportMailto(place, REPORT_EMAIL) : null;
  return (
    <div className="space-y-2.5">
      <div>
        <p className="text-micro font-extrabold uppercase tracking-wider" style={{ color: cat.color }}>{cat.one}</p>
        <h3 ref={headingRef} tabIndex={-1} className="font-extrabold text-base leading-tight focus:outline-none">{place.name}{county && "*"}</h3>
        {place.address && <p className="text-xs text-muted-foreground mt-0.5">{place.address}</p>}
        {miles !== undefined && <p className="text-xs font-bold text-primary mt-0.5">{fmtMi(miles)} away</p>}
      </div>
      <div className="rounded-xl bg-muted px-3 py-2">
        <p className="text-sm font-bold">{place.hours || "No hours listed"}</p>
        <p className="text-mini text-muted-foreground">{county ? COUNTY_NOTE : HOURS_NOTE}</p>
      </div>
      <div className="flex gap-2">
        {place.phone && (
          <a href={`tel:${place.phone.replace(/[^\d+]/g, "")}`} className={`${btn} flex-1 bg-primary text-white`} style={{ minHeight: 44 }}>
            <Phone size={13} /> Call {formatPhone(place.phone)}
          </a>
        )}
        {place.website && (
          <a href={place.website} target="_blank" rel="noopener noreferrer" className={`${btn} bg-primary/10 text-primary`} style={{ minHeight: 44, minWidth: 88 }}>
            <Globe size={13} /> Website
          </a>
        )}
        <a href={directionsUrl(place)} target="_blank" rel="noopener noreferrer" className={`${btn} flex-1 bg-primary/10 text-primary`} style={{ minHeight: 44 }}>
          <Navigation size={13} /> Directions
        </a>
      </div>
      {report && (
        <div>
          <a href={report} target="_blank" rel="noopener noreferrer" className="inline-flex items-center text-xs font-bold text-primary" style={{ minHeight: 44 }}>Report a problem</a>
          {!county && <p className="text-micro text-muted-foreground">Say what changed: closed, moved, or new hours.</p>}
        </div>
      )}
      {county ? (
        <p className="text-micro text-muted-foreground leading-snug border-t border-border pt-2">
          From {COUNTY_CREDIT} · <a href={COUNTY_TERMS} target="_blank" rel="noopener noreferrer" className="underline">Terms</a>
        </p>
      ) : (
        <div className="flex items-center justify-between gap-3 border-t border-border pt-2">
          <p className="text-micro text-muted-foreground leading-snug">
            From <a href={osmUrl(place)} target="_blank" rel="noopener noreferrer" className="text-primary font-semibold">OpenStreetMap</a> (community-edited),
            as of {formatAsOf(place.as_of)} · <a href={COPYRIGHT} target="_blank" rel="noopener noreferrer" className="underline">© OpenStreetMap contributors</a>
          </p>
          <a href={osmEditUrl(place)} target="_blank" rel="noopener noreferrer" className="text-xs font-bold text-primary whitespace-nowrap">Fix it on OSM</a>
        </div>
      )}
    </div>
  );
}

export default function MapTab({ places, status }: { places: ResourceRow[]; status: "loading" | "live" | "offline" }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const userMarkerRef = useRef<L.Marker | null>(null);
  const circleRef = useRef<L.Circle | null>(null);
  const zipPinRef = useRef<L.Marker | null>(null);

  const [zipText, setZipText] = useState("");
  const [zipMissing, setZipMissing] = useState(false);
  // Where "near" means: a ZIP's point or the phone's position inside LA County; null = all of LA County, A–Z (D2).
  const [center, setCenter] = useState<{ point: [number, number]; label: string } | null>(null);
  const [radius, setRadius] = useState(10);
  const [userLoc, setUserLoc] = useState<[number, number] | null>(null);
  const [locationOff, setLocationOff] = useState(false);
  const [locating, setLocating] = useState(false);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [activeTypes, setActiveTypes] = useState<Set<PlaceType>>(new Set(TYPES));
  const [mapCenter, setMapCenter] = useState<[number, number]>(LA_CENTER);

  const outside = userLoc !== null && !inLaCounty(userLoc[0], userLoc[1]);
  // OSM places from the database plus the County's sites (static data, deduplicated against OSM: D6), once OSM loaded.
  const all: ResourceRow[] = useMemo(() => places.length ? [...places, ...countyPlaces(places)] : [], [places]);
  const typed = useMemo(() => all.filter(p => activeTypes.has(p.type)), [all, activeTypes]);
  const shown: (ResourceRow & { miles?: number })[] = useMemo(
    () => center ? withinMiles(typed, center.point, radius) : sortPlaces(typed, null), [typed, center, radius]);
  const selected = shown.find(p => p.id === selectedId) ?? null;
  // A place that leaves the list (smaller radius, type turned off) closes its card for good.
  useEffect(() => { if (selectedId !== null && !selected) setSelectedId(null); }, [selected, selectedId]);
  // The card's heading takes focus when it opens; the list header when it closes (the tapped button is gone).
  const cardRef = useRef<HTMLHeadingElement>(null);
  const listTitleRef = useRef<HTMLHeadingElement>(null);
  const wasOpen = useRef(false);
  useEffect(() => {
    if (selected) cardRef.current?.focus(); else if (wasOpen.current) listTitleRef.current?.focus();
    wasOpen.current = !!selected;
  }, [!!selected]);
  const countyShown = shown.some(p => p.source === "lacounty");
  const asOf = places[0] ? formatAsOf(places[0].as_of) : "";
  const nextRadius = RADII.find(r => r > radius);

  // Map: created once, showing LA County. Leaflet's own attribution box is off: the credit is ours, under the list
  // (ODbL, tile usage policy). The centre feeds "Add it on OpenStreetMap" (D10).
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    const map = L.map(containerRef.current, { zoomControl: false, attributionControl: false }).fitBounds(LA_BOUNDS, FIT);
    L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", { maxZoom: 19 }).addTo(map);
    const onMoveEnd = () => { const c = map.getCenter(); setMapCenter([c.lat, c.lng]); };
    map.on("moveend", onMoveEnd);
    mapRef.current = map;
    return () => {
      map.off("moveend", onMoveEnd);
      mapRef.current = null;
      // Leaving the tab mid-zoom: Leaflet ends a zoom on a 250 ms timer that reads the map's panes, which remove()
      // deletes ("_leaflet_pos" of undefined). Let it finish first.
      setTimeout(() => map.remove(), 400);
    };
  }, []);

  // Pins: rebuilt when the shown places or the selection change.
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const cluster = (L as any).markerClusterGroup({ iconCreateFunction: clusterIcon, maxClusterRadius: 48, showCoverageOnHover: false, chunkedLoading: true,
      disableClusteringAtZoom: 16 }); // close up, every pin shows (two pantries can share a street corner)
    for (const p of shown) {
      const marker = L.marker([p.latitude, p.longitude], { icon: pinIcon(p.type, p.id === selectedId), title: p.name });
      marker.on("click", () => select(p));
      cluster.addLayer(marker);
    }
    cluster.addTo(map);
    return () => { map.removeLayer(cluster); }; // also stops its chunked loading when the tab closes
  }, [shown, selectedId]);

  // The search circle (and a ZIP's pin); the map zooms to fit it, or back to LA County (D1, D2).
  useEffect(() => {
    circleRef.current?.remove(); circleRef.current = null;
    zipPinRef.current?.remove(); zipPinRef.current = null;
    const map = mapRef.current;
    if (!map) return;
    if (center) {
      circleRef.current = L.circle(center.point, { radius: radius * METERS_PER_MI, color: "#1a5c39", weight: 2, fillOpacity: 0.06, interactive: false }).addTo(map);
      if (center.label !== YOUR_LOCATION) zipPinRef.current = L.marker(center.point, { icon: ZIP_ICON, interactive: false, keyboard: false }).addTo(map);
    }
    refit();
  }, [center, radius]);

  // The blue dot.
  useEffect(() => {
    userMarkerRef.current?.remove();
    userMarkerRef.current = userLoc && mapRef.current ? L.marker(userLoc, { icon: USER_ICON, interactive: false, keyboard: false }).addTo(mapRef.current) : null;
  }, [userLoc]);

  function refit() {
    const map = mapRef.current;
    map?.fitBounds(circleRef.current ? circleRef.current.getBounds() : LA_BOUNDS, FIT);
  }

  function select(p: ResourceRow) {
    setSelectedId(p.id);
    mapRef.current?.flyTo([p.latitude, p.longitude], Math.max(mapRef.current.getZoom(), 16), { duration: 0.7 });
  }

  function closeCard() {
    setSelectedId(null);
    refit();
  }

  // The ZIP is looked up in the app's own table: typing one sends nothing (D3).
  function findZip(zip: string) {
    const point = zipPoint(zip);
    setZipMissing(!point);
    if (!point) return;
    setCenter({ point, label: zip });
    setUserLoc(null); setLocationOff(false); setSelectedId(null);
  }

  function typeZip(raw: string) {
    const zip = raw.replace(/\D/g, "").slice(0, 5);
    setZipText(zip);
    if (zip.length === 5) findZip(zip); else setZipMissing(false);
  }

  // Location only on tap; never stored or sent anywhere.
  function locate() {
    if (!navigator.geolocation) { setLocationOff(true); return; }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => {
        const pos: [number, number] = [coords.latitude, coords.longitude];
        setUserLoc(pos); setLocationOff(false); setLocating(false);
        setZipText(""); setZipMissing(false); setSelectedId(null);
        setCenter(inLaCounty(pos[0], pos[1]) ? { point: pos, label: YOUR_LOCATION } : null); // distances only mean something in LA County
      },
      () => { // drop an earlier position too, but keep a ZIP search
        setUserLoc(null); setCenter(c => c?.label === YOUR_LOCATION ? null : c); setLocationOff(true); setLocating(false);
      },
      { timeout: 8000 },
    );
  }

  function backToLa() {
    setUserLoc(null);
    refit();
  }

  const toggle = (t: PlaceType) => setActiveTypes(prev => { const next = new Set(prev); next.has(t) ? next.delete(t) : next.add(t); return next; });
  const roundBtn = "w-11 h-11 bg-white rounded-2xl shadow-lg border border-gray-200 flex items-center justify-center text-gray-700";
  const header = !center ? "Food places in LA County"
    : shown.length === 0 && typed.length > 0 ? `Nothing within ${radius} mi`
    : `${shown.length} place${shown.length === 1 ? "" : "s"} within ${radius} mi of ${center.label}`;

  return (
    <div className="h-full flex flex-col bg-white">
      {/* Search: ZIP or My location, then the radius (D1) */}
      <div className="flex-shrink-0 px-4 pt-3 pb-2.5 space-y-2 border-b border-border">
        <div className="flex gap-2">
          <input aria-label="ZIP code" inputMode="numeric" autoComplete="postal-code" maxLength={5} placeholder="ZIP code"
            value={zipText} onChange={e => typeZip(e.target.value)} onKeyDown={e => e.key === "Enter" && findZip(zipText)}
            className="flex-1 min-w-0 rounded-xl bg-muted px-3.5 text-sm font-semibold placeholder:text-muted-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            style={{ minHeight: 44 }} />
          <button onClick={locate} aria-label="My location"
            className="flex items-center gap-1.5 rounded-xl bg-primary/10 text-primary text-sm font-bold px-3 flex-shrink-0" style={{ minHeight: 44 }}>
            <Navigation size={16} className={locating ? "animate-pulse" : ""} /> My location
          </button>
        </div>
        {/* Always in the page, so screen readers announce the text when it appears. */}
        <p role="status" className={zipMissing || locationOff ? "text-xs font-semibold" : "sr-only"}>
          {[zipMissing && "EcoGo doesn't have that ZIP. The map covers LA County and nearby.", locationOff && "Location is off. Showing Los Angeles."].filter(Boolean).join(" ")}
        </p>
        {/* Native radios: arrow keys and one tab stop come free; each label is a 44 px chip. */}
        <div role="radiogroup" aria-label="Search radius" className="grid grid-cols-4 gap-1.5">
          {RADII.map(r => (
            <label key={r} className="min-h-[44px] flex items-center justify-center rounded-xl border border-border text-xs font-bold cursor-pointer has-checked:bg-primary has-checked:text-primary-foreground has-checked:border-primary has-focus-visible:ring-2 has-focus-visible:ring-ring">
              <input type="radio" name="radius" value={r} checked={radius === r} onChange={() => setRadius(r)} className="sr-only" />
              {r} mi
            </label>
          ))}
        </div>
      </div>

      {/* The map, capped so the list keeps room at large text sizes (D1) */}
      <div className="relative flex-shrink-0 bg-gray-100" style={{ height: "clamp(160px, 38vh, 320px)" }}>
        <div ref={containerRef} style={{ position: "absolute", inset: 0, zIndex: 0 }} />
        <div className="absolute right-2.5 top-2.5 z-[400] flex flex-col gap-1.5">
          <button onClick={() => mapRef.current?.zoomIn()} aria-label="Zoom in" className={`${roundBtn} text-xl font-bold`}>+</button>
          <button onClick={() => mapRef.current?.zoomOut()} aria-label="Zoom out" className={`${roundBtn} text-xl font-bold`}>−</button>
        </div>
        {places.length === 0 && (
          <div className="absolute inset-x-6 top-1/2 -translate-y-1/2 z-[400] bg-white rounded-2xl shadow-xl p-3 text-center">
            <MapPin size={20} className="mx-auto mb-1 text-muted-foreground" />
            <p className="text-sm font-bold">{status === "loading" ? "Loading places…" : "Places need a connection"}</p>
          </div>
        )}
      </div>

      {/* The list, or one place in its place (D1) */}
      <section aria-labelledby="map-list-title" className="flex-1 min-h-0 overflow-y-auto px-4 pt-3 pb-8" style={{ scrollbarWidth: "none" }}>
        {selected ? (<>
          <button onClick={closeCard} aria-label="Back to the list" className="flex items-center gap-1.5 text-sm font-bold text-primary -ml-1 mb-2 px-1" style={{ minHeight: 44 }}>
            <ArrowLeft size={16} /> Back
          </button>
          <PlaceCard place={selected} miles={selected.miles} headingRef={cardRef} />
        </>) : (<>
          {outside && (
            <div className="rounded-2xl border border-border p-3.5 mb-3 space-y-2">
              <p className="text-base font-extrabold">The map covers LA County for now</p>
              <p className="text-xs text-muted-foreground leading-relaxed">You're outside the area EcoGo has places for. Your location stays on this phone.</p>
              <button onClick={backToLa} className="w-full rounded-2xl bg-primary text-white text-sm font-bold" style={{ minHeight: 44 }}>Back to LA</button>
            </div>
          )}
          <h3 id="map-list-title" ref={listTitleRef} tabIndex={-1} className="font-extrabold text-sm focus:outline-none">{header}</h3>
          {!center && <p className="text-micro text-muted-foreground">Enter a ZIP or tap My location to see what's near you</p>}
          <div className="flex gap-1.5 flex-wrap mt-2 mb-1">
            {TYPES.map(t => {
              const on = activeTypes.has(t);
              return (
                <button key={t} onClick={() => toggle(t)} aria-pressed={on}
                  className="rounded-full text-xs font-bold px-3 border"
                  style={{ minHeight: 44, background: on ? CAT[t].color : "#fff", color: on ? "#fff" : "#4b5563", borderColor: on ? CAT[t].color : "#d1d5db" }}>
                  {CAT[t].label}
                </button>
              );
            })}
          </div>
          {typed.length === 0 && places.length > 0 && <p className="text-xs text-muted-foreground py-4 text-center">Pick a type above to see places.</p>}
          {center && shown.length === 0 && typed.length > 0 && nextRadius && (
            <button onClick={() => setRadius(nextRadius)} className="w-full rounded-2xl bg-primary/10 text-primary text-sm font-bold my-2" style={{ minHeight: 44 }}>
              Show {nextRadius} mi
            </button>
          )}
          <ul aria-label="Places">
            {shown.map(p => {
              const cat = CAT[p.type];
              return (
                <li key={p.id}>
                  <button onClick={() => select(p)} className="w-full flex items-center gap-2.5 px-1 py-1.5 text-left border-b border-gray-100" style={{ minHeight: 44 }}>
                    <span className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: `${cat.color}18` }}>
                      <cat.Icon size={15} style={{ color: cat.color }} />
                    </span>
                    <span className="flex-1 min-w-0">
                      <span className="block text-xs font-bold truncate">{p.name}{p.source === "lacounty" && "*"}</span>
                      <span className="block text-micro text-muted-foreground truncate">{p.hours || "No hours listed"}</span>
                    </span>
                    {p.miles !== undefined && <span className="text-micro font-bold text-primary flex-shrink-0">{fmtMi(p.miles)}</span>}
                  </button>
                </li>
              );
            })}
          </ul>
          {/* D10: a missing place goes into OSM, at the map's centre; EcoGo stores and sends nothing. */}
          <p className="text-xs mt-3">
            Missing a place?{" "}
            <a href={`https://www.openstreetmap.org/edit#map=18/${mapCenter[0].toFixed(5)}/${mapCenter[1].toFixed(5)}`}
              target="_blank" rel="noopener noreferrer" className="text-primary font-bold">Add it on OpenStreetMap</a>
          </p>
          <p className="text-micro text-muted-foreground">Add it as Social facility → Food bank. EcoGo shows it after the next update.</p>
          {countyShown && <p className="text-micro text-muted-foreground leading-snug mt-2">{COUNTY_NOTE}</p>}
          <p className="text-micro text-muted-foreground leading-snug mt-2">
            Places from <a href={COPYRIGHT} target="_blank" rel="noopener noreferrer" className="text-primary font-semibold">© OpenStreetMap contributors</a> (community-edited){asOf && `, as of ${asOf}`}. {HOURS_NOTE}
            {countyShown && <> Sites marked * from {COUNTY_CREDIT} (<a href={COUNTY_TERMS} target="_blank" rel="noopener noreferrer" className="underline">terms</a>).</>}
          </p>
        </>)}
      </section>
    </div>
  );
}
