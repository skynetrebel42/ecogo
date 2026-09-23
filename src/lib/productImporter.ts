// ─────────────────────────────────────────────────────────────────────────────
// productImporter.ts — Fault-tolerant CSV → Product pipeline
//
// Design principles:
//   • A single bad row never prevents valid rows from loading.
//   • Every skip reason is logged with the row number and field that failed.
//   • The header is validated before any data rows are processed.
//   • All numeric parsing uses safe wrappers with explicit fallbacks.
//   • IMPORT_DIAGNOSTICS is exported so callers can inspect what happened.
//
// ── Supabase migration path ──────────────────────────────────────────────────
// Replace loadProductsFromCSV() with an async Supabase query, then map each
// row through buildValidatedProduct(). The exported types and PRODUCTS constant
// stay unchanged — no consumer code needs to change.
// ─────────────────────────────────────────────────────────────────────────────

import csvText from "../data/products.csv?raw";
import { buildProductScore, scoreToGrade } from "./scoring";

// ─── Schema: required and optional columns ────────────────────────────────────

/**
 * Columns that MUST be present in the header.
 * A missing required column causes the entire import to abort with a warning,
 * because data cannot be meaningfully interpreted without them.
 */
const REQUIRED_COLUMNS = [
  "id",
  "product_name",
  "brand",
  "category",
  "store",
  "price",
  "health_score",
  "environment_score",
  "ethics_score",
  "transparency_score",
  "overall_score",
] as const;

/**
 * Columns that MAY be absent. Missing optional columns default to empty string.
 * Their absence is noted in diagnostics but never causes rows to be skipped.
 */
const OPTIONAL_COLUMNS = [
  "barcode",
  "description",
  "ingredients",
  "image_url",
  "store_rating",
  "store_condition",
  "keywords",
] as const;

/** All columns the parser knows about. */
const ALL_KNOWN_COLUMNS = new Set<string>([
  ...REQUIRED_COLUMNS,
  ...OPTIONAL_COLUMNS,
]);

/** Valid values for the `store` column (case-insensitive). */
const VALID_STORES = new Set(["amazon", "walmart", "facebook"]);

/** Integer score range. Values are clamped, not rejected. */
const SCORE_MIN = 0;
const SCORE_MAX = 100;

// ─── Types ────────────────────────────────────────────────────────────────────

type RequiredColumn  = (typeof REQUIRED_COLUMNS)[number];
type RawRow = Record<string, string>;

/** Diagnostic information captured during a single import run. */
export interface ImportDiagnostics {
  /** True when the header row contained all required columns. */
  headerValid: boolean;
  /** Required columns that were absent from the header. */
  missingRequiredColumns: string[];
  /** Optional columns that were absent from the header. */
  missingOptionalColumns: string[];
  /** Column names found in the header that the schema does not recognise. */
  unknownColumns: string[];
  /** Total non-blank data lines processed. */
  totalDataRows: number;
  /** Data rows that were skipped due to validation errors. */
  skippedRows: number;
  /** Products successfully loaded (after grouping store rows). */
  loadedProducts: number;
  /** All warning messages produced during the import. */
  warnings: string[];
}

/** The canonical Product shape consumed by the rest of the application. */
export interface Product {
  id: number;
  barcode: string;
  name: string;
  brand: string;
  category: string;
  description: string;
  ingredients: string;
  imageUrl: string;
  keywords: string[];

  amazon?:   { price: number; rating: number };
  walmart?:  { price: number; rating: number };
  facebook?: { price: number; condition: string };

  /** Letter grade A–F derived from ethics_score */
  ethicalScore: string;
  /** Alias for healthScore — kept for UI backward-compatibility */
  safetyScore: number;
  /** Populated at runtime by the ingredient-analysis module, not the CSV */
  flaggedIngredients: string[];

  healthScore:      number;
  environmentScore: number;
  ethicsScore:      number;
  transparencyScore:number;
  overallScore:     number;
}

// ─── Safe Parsing Helpers ─────────────────────────────────────────────────────

/**
 * Parse a string to an integer.
 * Returns `fallback` for empty, whitespace-only, or non-numeric strings.
 * Clamps the result to [min, max] when bounds are provided.
 */
function safeInt(
  raw: string | undefined,
  fallback: number,
  min?: number,
  max?: number
): number {
  if (!raw || raw.trim() === "") return fallback;
  const n = parseInt(raw.trim(), 10);
  if (isNaN(n)) return fallback;
  if (min !== undefined && n < min) return min;
  if (max !== undefined && n > max) return max;
  return n;
}

