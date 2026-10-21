// ─────────────────────────────────────────────────────────────────────────────
// ProductDetailScreen.tsx — product page
//
// Concern level from the safety engine (src/lib/safety): the strongest official
// finding among the ingredients (additives), the food itself (processed meat) and
// what forms when it's cooked (acrylamide, a marker only). Every finding shows its
// sources. Also: same-category alternatives with fewer concerns.
// ─────────────────────────────────────────────────────────────────────────────

import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { toggleSave, type SavedStore } from "../../lib/saved";
import SaveSheet from "./SaveSheet";
import {
  ArrowLeft, Bookmark,
  TrendingUp, ChevronDown, ExternalLink, FlaskConical, Flame, Info, CheckCircle2,
} from "lucide-react";
import { loadSaferChoice, saferChoiceMatch, inCaliforniaScope, NOT_ENDORSEMENT, CALIFORNIA_LINE, PRODUCT_SEARCH, type SaferChoiceProduct } from "../../lib/saferChoice";
import type { Product } from "../../lib/productImporter";
import { updateInfoUrl, isPersonalCare, obfEditUrl } from "../../lib/lookup";
import { escapeRegExp, type Flag } from "../../lib/safety/analyze";
import { CARE_LIMITS, type CareAnalysis } from "../../lib/safety/personalCare";
import type { Severity, Source } from "../../lib/safety/library";
import type { Assessment } from "../../lib/safety/assess";
import { benzeneNote, BENZENE_NOTE } from "../../lib/safety/foodConcerns";
import Explainer, { EXPLAINERS, type ExplainerId } from "./Explainer";
import { VERDICT_STYLE, safeAnalyze, verdictHeadline, formsWhenCooked } from "./verdict";
import NutritionPanel, { NutritionChip, EditOnOff, useNutrition } from "./NutritionPanel";
import IngredientCheck, { LimitedRow, MoreDataLine } from "./IngredientCheck";
import { topHigh } from "../../lib/nutrition";
import { snapshotLabel } from "../../lib/foods";
import { useAlternatives } from "./useAlternatives";
import type { AddMode } from "./AddProductFlow";
import { foodIcon } from "../../lib/foodIcon";

/** "fr" → "French" (native Intl; falls back to the code). */
const languageName = (code: string) => {
  try { return new Intl.DisplayNames(["en"], { type: "language" }).of(code) ?? code; } catch { return code; }
};

const TAP_FINDING = "Tap a finding to see its official sources.";
const PRIMARY = "w-full min-h-[48px] rounded-2xl bg-[#1A5C39] text-white font-extrabold text-sm";
const SMALL_PRINT: Record<Assessment["verdict"], string> = {
  known:      TAP_FINDING,
  high:       TAP_FINDING,
  some:       TAP_FINDING,
  none:       "No hazard flags from IARC, EU or FDA.",
  "no-data":  "This product has no ingredient list yet.",
  "non-food": "EcoGo checks food and drinks only for now.",
};
// "Nothing flagged" with the 🔥 marker: scoped, so it doesn't contradict the IARC finding in "Formed when cooked".
const NONE_BUT_COOKED = "No hazard flags from IARC, EU or FDA in the ingredients or the food itself; see what forms when it's cooked below.";
// Point to the Nutrition section only when the page has one (no data, e.g. no verified barcode → no section).
const nutritionNote = (hasSection: boolean) => ` This badge doesn't rate nutrition${hasSection ? "; see the Nutrition section" : ""}.`;

/** One row on the product page: an additive flag, a food-level concern, or an info note (M16 personal care, 064 H2 benzene;
 *  `info`). `learn`: a Learn page the open row links to (064). */
interface Finding { id: string; name: string; severity?: Severity; info?: boolean; concern: string; detail: string; context?: string; sources: Source[]; learn?: ExplainerId }

/** Findings grouped by where they come from; empty groups are dropped. `care`: regulator context (FDA's dandruff-drug
 *  line, 063 F4) shows in the row next to the EU ban, not behind it. `foodNotes`: food info rows (064 H2). */
