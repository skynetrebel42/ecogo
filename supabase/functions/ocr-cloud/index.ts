// ocr-cloud — opt-in cloud help for a label photo the phone found hard to read (070 C1). The checks live in cloud.ts.
// Secrets: OCRSPACE_API_KEY (set by the owner in Supabase); SUPABASE_PUBLISHABLE_KEYS is built in. Deployed with
// verify_jwt off: the platform's check can't read the app's sb_publishable_ key, so cloud.ts checks it.
import { ocrCloud } from "./cloud.ts";

const publicKeys = Object.values(JSON.parse(Deno.env.get("SUPABASE_PUBLISHABLE_KEYS") ?? "{}")) as string[];

Deno.serve(req => ocrCloud(req, { key: Deno.env.get("OCRSPACE_API_KEY") ?? "", publicKeys, fetch }));
