import { createClient } from "@supabase/supabase-js";
import { projectId, publicAnonKey } from "../../utils/supabase/info.tsx";

export const supabase = createClient(
  `https://${projectId}.supabase.co`,
  publicAnonKey
);

// Edge function base URL for CRUD operations
export const SERVER = `https://${projectId}.supabase.co/functions/v1/server/make-server-504b3bba`;
