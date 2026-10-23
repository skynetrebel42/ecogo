// body.ts — read a request body only up to a limit (075 M1, audit S3): a body sent without Content-Length (streamed)
// stops being read once it passes `max`. No imports, so Deno and `node --test` both load it; deployed with each function.

/** The body's bytes, or null once it passes `max` bytes (the rest is never read). */
export async function readUpTo(req: Request, max: number): Promise<Uint8Array | null> {
  const parts: Uint8Array[] = [];
  let size = 0;
  const reader = req.body?.getReader();
  for (let r = await reader?.read(); r && !r.done; r = await reader!.read()) {
    if ((size += r.value.length) > max) { reader!.cancel().catch(() => {}); return null; }
    parts.push(r.value);
  }
  return new Uint8Array(await new Blob(parts).arrayBuffer());
}
