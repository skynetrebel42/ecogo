// ListScreen.tsx: one list (or All saved) under Saved › Favorites (M14 spec part 3).
import { useState, useId, useRef, type ReactNode } from "react";
import { ArrowLeft, MoreHorizontal, X } from "lucide-react";
import type { Product } from "../../lib/productImporter";
import { deleteList, renameList, setInList, type SavedList, type SavedStore } from "../../lib/saved";

/** `list` null = All saved: no menu and no × (unsave from the product page). */
export default function ListScreen({ list, products, store, onChangeSaved, onBack, card }: {
  list: SavedList | null; products: Product[]; store: SavedStore;
  onChangeSaved: (s: SavedStore, undoText?: string) => void; onBack: () => void; card: (p: Product) => ReactNode;
}) {
  const [menu, setMenu] = useState(false);
  const [renaming, setRenaming] = useState(false);
  const [name, setName] = useState("");
  const [error, setError] = useState("");
  const menuId = useId(), errorId = useId();
  const title = list?.name ?? "All saved";

  const options = useRef<HTMLButtonElement>(null);
  // Closing the text box or the menu hands focus back to ···.
  const endRename = () => { options.current?.focus(); setRenaming(false); setError(""); };
  const rename = () => {
    if (!list) return;
    const r = renameList(store, list.id, name);
    if (typeof r === "string") { setError(r); return; }
    onChangeSaved(r); endRename();
  };

  return (
    <div className="h-full overflow-y-auto bg-background" style={{ scrollbarWidth: "none" }}>
      <div className="px-5 pt-4 pb-3 flex items-center gap-2">
        <button onClick={onBack} aria-label="Back" className="w-11 h-11 -ml-2 flex items-center justify-center rounded-xl">
          <ArrowLeft size={20} />
        </button>
        {renaming && list ? (
          <form className="flex-1 min-w-0 flex gap-2" onSubmit={e => { e.preventDefault(); rename(); }}>
            <input autoFocus value={name} aria-label="List name" maxLength={60} aria-invalid={!!error} aria-describedby={error ? errorId : undefined}
              onChange={e => { setName(e.target.value); setError(""); }} onKeyDown={e => { if (e.key === "Escape") endRename(); }}
              className="flex-1 min-w-0 min-h-[44px] px-3 rounded-xl border border-border text-sm" />
            <button type="submit" className="min-h-[44px] px-4 rounded-xl bg-primary text-primary-foreground text-sm font-bold">Save</button>
          </form>
        ) : (
          <h1 className="flex-1 min-w-0 text-xl font-extrabold truncate">{title}</h1>
        )}
        {list && (
          <div className="relative" onKeyDown={e => { if (e.key === "Escape" && menu) { setMenu(false); options.current?.focus(); } }}>
            <button ref={options} onClick={() => setMenu(!menu)} aria-label={`${list.name} options`} aria-expanded={menu} aria-controls={menuId}
              className="w-11 h-11 flex items-center justify-center rounded-xl">
              <MoreHorizontal size={20} />
            </button>
            {menu && (
              <div id={menuId} className="absolute right-0 top-12 z-10 w-36 bg-card border border-border rounded-xl shadow-lg py-1">
                <button autoFocus onClick={() => { setMenu(false); setName(list.name); setError(""); setRenaming(true); }}
                  className="w-full min-h-[44px] px-4 text-left text-sm font-bold">Rename</button>
                <button onClick={() => { onChangeSaved(deleteList(store, list.id), "Deleted"); onBack(); }}
                  className="w-full min-h-[44px] px-4 text-left text-sm font-bold text-red-700">Delete</button>
              </div>
            )}
          </div>
        )}
      </div>
      {error && <p id={errorId} role="alert" className="px-5 -mt-1 mb-2 text-xs text-red-700">{error}</p>}
      <div className="px-5 pb-8 space-y-3">
        {products.length === 0 && <p className="text-center text-sm text-muted-foreground py-12">Nothing in this list yet</p>}
        {products.map(p => (
          <div key={p.id} className="flex items-center gap-2">
            <div className="flex-1 min-w-0">{card(p)}</div>
            {list && (
              <button onClick={() => onChangeSaved(setInList(store, list.id, p.id, false))} aria-label={`Remove ${p.name} from ${list.name}`}
                className="w-11 h-11 flex-shrink-0 flex items-center justify-center rounded-xl text-muted-foreground">
                <X size={18} />
              </button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
