// WordFix.tsx — 066 R4 (Minh, 2026-10-22: "Layout: row under the box. … Button words as drafted."): under the
// ingredients box, a row of the words the reader wasn't sure of and of items that look like two names run together.
// Each opens a small sheet: up to 3 real names from EcoGo's lists and USDA FoodData Central, "Or type it", "Retake
// photo", "Keep as read"; or "Add comma" / "No". Nothing changes until the person taps; the box stays the final say.
// 071 I: for typed and pasted text too; a stretch a few letters off a name of two or more words is one chip ("ED&C YILLOW
// 0. 5" → "FD&C YELLOW NO. 5"), and the row says what it couldn't read (W3, Minh's wording).
import { useEffect, useId, useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import { addComma, replaceWord, suggestWords, type fixList, type nameFixes } from "../../lib/suggest";

const CHIP = "min-h-[44px] px-3.5 rounded-full border border-[#D97706] bg-white text-sm font-bold text-gray-900 break-all text-left";
const MAX = 8;
type Split = ReturnType<typeof fixList>["splits"][number];
const short = (s: string, n: number) => (s.length > n ? `…${s.slice(-n)}` : s);

export default function WordFix({ text, fixes, onChange, onRetake }: {
  text: string; fixes: ReturnType<typeof fixList> & { names: ReturnType<typeof nameFixes> }; onChange: (text: string) => void; onRetake?: () => void;
}) {
  const [kept, setKept] = useState<string[]>([]); // "Keep as read" words and "No" splits
  const [all, setAll] = useState(false);
  const [open, setOpen] = useState<{ word: string } | { split: Split }>();
  const opener = useRef<HTMLElement | null>(null);
  const row = useRef<HTMLDivElement>(null);
  // A stretch's chip stands for the words in it ("YILLOW" is fixed with "ED&C YILLOW 0. 5").
  const inName = (w: string) => fixes.names.some(n => n.text.split(/[^\p{L}\p{N}]+/u).includes(w));
  const words = [...fixes.names.map(n => n.text), ...fixes.words.filter(w => !inName(w))].filter(w => !kept.includes(w));
  const named = (w: string) => fixes.names.find(n => n.text === w);
  const splits = fixes.splits.filter(s => !kept.includes(`${s.before}|${s.after}`));
  if (!words.length && !splits.length && !open) return null;

  const close = () => {
    setOpen(undefined);
    // Back to the chip that opened the sheet, or (it went: the word was fixed) the row's first chip, or the box.
    setTimeout(() => (opener.current?.isConnected ? opener.current : row.current?.querySelector("button") ?? document.getElementById("ingredients"))?.focus());
  };
  const show = (o: NonNullable<typeof open>) => (e: { currentTarget: HTMLElement }) => { opener.current = e.currentTarget; setOpen(o); };
  return (
    <div ref={row} className="space-y-2">
      {words.length > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          <p className="text-sm font-bold">Check {words.length} word{words.length > 1 ? "s" : ""}:</p>
          {(all ? words : words.slice(0, MAX)).map(w => (
            <button key={w} onClick={show({ word: w })} className={CHIP}>{w} <span aria-hidden="true">›</span></button>
          ))}
          {!all && words.length > MAX && <button onClick={() => setAll(true)} className={`${CHIP} border-border`}>+{words.length - MAX} more</button>}
          <p className="w-full text-sm text-gray-700">We couldn't read: {words.join(", ")}. Fix them above or retake the photo.</p>
        </div>
      )}
      {splits.length > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          <p className="text-sm font-bold">Add a comma?</p>
          {splits.map(s => (
            <button key={`${s.before}|${s.after}`} onClick={show({ split: s })} className={CHIP}>
              {short(s.before, 12)}, {short(s.after, 24)} <span aria-hidden="true">›</span>
            </button>
          ))}
        </div>
      )}
      {open && <Sheet onClose={close} {...("word" in open ? {
        title: `"${open.word}"`,
        body: <WordChoices word={open.word} name={named(open.word)?.by} onRetake={onRetake && (() => { setOpen(undefined); onRetake(); })}
          onUse={by => { onChange(named(open.word) ? text.split(open.word).join(by) : replaceWord(text, open.word, by)); close(); }}
          onKeep={() => { setKept(k => [...k, open.word]); close(); }} />,
      } : {
        title: `Add a comma between ${open.split.before} and ${open.split.after}?`,
        body: <div className="flex gap-2">
          <button onClick={() => { onChange(addComma(text, open.split.at)); close(); }}
            className="flex-1 min-h-[48px] rounded-2xl bg-[#1A5C39] text-white font-extrabold text-[15px]">Add comma</button>
          <button onClick={() => { setKept(k => [...k, `${open.split.before}|${open.split.after}`]); close(); }}
            className="flex-1 min-h-[48px] rounded-2xl border border-border bg-white font-bold text-sm">No</button>
        </div>,
      })} />}
    </div>
  );
}

