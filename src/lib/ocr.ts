// ocr.ts — read an ingredients label on the phone (M8, spec docs/superpowers/specs/2026-10-02-m8-add-product-design.md D4).

/** Tidy text read from a label: drop a leading "Ingredients:", rejoin words hyphenated across lines, one line. */
export function cleanIngredients(raw: string): string {
  return raw
    .replace(/-[ \t]*\r?\n\s*/g, "")
    .replace(/^\s*ingredients?\s*:\s*/i, "")
    .replace(/\s+/g, " ")
    .trim();
}
