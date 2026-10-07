// M11 part 4: the palette keeps its contrast promises. Copy to src/lib/themeContrast.test.ts. Reads src/styles/theme.css.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { TEXT_SIZES } from "./settings.ts";

const css = readFileSync(new URL("../styles/theme.css", import.meta.url), "utf8");

/** The declarations of the first rule whose selector is exactly `selector`. */
function block(selector: string): Record<string, string> {
  const start = css.indexOf(selector + " {");
  assert.ok(start >= 0, `theme.css has no ${selector} block`);
  const body = css.slice(css.indexOf("{", start) + 1, css.indexOf("}", start));
  return Object.fromEntries([...body.matchAll(/(--[\w-]+)\s*:\s*([^;]+);/g)].map(m => [m[1], m[2].trim()]));
}

type RGB = [number, number, number];
const hex = (h: string): RGB => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16)) as RGB;
const luminance = ([r, g, b]: RGB) => {
  const f = (c: number) => { c /= 255; return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; };
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
};
const ratio = (a: RGB, b: RGB) => { const [x, y] = [luminance(a), luminance(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05); };
/** "rgba(0, 0, 0, 0.55)" laid over a background. */
function overBackground(value: string, bg: RGB): RGB {
  const m = value.match(/rgba\(\s*(\d+),\s*(\d+),\s*(\d+),\s*([\d.]+)\)/);
  if (!m) return hex(value);
  const a = Number(m[4]);
  return [1, 2, 3].map(i => Math.round(a * Number(m[i]) + (1 - a) * bg[i - 1])) as RGB;
}

const normal = block(":root");
const high = block(':root[data-contrast="high"]');
const tokens = (t: Record<string, string>, base: Record<string, string> = {}) => (k: string) => hex(t[k] ?? base[k]);

test("normal palette: text reaches WCAG AA (4.5:1) on its surfaces", () => {
  const c = tokens(normal);
  for (const [fg, bg] of [["--foreground", "--background"], ["--muted-foreground", "--background"], ["--muted-foreground", "--card"], ["--primary", "--background"]])
    assert.ok(ratio(c(fg), c(bg)) >= 4.5, `${fg} on ${bg}: ${ratio(c(fg), c(bg)).toFixed(2)}`);
});

test("high contrast: every text token reaches WCAG AAA (7:1), borders 3:1", () => {
  const c = tokens(high, normal);
  for (const [fg, bg] of [["--foreground", "--background"], ["--card-foreground", "--card"], ["--muted-foreground", "--background"],
    ["--muted-foreground", "--card"], ["--muted-foreground", "--muted"], ["--primary", "--background"], ["--primary", "--card"], ["--secondary-foreground", "--secondary"]])
    assert.ok(ratio(c(fg), c(bg)) >= 7, `${fg} on ${bg}: ${ratio(c(fg), c(bg)).toFixed(2)}`);
  const border = overBackground(high["--border"], c("--background"));
  assert.ok(ratio(border, c("--background")) >= 3, `border: ${ratio(border, c("--background")).toFixed(2)}`);
});

test("text sizes: the CSS scales match the settings module, and the root size follows the browser", () => {
  assert.equal(normal["--font-size"], "100%");
  assert.equal(normal["--text-scale"], "1");
  assert.equal(block(':root[data-text-size="large"]')["--text-scale"], String(TEXT_SIZES[1].scale));
  assert.equal(block(':root[data-text-size="larger"]')["--text-scale"], String(TEXT_SIZES[2].scale));
});

test("every font-size token scales with --text-scale", () => {
  for (const name of ["xs", "sm", "base", "lg", "xl", "2xl", "nano", "micro", "mini"])
    assert.match(css, new RegExp(`--text-${name}:\\s*calc\\([^)]*var\\(--text-scale, 1\\)\\)`), `--text-${name}`);
});

// M12: Home's Learn tiles (spec docs/superpowers/specs/2026-10-06-m12-home-tiles-design.md §5).
test("Learn tiles: six different colours, white text reaches 7:1", () => {
  const src = readFileSync(new URL("../app/components/Explainer.tsx", import.meta.url), "utf8");
  const tiles = [...src.matchAll(/tile: "(#[0-9A-Fa-f]{6})"/g)].map(m => m[1].toUpperCase());
  assert.equal(tiles.length, 6);
  assert.equal(new Set(tiles).size, 6);
  for (const t of tiles) assert.ok(ratio(hex(t), [255, 255, 255]) >= 7, `${t}: ${ratio(hex(t), [255, 255, 255]).toFixed(2)}`);
});
