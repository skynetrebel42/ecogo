// ─────────────────────────────────────────────────────────────────────────────
// MapTab.tsx — Interactive Resource Map (pure Leaflet, no react-leaflet)
// Uses useRef + useEffect to manage the L.Map imperatively, avoiding all
// react-leaflet React-context compatibility issues.
// ─────────────────────────────────────────────────────────────────────────────

import "leaflet/dist/leaflet.css";
import "leaflet.markercluster/dist/MarkerCluster.css";
import "leaflet.markercluster/dist/MarkerCluster.Default.css";

import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import L from "leaflet";
import "leaflet.markercluster";
import {
  Filter, Navigation, Phone, Clock, X, ChevronDown, ChevronUp,
  Star, MapPin, Wifi, Bike, Shirt, Building2, Utensils,
  Package, Leaf, ShoppingBag, Heart, Zap, AlertCircle,
} from "lucide-react";

// ─── Leaflet default-icon fix (Vite mangles asset URLs) ──────────────────────
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({ iconUrl: "", shadowUrl: "", iconRetinaUrl: "" });

// ─── Types ────────────────────────────────────────────────────────────────────

type MapResourceType =
  | "food-bank" | "community-garden" | "farmers-market" | "wifi"
  | "restroom" | "bike-repair" | "donation" | "grocery-store"
  | "health-clinic" | "thrift-store" | "sustainable-business" | "clothing";

interface MapResource {
  id: number;
  name: string;
  type: MapResourceType;
  address: string;
  hours: string;
  phone: string | null;
  description: string;
  lat: number;
  lng: number;
  rating: number;
}

interface MapTabProps {
  resources?: { id: number; name: string; hours: string; phone?: string | null; description: string }[];
}

// ─── Category Config ──────────────────────────────────────────────────────────

type CatConfig = { label: string; color: string; letter: string; Icon: React.ElementType };

const CAT: Record<MapResourceType, CatConfig> = {
  "food-bank":            { label: "Food Banks",             color: "#16a34a", letter: "F", Icon: Utensils },
  "community-garden":     { label: "Community Gardens",      color: "#15803d", letter: "G", Icon: Leaf },
  "farmers-market":       { label: "Farmers Markets",        color: "#65a30d", letter: "M", Icon: ShoppingBag },
  "wifi":                 { label: "Free Wi-Fi",             color: "#d97706", letter: "W", Icon: Wifi },
  "restroom":             { label: "Public Restrooms",       color: "#0891b2", letter: "R", Icon: Building2 },
  "bike-repair":          { label: "Bike Repair",            color: "#ea580c", letter: "B", Icon: Bike },
  "donation":             { label: "Donation Centers",       color: "#2563eb", letter: "D", Icon: Package },
  "grocery-store":        { label: "Affordable Groceries",   color: "#7c3aed", letter: "A", Icon: ShoppingBag },
  "health-clinic":        { label: "Health Clinics",         color: "#dc2626", letter: "H", Icon: Heart },
  "thrift-store":         { label: "Thrift Stores",          color: "#9333ea", letter: "T", Icon: Shirt },
  "sustainable-business": { label: "Sustainable Businesses", color: "#059669", letter: "S", Icon: Zap },
  "clothing":             { label: "Clothing Drives",        color: "#7e22ce", letter: "C", Icon: Shirt },
};

const ALL_TYPES = new Set<MapResourceType>(Object.keys(CAT) as MapResourceType[]);

// ─── Constants ────────────────────────────────────────────────────────────────

const DEFAULT_CENTER: [number, number] = [41.8827, -87.6233];
const DEFAULT_ZOOM = 14;
const RADIUS_OPTIONS = [1, 5, 10, 25, 50] as const;
const SORT_OPTIONS = [
  { value: "distance", label: "Distance" },
  { value: "score",    label: "Smart Score" },
  { value: "rating",   label: "Highest Rated" },
  { value: "open",     label: "Open Now" },
];

// ─── Static Resource Data ─────────────────────────────────────────────────────