/**
 * Parse a string to a float.
 * Returns `fallback` for empty or non-numeric strings.
 */
function safeFloat(raw: string | undefined, fallback: number): number {
  if (!raw || raw.trim() === "") return fallback;
  const n = parseFloat(raw.trim());
  return isNaN(n) ? fallback : n;
}

/**
 * Return a trimmed string, defaulting to `fallback` for undefined/empty input.
 */
function safeString(raw: string | undefined, fallback = ""): string {
  return raw?.trim() ?? fallback;
}

// ─── CSV Line Parser ──────────────────────────────────────────────────────────

/**
 * Split one CSV line into fields, honouring RFC 4180 quoting rules.
 * - Quoted fields may contain commas and newlines.
 * - "" inside a quoted field represents a literal double-quote character.
 * - Unterminated quotes (editing accidents) are closed at end-of-line.
 *
 * Returns an empty array if the line cannot be parsed at all.
 */
function parseCSVLine(line: string): string[] {
  try {
    const fields: string[] = [];
    let current = "";
    let inQuotes = false;

    for (let i = 0; i < line.length; i++) {
      const ch = line[i];

      if (ch === '"') {
        if (inQuotes && line[i + 1] === '"') {
          // Escaped double-quote inside a quoted field
          current += '"';
          i++;
        } else {
          // Toggle quoted-field mode
          inQuotes = !inQuotes;
        }
      } else if (ch === "," && !inQuotes) {
        fields.push(current);
        current = "";
      } else {
        current += ch;
      }
    }

    // Close any unterminated quote and push the last field
    fields.push(current);
    return fields;
  } catch {
    // Absolute safety net — an unparseable line yields an empty array
    return [];
  }
}

// ─── Header Validation ────────────────────────────────────────────────────────

interface HeaderValidation {
  valid: boolean;
  missingRequired: string[];
  missingOptional: string[];
  unknownColumns: string[];
}

/**
 * Inspect the parsed header row and report:
 *   - which required columns are missing (import aborts if any)
 *   - which optional columns are missing (import continues with defaults)
 *   - which column names the schema does not recognise (import continues)
 */
function validateHeader(headers: string[]): HeaderValidation {
  const headerSet = new Set(headers);

  const missingRequired = (REQUIRED_COLUMNS as ReadonlyArray<string>).filter(
    (col) => !headerSet.has(col)
  );
  const missingOptional = (OPTIONAL_COLUMNS as ReadonlyArray<string>).filter(
    (col) => !headerSet.has(col)
  );
  const unknownColumns = headers.filter(
    (col) => col.length > 0 && !ALL_KNOWN_COLUMNS.has(col)
  );

  return {
    valid: missingRequired.length === 0,
    missingRequired,
    missingOptional,
    unknownColumns,
  };
}

// ─── Row Validation ───────────────────────────────────────────────────────────

interface RowValidationResult {
  /** True if the row should be included in the import. */
  valid: boolean;
  /** Human-readable reasons this row was skipped or has non-fatal issues. */
  warnings: string[];
}

/**
 * Validate a single data row and return whether it should be imported.
 *
 * Skip conditions (row is discarded):
 *   - `id` is not a positive integer
 *   - `product_name` is empty
 *   - `store` is not one of: amazon, walmart, facebook
 *   - `price` is not a parseable positive number
 *
 * Warn-only conditions (row is included with a fallback value):
 *   - Score fields outside [0, 100] — clamped to the valid range
 *   - `brand` or `category` is empty — defaults to empty string
 *   - `ingredients` is empty — product still loads, just no ingredient data
 */
