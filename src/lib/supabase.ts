import { createClient } from "@supabase/supabase-js";

// Public project URL + publishable key, from .env (safe to ship to browsers:
// access is controlled by the grants and RLS policies in supabase/migrations).
export const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY
);

/** USDA FoodData Central is reached through this Edge Function, which holds the API key (M7.5, supabase/functions/usda-relay). */
export const USDA_RELAY_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/usda-relay`;
