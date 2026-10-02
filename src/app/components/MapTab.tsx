// ─────────────────────────────────────────────────────────────────────────────
// MapTab.tsx — Los Angeles County food places from OpenStreetMap (M9). Pure Leaflet, no react-leaflet: the map is
// driven imperatively through refs. Spec: docs/superpowers/specs/2026-10-02-m9-real-map-design.md.
// Only what OSM lists is shown, labelled as community-edited and dated; no ratings, no open/closed guess.
// ─────────────────────────────────────────────────────────────────────────────

import "leaflet/dist/leaflet.css";
import "leaflet.markercluster/dist/MarkerCluster.css";
import "leaflet.markercluster/dist/MarkerCluster.Default.css";

import { useState, useEffect, useMemo, useRef } from "react";
import L from "leaflet";
import "leaflet.markercluster";
import { Navigation, Phone, Globe, MapPin, X, Utensils, ShoppingBag, Leaf } from "lucide-react";
import type { ResourceRow } from "../../lib/catalog";
import {
  LA_CENTER, inLaCounty, distanceKm, sortPlaces, osmUrl, osmEditUrl, directionsUrl, formatAsOf, formatPhone,
  type PlaceType,
} from "../../lib/osmPlaces";

const CAT: Record<PlaceType, { label: string; one: string; color: string; letter: string; Icon: React.ElementType }> = {
  "food-bank":        { label: "Food banks",      one: "Food bank",        color: "#1a5c39", letter: "F", Icon: Utensils },
  "farmers-market":   { label: "Farmers markets", one: "Farmers market",   color: "#8a5a12", letter: "M", Icon: ShoppingBag },
  "community-garden": { label: "Gardens",         one: "Community garden", color: "#2f6f86", letter: "G", Icon: Leaf },
};
const TYPES = Object.keys(CAT) as PlaceType[];
const LA_ZOOM = 11;
const COPYRIGHT = "https://www.openstreetmap.org/copyright";
const HOURS_NOTE = "Hours can change — check before you go.";

const miles = (km: number) => { const mi = km * 0.621371; return mi < 0.1 ? `${Math.round(mi * 5280)} ft` : `${mi.toFixed(1)} mi`; };

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

function PlaceCard({ place, distance, onClose }: { place: ResourceRow; distance: number | null; onClose: () => void }) {
  const cat = CAT[place.type];
  const btn = "flex items-center justify-center gap-1.5 rounded-2xl text-xs font-bold px-2";
  return (
    <div className="p-4 space-y-2.5">
      <div className="flex items-start gap-3">
        <div className="flex-1 min-w-0">
          <p className="text-[10px] font-extrabold uppercase tracking-wider" style={{ color: cat.color }}>{cat.one}</p>
          <h3 className="font-extrabold text-base leading-tight">{place.name}</h3>
          {place.address && <p className="text-xs text-muted-foreground mt-0.5">{place.address}</p>}
          {distance !== null && <p className="text-xs font-bold text-primary mt-0.5">{miles(distance)} away</p>}
        </div>
        <button onClick={onClose} aria-label="Close" className="w-11 h-11 rounded-full bg-gray-100 flex items-center justify-center flex-shrink-0"><X size={16} /></button>
      </div>
      <div className="rounded-xl bg-muted px-3 py-2">
        <p className="text-sm font-bold">{place.hours || "No hours listed"}</p>
        <p className="text-[11px] text-muted-foreground">{HOURS_NOTE}</p>
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
      <div className="flex items-center justify-between gap-3 border-t border-border pt-2">
        <p className="text-[10.5px] text-muted-foreground leading-snug">
          From <a href={osmUrl(place)} target="_blank" rel="noopener noreferrer" className="text-primary font-semibold">OpenStreetMap</a> (community-edited),
          as of {formatAsOf(place.as_of)} · <a href={COPYRIGHT} target="_blank" rel="noopener noreferrer" className="underline">© OpenStreetMap contributors</a>
        </p>
        <a href={osmEditUrl(place)} target="_blank" rel="noopener noreferrer" className="text-xs font-bold text-primary whitespace-nowrap">Fix it on OSM</a>
      </div>
    </div>
  );
}