function validateDataRow(
  row: RawRow,
  lineNum: number,
  warnings: string[]
): RowValidationResult {
  const rowWarnings: string[] = [];

  // ── Required: id must be a positive integer ──────────────────────────────
  const rawId = safeString(row.id);
  const id = parseInt(rawId, 10);
  if (!rawId || isNaN(id) || id <= 0) {
    const reason = `Row ${lineNum}: skipped — invalid id "${rawId}" (must be a positive integer)`;
    warnings.push(reason);
    return { valid: false, warnings: [reason] };
  }

  // ── Required: product_name must be non-empty ─────────────────────────────
  if (!safeString(row.product_name)) {
    const reason = `Row ${lineNum} (id=${id}): skipped — product_name is empty`;
    warnings.push(reason);
    return { valid: false, warnings: [reason] };
  }

  // ── Required: store must be a known value ────────────────────────────────
  const store = safeString(row.store).toLowerCase();
  if (!VALID_STORES.has(store)) {
    const reason = `Row ${lineNum} (id=${id}): skipped — unrecognised store "${row.store}" (expected: amazon | walmart | facebook)`;
    warnings.push(reason);
    return { valid: false, warnings: [reason] };
  }

  // ── Required: price must be a valid positive number ──────────────────────
  const price = safeFloat(row.price, NaN);
  if (isNaN(price) || price < 0) {
    const reason = `Row ${lineNum} (id=${id}, store=${store}): skipped — invalid price "${row.price}" (must be a positive number)`;
    warnings.push(reason);
    return { valid: false, warnings: [reason] };
  }

  // ── Warn-only: score fields should be integers in [0, 100] ───────────────
  const scoreFields = [
    "health_score",
    "environment_score",
    "ethics_score",
    "transparency_score",
    "overall_score",
  ] as const;

  for (const field of scoreFields) {
    const raw = safeString(row[field]);
    if (raw === "") {
      rowWarnings.push(
        `Row ${lineNum} (id=${id}): ${field} is missing — defaulting to 50`
      );
    } else {
      const n = parseInt(raw, 10);
      if (isNaN(n)) {
        rowWarnings.push(
          `Row ${lineNum} (id=${id}): ${field} "${raw}" is not a number — defaulting to 50`
        );
      } else if (n < SCORE_MIN || n > SCORE_MAX) {
        rowWarnings.push(
          `Row ${lineNum} (id=${id}): ${field} value ${n} is outside [${SCORE_MIN}, ${SCORE_MAX}] — clamped`
        );
      }
    }
  }

  // ── Warn-only: recommended but non-fatal fields ───────────────────────────
  if (!safeString(row.brand)) {
    rowWarnings.push(`Row ${lineNum} (id=${id}): brand is empty`);
  }
  if (!safeString(row.category)) {
    rowWarnings.push(`Row ${lineNum} (id=${id}): category is empty`);
  }
  if (!safeString(row.ingredients)) {
    rowWarnings.push(
      `Row ${lineNum} (id=${id}): ingredients is empty — Ingredient Explorer will show no data`
    );
  }

  // Push non-fatal warnings into the shared diagnostics list
  warnings.push(...rowWarnings);

  return { valid: true, warnings: rowWarnings };
}

// ─── Full CSV Parser ──────────────────────────────────────────────────────────

interface ParseResult {
  headerValidation: HeaderValidation;
  /** Valid data rows, each keyed by column header. */
  validRows: Array<{ row: RawRow; lineNum: number }>;
  skippedRows: number;
  warnings: string[];
}

/**
 * Parse the full CSV text:
 *   1. Normalise line endings.
 *   2. Extract and validate the header row.
 *   3. Skip blank lines and lines that appear to be duplicate headers.
 *   4. Validate each data row; skip invalid rows and collect warnings.
 *   5. Return valid rows together with the full diagnostic picture.
 */
