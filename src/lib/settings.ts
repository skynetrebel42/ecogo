// settings.ts: text size and high contrast, kept on this device. M11 part 4. Copy to src/lib/settings.ts.
// Spec: docs/superpowers/specs/2026-10-05-m11-quick-wins-design.md. Same pattern as recent.ts: storage may be missing, blocked or
// full, and must never break the app. The choice lives as two attributes on <html>, which theme.css reads.

export type TextSize = "normal" | "large" | "larger";
export interface Settings { textSize: TextSize; contrast: "normal" | "high" }

export const TEXT_SIZES: { id: TextSize; label: string; scale: number }[] = [
  { id: "normal", label: "Normal", scale: 1 },
  { id: "large", label: "Large", scale: 1.15 },
  { id: "larger", label: "Larger", scale: 1.3 },
];

const SETTINGS_KEY = "ecogo.settings.v1";

/** Stored JSON → settings. Corrupt or unknown values fall back to `fallback` field by field. */
export function parseSettings(raw: string | null, fallback: Settings): Settings {
  try {
    const data = raw ? JSON.parse(raw) : null;
    return {
      textSize: TEXT_SIZES.some(t => t.id === data?.textSize) ? data.textSize : fallback.textSize,
      contrast: data?.contrast === "high" || data?.contrast === "normal" ? data.contrast : fallback.contrast,
    };
  } catch {
    return fallback;
  }
}

/** First visit: high contrast follows the phone's own setting ("more contrast"); text size starts normal. */
export function defaultSettings(prefersMoreContrast: boolean): Settings {
  return { textSize: "normal", contrast: prefersMoreContrast ? "high" : "normal" };
}

export function loadSettings(): Settings {
  let more = false;
  try { more = window.matchMedia("(prefers-contrast: more)").matches; } catch { /* no media queries: normal */ }
  try { return parseSettings(localStorage.getItem(SETTINGS_KEY), defaultSettings(more)); } catch { return defaultSettings(more); }
}
export function saveSettings(s: Settings): void {
  try { localStorage.setItem(SETTINGS_KEY, JSON.stringify(s)); } catch { /* not saved; applies this visit */ }
}

/** Puts the settings where the CSS reads them: `data-text-size` and `data-contrast` on the root element. */
export function applySettings(root: { setAttribute(name: string, value: string): void }, s: Settings): void {
  root.setAttribute("data-text-size", s.textSize);
  root.setAttribute("data-contrast", s.contrast);
}