function findingGroups(a: Assessment, notes: CareAnalysis["notes"] = [], care = false, foodNotes: Finding[] = []): { title: string; findings: Finding[] }[] {
  const fromConcerns = (kind: "food" | "cooking") => a.concerns.filter(c => c.kind === kind).map(c => ({
    id: c.id, name: c.name, severity: c.severity, concern: c.concern, detail: c.reason, context: c.context, sources: c.sources, learn: c.learn,
  }));
  return [
    { title: "In the ingredients", findings: a.flags.map(({ entry, matchedText }) => ({
      id: entry.id, name: entry.name, severity: entry.severity, detail: `Listed as “${matchedText}”`, sources: entry.sources,
      ...(care && entry.context ? { concern: `${entry.concern} ${entry.context}` } : { concern: entry.concern, context: entry.context }),
    })) },
    { title: "The food itself", findings: fromConcerns("food") },
    { title: "Formed when cooked", findings: fromConcerns("cooking") },
    // M16 N3–N5: info rows; they don't change the badge.
    { title: "Good to know", findings: [...notes.map(({ note, matchedText }) => ({
      id: `note-${note.id}`, name: note.name, info: true, concern: note.text, detail: `Listed as “${matchedText}”`, sources: note.sources,
    })), ...foodNotes] },
  ].filter(g => g.findings.length > 0);
}

const COOKING_LOOK = { short: "Forms when cooked", color: "#4B5563", bg: "#F3F4F6", Icon: Flame };
const INFO_LOOK = { short: "Info", color: "#4B5563", bg: "#F3F4F6", Icon: Info }; // never changes the badge

/** The full ingredient text with the label phrases that triggered flags highlighted. */
function HighlightedIngredients({ text, flags }: { text: string; flags: Flag[] }) {
  const terms = [...new Set(flags.map(f => f.matchedText))].filter(Boolean);
  if (terms.length === 0) return <>{text}</>;
  const parts = text.split(new RegExp(`(${terms.map(escapeRegExp).join("|")})`, "gi"));
  return (
    <>
      {parts.map((part, i) => i % 2 === 1
        ? <mark key={i} className="bg-red-100 text-red-800 rounded px-0.5 font-semibold">{part}</mark>
        : <span key={i}>{part}</span>)}
    </>
  );
}

