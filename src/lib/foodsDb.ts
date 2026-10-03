// foodsDb.ts — reads the `foods` table through Supabase (the public key can only select). Spec:
// docs/superpowers/specs/2026-10-02-m10-data-ownership-design.md §3, §5. Browser only: Node tests use foodsFake.ts instead.
import { supabase } from "./supabase";
import { tsQueryFor, type FoodRow, type FoodsSource } from "./foods";

/** PostgREST errors are plain objects; the lookup code expects Errors. */
function fail(error: { message: string }): never {
  throw new Error(error.message);
}

export const supabaseFoods: FoodsSource = {
  async byBarcode(barcodeKey) {
    const { data, error } = await supabase.from("foods").select("*").eq("barcode_key", barcodeKey).maybeSingle();
    if (error) fail(error);
    return (data as FoodRow | null) ?? null;
  },
  async search(text, limit) {
    const q = tsQueryFor(text);
    if (!q) return [];
    const { data, error } = await supabase.rpc("search_foods", { q, n: limit });
    if (error) fail(error);
    return (data ?? []) as FoodRow[];
  },
  async alternatives(category, myRank, excludeKey, limit) {
    const { data, error } = await supabase.rpc("alternatives_for", { cat: category, my_rank: myRank, exclude_key: excludeKey, n: limit });
    if (error) fail(error);
    return (data ?? []) as FoodRow[];
  },
};
