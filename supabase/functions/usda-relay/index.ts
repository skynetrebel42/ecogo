// usda-relay — relays the two USDA FoodData Central searches the app makes, so the API key stays the Supabase secret
// FDC_API_KEY instead of sitting in the public JavaScript. Spec: docs/superpowers/specs/2026-10-02-m75-usda-key-relay-design.md
// (R1-R8). Not an open proxy: one fixed upstream URL, only `query` and `pageSize` are read, other websites get 403.
// ponytail: no cache or rate limit (R8); M10 retires this relay. If someone burns the shared quota, add a per-IP limit.

const USDA = "https://api.nal.usda.gov/fdc/v1/foods/search";
const PAGE_SIZES = new Set(["5", "15"]); // a barcode lookup, a text search
const ALLOWED_ORIGIN = /^(https:\/\/skynetrebel42\.github\.io|http:\/\/(localhost|127\.0\.0\.1)(:\d+)?)$/;

/** Pure request → response (Node tests call it directly). */
export async function handle(req: Request, env: { key?: string }, fetchImpl: typeof fetch = fetch): Promise<Response> {
  const origin = req.headers.get("Origin") ?? "";
  if (!ALLOWED_ORIGIN.test(origin)) return Response.json({ error: "origin not allowed" }, { status: 403 });
  const cors = { "Access-Control-Allow-Origin": origin, Vary: "Origin" };
  const reply = (status: number, error: string) => Response.json({ error }, { status, headers: cors });

  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: { ...cors, "Access-Control-Allow-Methods": "GET, OPTIONS",
      "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type" } });
  }
  if (req.method !== "GET") return reply(405, "GET only");

  const params = new URL(req.url).searchParams;
  const query = (params.get("query") ?? "").trim();
  const pageSize = params.get("pageSize") ?? "";
  if (!query || query.length > 100 || !PAGE_SIZES.has(pageSize)) return reply(400, "needs query (1-100 characters) and pageSize 5 or 15");
  const key = env.key?.trim(); // a pasted secret once carried a newline and USDA answered 403
  if (!key) return reply(500, "relay is not configured");

  try {
    const res = await fetchImpl(`${USDA}?api_key=${encodeURIComponent(key)}&dataType=Branded&pageSize=${pageSize}&query=${encodeURIComponent(query)}`);
    if (!res.ok) return reply(res.status, `USDA returned HTTP ${res.status}`);
    const body = await res.text();
    if (body.includes(key)) return reply(502, "USDA's answer could not be relayed"); // never echo the key
    return new Response(body, { status: 200, headers: { ...cors, "Content-Type": "application/json" } });
  } catch {
    return reply(502, "USDA could not be reached");
  }
}

// Supabase runs this file on Deno; Node (the tests) has no Deno global and only uses handle().
declare const Deno: { serve(h: (req: Request) => Promise<Response>): void; env: { get(name: string): string | undefined } };
if (typeof Deno !== "undefined") Deno.serve(req => handle(req, { key: Deno.env.get("FDC_API_KEY") }));
