// AddProductFlow.tsx — add a product that was found nowhere to Open Food Facts (M8 spec §3, layout A, one step per
// screen): front photo → ingredients photo (read on the phone) → check the text → nutrition photo → Send → Sent.
// Everything stays in this screen's state until Send, so a failed send loses nothing.

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { X, Check } from "lucide-react";
import { preparePhoto } from "../../lib/photo";
import { submitProduct, type SubmitReason } from "../../lib/contribute";
import { loadTurnstile, turnstileToken } from "../../lib/turnstile";
import { supabase } from "../../lib/supabase";
import { IngredientEditor, PhotoButtons, Reading, readPhoto } from "./IngredientCheck";

type Kind = "front" | "ingredients" | "nutrition";
type Step = Kind | "reading" | "check" | "send" | "sending" | "sent" | "failed";

const FAILED: Record<SubmitReason, string> = {
  "limit-you": "You've sent 10 today. Thanks! Try again tomorrow.",
  "limit-all": "EcoGo has reached today's limit. Try again tomorrow.",
  captcha: "Couldn't confirm you're not a robot. Try again.",
  "off-down": "Open Food Facts didn't answer. Try again later.",
  invalid: "Open Food Facts couldn't take this as it is. Check the ingredients and try again.",
};
const HOW: Record<Kind, string> = {
  front: "Photograph the front of the package, with its name showing.",
  ingredients: "Photograph the ingredients list: flat, in good light, with no glare. EcoGo reads the words on your phone.",
  nutrition: "Photograph the Nutrition Facts panel. Open Food Facts reads the numbers from it.",
};
const LABEL: Record<Kind, string> = { front: "Front", ingredients: "Ingredients", nutrition: "Nutrition" };

/** An object URL for a photo, released when it changes or the screen closes. */
function useObjectUrl(blob?: Blob) {
  const url = useMemo(() => (blob ? URL.createObjectURL(blob) : undefined), [blob]);
  useEffect(() => () => { if (url) URL.revokeObjectURL(url); }, [url]);
  return url;
}

function Thumb({ blob, label }: { blob?: Blob; label: string }) {
  const url = useObjectUrl(blob);
  return url
    ? <img src={url} alt={`${label} photo`} className="h-20 w-full rounded-xl object-cover bg-gray-200" />
    : <div className="h-20 rounded-xl bg-gray-200 flex items-center justify-center text-xs text-gray-600">{label}: skipped</div>;
}

