// library.ts — the verified ingredient library for the safety engine.
// Spec: docs/superpowers/specs/2026-09-24-safety-engine-design.md §5.
// Every entry must pass `npm run verify:sources` and the integrity test before it ships.

export type Severity = "high" | "some";

/** What a source establishes. "context" = a regulator's intake position; it never sets severity. */
export type Basis =
  | "iarc-1" | "iarc-2a" | "iarc-2b"
  | "banned-eu" | "banned-us"
  | "eu-warning-label"
  | "context";

export interface Source {
  body: "IARC" | "EU" | "FDA" | "EFSA" | "WHO/JECFA";
  basis: Basis;
  finding: string;   // e.g. "Group 2B: possibly carcinogenic to humans"
  url: string;       // official page
  quote: string;     // short verbatim phrase from that page (checked by verify:sources)
  checkedOn: string; // YYYY-MM-DD
}

export interface LibraryEntry {
  id: string;          // slug, e.g. "sodium-nitrite"
  name: string;        // display name
  aliases: string[];   // lowercase label spellings, >= 3 characters, unique across the library
  eCodes: string[];    // e.g. ["E250"]
  severity: Severity;  // must equal deriveSeverity(sources)
  concern: string;     // one plain-English sentence
  context?: string;    // regulator intake position shown next to the flag
  sources: Source[];
}

const HIGH_BASES: ReadonlySet<Basis> = new Set(["iarc-1", "iarc-2a", "banned-eu", "banned-us"]);
const SOME_BASES: ReadonlySet<Basis> = new Set(["iarc-2b", "eu-warning-label"]);

/** Severity is mechanical: the strongest basis among an entry's sources. null = no severity-bearing source. */
export function deriveSeverity(sources: Source[]): Severity | null {
  if (sources.some(s => HIGH_BASES.has(s.basis))) return "high";
  if (sources.some(s => SOME_BASES.has(s.basis))) return "some";
  return null;
}

export const LIBRARY: LibraryEntry[] = [];
