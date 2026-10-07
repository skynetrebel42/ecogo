# M14 Collections (Saved): design

Status: **Approved by Minh 2026-10-07.** Item 4 of decision 033; layout = decision 043.
Backlog source: `docs/superpowers/ideas/2026-10-05-owner-app-review.md` §4. Closes K-16's remaining part.

## Decisions

| # | Decision |
|---|---|
| D1 | Layout A, the save sheet (043): tapping the empty bookmark on a product page saves it at once and opens a sheet: "Saved", then "Add to a list (optional)" with chips. Saved › Favorites shows lists like folders. |
| D2 | Saved products and lists are kept **on this device** (localStorage), like Recently scanned. No account, nothing sent anywhere. |
| D3 | Preset lists are **suggested chips**: Breakfast, Lunch, Dinner, Dessert, Snacks appear in the sheet (after your own lists) until a list with that name exists. A list exists only once something is in it or you created it by name; Saved never shows empty preset folders. |
| D4 | Food-exchange groups (protein, fibre, …) are **not** in M14: naming a product's food group is a nutrition claim and needs a source (e.g. USDA MyPlate) first. Meal names are the user's own labels, not claims. |
| D5 | List tools: rename, delete (its products stay in All saved), and remove one product from a list. |
| D6 | Tapping the filled bookmark **unsaves everywhere** (Saved and every list), with a "Removed · Undo" note for 5 s. Deleting a list gets the same "Deleted · Undo" note. |

Design check: Nielsen #7 flexibility and efficiency (saving stays one tap; lists are optional), Nielsen #3 user
control (undo instead of confirm dialogs), Rams "as little design as possible" (no empty folders).

## Evidence

- Favorites today: `useState<number[]>([])` at `src/app/App.tsx:499`, lost on reload. Profile says so at `App.tsx:431`.
- Saving holds catalog products (id > 0) and looked-up USDA/OFF products (id < 0). Looked-up ids come from the barcode
  (`src/lib/lookup.ts:40`, `src/lib/foods.ts:41`), so they're stable across visits.
- `src/lib/recent.ts` already solves the same storage problem: catalog ids stored by id (stay fresh), looked-up products
  stored with a snapshot, a parser that survives corrupt JSON. `src/lib/settings.ts` follows it. M14 reuses that pattern.
- Looked-up favorites only show in Saved today because they're in the session's `lookedUp` list (`App.tsx:506`, `599`).
  With snapshots stored, Saved no longer depends on `lookedUp`.

## Changes

**Part 1: keep favorites on the device** (`src/lib/saved.ts` new, `saved.test.ts` new, `App.tsx`)
- Storage key `ecogo.saved.v1`: `{ items: {id, product?}[], lists: {id, name, ids: number[]}[] }`; items newest first.
  `product` snapshot only for id < 0 (as in recent.ts). List `id` is a random string; `ids` newest first.
- Pure functions, each tested: `toggleSave` (unsave also removes the id from every list), `setInList`,
  `createList` (name trimmed, 1–30 characters, unique ignoring case; else it returns an error string for the input),
  `renameList` (same rules), `deleteList`, `resolveSaved` (a catalog id no longer in the catalog is dropped),
  `parseSaved` (corrupt JSON → empty; list ids that aren't saved are dropped).
- `App.tsx`: `savedIds` state becomes the saved store, loaded and saved like `recent`. If the write fails (storage full or
  blocked), the sheet's title reads "Saved for this visit only" instead of "Saved".
- Profile copy (`App.tsx:431`): "Saved products and lists stay in this browser. Clearing site data removes them."
- Measure and report one looked-up snapshot's size in bytes (for the known-gaps line below).

**Part 2: the save sheet** (`src/app/components/SaveSheet.tsx` new, `ProductDetailScreen.tsx`)
- Empty bookmark → save + open the sheet. Filled bookmark → unsave everywhere + "Removed · Undo" note (D6).
- Sheet: title "Saved" with a check; line "Add to a list (optional)"; chips = your lists (oldest first), then the unused
  presets (D3), then "+ New list" (turns into a text box with Add; Enter adds; errors inline). A chip toggles the
  product in that list (filled = in). "Done" closes; so do Escape and a tap outside.
- Accessibility: `role="dialog"`, `aria-modal`, labelled by its title; focus moves into the sheet and back to the
  bookmark on close; chips are `aria-pressed` buttons; the undo note is announced (`role="status"`).

**Part 3: Saved › Favorites with lists** (`App.tsx` SavedTab, `src/app/components/ListScreen.tsx` new)
- No lists yet → products directly, as today (empty state unchanged). One or more lists → rows: "All saved · N", then
  each list with its count, oldest first; a row opens that list's screen.
- List screen: back arrow, name, a ··· menu with Rename (inline text box, same rules) and Delete (D6 undo); product
  cards, each with a remove (×) button labelled "Remove {name} from {list}". The "All saved" screen has no × (unsave
  from the product page).
- K-16 marked fixed in `KNOWN_ISSUES.md`.

## Verification

- `npm test` (new `saved.test.ts` covers every function above, incl. corrupt JSON and unsave-removes-from-lists) and
  `npm run build` pass; check-home 37 and check-map 36 unchanged.
- `check-saved.mjs` next to check-home (headless Edge, same CDP setup): save a catalog product and a looked-up one,
  add one to "Snacks" via the chip, **reload**, both are still saved and Snacks has 1; rename, remove, delete + undo,
  unsave + undo; Escape closes the sheet and focus returns to the bookmark.
- Screenshots at 375×812, 1x: the open sheet, Saved with lists, a list screen. Nothing else.

## Known gaps

- Device-only: another browser or phone doesn't see your lists; clearing site data deletes them (said on Profile).
  Accounts (later) can sync them.
- Looked-up snapshots don't refresh until the product is opened again (same as Recently scanned).
- localStorage is about 5 MB per site, shared with Recently scanned; the snapshot size measured in part 1 sets how
  many looked-up favorites fit.
- No reordering of lists or products; no sharing; no non-food lists (item 7); food groups wait for a source (D4).

## Summary for Minh

Your bookmarks and lists now survive a reload, kept on your device only. Tapping the bookmark saves at once and opens a
small sheet where you can drop the product into Breakfast, Snacks or a list you name. Saved shows your lists as folders,
and you can rename, delete, or take products out, with an Undo for anything you remove. Three parts, one commit each.
