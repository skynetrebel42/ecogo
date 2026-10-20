// PlaceForm.tsx — "Suggest a place" and "Report a problem" on the Map (M8.1 spec
// docs/superpowers/specs/2026-10-15-m81-suggest-report-design.md P1–P3, P3a). Sent to `place-submit`, which stores it for
// the owner to read by hand; nothing a suggestion or report says is shown in the app. The send reuses M8's anonymous
// sign-in, human check, lock while sending and every-send-ends rules (contribute.ts).
import { useEffect, useRef, useState, type ReactNode } from "react";
import { X, Check } from "lucide-react";
import type { ResourceRow } from "../../lib/catalog";
import { submitPlace, type SendStage, type SubmitReason } from "../../lib/contribute";
import { loadTurnstile, turnstileToken } from "../../lib/turnstile";
import { placeSubmit, supabase } from "../../lib/supabase";
import { MIN_CHARS, PAUSE_MS, suggestAddresses } from "../../lib/photon";

const OFFERS = ["Food pantry", "Free meals", "Community fridge", "Other"];
const WHO = ["Anyone", "Students only", "Other"];
const WRONG = ["Closed for good", "Wrong address or hours", "Not free", "Other"];
const NOTE_MAX = 500;

/** M8's Not-sent lines, with EcoGo in place of Open Food Facts (P3a). */
type Failed = "limit-you" | "limit-tries" | "limit-all" | "captcha" | "off-down" | "invalid";
const FAILED: Record<Failed, string> = {
  "limit-you": "You've sent 10 today. Thanks! Try again tomorrow.",
  "limit-tries": "You've tried 30 times today. Try again tomorrow.",
  "limit-all": "EcoGo has reached today's limit. Try again tomorrow.",
  captcha: "Couldn't confirm you're not a robot. Try again.",
  "off-down": "EcoGo didn't answer. Try again later.",
  invalid: "EcoGo couldn't take this as it is. Check the form and try again.",
};
const isFailed = (r: SubmitReason): r is Failed => r in FAILED;

/** An https:// link with a host (place-submit checks the same). */
const httpsLink = (s: string) => { try { const u = new URL(s.trim()); return u.protocol === "https:" && !!u.hostname; } catch { return false; } };

const input = "w-full min-h-[44px] px-3 rounded-xl border border-gray-500 bg-white text-sm disabled:opacity-60"; // 063 F12: 3:1 edge

function Choices({ name, legend, options, value, onChange, disabled }:
  { name: string; legend: string; options: string[]; value: string; onChange: (v: string) => void; disabled: boolean }) {
  return (
    <fieldset className="space-y-1">
      <legend className="text-sm font-bold mb-1">{legend}</legend>
      {options.map(o => (
        <label key={o} className="flex items-center gap-2.5 text-sm min-h-[44px]">
          <input type="radio" name={name} value={o} checked={value === o} onChange={() => onChange(o)} disabled={disabled} className="w-5 h-5 m-0 flex-shrink-0" />
          {o}
        </label>
      ))}
    </fieldset>
  );
}

/** 059 Q4: the address box, with Photon's suggestions after a pause (photon.ts). Typing freely always works; picking one
 *  fills the box. Each new value cancels the request before it, so an older answer is dropped. */
function AddressField({ value, onChange, disabled }: { value: string; onChange: (v: string) => void; disabled: boolean }) {
  const [list, setList] = useState<string[]>([]);
  const picked = useRef("");
  const box = useRef<HTMLInputElement>(null);
  useEffect(() => {
    setList([]);
    if (value === picked.current || value.trim().length < MIN_CHARS) return;
    const ctl = new AbortController();
    const wait = setTimeout(() => suggestAddresses(value, (u, i) => fetch(u, i), ctl.signal).then(s => { if (!ctl.signal.aborted) setList(s); }), PAUSE_MS);
    return () => { clearTimeout(wait); ctl.abort(); };
  }, [value]);
  return (
    <div className="space-y-1">
      <label htmlFor="place-address" className="block text-sm font-bold">Address or cross streets</label>
      {/* Escape with the list open closes only the list, not the form (and its answers). */}
      <input id="place-address" ref={box} value={value} onChange={e => onChange(e.target.value)} disabled={disabled} maxLength={200} required autoComplete="off"
        onKeyDown={e => { if (e.key === "Escape" && list.length) { e.stopPropagation(); setList([]); } }}
        aria-describedby="place-address-photon" className={input} />
      <p className="sr-only" aria-live="polite">{list.length ? `${list.length} address suggestion${list.length > 1 ? "s" : ""} below` : ""}</p>
      {list.length > 0 && !disabled && (
        <ul aria-label="Address suggestions" className="rounded-xl border border-border bg-white divide-y divide-border">
          {list.map(a => (
            <li key={a}>
              <button type="button" onClick={() => { picked.current = a; onChange(a); box.current?.focus(); }} className="w-full min-h-[44px] px-3 text-left text-sm">{a}</button>
            </li>
          ))}
        </ul>
      )}
      <p id="place-address-photon" className="text-xs text-gray-600">Address suggestions come from Photon (OpenStreetMap data); it sees what you type here.</p>
    </div>
  );
}