export default function MapTab({ places, status }: { places: ResourceRow[]; status: "loading" | "live" | "offline" }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const clusterRef = useRef<any>(null);
  const userMarkerRef = useRef<L.Marker | null>(null);

  const [userLoc, setUserLoc] = useState<[number, number] | null>(null);
  const [locateNote, setLocateNote] = useState<"off" | null>(null);
  const [locating, setLocating] = useState(false);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [activeTypes, setActiveTypes] = useState<Set<PlaceType>>(new Set(TYPES));

  const outside = userLoc !== null && !inLaCounty(userLoc[0], userLoc[1]);
  const near = userLoc && !outside ? userLoc : null; // distances only mean something inside LA County
  const shown = useMemo(() => sortPlaces(places.filter(p => activeTypes.has(p.type)), near), [places, activeTypes, near]);
  const selected = shown.find(p => p.id === selectedId) ?? null;
  const asOf = places[0] ? formatAsOf(places[0].as_of) : "";

  // Map: created once. Leaflet's own attribution box would sit under the bottom sheet, so the credit is ours, always
  // visible in the sheet (ODbL, tile usage policy).
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    const map = L.map(containerRef.current, { center: LA_CENTER, zoom: LA_ZOOM, zoomControl: false, attributionControl: false });
    L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", { maxZoom: 19 }).addTo(map);
    mapRef.current = map;
    return () => { map.remove(); mapRef.current = null; };
  }, []);

  // Pins: rebuilt when the shown places or the selection change.
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    if (clusterRef.current) map.removeLayer(clusterRef.current);
    const cluster = (L as any).markerClusterGroup({ iconCreateFunction: clusterIcon, maxClusterRadius: 48, showCoverageOnHover: false, chunkedLoading: true,
      disableClusteringAtZoom: 16 }); // close up, every pin shows (two pantries can share a street corner)
    for (const p of shown) {
      const marker = L.marker([p.latitude, p.longitude], { icon: pinIcon(p.type, p.id === selectedId), title: p.name });
      marker.on("click", () => select(p));
      cluster.addLayer(marker);
    }
    cluster.addTo(map);
    clusterRef.current = cluster;
  }, [shown, selectedId]);

  // The blue dot.
  useEffect(() => {
    userMarkerRef.current?.remove();
    userMarkerRef.current = userLoc && mapRef.current ? L.marker(userLoc, { icon: USER_ICON }).addTo(mapRef.current) : null;
  }, [userLoc]);

  function select(p: ResourceRow) {
    setSelectedId(p.id);
    mapRef.current?.flyTo([p.latitude, p.longitude], Math.max(mapRef.current.getZoom(), 16), { duration: 0.7 });
  }

  const toLa = () => mapRef.current?.flyTo(LA_CENTER, LA_ZOOM, { duration: 1 });

  // Location only on tap; never stored or sent anywhere.
  function locate() {
    if (!navigator.geolocation) { setLocateNote("off"); return; }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => {
        const pos: [number, number] = [coords.latitude, coords.longitude];
        setUserLoc(pos); setLocateNote(null); setLocating(false);
        mapRef.current?.flyTo(pos, inLaCounty(pos[0], pos[1]) ? 14 : 10, { duration: 1 });
      },
      () => { setLocateNote("off"); setLocating(false); toLa(); },
      { timeout: 8000 },
    );
  }

  function backToLa() {
    setUserLoc(null);
    toLa();
  }

  const toggle = (t: PlaceType) => setActiveTypes(prev => { const next = new Set(prev); next.has(t) ? next.delete(t) : next.add(t); return next; });
  const roundBtn = "w-11 h-11 bg-white rounded-2xl shadow-lg border border-gray-200 flex items-center justify-center text-gray-700";

  return (
    <div className="h-full relative overflow-hidden bg-gray-100">
      <div ref={containerRef} style={{ position: "absolute", inset: 0, zIndex: 0 }} />

      {/* Type chips */}
      <div className="absolute top-3 left-3 right-3 z-[400] flex gap-1.5">
        {TYPES.map(t => {
          const on = activeTypes.has(t);
          return (
            <button key={t} onClick={() => toggle(t)} aria-pressed={on}
              className="flex-1 rounded-full text-xs font-bold shadow-md px-2"
              style={{ minHeight: 44, background: on ? CAT[t].color : "#fff", color: on ? "#fff" : "#4b5563" }}>
              {CAT[t].label}
            </button>
          );
        })}
      </div>

      {/* Zoom + My location (under the chips, clear of the sheet) */}
      <div className="absolute right-3 top-[68px] z-[400] flex flex-col gap-1.5">
        <button onClick={() => mapRef.current?.zoomIn()} aria-label="Zoom in" className={`${roundBtn} text-xl font-bold`}>+</button>
        <button onClick={() => mapRef.current?.zoomOut()} aria-label="Zoom out" className={`${roundBtn} text-xl font-bold`}>−</button>
        <button onClick={locate} aria-label="My location" className={roundBtn}>
          <Navigation size={18} className={locating ? "text-blue-400 animate-pulse" : "text-blue-600"} />
        </button>
      </div>

      {/* Notes over the map */}
      {places.length === 0 && (
        <div className="absolute inset-x-6 top-1/3 z-[400] bg-white rounded-2xl shadow-xl p-4 text-center">
          <MapPin size={22} className="mx-auto mb-1.5 text-muted-foreground" />
          <p className="text-sm font-bold">{status === "loading" ? "Loading places…" : "Places need a connection"}</p>
        </div>
      )}
      {outside && (
        <div className="absolute inset-x-4 top-1/3 z-[450] bg-white rounded-2xl shadow-xl p-4 space-y-2">
          <p className="text-base font-extrabold">The map covers LA County for now</p>
          <p className="text-xs text-muted-foreground leading-relaxed">You're outside the area EcoGo has places for. Your location stays on this phone.</p>
          <button onClick={backToLa} className="w-full rounded-2xl bg-primary text-white text-sm font-bold" style={{ minHeight: 44 }}>Back to LA</button>
        </div>
      )}
      {locateNote === "off" && (
        <div className="absolute left-3 right-16 top-[68px] z-[400] bg-white rounded-xl shadow-md px-3 py-2 text-xs font-semibold">
          Location is off. Showing Los Angeles.
        </div>
      )}

      {/* Bottom sheet: the list, or one place */}
      <div className="absolute bottom-0 left-0 right-0 z-[400] bg-white rounded-t-3xl shadow-[0_-4px_24px_rgba(0,0,0,0.12)]">
        {selected ? (
          <PlaceCard place={selected} distance={near ? distanceKm(near[0], near[1], selected.latitude, selected.longitude) : null} onClose={() => setSelectedId(null)} />
        ) : (
          <div className="px-4 pt-3 pb-3">
            <div className="mb-1.5">
              <h3 className="font-extrabold text-sm">Food places in LA County</h3>
              <p className="text-[10.5px] text-muted-foreground">{near ? "Nearest first" : "A–Z · tap My location to sort by distance"}</p>
            </div>
            <div className="max-h-40 overflow-y-auto -mx-1" style={{ scrollbarWidth: "none" }}>
              {shown.length === 0 && places.length > 0 && <p className="text-xs text-muted-foreground py-4 text-center">Pick a type above to see places.</p>}
              {shown.map(p => {
                const cat = CAT[p.type];
                return (
                  <button key={p.id} onClick={() => select(p)} className="w-full flex items-center gap-2.5 px-1 py-1.5 text-left border-b border-gray-100 last:border-0">
                    <span className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: `${cat.color}18` }}>
                      <cat.Icon size={15} style={{ color: cat.color }} />
                    </span>
                    <span className="flex-1 min-w-0">
                      <span className="block text-xs font-bold truncate">{p.name}</span>
                      <span className="block text-[10.5px] text-muted-foreground truncate">{p.hours || "No hours listed"}</span>
                    </span>
                    {near && <span className="text-[10px] font-bold text-primary flex-shrink-0">{miles(distanceKm(near[0], near[1], p.latitude, p.longitude))}</span>}
                  </button>
                );
              })}
            </div>
            <p className="text-[10.5px] text-muted-foreground leading-snug mt-2">
              Places from <a href={COPYRIGHT} target="_blank" rel="noopener noreferrer" className="text-primary font-semibold">© OpenStreetMap contributors</a> (community-edited){asOf && `, as of ${asOf}`}. {HOURS_NOTE}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