export default function AddProductFlow({ code, onDone, onClose }: { code: string; onDone: () => void; onClose: () => void }) {
  const [step, setStep] = useState<Step>("front");
  const [photos, setPhotos] = useState<Partial<Record<Kind, Blob>>>({});
  const [photoError, setPhotoError] = useState<string>();
  const [text, setText] = useState("");
  const [unsure, setUnsure] = useState<string[]>([]);
  const [readError, setReadError] = useState<string>();
  const [name, setName] = useState("");
  const [consent, setConsent] = useState(false);
  const [failed, setFailed] = useState<SubmitReason>("off-down");
  const human = useRef<HTMLDivElement>(null);

  useEffect(() => { if (step === "send") loadTurnstile().catch(() => {}); }, [step]); // D8: only on the Send screen

  const next: Record<Kind, Step> = { front: "ingredients", ingredients: "check", nutrition: "send" };
  const onPhoto = (kind: Kind) => async (file: File) => {
    setPhotoError(undefined);
    let blob: Blob;
    try { blob = await preparePhoto(file); } catch (err) { setPhotoError((err as Error).message); return; }
    setPhotos(p => ({ ...p, [kind]: blob }));
    if (kind !== "ingredients") { setStep(next[kind]); return; }
    setStep("reading");
    const r = await readPhoto(blob);
    setText(r.text); setUnsure(r.unsure); setReadError(r.error); setStep("check");
  };
  const skip = (kind: Kind) => {
    setPhotoError(undefined);
    setPhotos(p => ({ ...p, [kind]: undefined }));
    if (kind === "ingredients") { setUnsure([]); setReadError(undefined); }
    setStep(next[kind]);
  };
  const send = async () => {
    setStep("sending");
    const r = await submitProduct({ code, name, ingredients: text, photos },
      () => turnstileToken(human.current!), supabase);
    if (r.ok) setStep("sent"); else { setFailed(r.reason); setStep("failed"); }
  };

  const header = (title: string, sub: string, dark: boolean) => (
    <div className="px-4 pt-4 flex items-center justify-between">
      <div>
        <p className={`text-xs font-bold ${dark ? "text-[#A7B8AE]" : "text-gray-600"}`}>{sub}</p>
        <h1 className={`text-xl font-extrabold ${dark ? "text-white" : "text-[#1A5C39]"}`}>{title}</h1>
      </div>
      <button onClick={onClose} aria-label="Close" className={`w-11 h-11 rounded-full flex items-center justify-center ${dark ? "bg-white/10 text-white" : "border border-border bg-white"}`}>
        <X size={16} />
      </button>
    </div>
  );
  const screen = (dark: boolean, children: ReactNode) => (
    <div className={`absolute inset-0 z-40 flex flex-col ${dark ? "bg-[#0F1F16] text-white" : "bg-[#F8F7F2] text-gray-900"}`}>{children}</div>
  );

  if (step === "front" || step === "ingredients" || step === "nutrition" || step === "reading") {
    const kind: Kind = step === "reading" ? "ingredients" : step;
    const order: Kind[] = ["front", "ingredients", "nutrition"];
    return screen(true, <>
      {header("Add this product", `Barcode ${code}`, true)}
      <ol className="px-4 pt-4 flex gap-2" aria-label="Photos">
        {order.map((k, i) => {
          const done = order.indexOf(kind) > i;
          return (
            <li key={k} aria-current={k === kind ? "step" : undefined}
              className={`flex-1 py-2 rounded-xl text-xs text-center flex items-center justify-center gap-1 ${k === kind ? "bg-[#F59E0B] text-[#1A1200] font-extrabold" : "bg-white/10 text-[#A7B8AE] font-bold"}`}>
              {i + 1} {LABEL[k]}{done && <Check size={12} aria-label="done" />}
            </li>
          );
        })}
      </ol>
      <div className="flex-1 flex flex-col justify-center px-6 gap-4 text-center">
        {step === "reading" ? <div className="bg-white rounded-3xl text-gray-900"><Reading /></div> : <>
          <p className="text-base font-extrabold">{LABEL[kind]} photo</p>
          <p className="text-sm text-[#D1DAD4] leading-relaxed">{HOW[kind]}</p>
          {photoError && <p role="alert" className="text-sm text-amber-300">{photoError}</p>}
        </>}
      </div>
      {step !== "reading" && (
        <div className="px-4 pb-6 space-y-2">
          <PhotoButtons onPhoto={onPhoto(kind)} />
          <button onClick={() => skip(kind)} className="w-full min-h-[44px] text-sm font-bold text-[#A7B8AE]">
            {kind === "ingredients" ? "Skip the photo, type the ingredients" : "Skip"}
          </button>
        </div>
      )}
    </>);
  }

  if (step === "check") return screen(false, <>
    {header("Check the ingredients", "Step 2 of 3", false)}
    <div className="flex-1 overflow-y-auto px-4 pt-3.5 pb-4 space-y-3" style={{ scrollbarWidth: "none" }}>
      {photos.ingredients && !readError && (
        <p className="text-sm text-gray-700 leading-relaxed">EcoGo read this from your photo. Fix anything it got wrong.{unsure.length > 0 && " Underlined words are ones it wasn't sure of."}</p>
      )}
      <IngredientEditor value={text} onChange={setText} unsure={unsure} note={readError} />
    </div>
    <div className="px-4 pt-3 pb-6 flex gap-2.5">
      <button onClick={() => setStep("ingredients")} className="min-h-[52px] px-4 rounded-2xl border border-border bg-white font-bold text-sm">Retake</button>
      <button onClick={() => setStep("nutrition")} disabled={!text.trim()}
        className="flex-1 min-h-[52px] rounded-2xl bg-[#1A5C39] text-white font-extrabold text-[15px] disabled:opacity-50">Next: nutrition photo</button>
    </div>
  </>);

  if (step === "sent") return screen(true, <>
    <div className="flex-1 flex flex-col items-center justify-center px-7 gap-3.5 text-center">
      <div className="w-24 h-24 rounded-[28px] bg-emerald-400/15 border-2 border-emerald-400/50 flex items-center justify-center">
        <Check size={44} className="text-emerald-300" />
      </div>
      <h1 className="text-2xl font-extrabold">Sent to Open Food Facts</h1>
      <p className="text-sm text-[#D1DAD4] leading-relaxed">Volunteers there review new products, so it can take a while before everyone sees it in EcoGo.</p>
    </div>
    <div className="px-5 pb-7">
      <button onClick={onDone} className="w-full min-h-[52px] rounded-2xl bg-[#F59E0B] text-[#1A1200] font-extrabold text-[15px]">Scan another product</button>
    </div>
  </>);

  if (step === "failed") return screen(false, <>
    {header("Not sent", `Barcode ${code}`, false)}
    <div className="flex-1 flex flex-col justify-center px-6 gap-3 text-center">
      <p role="alert" className="text-base font-bold">{FAILED[failed]}</p>
      <p className="text-sm text-gray-600">Your photos and text are still here.</p>
    </div>
    <div className="px-4 pb-6">
      <button onClick={() => setStep(failed === "invalid" ? "check" : "send")} className="w-full min-h-[52px] rounded-2xl bg-[#1A5C39] text-white font-extrabold text-[15px]">Try again</button>
    </div>
  </>);

  // Send (and sending)
  const sending = step === "sending";
  return screen(false, <>
    {header("Send to Open Food Facts", `Barcode ${code}`, false)}
    <div className="flex-1 overflow-y-auto px-4 pt-3.5 pb-4 space-y-3" style={{ scrollbarWidth: "none" }}>
      <div className="bg-white rounded-2xl p-3.5 space-y-2.5">
        <h2 className="text-[15px] font-extrabold">What you're sending</h2>
        <div className="grid grid-cols-3 gap-2">
          {(["front", "ingredients", "nutrition"] as const).map(k => <Thumb key={k} blob={photos[k]} label={LABEL[k]} />)}
        </div>
        <label htmlFor="product-name" className="block text-sm font-bold">Product name (optional)</label>
        <input id="product-name" value={name} onChange={e => setName(e.target.value)} placeholder="As printed on the front" maxLength={200}
          className="w-full min-h-[44px] px-3 rounded-xl border border-border bg-white text-sm" />
        <p className="text-xs text-gray-600">Plus the ingredients you checked and the barcode.</p>
      </div>
      <div className="bg-white border border-border rounded-2xl p-3.5 space-y-2">
        <h2 className="text-[15px] font-extrabold">This will be public</h2>
        <p className="text-xs text-gray-700 leading-relaxed">Open Food Facts is a free, open database. Your photos and text will be public there, for anyone to see and reuse, under its open licenses (photos CC BY-SA, data ODbL).</p>
        <p className="text-xs text-gray-700 leading-relaxed">Make sure no faces, receipts or anything personal show in the photos.</p>
        <label className="flex gap-2.5 items-start text-sm font-semibold leading-snug pt-1">
          <input type="checkbox" checked={consent} onChange={e => setConsent(e.target.checked)} className="w-[22px] h-[22px] m-0 flex-shrink-0" />
          <span>I took these photos, and they show only the product.</span>
        </label>
      </div>
      <div ref={human} />
    </div>
    <div className="px-4 pt-3 pb-6 space-y-2">
      <button onClick={send} disabled={!consent || !text.trim() || sending}
        className="w-full min-h-[52px] rounded-2xl bg-[#1A5C39] text-white font-extrabold text-[15px] disabled:opacity-50">
        {sending ? "Sending…" : "Send"}
      </button>
      <p className="text-micro text-gray-600 text-center">Sent under EcoGo's Open Food Facts account. No sign-in needed.</p>
    </div>
  </>);
}
