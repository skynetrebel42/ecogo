import { createClient } from "@supabase/supabase-js";

// Public project URL + publishable key, from .env (safe to ship to browsers:
// access is controlled by the grants and RLS policies in supabase/migrations).
export const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY
);
