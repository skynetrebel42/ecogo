// IngredientCheck.tsx — check an ingredient list without a barcode (M8 spec D2, §3): photograph or type it, see the
// same safety check as a product page. Nothing is saved or sent. IngredientEditor (the check box + live badge) is
// shared with AddProductFlow's "Check the ingredients" step.

import { useMemo, useRef, useState, type ChangeEvent } from "react";
import { X } from "lucide-react";
import { assessProduct, type Assessment } from "../../lib/safety/assess";
import { readPhoto, trimToIngredients, linesText, type LabelLine } from "../../lib/ocr";
import { preparePhoto } from "../../lib/photo";
import { VERDICT_STYLE, verdictHeadline } from "./verdict";
import Explainer from "./Explainer";

/** The check for typed or read text. No category: it is a food's ingredient list, like a looked-up product's. */
function check(ingredients: string): Assessment | null {
  if (!ingredients.trim()) return null;
  try {
    return assessProduct({ name: "", category: "", ingredients, source: {} });
  } catch (err) {
    console.error("[safety] check failed for typed ingredients", err);
    return { verdict: "no-data", flags: [], checkedCount: 0, concerns: [] };
  }
}

export const INGREDIENTS_TIP = "Photograph the ingredients list: flat, in good light, with no glare. EcoGo reads the words on your phone.";

/** The note above the lines, naming the words the trim found (M8 follow-up F2). */
function linesNote(lines: LabelLine[]): string {
  const { startWord: a, stopWord: b } = trimToIngredients(lines.map(l => l.text).join("\n"));
  if (!a && !b) return "Untick any line that isn't an ingredient.";
  return `We kept the part ${a && b ? `from "${a}" to "${b}"` : a ? `from "${a}" on` : `up to "${b}"`}. Tick or untick lines, or edit the text below.`;
}

/** Editable ingredients with unsure words underlined, and the live badge. The underlines are drawn by a copy of the
 *  text (transparent, in flow, so the box grows with it) behind a transparent textarea laid exactly over it.
 *  With `lines` (read from a photo), each line can be ticked or unticked and the box follows; the first keystroke in the
 *  box hides the lines for good (onLines(null)), so the box is the final say (follow-up F2, F3). */
