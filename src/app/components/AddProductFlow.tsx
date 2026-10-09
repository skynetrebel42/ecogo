// AddProductFlow.tsx — add a product that was found nowhere to Open Food Facts (M8 spec §3, layout A, one step per
// screen): front photo → ingredients photo (read on the phone) → check the text → nutrition photo → Send → Sent.
// Everything stays in this screen's state until Send, so a failed send loses nothing.

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { X, Check, ArrowLeft } from "lucide-react";
import { isBlurry, preparePhoto, TOO_SMALL } from "../../lib/photo";
import { readPhoto, type LabelLine } from "../../lib/ocr";
import { submitProduct, type PhotoKind, type SendStage, type SubmitReason } from "../../lib/contribute";
import { offEditUrl } from "../../lib/lookup";
import { loadTurnstile, turnstileToken } from "../../lib/turnstile";
import { offSubmit, supabase } from "../../lib/supabase";
import { IngredientEditor, INGREDIENTS_TIP, PhotoButtons, PhotoNotice, PhotoTips, Reading } from "./IngredientCheck";

type Kind = PhotoKind;
type Step = Kind | "reading" | "check" | "send" | "sending" | "sent" | "failed";

const FAILED: Record<SubmitReason, string> = {
  "limit-you": "You've sent 10 today. Thanks! Try again tomorrow.",
  "limit-all": "EcoGo has reached today's limit. Try again tomorrow.",
  captcha: "Couldn't confirm you're not a robot. Try again.",
  "off-down": "Open Food Facts didn't answer. Try again later.",
  invalid: "Open Food Facts couldn't take this as it is. Check the ingredients and try again.",
  "nothing-new": "Open Food Facts already has these ingredients and these photos, so there was nothing new to send.",
};
const PHOTO_TIPS: Record<Kind, string> = {
  front: "Photograph the front of the package, with its name showing.",
  ingredients: INGREDIENTS_TIP,
  nutrition: "Photograph the Nutrition Facts panel. Open Food Facts reads the numbers from it.",
};
const LABEL: Record<Kind, string> = { front: "Front", ingredients: "Ingredients", nutrition: "Nutrition" };

/** A photo's thumbnail; its object URL is released when the photo changes or the screen closes. */
function Thumb({ blob, label }: { blob?: Blob; label: string }) {
  const url = useMemo(() => (blob ? URL.createObjectURL(blob) : undefined), [blob]);
  useEffect(() => () => { if (url) URL.revokeObjectURL(url); }, [url]);
  return url
    ? <img src={url} alt={`${label} photo`} className="h-20 w-full rounded-xl object-cover bg-gray-200" />
    : <div className="h-20 rounded-xl bg-gray-200 flex items-center justify-center text-xs text-gray-600">{label}: skipped</div>;
}

/** What a send stage says (follow-up 4, P2); `percent: false` leaves the number out (the live region's wording). */
const stageLabel = (stage: SendStage, percent = true) => stage.stage === "upload" ? `Uploading photos…${percent ? ` ${stage.percent}%` : ""}`
  : stage.stage === "check" ? "Checking you're human…" : "Open Food Facts is saving it…";

/** The send bar (P2): the real upload percent, or a moving bar while the stage has none; with reduced motion the moving
 *  bar is a still tint. Screen readers hear each stage once from the Send screen's live region, not every percent. */
function SendProgress({ stage }: { stage: SendStage }) {
  const label = stageLabel(stage);
  return (
    <div className="space-y-1.5">
      <p className="text-sm font-bold text-gray-700" aria-hidden="true">{label}</p>
      <div role="progressbar" aria-label="Sending" aria-valuemin={0} aria-valuemax={100} aria-valuetext={label}
        aria-valuenow={stage.stage === "upload" ? stage.percent : undefined} className="h-2 rounded-full bg-[#1A5C39]/15 overflow-hidden">
        {stage.stage === "upload"
          ? <div className="h-full rounded-full bg-[#1A5C39] transition-[width] duration-200" style={{ width: `${stage.percent}%` }} />
          : <div data-moving className="h-full w-1/3 rounded-full bg-[#1A5C39] animate-[ecogo-indeterminate_1.2s_ease-in-out_infinite] motion-reduce:animate-none motion-reduce:w-full motion-reduce:opacity-40" />}
      </div>
    </div>
  );
}

