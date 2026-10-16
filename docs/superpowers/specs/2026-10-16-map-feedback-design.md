# Map feedback batch (decision 059): Suggest button up top, check County spots, account-free first, address suggestions

- **Date:** 2026-10-16
- **Status:** **Approved** by the owner 2026-10-16 (decision 059, all four picked from options, recommended)
- **Why:** Minh's M8.1 live test. "Suggest a place" sits at the very bottom, under every list; County cards have no
  website or phone (the 2023 County list never had them); OSM edit links hit OSM's sign-up; the address box has no
  suggestions.
- **Base:** M13 Map, M8.1 (057), 058 L4's pattern. No server or database change.

## 1. Changes

| # | Change |
|---|---|
| Q1 | **Suggest a place up top:** a small outlined "Suggest a place" button at the right of the "Food places in LA County" heading, always visible (wraps under the heading on narrow phones). The footer's "Suggest a place" button goes; "or add it on OpenStreetMap yourself" moves under Q3's rule |
| Q2 | **Check a County spot:** every County card gets two secondary buttons: "Search for it" (a web search for the name + address, `https://www.google.com/search?q=<name> <address>`, new tab) and "Call 211" (`tel:211`). The footnote stays. Nothing about the place is invented or fetched |
| Q3 | **Account-free first (as 058 L4):** "Report a problem" is the main fix on every card; OSM's "Fix it on OpenStreetMap" (and the footer's "add it on OpenStreetMap yourself") become small text links: "Have an OpenStreetMap account? Edit there." (same URLs, new tab, sr-only "(opens OpenStreetMap in a new tab)"). No auto sign-up: EcoGo never handles passwords for other services |
| Q4 | **Address suggestions:** the Suggest form's address box asks Photon (`https://photon.komoot.io/api/`, OSM data) after 3+ characters and a 400 ms pause, limited to LA County's bounding box (`bbox`), up to 5 results, `lang=en`; picking one fills the box with a formatted address (house number, street, city, ZIP). Typing freely still works; any Photon failure or slowness (2 s) just shows no list. One request at a time (an older answer is dropped). A line under the box: "Address suggestions come from Photon (OpenStreetMap data); it sees what you type here." Photon's terms (checked 2026-10-16): "You can use the API for your project, but please be fair" |

## 2. Testing

- check-map: the heading button opens Suggest with no type picked; County cards show both buttons with the right
  hrefs; OSM cards show the small "Edit there" link and no OSM button; the Photon request is stubbed (CDP Fetch):
  suggestions appear after a pause, picking one fills the box, a failed or slow answer shows no list, and no request goes
  out under 3 characters. All earlier gates.
- Live (planner): grep the bundle; Minh tries the address box once.

## 3. Out of scope

Fetching County phone numbers or websites; geocoding the address for the map; OSM accounts.