const BASE_RESOURCES: MapResource[] = [
  { id: 1,  name: "Community Food Pantry",     type: "food-bank",            lat: 41.8780, lng: -87.6320, address: "142 Oak Street",       hours: "Mon–Fri 9am–5pm",      phone: "(555) 234-5678", description: "Hot meals and dry goods. No ID required.",                          rating: 4.8 },
  { id: 2,  name: "Second Harvest Hub",        type: "food-bank",            lat: 41.8860, lng: -87.6180, address: "389 Maple Avenue",     hours: "Daily 8am–7pm",        phone: "(555) 876-5432", description: "Fresh produce and pantry staples. 200+ families weekly.",          rating: 4.6 },
  { id: 3,  name: "Goodwill Drop-Off",         type: "donation",             lat: 41.8920, lng: -87.6410, address: "55 Central Boulevard", hours: "Mon–Sat 8am–8pm",      phone: "(555) 345-6789", description: "Clothing, furniture, and electronics. Tax receipt provided.",       rating: 4.3 },
  { id: 4,  name: "Habitat ReStore",           type: "donation",             lat: 41.8700, lng: -87.6460, address: "201 Pine Road",        hours: "Tue–Sat 9am–6pm",      phone: "(555) 456-7890", description: "Home improvement items and appliances.",                            rating: 4.4 },
  { id: 5,  name: "Winter Warmth Drive",       type: "clothing",             lat: 41.8820, lng: -87.6250, address: "78 Elm Street",        hours: "Wed–Sun 10am–4pm",     phone: "(555) 567-8901", description: "Coats, hats, and warm clothing for all ages.",                      rating: 4.7 },
  { id: 6,  name: "Thread & Share Co-op",      type: "clothing",             lat: 41.8880, lng: -87.6140, address: "315 Birch Way",        hours: "Mon, Wed, Fri 12–6pm", phone: "(555) 678-9012", description: "Free clothing exchange — take what you need.",                      rating: 4.5 },
  { id: 7,  name: "Community Bike Shop",       type: "bike-repair",          lat: 41.8750, lng: -87.6510, address: "92 River Drive",       hours: "Sat–Sun 10am–3pm",     phone: "(555) 789-0123", description: "Free repairs, tire changes, and safety checks.",                    rating: 4.9 },
  { id: 8,  name: "Pedal Forward Workshop",    type: "bike-repair",          lat: 41.8790, lng: -87.6210, address: "420 Lake Avenue",      hours: "Tue, Thu 4pm–8pm",     phone: "(555) 890-1234", description: "DIY repair station with tools and spare parts.",                    rating: 4.6 },
  { id: 9,  name: "City Hall Restrooms",       type: "restroom",             lat: 41.8830, lng: -87.6300, address: "1 Civic Plaza",        hours: "Mon–Fri 7am–9pm",      phone: null,             description: "Clean, accessible public restrooms. ADA compliant.",               rating: 3.9 },
  { id: 10, name: "Central Park Facilities",   type: "restroom",             lat: 41.8870, lng: -87.6360, address: "Park Boulevard",       hours: "Daily 6am–10pm",       phone: null,             description: "Restrooms and water fountains throughout the park.",                rating: 4.1 },
  { id: 11, name: "Public Library WiFi",       type: "wifi",                 lat: 41.8910, lng: -87.6220, address: "250 Knowledge Drive",  hours: "Mon–Sat 8am–8pm",      phone: "(555) 901-2345", description: "High-speed internet. Computers available.",                         rating: 4.7 },
  { id: 12, name: "Community Center WiFi",     type: "wifi",                 lat: 41.8760, lng: -87.6290, address: "88 Unity Avenue",      hours: "Daily 7am–11pm",       phone: "(555) 012-3456", description: "Free WiFi, charging stations, and terminals.",                      rating: 4.5 },
  { id: 13, name: "Lincoln Park Garden",       type: "community-garden",     lat: 41.8840, lng: -87.6420, address: "Lincoln Park East",    hours: "Daily dawn–dusk",      phone: null,             description: "Community vegetable and herb garden. Plots available.",             rating: 4.8 },
  { id: 14, name: "Saturday Farmers Market",   type: "farmers-market",       lat: 41.8900, lng: -87.6270, address: "Civic Center Plaza",   hours: "Sat 7am–1pm",          phone: "(555) 123-4567", description: "Local produce, honey, eggs, and artisan goods.",                    rating: 4.9 },
  { id: 15, name: "FreshGo Community Grocer",  type: "grocery-store",        lat: 41.8730, lng: -87.6390, address: "512 Grove Street",     hours: "Daily 7am–10pm",       phone: "(555) 234-6789", description: "Affordable groceries. EBT and WIC accepted.",                       rating: 4.2 },
  { id: 16, name: "Southside Health Clinic",   type: "health-clinic",        lat: 41.8800, lng: -87.6160, address: "80 Wellness Way",      hours: "Mon–Fri 8am–6pm",      phone: "(555) 345-7890", description: "Free and sliding-scale primary care. No insurance required.",      rating: 4.6 },
  { id: 17, name: "Second Story Thrift",       type: "thrift-store",         lat: 41.8930, lng: -87.6330, address: "211 Commerce Avenue",  hours: "Mon–Sat 9am–7pm",      phone: "(555) 456-8901", description: "Quality second-hand clothing, books, and housewares.",             rating: 4.4 },
  { id: 18, name: "GreenRoot Cooperative",     type: "sustainable-business", lat: 41.8690, lng: -87.6230, address: "44 Earth Lane",        hours: "Mon–Sat 8am–8pm",      phone: "(555) 567-9012", description: "Worker-owned zero-waste grocery and supplies.",                     rating: 4.8 },
];

