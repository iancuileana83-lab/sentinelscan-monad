// Best-effort, in-memory sliding-window limiter. Serverless instances do not share
// memory, so this only slows down a single noisy client on one instance; it is a
// courtesy limit, not a security boundary. (The AI analyst adds stricter, shared limits.)
const hits = new Map<string, number[]>();

export function allow(key: string, max: number, windowMs: number, now = Date.now()): boolean {
  const recent = (hits.get(key) ?? []).filter((t) => now - t < windowMs);
  if (recent.length >= max) {
    hits.set(key, recent);
    return false;
  }
  recent.push(now);
  hits.set(key, recent);
  if (hits.size > 5000) for (const k of hits.keys()) if (!(hits.get(k) ?? []).some((t) => now - t < windowMs)) hits.delete(k);
  return true;
}
