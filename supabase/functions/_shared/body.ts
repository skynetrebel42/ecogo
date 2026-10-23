// body.ts — read a request body only up to a limit (075 M1, audit S3), with or without Content-Length (streamed).
// No imports, so Deno and `node --test` both load it; deployed with each function.

/** The body's bytes, or null when it passes `max` bytes. Past `max` the rest is read and dropped, never kept (only one
 *  chunk in memory): stopping mid-upload left Supabase's relay without a reply (planner, option A); Supabase's own
 *  request size cap ends a longer one. */
export async function readUpTo(req: Request, max: number): Promise<Uint8Array | null> {
  const parts: Uint8Array[] = [];
  let size = 0;
  const reader = req.body?.getReader();
  for (let r = await reader?.read(); r && !r.done; r = await reader!.read()) {
    if ((size += r.value.length) <= max) parts.push(r.value);
  }
  return size > max ? null : new Uint8Array(await new Blob(parts).arrayBuffer());
}