// ─── Utilities ────────────────────────────────────────────────────────────────

function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
    Math.cos((lat2 * Math.PI) / 180) *
    Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function kmToMiles(km: number): string {
  const mi = km * 0.621371;
  return mi < 0.1 ? `${Math.round(mi * 5280)} ft` : `${mi.toFixed(1)} mi`;
}

function checkIsOpen(hours: string): boolean {
  const h = hours.toLowerCase();
  const now = new Date();
  const day = now.getDay();
  const current = now.getHours() + now.getMinutes() / 60;
  const parseH = (s: string): number => {
    const m = s.match(/(\d+)(?::(\d+))?(am|pm)/);
    if (!m) return NaN;
    let hr = parseInt(m[1]);
    if (m[3] === "pm" && hr !== 12) hr += 12;
    if (m[3] === "am" && hr === 12) hr = 0;
    return hr + (m[2] ? parseInt(m[2]) / 60 : 0);
  };
  const tm = h.match(/(\d+(?::\d+)?(?:am|pm))[–\-](\d+(?::\d+)?(?:am|pm))/);
  const o = tm ? parseH(tm[1]) : 9;
  const c = tm ? parseH(tm[2]) : 17;
  const inT = !isNaN(o) && !isNaN(c) && current >= o && current < c;
  if (h.includes("daily")) return inT;
  if (h.includes("dawn")) return current >= 5.5 && current < 21;
  if (/mon[–-]fri/.test(h))   return day >= 1 && day <= 5 && inT;
  if (/mon[–-]sat/.test(h))   return day >= 1 && day <= 6 && inT;
  if (/tue[–-]sat/.test(h))   return day >= 2 && day <= 6 && inT;
  if (/wed[–-]sun/.test(h))   return (day >= 3 || day === 0) && inT;
  if (/sat[–-]sun/.test(h))   return (day === 0 || day === 6) && inT;
  if (h.startsWith("sat "))   return day === 6 && inT;
  if (/mon.*wed.*fri/.test(h)) return [1, 3, 5].includes(day) && inT;
  if (/tue.*thu/.test(h))     return [2, 4].includes(day) && inT;
  return inT;
}

// ─── Leaflet Icon Factories ───────────────────────────────────────────────────

function createMarkerIcon(type: MapResourceType, selected: boolean): L.DivIcon {
  const { color, letter } = CAT[type];
  const s = selected ? 40 : 30;
  return L.divIcon({
    html: `<div style="
      width:${s}px;height:${s}px;
      background:${selected ? color : "#fff"};
      border:2.5px solid ${color};border-radius:50%;
      display:flex;align-items:center;justify-content:center;
      box-shadow:0 2px 10px rgba(0,0,0,${selected ? 0.35 : 0.18});
      font-weight:900;font-size:${Math.round(s * 0.36)}px;
      color:${selected ? "#fff" : color};font-family:sans-serif;
      ${selected ? "transform:scale(1.08);" : ""}
    ">${letter}</div>`,
    className: "",
    iconSize: [s, s],
    iconAnchor: [s / 2, s / 2],
  });
}