function parseCSV(text: string, warnings: string[]): ParseResult {
  // Normalise all line endings to \n
  const lines = text.replace(/\r\n/g, "\n").replace(/\r/g, "\n").split("\n");

  if (lines.length === 0 || lines[0].trim() === "") {
    warnings.push("CSV file appears to be empty — no products loaded");
    return {
      headerValidation: {
        valid: false,
        missingRequired: [...REQUIRED_COLUMNS],
        missingOptional: [...OPTIONAL_COLUMNS],
        unknownColumns: [],
      },
      validRows: [],
      skippedRows: 0,
      warnings,
    };
  }

  // ── Parse and validate the header row ───────────────────────────────────
  const rawHeaders = parseCSVLine(lines[0]);
  if (rawHeaders.length === 0) {
    warnings.push("CSV line 1 (header) could not be parsed — no products loaded");
    return {
      headerValidation: {
        valid: false,
        missingRequired: [...REQUIRED_COLUMNS],
        missingOptional: [...OPTIONAL_COLUMNS],
        unknownColumns: [],
      },
      validRows: [],
      skippedRows: 0,
      warnings,
    };
  }

  const headers = rawHeaders.map((h) => h.trim());
  const headerValidation = validateHeader(headers);

  if (headerValidation.unknownColumns.length > 0) {
    warnings.push(
      `CSV header contains unrecognised columns (will be ignored): ${headerValidation.unknownColumns.join(", ")}`
    );
  }
  if (headerValidation.missingOptional.length > 0) {
    warnings.push(
      `CSV header is missing optional columns (defaulting to empty): ${headerValidation.missingOptional.join(", ")}`
    );
  }

  if (!headerValidation.valid) {
    // Required columns are absent — we cannot safely map any data
    warnings.push(
      `[IMPORT ABORTED] CSV is missing required columns: ${headerValidation.missingRequired.join(", ")}. ` +
      `Check that the header row is the first line and all required columns are present.`
    );
    return { headerValidation, validRows: [], skippedRows: 0, warnings };
  }

  // ── Process data rows ────────────────────────────────────────────────────
  const validRows: Array<{ row: RawRow; lineNum: number }> = [];
  let skippedRows = 0;

  // Build a string fingerprint of the header to detect accidentally repeated
  // header rows embedded in the data (the exact corruption that caused the
  // regression this module was hardened to prevent).
  const headerFingerprint = lines[0].trim();

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i];
    const lineNum = i + 1; // 1-based, matching editor line numbers

    // Skip blank lines
    if (line.trim() === "") continue;

    // Skip lines that are identical to the header (duplicate header guard)
    if (line.trim() === headerFingerprint) {
      warnings.push(
        `Line ${lineNum}: skipped — looks like a duplicate header row embedded in the data`
      );
      skippedRows++;
      continue;
    }

    // Parse the line into fields
    const values = parseCSVLine(line);
    if (values.length === 0) {
      warnings.push(`Line ${lineNum}: skipped — line could not be parsed`);
      skippedRows++;
      continue;
    }

    // Map fields to header names; extra fields are silently ignored
    const row: RawRow = {};
    headers.forEach((header, idx) => {
      row[header] = safeString(values[idx]);
    });

    // Validate the row; skip if it fails required-field checks
    const validation = validateDataRow(row, lineNum, warnings);
    if (!validation.valid) {
      skippedRows++;
      continue;
    }

    validRows.push({ row, lineNum });
  }

  return { headerValidation, validRows, skippedRows, warnings };
}

// ─── Product Builder ──────────────────────────────────────────────────────────

/**
 * Convert a validated group of rows (all sharing the same product id) into a
 * single Product object, collecting per-store prices from each row.
 *
 * Returns null only if the group is empty — by the time rows reach this
 * function they have already been validated by validateDataRow().
 */
function buildValidatedProduct(
  rows: Array<{ row: RawRow; lineNum: number }>,
  warnings: string[]
): Product | null {
  if (rows.length === 0) return null;

  const { row: base, lineNum: baseLine } = rows[0];

  // id was already validated as a positive integer; parseInt is safe here
  const id = parseInt(base.id, 10);

  // Score dimensions — clamped to [0, 100] by safeInt
  const dims = {
    health:       safeInt(base.health_score,       50, SCORE_MIN, SCORE_MAX),
    environment:  safeInt(base.environment_score,  50, SCORE_MIN, SCORE_MAX),
    ethics:       safeInt(base.ethics_score,        50, SCORE_MIN, SCORE_MAX),
    transparency: safeInt(base.transparency_score, 50, SCORE_MIN, SCORE_MAX),
  };

  const score    = buildProductScore(dims);
  const keywords = safeString(base.keywords)
    .split("|")
    .map((k) => k.trim())
    .filter(Boolean);

  let amazon:   Product["amazon"]   = undefined;
  let walmart:  Product["walmart"]  = undefined;
  let facebook: Product["facebook"] = undefined;
  const seenStores = new Set<string>();

  for (const { row, lineNum } of rows) {
    const store = safeString(row.store).toLowerCase();
    const price = safeFloat(row.price, NaN);

    // Guard against duplicate store entries for the same product
    if (seenStores.has(store)) {
      warnings.push(
        `Line ${lineNum} (id=${id}): duplicate ${store} price entry — ` +
        `first occurrence wins, this row ignored`
      );
      continue;
    }
    seenStores.add(store);

    if (isNaN(price)) continue; // already guarded by validateDataRow; defensive only

    switch (store) {
      case "amazon":
        amazon = { price, rating: safeFloat(row.store_rating, 0) };
        break;
      case "walmart":
        walmart = { price, rating: safeFloat(row.store_rating, 0) };
        break;
      case "facebook":
        facebook = { price, condition: safeString(row.store_condition, "Listed") };
        break;
    }
  }

  // Warn if the product has no prices at all (it will still load but be
  // unshoppable — the developer should know)
  if (!amazon && !walmart && !facebook) {
    warnings.push(
      `Product id=${id} ("${safeString(base.product_name)}"): loaded with no store prices`
    );
  }

  return {
    id,
    barcode:           safeString(base.barcode),
    name:              safeString(base.product_name, `Product ${id}`),
    brand:             safeString(base.brand),
    category:          safeString(base.category),
    description:       safeString(base.description),
    ingredients:       safeString(base.ingredients),
    imageUrl:          safeString(base.image_url),
    keywords,

    amazon,
    walmart,
    facebook,

    // Legacy UI compatibility
    ethicalScore:      scoreToGrade(dims.ethics),
    safetyScore:       dims.health,
    flaggedIngredients: [],

    // Score breakdown
    healthScore:       score.health,
    environmentScore:  score.environment,
    ethicsScore:       score.ethics,
    transparencyScore: score.transparency,
    overallScore:      score.overall,
  };
}