function WordChoices({ word, name, onUse, onKeep, onRetake }: { word: string; name?: string; onUse: (by: string) => void; onKeep: () => void; onRetake?: () => void }) {
  const [typed, setTyped] = useState(word);
  const names = name ? [name] : suggestWords(word);
  const inputId = useId();
  return <>
    {names.length > 0 && <div className="space-y-2">
      <p className="text-sm font-bold">Did you mean</p>
      {names.map(n => <button key={n} onClick={() => onUse(n)} className="w-full min-h-[48px] px-3 rounded-2xl border-2 border-[#1A5C39] bg-white text-left font-extrabold text-[15px] break-all">{n}</button>)}
      <p className="text-xs text-muted-foreground">Suggested names come from EcoGo's lists and USDA FoodData Central.</p>
    </div>}
    <form className="space-y-1.5" onSubmit={e => { e.preventDefault(); if (typed.trim()) onUse(typed.trim()); }}>
      <label htmlFor={inputId} className="block text-sm font-bold">Or type it</label>
      <div className="flex gap-2">
        <input id={inputId} value={typed} onChange={e => setTyped(e.target.value)} autoComplete="off" autoCapitalize="characters"
          className="flex-1 min-w-0 min-h-[44px] px-3 rounded-xl border border-border text-sm" />
        <button type="submit" disabled={!typed.trim()} className="min-h-[44px] px-4 rounded-xl bg-[#1A5C39] text-white text-sm font-bold disabled:opacity-50">Use</button>
      </div>
    </form>
    <div className="flex gap-2">
      {onRetake && <button onClick={onRetake} className="flex-1 min-h-[44px] rounded-2xl border border-border bg-white font-bold text-sm">Retake photo</button>}
      <button onClick={onKeep} className="flex-1 min-h-[44px] rounded-2xl border border-border bg-white font-bold text-sm">Keep as read</button>
    </div>
  </>;
}

/** A bottom sheet over the screen (SaveSheet's pattern): focus on its title when it opens, Escape or a tap outside
 *  closes it, Tab stays inside. */
function Sheet({ title, body, onClose }: { title: string; body: ReactNode; onClose: () => void }) {
  const titleId = useId();
  const panel = useRef<HTMLDivElement>(null);
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => heading.current?.focus(), []);
  const onKeyDown = (e: KeyboardEvent) => {
    if (e.key === "Escape") { e.stopPropagation(); onClose(); return; }
    if (e.key !== "Tab" || !panel.current) return;
    const f = [...panel.current.querySelectorAll<HTMLElement>("button:not(:disabled), input")];
    const first = f[0], last = f[f.length - 1];
    if (e.shiftKey && (document.activeElement === first || document.activeElement === heading.current)) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
  };
  return (
    <div className="absolute inset-0 z-[60] flex items-end bg-black/40" onClick={e => { if (e.target === e.currentTarget) onClose(); }} onKeyDown={onKeyDown}>
      <div ref={panel} role="dialog" aria-modal="true" aria-labelledby={titleId} className="w-full bg-card rounded-t-3xl px-5 pt-5 pb-6 space-y-3">
        <h2 id={titleId} ref={heading} tabIndex={-1} className="text-lg font-extrabold break-all outline-none">{title}</h2>
        {body}
      </div>
    </div>
  );
}