function createClusterIcon(cluster: any): L.DivIcon {
  const n: number = cluster.getChildCount();
  const s = n < 10 ? 36 : n < 50 ? 42 : 48;
  return L.divIcon({
    html: `<div style="
      width:${s}px;height:${s}px;
      background:#1a5c39;color:#fff;
      border:2.5px solid #fff;border-radius:50%;
      display:flex;align-items:center;justify-content:center;
      font-weight:900;font-size:${Math.round(s * 0.35)}px;
      box-shadow:0 2px 10px rgba(0,0,0,0.3);
    ">${n}</div>`,
    className: "",
    iconSize: [s, s],
    iconAnchor: [s / 2, s / 2],
  });
}

const USER_ICON = L.divIcon({
  html: `<div style="width:18px;height:18px;background:#2563eb;border:3px solid white;border-radius:50%;box-shadow:0 0 0 5px rgba(37,99,235,0.22),0 2px 8px rgba(0,0,0,0.25)"></div>`,
  className: "",
  iconSize: [18, 18],
  iconAnchor: [9, 9],
});

// ─── UI Sub-components ────────────────────────────────────────────────────────

function RatingStars({ rating }: { rating: number }) {
  return (
    <div className="flex items-center gap-0.5">
      {Array.from({ length: 5 }, (_, i) => (
        <Star key={i} size={10} className={i < Math.floor(rating) ? "fill-amber-400 text-amber-400" : "text-gray-200 fill-gray-200"} />
      ))}
      <span className="text-[10px] text-muted-foreground ml-1">{rating.toFixed(1)}</span>
    </div>
  );
}