export default function AddProductFlow({ code, onDone, onClose }: { code: string; onDone: () => void; onClose: () => void }) {
  const [step, setStep] = useState<Step>("front");
  const [photos, setPhotos] = useState<Partial<Record<Kind, Blob>>>({});
  const [photoError, setPhotoError] = useState<string>();
  const [text, setText] = useState("");
  const [unsure, setUnsure] = useState<string[]>([]);
  const [lines, setLines] = useState<LabelLine[] | null>();
  const [readError, setReadError] = useState<string>();
  const [hard, setHard] = useState(false); // M8 follow-up 2, G4: the photo read looks hard to read
  const [blurry, setBlurry] = useState<{ kind: Kind; blob: Blob }>(); // 049 H2: waiting on "Retake photo" / "Use it anyway"
  const [name, setName] = useState("");
  const [consent, setConsent] = useState(false);
  const [failed, setFailed] = useState<SubmitReason>("off-down");
  const [textKept, setTextKept] = useState(false);
  const [failedPhotos, setFailedPhotos] = useState<PhotoKind[]>([]);
  const [uploading, setUploading] = useState(false); // follow-up 3, H1: other photos still going up in the background
  const [stage, setStage] = useState<SendStage>(); // follow-up 4: where the send is, for the bar
  const humanCheckSlot = useRef<HTMLDivElement>(null); // where Turnstile shows a challenge, if it needs one

  useEffect(() => { if (step === "send") loadTurnstile().catch(() => {}); }, [step]); // D8: only on the Send screen

  const next: Record<Kind, Step> = { front: "ingredients", ingredients: "check", nutrition: "send" };
  const acceptPhoto = async (kind: Kind, blob: Blob, blurOk: boolean) => {
    setBlurry(undefined);
    setPhotos(p => ({ ...p, [kind]: blob }));
    if (kind !== "ingredients") { setStep(next[kind]); return; }
    setStep("reading");
    const r = await readPhoto(blob);
    // After "Use it anyway" on a blurry photo, the hard-to-read hint doesn't show again for it (049 H2).
    setText(r.text); setUnsure(r.unsure); setLines(r.lines); setReadError(r.error); setHard(r.hard && !blurOk); setStep("check");
  };
  const onPhoto = (kind: Kind) => async (file: File) => {
    setPhotoError(undefined);
    let blob: Blob;
    try { blob = await preparePhoto(file); } catch (err) {
      setPhotoError((err as Error).message === TOO_SMALL ? TOO_SMALL : "Couldn't open this photo. Try another one.");
      return;
    }
    // H2: the blur check runs before reading, so a retake costs no reading time.
    if (await isBlurry(blob)) setBlurry({ kind, blob }); else await acceptPhoto(kind, blob, false);
  };
  const skip = (kind: Kind) => {
    setPhotoError(undefined); setBlurry(undefined);
    setPhotos(p => ({ ...p, [kind]: undefined }));
    if (kind === "ingredients") { setUnsure([]); setLines(undefined); setReadError(undefined); setHard(false); }
    setStep(next[kind]);
  };
  const send = async () => {
    setStep("sending"); setStage(undefined);
    const r = await submitProduct({ code, name, ingredients: text, photos }, () => turnstileToken(humanCheckSlot.current!),
      { auth: supabase.auth, ...offSubmit }, setStage);
    if (r.ok) { setTextKept(!!r.textKept); setFailedPhotos(r.failedPhotos ?? []); setUploading(!!r.pendingPhotos); setStep("sent"); } else { setFailed(r.reason); setStep("failed"); }
  };

  // Back (nutrition → check, Send → nutrition) keeps every photo and the text: nothing is lost while the screen is open.
  const header = (title: string, sub: string, dark: boolean, onBack?: () => void) => (
    <div className="px-4 pt-4 flex items-center gap-3">
      {onBack && (
        <button onClick={onBack} aria-label="Back" className={`w-11 h-11 rounded-full flex items-center justify-center flex-shrink-0 ${dark ? "bg-white/10 text-white" : "border border-border bg-white"}`}>
          <ArrowLeft size={16} />
        </button>
      )}
      <div className="flex-1">
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
    const blur = step !== "reading" && blurry?.kind === kind ? blurry.blob : undefined;
    return screen(true, <>
      {header("Add this product", `Barcode ${code}`, true, step === "nutrition" ? () => { setBlurry(undefined); setStep("check"); } : undefined)}
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
        {step === "reading" ? <div className="bg-white rounded-3xl text-gray-900"><Reading /></div>
          : blur ? <PhotoNotice title="This photo looks blurry." kind={kind}
              onRetake={() => setBlurry(undefined)} onUseAnyway={() => acceptPhoto(kind, blur, true)} />
          : <>
          <p className="text-base font-extrabold">{LABEL[kind]} photo</p>
          <p className="text-sm text-[#D1DAD4] leading-relaxed">{PHOTO_TIPS[kind]}</p>
          {kind !== "front" && <PhotoTips kind={kind} className="text-[#D1DAD4] justify-center" />}
          {photoError && <p role="alert" className="text-sm text-amber-300">{photoError}</p>}
        </>}
      </div>
      {step !== "reading" && !blur && (
        <div className="px-4 pb-6 space-y-2">
          <PhotoButtons onPhoto={onPhoto(kind)} />
          {photos[kind]
            ? <button onClick={() => setStep(next[kind])} className="w-full min-h-[44px] text-sm font-bold text-[#A7B8AE]">Keep the photo I took</button>
            : <button onClick={() => skip(kind)} className="w-full min-h-[44px] text-sm font-bold text-[#A7B8AE]">
                {kind === "ingredients" ? "Skip the photo, type the ingredients" : "Skip"}
              </button>}
        </div>
      )}
    </>);
  }

  if (step === "check") return screen(false, <>
    {header("Check the ingredients", "Step 2 of 3", false)}
    <div className="flex-1 overflow-y-auto px-4 pt-3.5 pb-4 space-y-3" style={{ scrollbarWidth: "none" }}>
      {hard ? <PhotoNotice title="This photo is hard to read." onRetake={() => setStep("ingredients")} onUseAnyway={() => setHard(false)} /> : <>
        {photos.ingredients && !readError && (
          <p className="text-sm text-gray-700 leading-relaxed">EcoGo read this from your photo. Fix anything it got wrong.</p>
        )}
        <IngredientEditor value={text} onChange={setText} unsure={unsure} note={readError} lines={lines} onLines={setLines} />
      </>}
    </div>
    {!hard && <div className="px-4 pt-3 pb-6 flex gap-2.5">
      <button onClick={() => setStep("ingredients")} className="min-h-[52px] px-4 rounded-2xl border border-border bg-white font-bold text-sm">Retake</button>
      <button onClick={() => setStep("nutrition")} disabled={!text.trim()}
        className="flex-1 min-h-[52px] rounded-2xl bg-[#1A5C39] text-white font-extrabold text-[15px] disabled:opacity-50">Next: nutrition photo</button>
    </div>}
  </>);

  if (step === "sent") return screen(true, <>
    <div className="flex-1 flex flex-col items-center justify-center px-7 gap-3.5 text-center">
      <div className="w-24 h-24 rounded-[28px] bg-emerald-400/15 border-2 border-emerald-400/50 flex items-center justify-center">
        <Check size={44} className="text-emerald-300" />
      </div>
      <h1 className="text-2xl font-extrabold">Sent to Open Food Facts</h1>
      <p className="text-sm text-[#D1DAD4] leading-relaxed">Volunteers there review new products, so it can take a while before everyone sees it in EcoGo.</p>
      {textKept && <p className="text-xs text-[#A7B8AE] leading-relaxed">Open Food Facts already had ingredients for this product, so EcoGo sent only your photos and left its text as it was.</p>}
      {failedPhotos.length > 0 && (
        <p className="text-sm text-amber-300 leading-relaxed">
          The {new Intl.ListFormat("en").format(failedPhotos)} photo{failedPhotos.length > 1 ? "s" : ""} didn't go through.
          You can add {failedPhotos.length > 1 ? "them" : "it"} later on the{" "}
          <a href={offEditUrl(code)} target="_blank" rel="noopener noreferrer" className="underline font-bold">Open Food Facts website</a>.
        </p>
      )}
      {uploading && <p className="text-xs text-[#A7B8AE] leading-relaxed">Your other photos are still uploading to Open Food Facts.</p>}
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
    {header("Send to Open Food Facts", `Barcode ${code}`, false, sending ? undefined : () => setStep("nutrition"))}
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
      <div ref={humanCheckSlot} />
    </div>
    <div className="px-4 pt-3 pb-6 space-y-2">
      {/* Always on this screen, so its first announcement isn't lost (a region inserted with its text isn't read). */}
      <p className="sr-only" aria-live="polite">{sending && stage ? stageLabel(stage, false) : ""}</p>
      {sending && stage && <SendProgress stage={stage} />}
      <button onClick={send} disabled={!consent || !text.trim() || sending}
        className="w-full min-h-[52px] rounded-2xl bg-[#1A5C39] text-white font-extrabold text-[15px] disabled:opacity-50">
        {sending ? "Sending…" : "Send"}
      </button>
      <p className="text-micro text-gray-600 text-center">Sent under EcoGo's Open Food Facts account. No sign-in needed.</p>
    </div>
  </>);
}
