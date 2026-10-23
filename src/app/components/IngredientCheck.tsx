// IngredientCheck.tsx — check an ingredient list without a barcode (M8 spec D2, §3): photograph or type it, see the
// same safety check as a product page. Nothing is saved or sent. Decision 058: the same check opens from a
// crowd-sourced OFF product as "Check the label yourself". IngredientEditor (the check box + live badge) is
// shared with AddProductFlow's "Check the ingredients" step. M16 N6: "What is it?" Food / Personal care; personal care
// runs the personal-care check (src/lib/safety/personalCare.ts) on the same photo or typed list.

import { useEffect, useId, useMemo, useRef, useState, type ChangeEvent, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import { assessProduct, type Assessment } from "../../lib/safety/assess";
import { analyzeCare, analyzeCleaner, CARE_LIMITS, CLEANER_LINE, MORE_DATA_MEANING, isMoreData, type CareAnalysis } from "../../lib/safety/personalCare";
import { cloudHelpOn, joinReads, pasteInto, readAnother, readPhoto, setCloudHelp, trimToIngredients, linesText, unsureCount, type LabelLine } from "../../lib/ocr";
import { isBlurry, preparePhoto } from "../../lib/photo";
import { latestWins } from "../../lib/latest";
import { VERDICT_STYLE, verdictHeadline } from "./verdict";
import Explainer from "./Explainer";
import WordFix from "./WordFix";

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

function careCheck(ingredients: string, cleaner: boolean): CareAnalysis | null {
  if (!ingredients.trim()) return null;
  try {
    return cleaner ? analyzeCleaner(ingredients) : analyzeCare(ingredients);
  } catch (err) {
    console.error("[safety] personal-care check failed for typed ingredients", err);
    return { verdict: "no-data", flags: [], checkedCount: 0, notes: [], limited: [] };
  }
}

export type CheckKind = "food" | "care" | "cleaner"; // 068 S3: a cleaner runs IARC findings only (analyzeCleaner)

/** M16 N2b: EU Annex III ingredients, one grey row closed by default; hidden when there are none. Never a badge. */
export function LimitedRow({ limited, className = "" }: { limited: CareAnalysis["limited"]; className?: string }) {
  if (limited.length === 0) return null;
  return (
    <details className={`rounded-xl bg-gray-100 text-gray-700 ${className}`}>
      <summary className="min-h-[44px] px-3 py-3.5 text-xs font-bold cursor-pointer">{/* list-item display keeps the open/close marker */}
        Limited, not banned: {limited.length} ingredient{limited.length === 1 ? "" : "s"}
      </summary>
      <ul className="px-3 pb-3 space-y-2">
        {limited.map(({ note, matchedText }) => (
          <li key={note.id} className="text-xs leading-snug">
            <b>{note.name}</b> <span className="text-gray-500">(listed as “{matchedText}”)</span>: {note.text}{" "}
            {note.sources.map((s, i) => (
              <span key={i}>{i > 0 && " · "}<a href={s.url} target="_blank" rel="noreferrer" className="underline">{s.finding}</a></span>
            ))}
          </li>
        ))}
      </ul>
    </details>
  );
}

/** 063 F3: FDA's own reading of "more data needed", once, when any sunscreen row says it. */
export function MoreDataLine({ notes, className = "" }: { notes: CareAnalysis["notes"]; className?: string }) {
  if (!notes.some(n => isMoreData(n.note))) return null;
  const [s] = MORE_DATA_MEANING.sources;
  return (
    <p className={`text-xs leading-snug text-gray-700 ${className}`}>
      {MORE_DATA_MEANING.text} <a href={s.url} target="_blank" rel="noreferrer" className="underline">{s.body}, sunscreen Q&amp;A (Q9)</a>
    </p>
  );
}

/** The photo tip; 070 (Minh's option A): with cloud help on, it says hard photos go there. */
export const ingredientsTip = (cloud: boolean) =>
  `Photograph the ingredients list: flat, in good light, with no glare. EcoGo reads the words on your phone${cloud ? ", and hard ones with cloud help" : ""}.`;
/** 070 (option A): what the check sends, said wherever it promised "Nothing is saved or sent." */
export const nothingSent = (cloud: boolean) => cloud ? "Nothing is saved. With cloud help on, a hard-to-read photo is sent to OCR.space." : "Nothing is saved or sent.";
export const CLOUD_BUSY = "Cloud help is busy today. We read the photo on your phone instead.";

/** 070 C2: "Cloud help for hard labels", off until turned on, remembered on this device (ocr.ts). Words as approved
 *  (planner's wording note §5, Minh: "as drafted"); OCR.space's own words checked on ocr.space/privacypolicy 2026-10-22. */
export function CloudHelpSwitch({ on, onChange, className = "" }: { on: boolean; onChange: (on: boolean) => void; className?: string }) {
  const about = useId();
  return (
    <div className={`space-y-1 text-left ${className}`}>
      <label className="flex items-center gap-3 min-h-[44px] text-sm font-bold">
        <input type="checkbox" role="switch" checked={on} aria-describedby={about} className="w-[22px] h-[22px] m-0 flex-shrink-0"
          onChange={e => { setCloudHelp(e.target.checked); onChange(e.target.checked); }} />
        Cloud help for hard labels
      </label>
      <p id={about} className="text-xs leading-relaxed">
        When this is on, a photo we can't read well is sent to OCR.space, a free reading service, through EcoGo's server.
        OCR.space says: "All uploaded documents are deleted after processing." It logs the address the request comes from
        (EcoGo's server, not your phone) for a month. Only photograph the label, never anything private.
      </p>
    </div>
  );
}

/** Numbered photo tips, one compact row (M8 follow-up 3, H3): above Take photo on the ingredients and nutrition steps,
 *  and inside the photo notices. */
export function PhotoTips({ kind = "ingredients", className = "" }: { kind?: "ingredients" | "nutrition"; className?: string }) {
  const tips = ["Lay it flat", "Close & sharp", kind === "nutrition" ? "Only the nutrition table" : "Only the ingredients", "No glare"];
  return (
    <ol aria-label="Photo tips" className={`flex flex-wrap gap-x-3 gap-y-1 text-xs font-bold ${className}`}>
      {tips.map((t, i) => (
        <li key={t} className="flex items-center gap-1">
          <span className="w-4 h-4 rounded-full bg-[#F59E0B] text-[#1A1200] text-[10px] flex items-center justify-center" aria-hidden="true">{i + 1}</span>{t}
        </li>
      ))}
    </ol>
  );
}

/** A hint about the photo, never a block: "This photo is hard to read." (048 G4, after reading) or "This photo looks
 *  blurry." (049 H2, before reading). */
export function PhotoNotice({ title, kind = "ingredients", onRetake, onUseAnyway }: {
  title: string; kind?: "front" | "ingredients" | "nutrition"; onRetake: () => void; onUseAnyway: () => void;
}) {
  return (
    <div role="alert" className="bg-white text-gray-900 border border-border rounded-2xl p-4 space-y-3">
      <p className="text-base font-extrabold">{title}</p>
      {kind !== "front" && <PhotoTips kind={kind} className="text-gray-700" />}{/* H3 defines tips for these two only */}
      <button onClick={onRetake} className="w-full min-h-[52px] rounded-2xl bg-[#1A5C39] text-white font-extrabold text-[15px]">Retake photo</button>
      <button onClick={onUseAnyway} className="w-full min-h-[44px] rounded-2xl border border-border bg-white font-bold text-sm">Use it anyway</button>
    </div>
  );
}

/** The note above the lines, naming the words the trim found (M8 follow-up F2). */
function linesNote(a?: string, b?: string): string {
  if (!a && !b) return "Untick any line that isn't an ingredient.";
  return `We kept the part ${a && b ? `from "${a}" to "${b}"` : a ? `from "${a}" on` : `up to "${b}"`}. Tick or untick lines, or edit the text below.`;
}

/** Editable ingredients with unsure words underlined, and the live badge. The underlines are drawn by a copy of the
 *  text (transparent, in flow, so the box grows with it) behind a transparent textarea laid exactly over it.
 *  With `lines` (read from a photo), each line can be ticked or unticked and the box follows; the first keystroke in the
 *  box hides the lines for good (onLines(null)), so the box is the final say (follow-up F2, F3).
 *  With `read` (a hard-to-read photo, follow-up 6 K2), the box starts empty and "Show what we read" puts it there. */
export function IngredientEditor({ value, onChange, unsure, note, lines, onLines, read, onShowRead, from, kind = "food", onRetake, children }: {
  value: string; onChange: (text: string) => void; unsure: string[]; note?: string; children?: ReactNode;
  lines?: LabelLine[] | null; onLines?: (lines: LabelLine[] | null) => void; read?: string; onShowRead?: () => void;
  /** 066 R4: "Retake photo" in the sheet for an unsure word. */
  onRetake?: () => void;
  /** 058 L1: where the result comes from, said inside it ("From your photo, not from Open Food Facts."). */
  from?: string;
  /** M16 N6: which check runs. */
  kind?: CheckKind;
}) {
  const assessment = useMemo(() => (kind === "food" ? check(value) : null), [value, kind]);
  const care = useMemo(() => (kind !== "food" ? careCheck(value, kind === "cleaner") : null), [value, kind]);
  // 075 M3 (audit A1), as on Home: the article covers the whole screen (the link's positioned ancestor, as before). It
  // goes there, everything else on that screen is inert meanwhile, and Back returns focus to the link.
  const link = useRef<HTMLButtonElement>(null);
  const [cover, setCover] = useState<HTMLElement | null>(null);
  useEffect(() => {
    if (!cover) return;
    const behind = [...cover.children].filter(e => !e.hasAttribute("data-article")) as HTMLElement[];
    behind.forEach(e => { e.inert = true; });
    return () => { behind.forEach(e => { e.inert = false; }); link.current?.focus(); };
  }, [cover]);
  const unsureSet = new Set(unsure);
  const box = "w-full min-h-[120px] p-3 text-sm leading-relaxed font-[inherit] whitespace-pre-wrap break-words";
  const look = assessment ? VERDICT_STYLE[assessment.verdict] : care && VERDICT_STYLE[care.verdict];
  const [showAll, setShowAll] = useState(false);
  const found = trimToIngredients((lines ?? []).map(l => l.text).join("\n"));
  // G5: with a start or stop word found, lines left out (and not ticked) wait behind a button.
  const listed = (l: LabelLine) => showAll || !(found.startWord || found.stopWord) || l.kept !== "" || l.on;
  const hidden = lines?.filter(l => !listed(l)).length ?? 0;
  const unsureN = unsureCount(value, unsure).unsure; // G6: the box's own words
  // Typing in the box, or a fix chosen under it, hides the lines for good: the box is the final say (F3).
  const edit = (text: string) => { if (lines?.length) onLines?.(null); onChange(text); };
  const tick = (i: number) => {
    const next = lines!.map((l, j) => (j === i ? { ...l, on: !l.on } : l));
    onLines?.(next); onChange(linesText(next));
  };
  return (
    <div className="space-y-3">
      {lines && lines.length > 0 && <>
        <p className="text-sm text-gray-700 leading-relaxed">{linesNote(found.startWord, found.stopWord)}</p>
        {hidden < lines.length && <ul aria-label="Lines read from the photo" className="bg-white rounded-2xl border border-border divide-y divide-border">
          {lines.map((l, i) => listed(l) && (
            <li key={i}>
              <label className="flex gap-2.5 items-start px-3 py-2.5 min-h-[44px] text-sm leading-snug">
                <input type="checkbox" checked={l.on} onChange={() => tick(i)} className="w-[22px] h-[22px] m-0 flex-shrink-0" />
                <span className={l.on ? "" : "text-gray-500"}>{l.kept || l.text}</span>
              </label>
            </li>
          ))}
        </ul>}{/* K5: never an empty card */}
        {hidden > 0 && (
          <button onClick={() => setShowAll(true)} className="text-sm font-bold text-[#1A5C39] underline min-h-[44px]">
            Show {hidden} more line{hidden > 1 ? "s" : ""} we left out
          </button>
        )}
      </>}
      {lines === null && <p className="text-xs text-muted-foreground">You're editing the text directly.</p>}
      {read !== undefined && <p className="text-sm text-gray-700 leading-relaxed">We couldn't read this label well. Type the ingredients below.</p>}
      {read && !value && ( // only into an empty box: never over what the person typed
        <button onClick={onShowRead} className="text-sm font-bold text-[#1A5C39] underline min-h-[44px]">Show what we read</button>
      )}
      <label htmlFor="ingredients" className="block text-sm font-bold">Ingredients</label>
      <div className="relative rounded-2xl border-2 border-[#1A5C39] bg-white">
        <div aria-hidden="true" className={`${box} text-transparent pointer-events-none`}>
          {/* Split into words (odd parts) and what's between them; no lookbehind, which older iOS Safari can't parse. */}
          {value.split(/([\p{L}\p{N}]+)/u).map((part, i) => (i % 2 && unsureSet.has(part)
            ? <span key={i} style={{ textDecoration: "underline wavy #D97706", textDecorationSkipInk: "none" }}>{part}</span>
            : part))}{"\n"}
        </div>
        <textarea id="ingredients" value={value} onChange={e => edit(e.target.value)}
          placeholder={kind !== "food" ? "e.g. Water, Glycerin, Fragrance, …" : "e.g. Sugar, corn syrup, Red 40, …"} aria-describedby={unsureN ? "unsure-note" : undefined}
          className={`${box} absolute inset-0 h-full bg-transparent resize-none outline-none rounded-2xl text-foreground overflow-hidden`} />
      </div>
      {unsureN > 0 && <p id="unsure-note" className="text-xs text-muted-foreground">{unsureN === 1 ? "1 word underlined: check it." : `${unsureN} words underlined: check them.`}</p>}
      {lines !== undefined && <WordFix text={value} unsure={unsure} onChange={edit} onRetake={onRetake} />}{/* text from a photo only */}
      {children}{/* 066 R9: Add another photo, under the chips */}
      {note &&<p className="text-xs text-muted-foreground">{note}</p>}

      {assessment && look && (
        <div role="status" className="rounded-2xl p-3.5 space-y-1.5" style={{ background: look.bg }}>
          <p className="flex items-center gap-1.5 text-[15px] font-extrabold" style={{ color: look.color }}>
            <look.Icon size={16} />{verdictHeadline(assessment)}
          </p>
          {from && <p className="text-xs font-bold text-gray-700">{from}</p>}
          {assessment.flags.map(f => (
            <p key={f.entry.id} className="text-xs leading-snug" style={{ color: look.solid }}><b>{f.entry.name}:</b> {f.entry.concern}</p>
          ))}
          {assessment.concerns.filter(c => c.kind === "food").map(c => (
            <p key={c.id} className="text-xs leading-snug" style={{ color: look.solid }}><b>{c.name}:</b> {c.concern}</p>
          ))}
          {assessment.verdict === "none" && <>
            <p className="text-xs leading-snug text-gray-700">None of these ingredients match an official finding in EcoGo's list. That isn't the same as "healthy".</p>
            <button ref={link} onClick={() => setCover(link.current?.offsetParent as HTMLElement | null)} className="text-xs font-bold text-[#1A5C39] underline min-h-[44px] text-left">
              Why "Nothing flagged" isn't "healthy"
            </button>
          </>}
        </div>
      )}
      {care && look && (
        <div role="status" className="rounded-2xl p-3.5 space-y-1.5" style={{ background: look.bg }}>
          <p className="flex items-center gap-1.5 text-[15px] font-extrabold" style={{ color: look.color }}>
            <look.Icon size={16} />{verdictHeadline(care, true)}
          </p>
          {from && <p className="text-xs font-bold text-gray-700">{from}</p>}
          {care.flags.map(f => (
            <p key={f.entry.id} className="text-xs leading-snug" style={{ color: look.solid }}>
              <b>{f.entry.name}:</b> {f.entry.concern}{f.entry.context && ` ${f.entry.context}`}
            </p>
          ))}
          {care.notes.length > 0 && <ul aria-label="Good to know" className="space-y-1 pt-0.5">
            {care.notes.map(n => <li key={n.note.id} className="text-xs leading-snug text-gray-700"><b>{n.note.name}:</b> {n.note.text}</li>)}
          </ul>}
          <MoreDataLine notes={care.notes} />
          <p className="text-xs leading-snug text-gray-700">{kind === "cleaner" ? CLEANER_LINE : CARE_LIMITS}</p>
          <LimitedRow limited={care.limited} />
        </div>
      )}
      {cover && createPortal(<div data-article><Explainer id="not-healthy" onBack={() => setCover(null)} /></div>, cover)}
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

/** 066 R9 (Minh's words): more photos of a curved or cut-off label, each read and joined (ocr.ts joinReads) to the box's
 *  text as it is when the read ends, so the box stays editable and in place meanwhile. A blurry photo gets the usual
 *  notice here ("Retake photo" leaves the box as it was). `begin` is the screen's latest-wins: Type it, Check another,
 *  Retake or Close drop a read. One button: without `capture` the phone offers its camera or its library. */
export function AnotherPhoto({ text, unsure, cloud, begin, onRead, onError }: {
  text: string; unsure: string[]; cloud: boolean; begin: () => () => boolean;
  onRead: (r: { text: string; unsure: string[] }) => void; onError: (message: string) => void;
}) {
  const input = useRef<HTMLInputElement>(null);
  const now = useRef({ text, unsure });
  now.current = { text, unsure };
  const [busy, setBusy] = useState(false);
  const [blurry, setBlurry] = useState<Blob>();
  const [added, setAdded] = useState<{ n: number; joined: boolean; cloudBusy?: boolean }>();
  const read = async (photo: Blob, live = begin()) => {
    setBlurry(undefined); setBusy(true);
    const r = await readAnother(photo, () => cloud && live()); // 070: a hard one goes to cloud help too, with the switch on
    if (!live()) return;
    setBusy(false);
    if ("error" in r) return onError(r.error);
    const j = joinReads(now.current.text, r.text);
    onRead({ text: j.text, unsure: [...new Set([...now.current.unsure, ...r.unsure])] });
    setAdded(a => ({ n: (a?.n ?? 1) + 1, joined: j.joined, cloudBusy: r.busy }));
  };
  const pick = async (e: ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]; e.target.value = "";
    if (!f) return;
    const live = begin(); setBusy(true);
    const photo = (await preparePhoto(f).catch(() => undefined)) ?? f;
    const blurred = live() && await isBlurry(photo);
    if (!live()) return;
    if (blurred) { setBusy(false); setBlurry(photo); } else await read(photo, live);
  };
  if (blurry) return <PhotoNotice title="This photo looks blurry." onRetake={() => setBlurry(undefined)} onUseAnyway={() => read(blurry)} />;
  return (
    <div className="space-y-1.5">
      <p aria-live="polite" className="text-xs font-bold text-gray-700">{/* not role="status": that's the verdict below */}
        {busy ? "Reading the label…" : added && `${added.cloudBusy ? `${CLOUD_BUSY} ` : ""}${added.joined ? `Joined ${added.n} photos. Check where they meet.` : "Added the new photo's text at the end. Check it."}`}
      </p>
      <p className="text-sm text-gray-700">Curvy label? Cut off? Add more pics.</p>
      <input ref={input} type="file" accept="image/*" hidden onChange={pick} data-photo="another" />
      <button onClick={() => input.current?.click()} disabled={busy}
        className="w-full min-h-[44px] rounded-2xl border-2 border-[#1A5C39] bg-white text-[#1A5C39] font-bold text-sm disabled:opacity-50">Add another photo</button>
    </div>
  );
}

export function Reading({ cloud }: { cloud: boolean }) {
  return (
    <div role="status" className="flex flex-col items-center gap-3 py-10 text-center">
      <div className="w-10 h-10 rounded-full border-4 border-gray-200 border-t-[#1A5C39] animate-spin" aria-hidden="true" />
      <p className="text-sm font-bold">Reading the label…</p>
      <p className="text-xs text-muted-foreground max-w-[260px]">The first time, your phone downloads the reader once (about 13 MB).{!cloud && " The photo stays on your phone."}</p>
    </div>
  );
}

/** Without `product`: the Scan drawer's no-barcode check. With it (decision 058 L1): "Check the label yourself" for a
 *  crowd-sourced product, named in the header; `onSendPhotos` (L2) hands the label photo to Send new photos (food only).
 *  `kind` (M16 N6): the "What is it?" answer it starts on; `source`: where the product page's data came from. */
export default function IngredientCheck({ onClose, product, onSendPhotos, kind: startKind = "food", source = "Open Food Facts" }: {
  onClose: () => void; product?: string; onSendPhotos?: (photo: Blob) => void; kind?: CheckKind; source?: string;
}) {
  const [mode, setMode] = useState<"photo" | "type">("photo");
  const [kind, setKind] = useState<CheckKind>(startKind);
  const [sendable, setSendable] = useState<Blob>(); // L2: the prepared (sendable) photo; not a raw one preparePhoto refused
  const title = useRef<HTMLHeadingElement>(null);
  useEffect(() => { if (product) title.current?.focus(); }, []);
  const [text, setText] = useState("");
  const [unsure, setUnsure] = useState<string[]>([]);
  const [lines, setLines] = useState<LabelLine[] | null>();
  const [status, setStatus] = useState<"idle" | "reading" | "read">("idle");
  const [error, setError] = useState<string>();
  const [hard, setHard] = useState(false);
  const [blurry, setBlurry] = useState<Blob>(); // 049 H2: a photo waiting on "Retake photo" / "Use it anyway"
  const [readText, setReadText] = useState<string>(); // K2: a hard-to-read photo's text, behind "Show what we read"
  const [cloud, setCloud] = useState(cloudHelpOn); // 070 C2
  const [cloudBusy, setCloudBusy] = useState(false);

  // RW1-01: latest photo wins. A photo, Type it, Check another, Retake or Close begins anew; a slow preparation, blur
  // check or read whose own check (`live`) went false since then is dropped.
  const [begin] = useState(latestWins);
  useEffect(() => () => { begin(); }, []); // 075 H1: however the check closes, a read still going sends nothing to cloud help
  const read = async (photo: Blob, blurOk: boolean, live = begin()) => {
    setBlurry(undefined); setStatus("reading");
    const r = await readPhoto(photo, () => cloud && live());
    if (!live()) return;
    // After "Use it anyway" on a blurry photo, the hard-to-read hint doesn't show again for it (H2); the box starts empty either way (K2).
    setText(r.text); setUnsure(r.unsure); setLines(r.lines); setError(r.error); setReadText(r.read); setHard(r.hard && !blurOk); setCloudBusy(!!r.busy); setStatus("read");
  };
  const onPhoto = async (file: File) => {
    const live = begin();
    const prepared = await preparePhoto(file).catch(() => undefined);
    const photo = prepared ?? file; // a small photo can still be read
    const blurred = live() && await isBlurry(photo);
    if (!live()) return;
    setSendable(prepared);
    if (blurred) setBlurry(photo); else await read(photo, false, live);
  };
  // 068 S2: the clipboard is read only on this tap. The box gets focus first, inside the tap (iOS ignores a focus after
  // an await), so when the read is refused, unsupported or empty the person can long-press → Paste.
  const paste = async () => {
    document.getElementById("ingredients")?.focus();
    let clip = "";
    try { clip = await navigator.clipboard.readText(); } catch { /* refused or no clipboard API */ }
    if (pasteInto("", clip) !== null) setText(t => pasteInto(t, clip)!);
  };
  const reset = () => { begin(); setSendable(undefined); setText(""); setUnsure([]); setLines(undefined); setError(undefined); setReadText(undefined); setHard(false); setBlurry(undefined); setCloudBusy(false); setStatus("idle"); };
  const showHard = mode === "photo" && status === "read" && hard;
  const showEditor = (mode === "type" || status === "read") && !showHard;

  return (
    <div role="dialog" aria-modal="true" aria-labelledby="check-title" onKeyDown={e => { if (e.key === "Escape") { begin(); onClose(); } }}
      className="absolute inset-0 z-40 flex flex-col bg-[#F8F7F2] text-gray-900">
      <div className="px-4 pt-4 flex items-center justify-between gap-3">
        <div className="min-w-0">
          {product && <p id="check-product" className="text-xs font-bold text-gray-600 truncate">{product}</p>}
          <h1 id="check-title" ref={title} tabIndex={-1} aria-describedby={product ? "check-product" : undefined}
            className="text-xl font-extrabold text-[#1A5C39] focus:outline-none">{product ? "Check the label yourself" : "Check ingredients"}</h1>
        </div>
        <button onClick={() => { begin(); onClose(); }} aria-label="Close" className="w-11 h-11 rounded-full border border-border bg-white flex items-center justify-center">
          <X size={16} />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-4 pt-3.5 pb-4 space-y-3" style={{ scrollbarWidth: "none" }}>
        <div role="group" aria-labelledby="check-kind" className="space-y-1.5">
          <p id="check-kind" className="text-sm font-bold">What is it?</p>
          <div className="grid grid-cols-3 gap-1.5">
            {([["food", "Food"], ["care", "Personal care"], ["cleaner", "Cleaning product"]] as const).map(([k, label]) => (
              <button key={k} onClick={() => setKind(k)} aria-pressed={kind === k}
                className={`min-h-[44px] px-1 rounded-xl text-sm leading-tight bg-white ${kind === k ? "border-2 border-[#1A5C39] font-extrabold text-[#1A5C39]" : "border border-border font-bold text-gray-700"}`}>
                {label}
              </button>
            ))}
          </div>
        </div>
        <div role="group" aria-label="How to enter the ingredients" className="grid grid-cols-2 gap-1.5 bg-gray-200 p-1 rounded-2xl">
          {(["photo", "type"] as const).map(m => (
            <button key={m} onClick={() => { if (m !== mode) begin(); setMode(m); if (m === "type") setLines(l => (l?.length ? null : l)); }} aria-pressed={mode === m} disabled={status === "reading"}
              className={`min-h-[44px] rounded-xl text-sm ${mode === m ? "bg-white font-extrabold text-[#1A5C39]" : "font-bold text-gray-700"}`}>
              {m === "photo" ? "Take a photo" : "Type it"}
            </button>
          ))}
        </div>
        {mode === "type" && <>
          <p className="text-sm text-gray-700 leading-relaxed">On iPhone: open the photo, press and hold the words, tap Copy, then tap Paste here.</p>
          <button onClick={paste} className="w-full min-h-[44px] rounded-2xl border-2 border-[#1A5C39] bg-white text-[#1A5C39] font-bold text-sm">Paste</button>
        </>}

        {mode === "photo" && status === "idle" && (blurry
          ? <PhotoNotice title="This photo looks blurry." onRetake={() => setBlurry(undefined)} onUseAnyway={() => read(blurry, true)} />
          : <>
            <p className="text-sm text-gray-700 leading-relaxed">{ingredientsTip(cloud)}</p>
            <PhotoTips className="text-gray-700" />
            <PhotoButtons onPhoto={onPhoto} />
            <CloudHelpSwitch on={cloud} onChange={setCloud} className="text-gray-700" />
          </>)}
        {mode === "photo" && status === "reading" && <Reading cloud={cloud} />}
        {mode === "photo" && status === "read" && cloudBusy && <p role="alert" className="text-sm font-bold text-gray-700">{CLOUD_BUSY}</p>}
        {showHard && <PhotoNotice title="This photo is hard to read." onRetake={reset} onUseAnyway={() => setHard(false)} />}
        {showEditor && <IngredientEditor value={text} onChange={setText} unsure={mode === "photo" ? unsure : []}
          note={mode === "photo" ? error : undefined} lines={mode === "photo" ? lines : undefined} onLines={setLines}
          read={mode === "photo" ? readText : undefined} onShowRead={() => { setText(readText!); setReadText(undefined); }}
          from={product && (status === "read" ? `From your photo, not from ${source}.` : `From what you typed, not from ${source}.`)} kind={kind}
          onRetake={mode === "photo" ? reset : undefined}>{/* read text stays "from your photo" after Type it */}
          {mode === "photo" && <AnotherPhoto text={text} unsure={unsure} cloud={cloud} begin={begin} onError={setError}
            onRead={r => { setText(r.text); setUnsure(r.unsure); setLines(null); setError(undefined); setReadText(undefined); }} />}
        </IngredientEditor>}

        <p className="text-xs text-gray-600 leading-relaxed">
          {product || kind !== "food" ? "This checks the ingredients only. " : "Without a barcode there's no nutrition label to look up, so this checks ingredients only. "}
          {nothingSent(cloud)}
        </p>
      </div>

      {showEditor && (
        <div className="px-4 pt-3 pb-6 space-y-2">
          {/* L2: only after a photo check (typed text is never sent to OFF) */}
          {onSendPhotos && kind === "food" && mode === "photo" && sendable && (
            <button onClick={() => { begin(); onSendPhotos(sendable); }}
              className="w-full min-h-[52px] rounded-2xl border-2 border-[#1A5C39] bg-white text-[#1A5C39] font-extrabold text-[15px]">Also send these photos to Open Food Facts</button>
          )}
          <button onClick={reset} className="w-full min-h-[52px] rounded-2xl border border-border bg-white font-extrabold text-[15px]">Check another</button>
        </div>
      )}
    </div>
  );
}