// ─── Pipeline Entry Point ─────────────────────────────────────────────────────

/** Internal mutable record populated during the singleton load. */
const _diagnostics: ImportDiagnostics = {
  headerValid: false,
  missingRequiredColumns: [],
  missingOptionalColumns: [],
  unknownColumns: [],
  totalDataRows: 0,
  skippedRows: 0,
  loadedProducts: 0,
  warnings: [],
};

/**
 * Parse the bundled CSV and return a typed Product array.
 * Invalid rows are skipped; valid rows always load.
 *
 * Side-effect: populates the module-level `_diagnostics` object, which is
 * exported as `IMPORT_DIAGNOSTICS` after this function returns.
 *
 * To migrate to Supabase, replace this function body with an async fetch,
 * map each row through `buildValidatedProduct()`, and keep the return type.
 */
export function loadProductsFromCSV(): Product[] {
  const warnings: string[] = [];

  // ── 1. Parse CSV and validate structure ─────────────────────────────────
  const { headerValidation, validRows, skippedRows } = parseCSV(
    csvText,
    warnings
  );

  _diagnostics.headerValid            = headerValidation.valid;
  _diagnostics.missingRequiredColumns = headerValidation.missingRequired;
  _diagnostics.missingOptionalColumns = headerValidation.missingOptional;
  _diagnostics.unknownColumns         = headerValidation.unknownColumns;
  _diagnostics.totalDataRows          = validRows.length + skippedRows;
  _diagnostics.skippedRows            = skippedRows;

  if (!headerValidation.valid) {
    // Emit a clear console error so developers can diagnose the problem
    // without opening the network tab or reading source code.
    console.error(
      "[productImporter] Import aborted — CSV header is invalid.\n" +
      `  Missing required columns: ${headerValidation.missingRequired.join(", ")}\n` +
      "  Ensure the header row is the first line of products.csv and contains\n" +
      "  all required columns. See IMPORT_DIAGNOSTICS for details."
    );
    _diagnostics.warnings = warnings;
    return [];
  }

  // ── 2. Group valid rows by product id ───────────────────────────────────
  const grouped = new Map<string, Array<{ row: RawRow; lineNum: number }>>();
  for (const entry of validRows) {
    const key = safeString(entry.row.id);
    if (!grouped.has(key)) grouped.set(key, []);
    grouped.get(key)!.push(entry);
  }

  // ── 3. Build Product objects from each group ─────────────────────────────
  const products: Product[] = [];
  for (const [, group] of grouped) {
    const product = buildValidatedProduct(group, warnings);
    if (product) products.push(product);
  }

  // ── 4. Emit diagnostics ──────────────────────────────────────────────────
  _diagnostics.loadedProducts = products.length;
  _diagnostics.warnings       = warnings;

  if (warnings.length > 0) {
    console.warn(
      `[productImporter] Import completed with ${warnings.length} warning(s):\n` +
      warnings.map((w) => `  • ${w}`).join("\n")
    );
  }

  if (products.length === 0) {
    console.error(
      "[productImporter] No products were loaded. Check products.csv for data issues.\n" +
      "  Run IMPORT_DIAGNOSTICS in the browser console for a full report."
    );
  } else {
    console.info(
      `[productImporter] Successfully loaded ${products.length} product(s). ` +
      `${skippedRows} row(s) skipped.`
    );
  }

  return products.sort((a, b) => a.id - b.id);
}

// ─── Singletons ───────────────────────────────────────────────────────────────
// Parsed once at module load — no repeated work on re-renders.

export const PRODUCTS: Product[] = loadProductsFromCSV();

/**
 * Read-only snapshot of the last import run.
 * Inspect this in the browser console when debugging data issues:
 *
 *   import { IMPORT_DIAGNOSTICS } from "./lib/productImporter";
 *   console.table(IMPORT_DIAGNOSTICS.warnings);
 */
export const IMPORT_DIAGNOSTICS: Readonly<ImportDiagnostics> = _diagnostics;
