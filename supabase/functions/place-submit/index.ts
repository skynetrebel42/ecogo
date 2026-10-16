// place-submit — the only writer to `place_reports` (M8.1 spec P4): a Map suggestion or report, for the owner to read
// by hand in the Supabase dashboard. The checks live in place.ts; this file wires them to the service-role client.
// Secrets: SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are built in. Deployed with verify_jwt off (as off-submit).
import { createClient } from "jsr:@supabase/supabase-js@2";
import { placeSubmit, reviewedBefore, type PlaceDb } from "./place.ts";

const env = (name: string) => Deno.env.get(name) ?? "";
const db = createClient(env("SUPABASE_URL"), env("SUPABASE_SERVICE_ROLE_KEY"), { auth: { persistSession: false } });

const count = async (table: "place_reports" | "contributions", day: string, user?: string) => {
  let q = db.from(table).select("id", { count: "exact", head: true }).gte("created_at", day);
  if (user) q = q.eq("user_id", user);
  const { count, error } = await q;
  if (error) throw error;
  return count ?? 0;
};

const places: PlaceDb = {
  async userId(jwt) { return (await db.auth.getUser(jwt)).data.user?.id ?? null; },
  async counts(user, day) {
    const [mine, all, products] = await Promise.all([count("place_reports", day, user), count("place_reports", day), count("contributions", day, user)]);
    return { mine, all, products };
  },
  async insert(user, row) {
    const { error } = await db.from("place_reports").insert({ user_id: user, ...row });
    if (error) throw error;
  },
  async deleteReviewed(status, before) {
    const { error } = await db.from("place_reports").delete().eq("status", status).or(reviewedBefore(before));
    if (error) throw error;
  },
  // ponytail: also rewrites rows already cleared, each call; add a fields filter if approved rows grow into thousands.
  async clearReviewed(status, before) {
    const { error } = await db.from("place_reports").update({ fields: {} }).eq("status", status).or(reviewedBefore(before));
    if (error) throw error;
  },
};

Deno.serve(req => placeSubmit(req, places));
