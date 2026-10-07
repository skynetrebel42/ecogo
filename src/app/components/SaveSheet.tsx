// SaveSheet.tsx: after a save, optionally drop the product into lists (M14 spec part 2, decision 043 layout A).
import { useEffect, useId, useRef, useState, type KeyboardEvent } from "react";
import { Check, Plus } from "lucide-react";
import { createList, setInList, type SavedStore } from "../../lib/saved";

const PRESETS = ["Breakfast", "Lunch", "Dinner", "Dessert", "Snacks"];
const CHIP = "min-h-[44px] px-3.5 rounded-full border text-sm font-bold";

export default function SaveSheet({ productId, saved, savedOk, onChange, onClose }: {
  productId: number; saved: SavedStore; savedOk: boolean; onChange: (s: SavedStore) => void; onClose: () => void;
}) {
  const titleId = useId(), errorId = useId();
  const panel = useRef<HTMLDivElement>(null);
  const [naming, setNaming] = useState(false);
  const [name, setName] = useState("");
  const [error, setError] = useState("");
  useEffect(() => panel.current?.focus(), []);

  // Chip order is fixed when the sheet opens, so a chip never moves under the finger: your lists, then unused presets.
  // A list made here goes after them; a tapped preset stays put, pressed.
  const byName = (n: string) => saved.lists.find(l => l.name.toLowerCase() === n.toLowerCase());
  const [order] = useState(() => [...saved.lists.map(l => l.name), ...PRESETS.filter(p => !byName(p))]);
  const chips = [...order.map(n => byName(n) ?? n), ...saved.lists.filter(l => !order.some(n => n.toLowerCase() === l.name.toLowerCase()))];
  const add = (n: string) => {
    const r = createList(saved, n, [productId]);
    if (typeof r === "string") { setError(r); return; }
    onChange(r); setNaming(false); setName(""); setError("");
  };
  // Escape closes; Tab stays inside the sheet (aria-modal).
  const onKeyDown = (e: KeyboardEvent) => {
    if (e.key === "Escape") { e.stopPropagation(); onClose(); return; }
    if (e.key !== "Tab" || !panel.current) return;
    const f = [...panel.current.querySelectorAll<HTMLElement>("button, input")];
    const first = f[0], last = f[f.length - 1];
    if (e.shiftKey && (document.activeElement === first || document.activeElement === panel.current)) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
  };

  return (
    <div className="absolute inset-0 z-[60] flex items-end bg-black/40" onClick={e => { if (e.target === e.currentTarget) onClose(); }} onKeyDown={onKeyDown}>
      <div ref={panel} role="dialog" aria-modal="true" aria-labelledby={titleId} tabIndex={-1}
        className="w-full bg-card rounded-t-3xl px-5 pt-5 pb-6 space-y-3 outline-none">
        <h2 id={titleId} className="flex items-center gap-2 text-lg font-extrabold">
          <Check size={20} className="text-primary" aria-hidden="true" />{savedOk ? "Saved" : "Saved for this visit only"}
        </h2>
        <p className="text-sm text-muted-foreground">Add to a list (optional)</p>
        <div className="flex flex-wrap gap-2">
          {chips.map(c => {
            // Keyed by name: a tapped preset keeps its button, and focus, when it becomes a list.
            if (typeof c === "string") return <button key={c.toLowerCase()} aria-pressed={false} onClick={() => add(c)} className={`${CHIP} border-border`}>{c}</button>;
            const on = c.ids.includes(productId);
            return (
              <button key={c.name.toLowerCase()} aria-pressed={on} onClick={() => onChange(setInList(saved, c.id, productId, !on))}
                className={`${CHIP} ${on ? "bg-primary text-primary-foreground border-primary" : "border-border"}`}>{c.name}</button>
            );
          })}
          {!naming && (
            <button onClick={() => setNaming(true)} className={`${CHIP} border-dashed border-border flex items-center gap-1`}>
              <Plus size={14} aria-hidden="true" />New list
            </button>
          )}
        </div>
        {naming && (
          <div>
            <form className="flex gap-2" onSubmit={e => { e.preventDefault(); add(name); }}>
              <input autoFocus value={name} onChange={e => { setName(e.target.value); setError(""); }} aria-label="New list name"
                maxLength={60} aria-invalid={!!error} aria-describedby={error ? errorId : undefined}
                className="flex-1 min-w-0 min-h-[44px] px-3 rounded-xl border border-border text-sm" />
              <button type="submit" className="min-h-[44px] px-4 rounded-xl bg-primary text-primary-foreground text-sm font-bold">Add</button>
            </form>
            {error && <p id={errorId} role="alert" className="text-xs text-red-700 mt-1">{error}</p>}
          </div>
        )}
        <button onClick={onClose} className="w-full min-h-[44px] rounded-xl bg-muted text-sm font-bold">Done</button>
      </div>
    </div>
  );
}
