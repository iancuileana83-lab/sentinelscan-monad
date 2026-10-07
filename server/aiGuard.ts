// Limits for the AI endpoints. Everything here lives in server memory, so it is best effort:
// Vercel runs several instances that do not share it. The real hard cap is the AI key itself,
// which is a free-tier key without billing. A kill switch (AI_DISABLED=1) turns the AI off at once.
import { allow } from './limit.ts';

export const LIMITS = {
  perVisitorPerHour: 6,
  perVisitorPerDay: 15,
  globalPerDay: 120,
};

let day = '';
let used = 0;

function today(now: number) {
  return new Date(now).toISOString().slice(0, 10);
}

export type Verdict = { ok: true } | { ok: false; status: number; error: string };

/** Counts one AI run for this visitor and for everybody; refuses when a limit is reached. */
export function admit(visitor: string, now = Date.now(), globalCap = LIMITS.globalPerDay): Verdict {
  if (day !== today(now)) {
    day = today(now);
    used = 0;
  }
  if (used >= globalCap) return { ok: false, status: 429, error: 'The daily AI limit for this demo has been reached. It resets at midnight UTC. Everything else on the site still works.' };
  if (!allow(`ai-hour:${visitor}`, LIMITS.perVisitorPerHour, 3_600_000, now)) {
    return { ok: false, status: 429, error: `You have used your ${LIMITS.perVisitorPerHour} AI runs for this hour. Please try again later.` };
  }
  if (!allow(`ai-day:${visitor}`, LIMITS.perVisitorPerDay, 86_400_000, now)) {
    return { ok: false, status: 429, error: `You have used your ${LIMITS.perVisitorPerDay} AI runs for today.` };
  }
  used += 1;
  return { ok: true };
}

export function remainingToday(now = Date.now(), globalCap = LIMITS.globalPerDay): number {
  return day === today(now) ? Math.max(0, globalCap - used) : globalCap;
}

/** Test helper. */
export function resetAiGuard() {
  day = '';
  used = 0;
}

// Same address, same answer for ten minutes: saves quota and makes repeated clicks instant.
const cache = new Map<string, { at: number; value: unknown }>();
const TTL_MS = 10 * 60_000;

export function cached<T>(key: string, now = Date.now()): T | undefined {
  const hit = cache.get(key);
  return hit && now - hit.at < TTL_MS ? (hit.value as T) : undefined;
}

export function remember(key: string, value: unknown, now = Date.now()) {
  cache.set(key, { at: now, value });
  if (cache.size > 200) cache.delete(cache.keys().next().value as string);
}
