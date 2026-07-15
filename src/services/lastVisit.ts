import { readJson, writeJson } from './userStorage';

/**
 * "New since last visit" bookkeeping — a per-user visit timestamp for the
 * dashboard banner, and a seen-set of deal ids for the deal-room nav dot.
 */
const LAST_VISIT_PREFIX = 'mg_last_visit_v1:';
const SEEN_DEALS_PREFIX = 'mg_seen_deals_v1:';

/**
 * Returns the previous visit's ISO timestamp (null on the first ever visit)
 * and stamps "now". The previous value is memoized per user at module scope,
 * so StrictMode's double effect run and repeated dashboard visits within one
 * SPA session all see the same "previous" instead of the stamp they just wrote.
 */
const sessionPrev = new Map<string, string | null>();

export function getAndStampLastVisit(userKey: string): string | null {
  if (sessionPrev.has(userKey)) return sessionPrev.get(userKey)!;
  let prev: string | null = null;
  try {
    prev = localStorage.getItem(LAST_VISIT_PREFIX + userKey);
    localStorage.setItem(LAST_VISIT_PREFIX + userKey, new Date().toISOString());
  } catch { /* private mode — non-fatal */ }
  sessionPrev.set(userKey, prev);
  return prev;
}

export function getSeenDealIds(userKey: string): Set<string> {
  return new Set(readJson<string[]>(SEEN_DEALS_PREFIX + userKey) ?? []);
}

export function markDealsSeen(userKey: string, ids: string[]): void {
  const seen = getSeenDealIds(userKey);
  ids.forEach(id => seen.add(id));
  writeJson(SEEN_DEALS_PREFIX + userKey, Array.from(seen));
}