function FindingRow({ finding: entry, open, onToggle, onLearn }: { finding: Finding; open: boolean; onToggle: () => void; onLearn: (id: ExplainerId, from: HTMLElement) => void }) {
  const look = entry.info ? INFO_LOOK : entry.severity ? VERDICT_STYLE[entry.severity] : COOKING_LOOK;
  return (
    <div className="px-4 py-3">
      <button onClick={onToggle} aria-expanded={open} className="w-full flex items-start gap-3 text-left">
        <look.Icon size={16} className="flex-shrink-0 mt-0.5" style={{ color: look.color }} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-bold">{entry.name}</span>
            <span className="text-nano font-bold px-1.5 py-0.5 rounded-full" style={{ background: look.bg, color: look.color }}>{look.short}</span>
          </div>
          <p className="text-xs text-gray-600 mt-0.5 leading-snug">{entry.concern}</p>
          <p className="text-micro text-gray-500 mt-0.5">{entry.detail}</p>
        </div>
        <ChevronDown size={14} className={`flex-shrink-0 mt-1 text-gray-500 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      {open && (
        <div className="mt-3 ml-7 space-y-2">
          {entry.context && (
            <p className="text-mini text-gray-600 bg-gray-50 rounded-xl p-2.5 leading-snug">
              <strong>Regulator context:</strong> {entry.context}
            </p>
          )}
          {entry.sources.map((s, i) => (
            <a key={i} href={s.url} target="_blank" rel="noreferrer" className="block text-mini leading-snug text-primary">
              <span className="font-bold">{s.body}:</span> {s.finding} <ExternalLink size={9} className="inline" />
              <span className="block text-nano text-gray-500">Source checked {s.checkedOn}</span>
            </a>
          ))}
          {entry.learn && (
            <button onClick={e => onLearn(entry.learn!, e.currentTarget)} className="text-mini font-bold text-primary underline text-left">
              Read: {EXPLAINERS[entry.learn].title}
            </button>
          )}
        </div>
      )}
    </div>
  );
}

interface ProductDetailScreenProps {
  product: Product; onBack: () => void; onSelectProduct: (p: Product) => void;
  store: SavedStore; savedOk: boolean; onChangeSaved: (s: SavedStore, undoText?: string) => void;
  /** M8 follow-up 5: open the add flow for this crowd-sourced OFF product (J1 add the ingredients, J2 new photos). */
  onAddToOff: (mode: Exclude<AddMode, "new">, ingredientsPhoto?: Blob) => void;
}

/** M17 S2: the barcode is on EPA's Safer Choice list (exact match in the committed snapshot; EPA is never called).
 *  No match shows nothing: not being listed is not a finding. */
function SaferChoiceCard({ barcode }: { barcode: string }) {
  const [hit, setHit] = useState<{ listed: SaferChoiceProduct[]; retrieved: string } | null>(null);
  useEffect(() => {
    let live = true;
    loadSaferChoice().then(s => { const listed = saferChoiceMatch(barcode, s); if (live && listed.length) setHit({ listed, retrieved: s.retrieved }); }, () => {});
    return () => { live = false; };
  }, [barcode]);
  if (!hit) return null;
  const named = (p: SaferChoiceProduct) => <><strong>{p.name}</strong>, {p.company.replace(/\.?$/, ".")}</>;
  return (
    <div className="bg-white rounded-2xl p-4 shadow-sm" data-safer-choice>
      <div className="flex items-center gap-2">
        <CheckCircle2 size={18} className="text-[#1A5C39]" aria-hidden="true" />
        <span className="font-extrabold text-sm text-[#1A5C39]">EPA Safer Choice certified</span>
      </div>
      {hit.listed.length === 1
        ? <p className="text-xs text-gray-600 mt-1.5 leading-relaxed">As listed by EPA: {named(hit.listed[0])}</p>
        : <div className="text-xs text-gray-600 mt-1.5 leading-relaxed">EPA lists this barcode for:
            <ul className="list-disc pl-4">{hit.listed.map(p => <li key={p.name + p.company}>{named(p)}</li>)}</ul></div>}
      <p className="text-xs text-gray-600 mt-1.5 leading-relaxed">“{NOT_ENDORSEMENT.text}” (EPA)</p>
      {hit.listed.some(inCaliforniaScope) && <p className="text-xs text-gray-600 mt-1.5 leading-relaxed">{CALIFORNIA_LINE.text}</p>}
      <p className="text-micro text-gray-500 mt-1.5 leading-snug">
        From EPA's Safer Choice list, {snapshotLabel(hit.retrieved)}.{" "}
        <a href={PRODUCT_SEARCH} target="_blank" rel="noreferrer" className="font-bold underline text-gray-700">
          Search EPA's Safer Choice products<span className="sr-only"> (opens in a new tab)</span>
        </a>
      </p>
    </div>
  );
}

export default function ProductDetailScreen({ product, onBack, store, savedOk, onChangeSaved, onSelectProduct, onAddToOff }: ProductDetailScreenProps) {
  const [openFlag, setOpenFlag] = useState<string | null>(null);
  const saved = store.items.some(i => i.id === product.id);
  const [sheet, setSheet] = useState(false);
  const bookmark = useRef<HTMLButtonElement>(null);
  // M14 D1/D6: the empty bookmark saves at once and opens the sheet; the filled one unsaves everywhere, with Undo.
  const onBookmark = () => {
    onChangeSaved(toggleSave(store, product), saved ? "Removed" : undefined);
    if (!saved) setSheet(true);
  };
  const closeSheet = () => { setSheet(false); bookmark.current?.focus(); };
  // 058 L1/L3: "Check the label yourself" opens over the page, which stays as it was (inert) and gets focus back.
  const [checking, setChecking] = useState(false);
  const checkButton = useRef<HTMLButtonElement>(null);
  // 064 G5: a row's Learn link opens the page over this one the same way; Back returns focus to the link.
  const [learn, setLearn] = useState<ExplainerId | null>(null);
  const learnLink = useRef<HTMLElement | null>(null);
  const openLearn = (id: ExplainerId, from: HTMLElement) => { learnLink.current = from; setLearn(id); };
  const behind = checking || learn ? { inert: "" } : {};
  const analysis = useMemo(() => safeAnalyze(product), [product]);
  // M16: an Open Beauty Facts product. Its badge and info rows come from the same personal-care check.
  const care = isPersonalCare(product);
  const careNotes = analysis.notes ?? [];
  // 064 H2: the benzene info row (drinks only); outside the assessment, so it never touches the badge.
  const foodNotes = useMemo((): Finding[] => {
    const m = care ? null : benzeneNote(product);
    return m ? [{ id: "note-benzene", name: BENZENE_NOTE.name, info: true, concern: BENZENE_NOTE.text, detail: `Listed as “${m[0]}” and “${m[1]}”`, sources: BENZENE_NOTE.sources, learn: "hidden-risks" }] : [];
  }, [product, care]);
  const look = VERDICT_STYLE[analysis.verdict];
  const nutrition = useNutrition(product);
  const highNutrient = topHigh(nutrition.status === "ready" ? nutrition.nutrition : null);

  // Same USDA category, strictly better badge; only offered when this product has concerns (useAlternatives.ts).
  const alternatives = useAlternatives(product, analysis.verdict);
  const category = product.category || product.source?.foodCategory;
  const updateUrl = updateInfoUrl(product);

  return (
    <div className="absolute inset-0 z-50 flex flex-col bg-white" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>

      {/* ── Hero ── */}
      <div data-hero {...behind} className="flex-shrink-0 relative" style={{ background: look.gradient, "--hero-solid": look.solid } as CSSProperties}>
        <div className="absolute top-0 left-0 right-0 flex items-center justify-between px-4 pt-4 z-10">
          <button onClick={onBack} aria-label="Back" className="w-11 h-11 bg-white/20 rounded-2xl backdrop-blur-sm flex items-center justify-center">
            <ArrowLeft size={18} color="white" />
          </button>
          <button ref={bookmark} onClick={onBookmark} aria-label={saved ? "Remove from saved" : "Save"} aria-pressed={saved} className="w-11 h-11 bg-white/20 rounded-2xl backdrop-blur-sm flex items-center justify-center">
            <Bookmark size={16} fill={saved ? "white" : "none"} color="white" />
          </button>
        </div>

        <div className="pt-16 pb-5 px-5 flex items-center gap-4">
          <div className="w-20 h-20 rounded-3xl bg-white/20 backdrop-blur-sm border border-white/30 flex items-center justify-center flex-shrink-0 shadow-xl">
            <span className="text-4xl" aria-hidden="true">{foodIcon(product)}</span>
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5 mb-1">
              <span className="text-nano font-bold uppercase tracking-[0.15em] text-white/60">{product.brand}</span>
              {category && (<>
                <span className="text-white/30">·</span>
                <span className="text-nano font-bold uppercase tracking-[0.15em] text-white/60">{category}</span>
              </>)}
            </div>
            <h1 className="text-lg font-extrabold text-white leading-tight mb-2">{product.name}</h1>
            <div className="flex gap-1.5 flex-wrap">
              {formsWhenCooked(analysis) && (
                <span className="text-nano font-bold px-2 py-0.5 rounded-full bg-white/20 text-white">🔥 Forms when cooked</span>
              )}
              {highNutrient && <NutritionChip onDark text={`High in ${highNutrient.label.toLowerCase()}`} />}
            </div>
          </div>
          <div className="flex-shrink-0 w-[84px] flex flex-col items-center gap-1.5 text-center">
            <div className="w-16 h-16 rounded-full bg-white flex items-center justify-center shadow-xl">
              <look.Icon size={30} style={{ color: look.color }} />
            </div>
            <span className="text-micro font-extrabold text-white leading-tight">{look.short}</span>
          </div>
        </div>
      </div>

      {/* ── Scrollable Body ── */}
      <div {...behind} className="flex-1 overflow-y-auto bg-gray-50" style={{ scrollbarWidth: "none" }}>
        <div className="px-4 py-4 space-y-3 pb-10">

          {product.source && care && (
            <div className="rounded-2xl p-3 text-mini leading-snug border bg-amber-50 border-amber-100 text-amber-900">
              <strong>From Open Beauty Facts, crowd-sourced.</strong>{" "}
              <a href={product.source.url} target="_blank" rel="noreferrer" className="font-bold underline">View on Open Beauty Facts</a>
              {product.source.ingredientsLang !== "en" && (
                <span className="block mt-1">Ingredients are listed in {languageName(product.source.ingredientsLang)}; ingredient names may be missed.</span>
              )}
              <span className="block mt-1 opacity-70">Data © Open Beauty Facts contributors, ODbL.</span>
            </div>
          )}
          {product.source && !care && (
            <div className={`rounded-2xl p-3 text-mini leading-snug border ${product.source.crowdSourced
              ? "bg-amber-50 border-amber-100 text-amber-900" : "bg-white border-gray-100 text-gray-600 shadow-sm"}`}>
              {product.source.crowdSourced
                ? <><strong className="block">Shown from Open Food Facts, crowd-sourced. Help verify it.</strong>
                    Anyone can edit this data, so it may contain errors. Fixes you make there show here after you reload EcoGo.</>
                : `Label data from USDA FoodData Central, supplied by the manufacturer${product.source.snapshot ? ` (snapshot ${snapshotLabel(product.source.snapshot)})` : ""}.`}{" "}
              <a href={product.source.url} target="_blank" rel="noreferrer" className="font-bold underline">
                {product.source.crowdSourced ? "View on Open Food Facts" : "View record"}
              </a>
              {product.source.ingredientsLang !== "en" && (
                <span className="block mt-1">
                  Ingredients are listed in {languageName(product.source.ingredientsLang)}; additive codes were checked, ingredient names may be missed.
                </span>
              )}
              {product.source.crowdSourced && <span className="block mt-1 opacity-70">Data © Open Food Facts contributors, ODbL.</span>}
            </div>
          )}

          <SaferChoiceCard barcode={product.barcode} />

          {/* ── Verdict ── */}
          <div className="bg-white rounded-2xl p-4 shadow-sm" style={{ borderLeft: `4px solid ${look.color}` }}>
            <div className="flex items-center gap-2">
              <look.Icon size={18} style={{ color: look.color }} />
              <span className="font-extrabold text-sm" style={{ color: look.color }}>{verdictHeadline(analysis, care)}</span>
            </div>
            <p className="text-xs text-gray-500 mt-1.5 leading-relaxed">{care
              ? (!product.ingredients.trim() ? (product.source ? "No ingredient list on Open Beauty Facts." : SMALL_PRINT["no-data"])
                : `${analysis.flags.length + careNotes.length > 0 ? `${TAP_FINDING} ` : ""}${CARE_LIMITS}`)
              : analysis.verdict === "none"
              ? (formsWhenCooked(analysis) ? NONE_BUT_COOKED : SMALL_PRINT.none) + nutritionNote(nutrition.status !== "none" || !!updateUrl)
              : SMALL_PRINT[analysis.verdict]}</p>
          </div>

          {/* ── Findings, grouped by where they come from ── */}
          {findingGroups(analysis, careNotes, care, foodNotes).map(g => (
            <div key={g.title} className="bg-white rounded-2xl shadow-sm overflow-hidden">
              <div className="px-4 py-3 border-b border-gray-100 font-bold text-sm">{g.title}</div>
              <div className="divide-y divide-gray-50">
                {g.findings.map(f => (
                  <FindingRow key={f.id} finding={f} open={openFlag === f.id} onLearn={openLearn}
                    onToggle={() => setOpenFlag(openFlag === f.id ? null : f.id)} />
                ))}
              </div>
              {g.title === "Good to know" && <MoreDataLine notes={careNotes} className="px-4 pb-3" />}
            </div>
          ))}

          <LimitedRow limited={analysis.limited ?? []} />

          <NutritionPanel state={nutrition} updateUrl={updateUrl} />

          {/* ── Full ingredient list ── */}
          <div className="bg-white rounded-2xl p-4 shadow-sm">
            <div className="flex items-center gap-2 mb-2">
              <FlaskConical size={15} className="text-primary" />
              <span className="font-bold text-sm">Ingredients</span>
            </div>
            {product.ingredients.trim()
              ? <p className="text-xs text-gray-600 leading-relaxed"><HighlightedIngredients text={product.ingredients} flags={analysis.flags} /></p>
              : <p className="text-xs text-gray-500 italic">{care && product.source ? "No ingredient list on Open Beauty Facts." : "No ingredient list available."}</p>}
            {/* M16 N1: Open Beauty Facts products: the self-check and OBF's own editor; EcoGo sends nothing to OBF. */}
            {care && product.source && <div className="mt-3 space-y-2">
              <div className="flex items-center justify-between gap-2">
                <p className="text-xs text-gray-600">{product.ingredients.trim() ? "Doesn't match your package?" : "Have the package?"}</p>
                <button ref={checkButton} onClick={() => setChecking(true)} className="flex-shrink-0 min-h-[44px] px-3 rounded-xl border border-border text-xs font-bold text-gray-700">Check the label yourself</button>
              </div>
              <EditOnOff url={obfEditUrl(product.barcode)} site="Open Beauty Facts" />
            </div>}
            {/* Crowd-sourced OFF products only: 058 L1 the self-check; L4 the account-free sends first, OFF's own editor last. */}
            {updateUrl && <div className="mt-3 space-y-2">
              <div className="flex items-center justify-between gap-2">
                <p className="text-xs text-gray-600">Doesn't match your package?</p>
                <button ref={checkButton} onClick={() => setChecking(true)} className="flex-shrink-0 min-h-[44px] px-3 rounded-xl border border-border text-xs font-bold text-gray-700">Check the label yourself</button>
              </div>
              {!product.ingredients.trim() && <button onClick={() => onAddToOff("ingredients")} className={PRIMARY}>Add the ingredients</button>}
              <button onClick={() => onAddToOff("photos")} className={PRIMARY}>Send new photos</button>
              <EditOnOff url={updateUrl} />
            </div>}
            <p className="text-micro text-gray-500 mt-3 leading-snug">
              Findings are matched against official sources ({care ? "FDA, EU, IARC" : "IARC, EU, FDA, EFSA, WHO"}), linked on each finding.
              Classifications describe potential hazards; this is not medical advice.
            </p>
          </div>

          {/* ── Alternatives with fewer concerns ── */}
          {alternatives.length > 0 && (
            <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
              <div className="flex items-center gap-2 px-4 py-3 border-b border-gray-100">
                <TrendingUp size={15} className="text-green-600" />
                <span className="font-bold text-sm">Alternatives with fewer concerns</span>
              </div>
              <p className="px-4 pt-2.5 text-micro text-gray-500 leading-snug">
                Other products in this USDA category with fewer findings. Availability near you isn't known.
              </p>
              <div className="divide-y divide-gray-50">
                {alternatives.map(({ p, a }) => {
                  const altLook = VERDICT_STYLE[a.verdict];
                  return (
                    <button key={p.id} onClick={() => onSelectProduct(p)} className="w-full px-4 py-3 flex items-center gap-3 text-left">
                      <div className="w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: altLook.bg }}>
                        <span className="text-xl" aria-hidden="true">{foodIcon(p)}</span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-micro text-gray-500 font-medium">{p.brand}</p>
                        <p className="text-sm font-semibold leading-tight">{p.name}</p>
                      </div>
                      <span className="text-micro font-bold px-2 py-0.5 rounded-full flex-shrink-0" style={{ background: altLook.bg, color: altLook.color }}>{altLook.short}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>
      {sheet && <SaveSheet productId={product.id} saved={store} savedOk={savedOk} onChange={onChangeSaved} onClose={closeSheet} />}
      {checking && <IngredientCheck product={product.name} onClose={() => { setChecking(false); setTimeout(() => checkButton.current?.focus()); }}
        {...(care ? { kind: "care" as const, source: "Open Beauty Facts" } : { onSendPhotos: (photo: Blob) => onAddToOff("photos", photo) })} />}
      {learn && <Explainer id={learn} onBack={() => { setLearn(null); setTimeout(() => learnLink.current?.focus()); }} />}
    </div>
  );
}