function OpenBadge({ open }: { open: boolean }) {
  return (
    <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full ${open ? "bg-green-100 text-green-700" : "bg-red-100 text-red-600"}`}>
      {open ? "Open" : "Closed"}
    </span>
  );
}

interface ResourceCardProps {
  resource: MapResource & { isOpen: boolean };
  distanceKm: number | null;
  onClose: () => void;
}

function ResourceCard({ resource, distanceKm, onClose }: ResourceCardProps) {
  const cfg = CAT[resource.type];
  return (
    <div className="p-4">
      <div className="w-8 h-1 bg-gray-200 rounded-full mx-auto mb-3" />
      <div className="flex items-start gap-3">
        <div className="w-12 h-12 rounded-2xl flex items-center justify-center flex-shrink-0" style={{ background: `${cfg.color}18` }}>
          <cfg.Icon size={22} style={{ color: cfg.color }} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 flex-wrap mb-0.5">
            <span className="text-[9px] font-bold uppercase tracking-wider" style={{ color: cfg.color }}>{cfg.label}</span>
            <OpenBadge open={resource.isOpen} />
          </div>
          <h3 className="font-bold text-base leading-tight">{resource.name}</h3>
          <p className="text-[11px] text-muted-foreground mt-0.5">{resource.address}</p>
          <div className="flex items-center gap-3 mt-1">
            {distanceKm !== null && (
              <span className="text-xs text-primary font-bold">{kmToMiles(distanceKm)} away</span>
            )}
            <RatingStars rating={resource.rating} />
          </div>
        </div>
        <button onClick={onClose} className="w-7 h-7 rounded-full bg-gray-100 flex items-center justify-center flex-shrink-0 hover:bg-gray-200 transition-colors">
          <X size={12} />
        </button>
      </div>
      <p className="text-xs text-foreground/80 mt-2.5 leading-snug">{resource.description}</p>
      <div className="flex items-center gap-1 mt-1.5 text-xs text-muted-foreground">
        <Clock size={10} className="flex-shrink-0" />
        <span>{resource.hours}</span>
      </div>
      {resource.phone && (
        <button className="w-full mt-3 py-2.5 rounded-2xl text-sm font-bold flex items-center justify-center gap-2 text-white" style={{ background: "#1a5c39" }}>
          <Phone size={13} /> Call {resource.phone}
        </button>
      )}
    </div>
  );
}

function ResourceList({ resources, userLoc, onSelect }: {
  resources: (MapResource & { isOpen: boolean })[];
  userLoc: [number, number] | null;
  onSelect: (r: MapResource) => void;
}) {
  return (
    <div className="p-4">
      <div className="w-8 h-1 bg-gray-200 rounded-full mx-auto mb-3" />
      <h3 className="font-bold text-sm mb-2.5">{resources.length} Resource{resources.length !== 1 ? "s" : ""} Found</h3>
      <div className="space-y-1.5 max-h-44 overflow-y-auto" style={{ scrollbarWidth: "none" }}>
        {resources.length === 0 ? (
          <div className="text-center py-6">
            <MapPin size={24} className="mx-auto mb-2 opacity-25" />
            <p className="text-sm text-muted-foreground">No resources match your filters</p>
          </div>
        ) : resources.slice(0, 10).map((r) => {
          const cfg = CAT[r.type];
          const dist = userLoc ? haversineKm(userLoc[0], userLoc[1], r.lat, r.lng) : null;
          return (
            <button key={r.id} onClick={() => onSelect(r)} className="w-full flex items-center gap-3 px-2.5 py-2 rounded-xl hover:bg-gray-50 transition-colors text-left">
              <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: `${cfg.color}18` }}>
                <cfg.Icon size={16} style={{ color: cfg.color }} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-semibold truncate">{r.name}</p>
                <p className="text-[10px] text-muted-foreground truncate">{r.address}</p>
              </div>
              <div className="text-right flex-shrink-0 space-y-0.5">
                {dist !== null && <p className="text-[10px] font-bold text-primary">{kmToMiles(dist)}</p>}
                <OpenBadge open={r.isOpen} />
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function FilterPanel({ activeTypes, onToggleType, onSelectAll, radius, onRadiusChange, sortBy, onSortChange, hasLocation }: {
  activeTypes: Set<MapResourceType>; onToggleType: (t: MapResourceType) => void; onSelectAll: () => void;
  radius: number; onRadiusChange: (r: number) => void;
  sortBy: string; onSortChange: (s: string) => void;
  hasLocation: boolean;
}) {
  return (
    <div className="mt-2 bg-white rounded-2xl shadow-xl border border-gray-100 overflow-hidden">
      <div className="p-3 max-h-[52vh] overflow-y-auto" style={{ scrollbarWidth: "none" }}>
        <div className="mb-3.5">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Category</span>
            <button onClick={onSelectAll} className="text-[10px] font-bold text-primary">Select All</button>
          </div>
          <div className="grid grid-cols-2 gap-1.5">
            {(Object.entries(CAT) as [MapResourceType, CatConfig][]).map(([type, cfg]) => {
              const active = activeTypes.has(type);
              return (
                <button key={type} onClick={() => onToggleType(type)}
                  className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-xs font-semibold transition-all text-left"
                  style={active ? { background: cfg.color, color: "#fff" } : { background: "#f3f4f6", color: "#6b7280" }}>
                  <cfg.Icon size={11} />
                  <span className="truncate leading-tight">{cfg.label}</span>
                </button>
              );
            })}
          </div>
        </div>
        <div className="mb-3.5">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Distance Radius</span>
            {!hasLocation && (
              <span className="text-[9px] text-orange-500 flex items-center gap-0.5">
                <AlertCircle size={9} /> Enable location
              </span>
            )}
          </div>
          <div className="flex gap-1.5">
            {RADIUS_OPTIONS.map((r) => (
              <button key={r} onClick={() => onRadiusChange(r)}
                className="flex-1 py-1.5 rounded-xl text-xs font-bold transition-all"
                style={radius === r ? { background: "#1a5c39", color: "#fff" } : { background: "#f3f4f6", color: "#6b7280" }}>
                {r}mi
              </button>
            ))}
          </div>
        </div>
        <div>
          <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground block mb-2">Sort By</span>
          <div className="grid grid-cols-2 gap-1.5">
            {SORT_OPTIONS.map((opt) => (
              <button key={opt.value} onClick={() => onSortChange(opt.value)}
                className="py-1.5 rounded-xl text-xs font-bold transition-all"
                style={sortBy === opt.value ? { background: "#1a5c39", color: "#fff" } : { background: "#f3f4f6", color: "#6b7280" }}>
                {opt.label}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── MapTab ───────────────────────────────────────────────────────────────────

export default function MapTab({ resources }: MapTabProps) {
  const containerRef   = useRef<HTMLDivElement>(null);
  const mapRef         = useRef<L.Map | null>(null);
  const clusterRef     = useRef<any>(null);
  const userMarkerRef  = useRef<L.Marker | null>(null);
  const radiusCircleRef = useRef<L.Circle | null>(null);

  const [userLoc,      setUserLoc]      = useState<[number, number] | null>(null);
  const [selectedId,   setSelectedId]   = useState<number | null>(null);
  const [filterOpen,   setFilterOpen]   = useState(false);
  const [activeTypes,  setActiveTypes]  = useState<Set<MapResourceType>>(new Set(ALL_TYPES));
  const [radius,       setRadius]       = useState(5);
  const [sortBy,       setSortBy]       = useState("distance");
  const [locating,     setLocating]     = useState(false);

  // Merge live DB fields onto base coordinates
  const mergedResources: MapResource[] = useMemo(() => {
    if (!resources?.length) return BASE_RESOURCES;
    return BASE_RESOURCES.map((base) => {
      const live = resources.find((r) => r.id === base.id);
      return live ? { ...base, name: live.name ?? base.name, hours: live.hours ?? base.hours, phone: live.phone ?? base.phone, description: live.description ?? base.description } : base;
    });
  }, [resources]);

  // Filter + sort
  const displayResources = useMemo(() => {
    const annotated = mergedResources.map((r) => ({ ...r, isOpen: checkIsOpen(r.hours) }));
    let list = annotated.filter((r) => activeTypes.has(r.type));
    if (userLoc) {
      const maxKm = radius * 1.60934;
      list = list.filter((r) => haversineKm(userLoc[0], userLoc[1], r.lat, r.lng) <= maxKm);
    }
    return [...list].sort((a, b) => {
      if (sortBy === "distance" && userLoc)
        return haversineKm(userLoc[0], userLoc[1], a.lat, a.lng) - haversineKm(userLoc[0], userLoc[1], b.lat, b.lng);
      if (sortBy === "rating")  return b.rating - a.rating;
      if (sortBy === "open")    return (b.isOpen ? 1 : 0) - (a.isOpen ? 1 : 0);
      if (sortBy === "score")   return b.rating - a.rating;
      return 0;
    });
  }, [mergedResources, activeTypes, radius, sortBy, userLoc]);

  const selected = displayResources.find((r) => r.id === selectedId) ?? null;

  // ── Effect 1: Initialize Leaflet map once ──────────────────────────────────
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const map = L.map(containerRef.current, {
      center: DEFAULT_CENTER,
      zoom: DEFAULT_ZOOM,
      zoomControl: false,
    });

    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
      maxZoom: 19,
    }).addTo(map);

    mapRef.current = map;

    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, []);

  // ── Effect 2: Rebuild marker cluster when resources or selection changes ───
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    // Remove old cluster
    if (clusterRef.current) {
      map.removeLayer(clusterRef.current);
      clusterRef.current = null;
    }

    const cluster = (L as any).markerClusterGroup({
      iconCreateFunction: createClusterIcon,
      maxClusterRadius: 48,
      showCoverageOnHover: false,
      chunkedLoading: true,
    });

    displayResources.forEach((r) => {
      const icon = createMarkerIcon(r.type, r.id === selectedId);
      const marker = L.marker([r.lat, r.lng], { icon });
      marker.on("click", () => {
        setSelectedId((prev) => (prev === r.id ? null : r.id));
        setFilterOpen(false);
        mapRef.current?.flyTo([r.lat, r.lng], Math.max(mapRef.current.getZoom(), 15), { duration: 0.7 });
      });
      cluster.addLayer(marker);
    });

    cluster.addTo(map);
    clusterRef.current = cluster;
  }, [displayResources, selectedId]);

  // ── Effect 3: User location marker + radius circle ────────────────────────
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    userMarkerRef.current?.remove();
    radiusCircleRef.current?.remove();

    if (userLoc) {
      userMarkerRef.current = L.marker(userLoc, { icon: USER_ICON }).addTo(map);
      radiusCircleRef.current = L.circle(userLoc, {
        radius: radius * 1609.34,
        color: "#2563eb", fillColor: "#2563eb",
        fillOpacity: 0.05, weight: 1.5,
        dashArray: "6 5",
      }).addTo(map);
    }
  }, [userLoc, radius]);

  // ── Handlers ──────────────────────────────────────────────────────────────
  const handleLocate = useCallback(() => {
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => {
        const pos: [number, number] = [coords.latitude, coords.longitude];
        setUserLoc(pos);
        mapRef.current?.flyTo(pos, 15, { duration: 1 });
        setLocating(false);
      },
      () => {
        mapRef.current?.flyTo(DEFAULT_CENTER, DEFAULT_ZOOM, { duration: 1 });
        setLocating(false);
      },
      { timeout: 8000 }
    );
  }, []);

  const toggleType = useCallback((t: MapResourceType) => {
    setActiveTypes((prev) => {
      const next = new Set(prev);
      next.has(t) ? next.delete(t) : next.add(t);
      return next;
    });
  }, []);

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="h-full relative overflow-hidden bg-gray-100">

      {/* Leaflet map container */}
      <div ref={containerRef} style={{ position: "absolute", inset: 0, zIndex: 0 }} />

      {/* Filter toggle + panel */}
      <div className="absolute top-3 left-3 right-3 z-[400]">
        <button
          onClick={() => setFilterOpen((f) => !f)}
          className="w-full flex items-center justify-between gap-2 bg-white/96 backdrop-blur-sm rounded-2xl px-4 py-2.5 shadow-lg"
        >
          <div className="flex items-center gap-2 min-w-0">
            <Filter size={14} className="text-primary flex-shrink-0" />
            <span className="text-sm font-bold">Filter By</span>
            <span className="text-xs text-muted-foreground truncate">
              {activeTypes.size === ALL_TYPES.size ? "All categories" : `${activeTypes.size} of ${ALL_TYPES.size} selected`}
            </span>
          </div>
          {filterOpen
            ? <ChevronUp size={14} className="text-muted-foreground flex-shrink-0" />
            : <ChevronDown size={14} className="text-muted-foreground flex-shrink-0" />}
        </button>

        {filterOpen && (
          <FilterPanel
            activeTypes={activeTypes} onToggleType={toggleType} onSelectAll={() => setActiveTypes(new Set(ALL_TYPES))}
            radius={radius} onRadiusChange={setRadius}
            sortBy={sortBy} onSortChange={setSortBy}
            hasLocation={userLoc !== null}
          />
        )}
      </div>

      {/* Zoom buttons */}
      <div className="absolute right-3 z-[400]" style={{ bottom: selected ? 230 : 210 }}>
        <div className="flex flex-col gap-1.5">
          {[{ label: "+", fn: () => mapRef.current?.zoomIn() }, { label: "−", fn: () => mapRef.current?.zoomOut() }].map(({ label, fn }) => (
            <button key={label} onClick={fn}
              className="w-11 h-11 bg-white rounded-2xl shadow-lg border border-gray-200 flex items-center justify-center text-gray-700 text-xl font-bold hover:bg-gray-50 transition-colors">
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* My Location button */}
      <button
        onClick={handleLocate}
        title="My Location"
        className="absolute right-3 z-[400] w-11 h-11 bg-white rounded-2xl shadow-lg border border-gray-200 flex items-center justify-center hover:bg-gray-50 transition-colors"
        style={{ bottom: selected ? 340 : 320 }}
      >
        <Navigation size={18} className={locating ? "text-blue-400 animate-pulse" : "text-blue-600"} />
      </button>

      {/* Bottom sheet */}
      <div className="absolute bottom-0 left-0 right-0 z-[400] bg-white rounded-t-3xl shadow-[0_-4px_24px_rgba(0,0,0,0.12)]">
        {selected ? (
          <ResourceCard
            resource={selected}
            distanceKm={userLoc ? haversineKm(userLoc[0], userLoc[1], selected.lat, selected.lng) : null}
            onClose={() => setSelectedId(null)}
          />
        ) : (
          <ResourceList resources={displayResources} userLoc={userLoc} onSelect={(r) => {
            setSelectedId(r.id);
            setFilterOpen(false);
            mapRef.current?.flyTo([r.lat, r.lng], Math.max(mapRef.current.getZoom(), 15), { duration: 0.7 });
          }} />
        )}
      </div>
    </div>
  );
}
