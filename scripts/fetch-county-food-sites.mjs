// fetch-county-food-sites.mjs — LA County Public Health's "Charitable Food Distribution Sites" for "Map near me" (M13).
//
//   node scripts/fetch-county-food-sites.mjs
//
// Writes src/lib/data/county-food-sites.json as the County publishes it (names stay in capitals; the app title-cases
// them, D7): { as_of, sites: [{ id, name, address, city, zip, lat, lng }] }. `as_of` is the layer's last edit date.
// The layer's own copyrightText says its data came from 211LA Food Resources (May 2023); the owner relies on the County's
// open-data licence (decision 041): https://egis-lacounty.hub.arcgis.com/pages/terms-of-use
// Spec: docs/superpowers/specs/2026-10-07-m13-map-near-me-design.md §3.2.

import { writeFileSync } from "node:fs";

const LAYER = "https://services.arcgis.com/RmCCgQtiZLDCtblq/arcgis/rest/services/Food_Distribution_chp/FeatureServer/0";
const get = async url => { const res = await fetch(url, { headers: { "User-Agent": "EcoGo/0.1 (personal project)" } });
  if (!res.ok) throw new Error(`${url}: ${res.status}`); return res.json(); };

const info = await get(`${LAYER}?f=json`);
const data = await get(`${LAYER}/query?where=1%3D1&outFields=*&outSR=4326&f=json`);
if (data.exceededTransferLimit) throw new Error("the layer has more rows than one page; page through it");
const asOf = new Date(info.editingInfo.lastEditDate).toISOString().slice(0, 10);
const sites = data.features.map(({ attributes: a }) => ({
  id: a.OBJECTID, name: a.food_distrib_name, address: a.food_distrib_address, city: a.food_distrib_city,
  zip: String(a.food_distrib_zipcode), lat: a.food_distrib_latitude, lng: a.food_distrib_longitude,
})).sort((x, y) => x.id - y.id);

writeFileSync(new URL("../src/lib/data/county-food-sites.json", import.meta.url), JSON.stringify({ as_of: asOf, sites }, null, 0) + "\n");
console.error(`${sites.length} sites, layer last edited ${asOf}; copyrightText: ${info.copyrightText}`);