/** With `place`: a report about it; without: a suggestion. */
export default function PlaceForm({ place, onClose }: { place?: ResourceRow; onClose: () => void }) {
  const report = !!place;
  const [step, setStep] = useState<"form" | "sending" | "sent" | "failed" | "unknown">("form");
  const [f, setF] = useState({ name: "", address: "", offers: "", who: "", whoNote: "", link: "", wrong: "", note: "" });
  const [consent, setConsent] = useState(false);
  const [failed, setFailed] = useState<Failed>("off-down");
  const [stage, setStage] = useState<SendStage>();
  const humanCheckSlot = useRef<HTMLDivElement>(null); // where Turnstile shows a challenge, if it needs one
  const titleRef = useRef<HTMLHeadingElement>(null);
  const set = (k: keyof typeof f) => (v: string) => setF(p => ({ ...p, [k]: v }));

  useEffect(() => { loadTurnstile().catch(() => {}); }, []); // M8 D8: only on a screen with Send
  useEffect(() => { titleRef.current?.focus(); }, [step === "sending" ? "form" : step]); // each new screen, not the send

  const placeRef = !place ? "" : place.source === "lacounty" ? `county/${-place.id}` : `${place.osm_type}/${place.osm_id}`;
  const ready = consent && (report ? !!f.wrong
    : !!f.name.trim() && !!f.address.trim() && !!f.offers && !!f.who && (f.who !== "Other" || !!f.whoNote.trim()) && httpsLink(f.link));
  const sending = step === "sending";

  const send = async () => {
    setStep("sending"); setStage(undefined);
    const fields = report ? { kind: "report" as const, placeRef, name: place!.name, wrong: f.wrong, note: f.note }
      : { kind: "suggest" as const, name: f.name, address: f.address, offers: f.offers, who: f.who, link: f.link.trim(), note: f.note,
        ...(f.who === "Other" && { whoNote: f.whoNote }) };
    const r = await submitPlace(fields, () => turnstileToken(humanCheckSlot.current!), { auth: supabase.auth, ...placeSubmit }, setStage);
    if (r.ok) setStep("sent");
    else if (isFailed(r.reason)) { setFailed(r.reason); setStep("failed"); }
    else setStep("unknown"); // 055 E2: no reply (or not place-submit's), so it may have arrived
  };

  const title = report ? "Report a problem" : "Suggest a place";
  const screen = (heading: string, children: ReactNode) => (
    <div role="dialog" aria-modal="true" aria-labelledby="place-form-title" onKeyDown={e => { if (e.key === "Escape" && !sending) onClose(); }} className="absolute inset-0 z-[1000] flex flex-col bg-[#F8F7F2] text-gray-900">
      <div className="px-4 pt-4 flex items-center gap-3">
        <h1 id="place-form-title" ref={titleRef} tabIndex={-1} className="flex-1 text-xl font-extrabold text-[#1A5C39] focus:outline-none">{heading}</h1>
        {/* 055 E1: no Close while sending (the send would run on with no receipt). */}
        <button onClick={onClose} disabled={sending} aria-label="Close" className="w-11 h-11 rounded-full flex items-center justify-center border border-border bg-white disabled:opacity-50">
          <X size={16} />
        </button>
      </div>
      {children}
    </div>
  );
  const bigButton = "w-full min-h-[52px] rounded-2xl bg-[#1A5C39] text-white font-extrabold text-[15px] disabled:opacity-50";
  const end = (heading: string, line: ReactNode, button: ReactNode) => screen(heading, <>
    <div className="flex-1 flex flex-col justify-center px-6 gap-3 text-center">{line}</div>
    <div className="px-4 pb-6">{button}</div>
  </>);

  if (step === "sent") return end(title, <>
    <div className="mx-auto w-20 h-20 rounded-[24px] bg-emerald-100 flex items-center justify-center"><Check size={40} className="text-[#1A5C39]" /></div>
    <p className="text-base font-bold">Thanks. EcoGo checks these by hand, so it can take a few days.</p>
  </>, <button onClick={onClose} className={bigButton}>Back to the map</button>);

  if (step === "failed") return end("Not sent", <>
    <p role="alert" className="text-base font-bold">{FAILED[failed]}</p>
    <p className="text-sm text-gray-600">Your answers are still here.</p>
  </>, <button onClick={() => setStep("form")} className={bigButton}>Try again</button>);

  // 055 E2: no Try again; sending again blind could send twice.
  if (step === "unknown") return end("Not sure it arrived",
    <p role="alert" className="text-base font-bold">We didn't hear back from EcoGo. It may have arrived. Wait a few minutes before sending again.</p>,
    <button onClick={onClose} className={bigButton}>Back to the map</button>);

  return screen(title, <>
    <div className="flex-1 overflow-y-auto px-4 pt-3.5 pb-4 space-y-3" style={{ scrollbarWidth: "none" }}>
      <div className="bg-white rounded-2xl p-3.5 space-y-3">
        {place ? (<>
          <div>
            <p className="text-[15px] font-extrabold">{place.name}</p>
            <p className="text-xs text-gray-600">From {place.source === "lacounty" ? `LA County · site ${-place.id}` : `OpenStreetMap · ${placeRef}`}</p>
          </div>
          <Choices name="wrong" legend="What's wrong" options={WRONG} value={f.wrong} onChange={set("wrong")} disabled={sending} />
        </>) : (<>
          <div className="space-y-1">
            <label htmlFor="place-name" className="block text-sm font-bold">Name</label>
            <input id="place-name" value={f.name} onChange={e => set("name")(e.target.value)} disabled={sending} maxLength={200} required className={input} />
          </div>
          <AddressField value={f.address} onChange={set("address")} disabled={sending} />
          <Choices name="offers" legend="What it offers" options={OFFERS} value={f.offers} onChange={set("offers")} disabled={sending} />
          <Choices name="who" legend="Who can use it" options={WHO} value={f.who} onChange={set("who")} disabled={sending} />
          {f.who === "Other" && (
            <div className="space-y-1">
              <label htmlFor="place-who-note" className="block text-sm font-bold">Who can use it?</label>
              <input id="place-who-note" value={f.whoNote} onChange={e => set("whoNote")(e.target.value)} disabled={sending} maxLength={100} required className={input} />
            </div>
          )}
          <div className="space-y-1">
            <label htmlFor="place-link" className="block text-sm font-bold">Link to its own website or official social page</label>
            <input id="place-link" type="url" inputMode="url" placeholder="https://" value={f.link} onChange={e => set("link")(e.target.value)} disabled={sending}
              maxLength={NOTE_MAX} required aria-describedby="place-link-hint" className={input} />
            <p id="place-link-hint" className="text-xs text-gray-600">Its own site or its own Instagram/Facebook page. Not Yelp, Google Maps or news.</p>
          </div>
        </>)}
        <div className="space-y-1">
          <label htmlFor="place-note" className="block text-sm font-bold">Note (optional)</label>
          <textarea id="place-note" value={f.note} onChange={e => set("note")(e.target.value)} disabled={sending} maxLength={NOTE_MAX} rows={3}
            className={`${input} py-2`} />
        </div>
      </div>
      <div className="bg-white border border-border rounded-2xl p-3.5 space-y-2">
        <p className="text-xs text-gray-700 leading-relaxed">EcoGo's owner reads this by hand. Don't include personal details. Approved places are added to OpenStreetMap, which is public.</p>
        <label className="flex gap-2.5 items-start text-sm font-semibold leading-snug pt-1">
          <input type="checkbox" checked={consent} onChange={e => setConsent(e.target.checked)} disabled={sending} className="w-[22px] h-[22px] m-0 flex-shrink-0" />
          <span>My note has no personal details, mine or anyone else's.</span>
        </label>
      </div>
      <div ref={humanCheckSlot} />
    </div>
    <div className="px-4 pt-3 pb-6 space-y-2">
      {/* Always on this screen, so its first announcement isn't lost. */}
      <p className="sr-only" aria-live="polite">{sending && stage ? (stage.stage === "check" ? "Checking you're human…" : "Sending…") : ""}</p>
      <button onClick={send} disabled={!ready || sending} className={bigButton}>{sending ? "Sending…" : "Send"}</button>
    </div>
  </>);
}
