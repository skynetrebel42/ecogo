// ─────────────────────────────────────────────────────────────────────────────
// scoring.ts — Modular product scoring engine
//
// Each product is evaluated across four independent dimensions. Weights are
// defined here so graders can adjust them without touching component code.
//
// Future: these weights could be user-configurable (stored in Supabase) or
// category-specific (e.g., food vs. cleaning products weigh health differently).
// ─────────────────────────────────────────────────────────────────────────────

// ─── Score Dimensions ────────────────────────────────────────────────────────

export interface ScoreDimensions {
  /** Ingredient safety, IARC classifications, known health impacts. 0–100. */
  health: number;
  /** Packaging, emissions, biodegradability, sourcing footprint. 0–100. */
  environment: number;
  /** Labor practices, corporate conduct, animal welfare, political activity. 0–100. */
  ethics: number;
  /** Ingredient disclosure, certifications, supply chain visibility. 0–100. */
  transparency: number;
}

export interface ProductScore extends ScoreDimensions {
  /** Weighted composite of the four dimensions. 0–100. */
  overall: number;
  /** Letter grade derived from ethicsScore (A–F). */
  grade: string;
  /** Short human-readable verdict. */
  verdict: string;
}

// ─── Weights ─────────────────────────────────────────────────────────────────

/**
 * Dimension weights must sum to 1.0.
 * Health is weighted highest because it has the most direct personal impact.
 */
export const SCORE_WEIGHTS: Record<keyof ScoreDimensions, number> = {
  health:       0.30,
  environment:  0.25,
  ethics:       0.25,
  transparency: 0.20,
};

// ─── Grade Thresholds ─────────────────────────────────────────────────────────

/**
 * Thresholds applied to ethics_score to produce the letter grade.
 * Using ethics rather than overall because ethics captures company-level
 * accountability that consumers frequently act on.
 */
const GRADE_THRESHOLDS: { min: number; grade: string; verdict: string }[] = [
  { min: 80, grade: "A", verdict: "Exemplary" },
  { min: 65, grade: "B", verdict: "Good" },
  { min: 50, grade: "C", verdict: "Fair" },
  { min: 35, grade: "D", verdict: "Concerning" },
  { min: 0,  grade: "F", verdict: "Harmful" },
];

// ─── Public Functions ─────────────────────────────────────────────────────────

/**
 * Compute the overall weighted score from the four input dimensions.
 * Returns a rounded integer in [0, 100].
 */
export function computeOverall(dims: ScoreDimensions): number {
  return Math.round(
    dims.health       * SCORE_WEIGHTS.health       +
    dims.environment  * SCORE_WEIGHTS.environment  +
    dims.ethics       * SCORE_WEIGHTS.ethics       +
    dims.transparency * SCORE_WEIGHTS.transparency
  );
}

/**
 * Convert a numeric ethics score (0–100) to a letter grade.
 */
export function scoreToGrade(ethicsScore: number): string {
  return (GRADE_THRESHOLDS.find((t) => ethicsScore >= t.min) ?? GRADE_THRESHOLDS.at(-1)!).grade;
}

/**
 * Return the human-readable verdict for a grade.
 */
export function gradeToVerdict(grade: string): string {
  return GRADE_THRESHOLDS.find((t) => t.grade === grade)?.verdict ?? "Unknown";
}

/**
 * Build a full ProductScore from raw dimension values.
 * Validates that all dimensions are in [0, 100].
 */
export function buildProductScore(dims: ScoreDimensions): ProductScore {
  const clamped: ScoreDimensions = {
    health:       clamp(dims.health,       0, 100),
    environment:  clamp(dims.environment,  0, 100),
    ethics:       clamp(dims.ethics,       0, 100),
    transparency: clamp(dims.transparency, 0, 100),
  };
  const overall = computeOverall(clamped);
  const grade   = scoreToGrade(clamped.ethics);
  const verdict = gradeToVerdict(grade);
  return { ...clamped, overall, grade, verdict };
}

/**
 * Map a 0–100 score to a Tailwind text-color class.
 * Used in UI components — kept here so color semantics stay co-located with scoring.
 */
export function scoreColorClass(score: number): string {
  if (score >= 80) return "text-green-600";
  if (score >= 65) return "text-emerald-600";
  if (score >= 50) return "text-yellow-600";
  if (score >= 35) return "text-orange-600";
  return "text-red-600";
}

/**
 * Map a 0–100 score to a hex color (for SVG / inline style use).
 */
export function scoreColorHex(score: number): string {
  if (score >= 80) return "#16a34a";
  if (score >= 65) return "#059669";
  if (score >= 50) return "#ca8a04";
  if (score >= 35) return "#ea580c";
  return "#dc2626";
}

/**
 * Map a grade string to a Tailwind badge class pair (bg + text).
 */
export function gradeBadgeClass(grade: string): string {
  const map: Record<string, string> = {
    A: "bg-green-600 text-white",
    B: "bg-emerald-500 text-white",
    C: "bg-yellow-500 text-white",
    D: "bg-orange-600 text-white",
    F: "bg-red-600 text-white",
  };
  return map[grade] ?? "bg-gray-400 text-white";
}

// ─── Internal ────────────────────────────────────────────────────────────────

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}