export function IngredientEditor({ value, onChange, unsure, note, lines, onLines }: {
  value: string; onChange: (text: string) => void; unsure: string[]; note?: string;
  lines?: LabelLine[] | null; onLines?: (lines: LabelLine[] | null) => void;
}) {
  const assessment = useMemo(() => check(value), [value]);
  const [explainer, setExplainer] = useState(false);
  const unsureSet = new Set(unsure);
  const box = "w-full min-h-[120px] p-3 text-sm leading-relaxed font-[inherit] whitespace-pre-wrap break-words";
  const look = assessment && VERDICT_STYLE[assessment.verdict];
  const tick = (i: number) => {
    const next = lines!.map((l, j) => (j === i ? { ...l, on: !l.on } : l));
    onLines?.(next); onChange(linesText(next));
  };
  return (
    <div className="space-y-3">
      {lines && lines.length > 0 && <>
        <p className="text-sm text-gray-700 leading-relaxed">{linesNote(lines)}</p>
        <ul aria-label="Lines read from the photo" className="bg-white rounded-2xl border border-border divide-y divide-border">
          {lines.map((l, i) => (
            <li key={i}>
              <label className="flex gap-2.5 items-start px-3 py-2.5 min-h-[44px] text-sm leading-snug">
                <input type="checkbox" checked={l.on} onChange={() => tick(i)} className="w-[22px] h-[22px] m-0 flex-shrink-0" />
                <span className={l.on ? "" : "text-gray-500"}>{l.kept || l.text}</span>
              </label>
            </li>
          ))}
        </ul>
      </>}
      {lines === null && <p className="text-xs text-muted-foreground">You're editing the text directly.</p>}
      <label htmlFor="ingredients" className="block text-sm font-bold">Ingredients</label>
      <div className="relative rounded-2xl border-2 border-[#1A5C39] bg-white">
        <div aria-hidden="true" className={`${box} text-transparent pointer-events-none`}>
          {/* Split into words (odd parts) and what's between them; no lookbehind, which older iOS Safari can't parse. */}
          {value.split(/([\p{L}\p{N}]+)/u).map((part, i) => (i % 2 && unsureSet.has(part)
            ? <span key={i} style={{ textDecoration: "underline wavy #D97706", textDecorationSkipInk: "none" }}>{part}</span>
            : part))}{"\n"}
        </div>
        <textarea id="ingredients" value={value} onChange={e => { if (lines?.length) onLines?.(null); onChange(e.target.value); }}
          placeholder="e.g. Sugar, corn syrup, Red 40, …" aria-describedby={unsure.length ? "unsure-note" : undefined}
          className={`${box} absolute inset-0 h-full bg-transparent resize-none outline-none rounded-2xl text-foreground overflow-hidden`} />
      </div>
      {unsure.length > 0 && <p id="unsure-note" className="text-xs text-muted-foreground">Underlined: words EcoGo wasn't sure of ({unsure.join(", ")}).</p>}
      {note && <p className="text-xs text-muted-foreground">{note}</p>}

      {assessment && look && (
        <div role="status" className="rounded-2xl p-3.5 space-y-1.5" style={{ background: look.bg }}>
          <p className="flex items-center gap-1.5 text-[15px] font-extrabold" style={{ color: look.color }}>
            <look.Icon size={16} />{verdictHeadline(assessment)}
          </p>
          {assessment.flags.map(f => (
            <p key={f.entry.id} className="text-xs leading-snug" style={{ color: look.solid }}><b>{f.entry.name}:</b> {f.entry.concern}</p>
          ))}
          {assessment.concerns.filter(c => c.kind === "food").map(c => (
            <p key={c.id} className="text-xs leading-snug" style={{ color: look.solid }}><b>{c.name}:</b> {c.concern}</p>
          ))}
          {assessment.verdict === "none" && <>
            <p className="text-xs leading-snug text-gray-700">None of these ingredients match an official finding in EcoGo's list. That isn't the same as "healthy".</p>
            <button onClick={() => setExplainer(true)} className="text-xs font-bold text-[#1A5C39] underline min-h-[44px] text-left">
              Why "Nothing flagged" isn't "healthy"
            </button>
          </>}
        </div>
      )}
      {explainer && <Explainer id="not-healthy" onBack={() => setExplainer(false)} />}
    </div>
  );
}

/** Hidden file inputs behind "Take a photo" (the phone's camera app) and "Choose a photo" (the library), spec D5. */
export function PhotoButtons({ onPhoto }: { onPhoto: (file: File) => void }) {
  const camera = useRef<HTMLInputElement>(null);
  const library = useRef<HTMLInputElement>(null);
  const pick = (e: ChangeEvent<HTMLInputElement>) => { const f = e.target.files?.[0]; e.target.value = ""; if (f) onPhoto(f); };
  return (
    <div className="flex gap-2">
      <input ref={camera} type="file" accept="image/*" capture="environment" hidden onChange={pick} data-photo="camera" />
      <input ref={library} type="file" accept="image/*" hidden onChange={pick} data-photo="library" />
      <button onClick={() => camera.current?.click()}
        className="flex-1 min-h-[52px] rounded-2xl bg-[#1A5C39] text-white font-extrabold text-[15px]">Take a photo</button>
      <button onClick={() => library.current?.click()}
        className="min-h-[52px] px-4 rounded-2xl border border-border bg-white text-gray-900 font-bold text-sm">Choose a photo</button>
    </div>
  );
}

export function Reading() {
  return (
    <div role="status" className="flex flex-col items-center gap-3 py-10 text-center">
      <div className="w-10 h-10 rounded-full border-4 border-gray-200 border-t-[#1A5C39] animate-spin" aria-hidden="true" />
      <p className="text-sm font-bold">Reading the label…</p>
      <p className="text-xs text-muted-foreground max-w-[260px]">The first time, your phone downloads the reader once (about 7 MB). The photo stays on your phone.</p>
    </div>
  );
}

export default function IngredientCheck({ onClose }: { onClose: () => void }) {
  const [mode, setMode] = useState<"photo" | "type">("photo");
  const [text, setText] = useState("");
  const [unsure, setUnsure] = useState<string[]>([]);
  const [lines, setLines] = useState<LabelLine[] | null>();
  const [status, setStatus] = useState<"idle" | "reading" | "read">("idle");
  const [error, setError] = useState<string>();

  const onPhoto = async (file: File) => {
    setStatus("reading");
    const r = await readPhoto(await preparePhoto(file).catch(() => file)); // a small photo can still be read
    setText(r.text); setUnsure(r.unsure); setLines(r.lines); setError(r.error); setStatus("read");
  };
  const reset = () => { setText(""); setUnsure([]); setLines(undefined); setError(undefined); setStatus("idle"); };
  const showEditor = mode === "type" || status === "read";

  return (
    <div className="absolute inset-0 z-40 flex flex-col bg-[#F8F7F2] text-gray-900">
      <div className="px-4 pt-4 flex items-center justify-between">
        <h1 className="text-xl font-extrabold text-[#1A5C39]">Check ingredients</h1>
        <button onClick={onClose} aria-label="Close" className="w-11 h-11 rounded-full border border-border bg-white flex items-center justify-center">
          <X size={16} />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-4 pt-3.5 pb-4 space-y-3" style={{ scrollbarWidth: "none" }}>
        <div role="group" aria-label="How to enter the ingredients" className="grid grid-cols-2 gap-1.5 bg-gray-200 p-1 rounded-2xl">
          {(["photo", "type"] as const).map(m => (
            <button key={m} onClick={() => { setMode(m); if (m === "type") setLines(l => (l?.length ? null : l)); }} aria-pressed={mode === m} disabled={status === "reading"}
              className={`min-h-[44px] rounded-xl text-sm ${mode === m ? "bg-white font-extrabold text-[#1A5C39]" : "font-bold text-gray-700"}`}>
              {m === "photo" ? "Take a photo" : "Type it"}
            </button>
          ))}
        </div>

        {mode === "photo" && status === "idle" && <>
          <p className="text-sm text-gray-700 leading-relaxed">{INGREDIENTS_TIP}</p>
          <PhotoButtons onPhoto={onPhoto} />
        </>}
        {mode === "photo" && status === "reading" && <Reading />}
        {showEditor && <IngredientEditor value={text} onChange={setText} unsure={mode === "photo" ? unsure : []}
          note={mode === "photo" ? error : undefined} lines={mode === "photo" ? lines : undefined} onLines={setLines} />}

        <p className="text-xs text-gray-600 leading-relaxed">
          Without a barcode there's no nutrition label to look up, so this checks ingredients only. Nothing is saved or sent.
        </p>
      </div>

      {showEditor && (
        <div className="px-4 pt-3 pb-6">
          <button onClick={reset} className="w-full min-h-[52px] rounded-2xl border border-border bg-white font-extrabold text-[15px]">Check another</button>
        </div>
      )}
    </div>
  );
}
