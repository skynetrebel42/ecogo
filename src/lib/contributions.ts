// contributions.ts — M15 "Your contributions" (docs/superpowers/specs/2026-10-16-m15-contributions-design.md C1–C5):
// counts from the person's own server rows (RLS limits each read to them), and the five milestones.
// The Supabase client is passed in (the app passes lib/supabase.ts), so Node tests can load this module.

const AT = [1, 5, 10, 25, 50];
const badge = (n: number) => (n === 1 ? "First help" : `${n} helps`);
export const BADGES = AT.map(badge);

/** Badges reached for `total`, and the next one with how many to go (none after 50). */
export function milestones(total: number): { reached: string[]; next?: { badge: string; toGo: number } } {
  const at = AT.find(n => n > total);
  return { reached: AT.filter(n => n <= total).map(badge), ...(at && { next: { badge: badge(at), toGo: at - total } }) };
}

/** Products sent to Open Food Facts: distinct barcodes among the person's `sent` rows. */
export const productCount = (barcodes: string[]) => new Set(barcodes).size;

/** C5: the badge a product send of `code` just reached, read after the send. The send added to the count only if its
 *  row is this barcode's only `sent` row; then the total rose by one and may land on a milestone. */
export function justReached(barcodes: string[], code: string, places: number): string | undefined {
  if (barcodes.filter(b => b === code).length !== 1) return undefined;
  const total = productCount(barcodes) + places;
  return AT.includes(total) ? badge(total) : undefined;
}

type Answer = { data?: { barcode: string }[] | null; count?: number | null; error: unknown };
export interface ContributionsClient {
  auth: { getSession(): Promise<{ data: { session: unknown }; error?: unknown }> };
  from(table: "contributions" | "place_reports"): {
    select(cols: string, opts?: { count: "exact"; head: true }): { eq(col: string, v: string): PromiseLike<Answer> };
  };
}

/** C4: "none" with no session (no sign-in is made, nothing is read); else the person's sent barcodes and approved
 *  place reports, or null if either read failed.
 *  ponytail: one page of barcodes (PostgREST's 1,000-row default); the last milestone is 50. */
export async function readContributions(client: ContributionsClient): Promise<{ barcodes: string[]; places: number } | "none" | null> {
  // A stored session whose refresh failed (offline) comes back null with an error: that's a failed read, not "none".
  const { data, error } = await client.auth.getSession();
  if (error) return null;
  if (!data.session) return "none";
  const [p, r] = await Promise.all([
    client.from("contributions").select("barcode").eq("status", "sent"),
    client.from("place_reports").select("id", { count: "exact", head: true }).eq("status", "approved"),
  ]);
  if (p.error || r.error || !p.data) return null;
  return { barcodes: p.data.map(row => row.barcode), places: r.count ?? 0 };
}
