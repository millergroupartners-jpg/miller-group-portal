/**
 * Tiny localStorage cache with TTL — used for stale-while-revalidate
 * across Monday + CompanyCam data, so the user sees content instantly
 * while we refetch in the background.
 *
 * Versioned keys (`mg_cache_v1:<name>`) so we can invalidate everyone's
 * cache later by bumping the prefix if a payload shape changes.
 */

const PREFIX = 'mg_cache_v1:';

interface Envelope<T> {
  v: 1;
  /** epoch ms when this entry was written */
  at: number;
  /** payload */
  data: T;
}

export function getCached<T>(key: string, maxAgeMs: number): { data: T; isStale: boolean } | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(PREFIX + key);
    if (!raw) return null;
    const env = JSON.parse(raw) as Envelope<T>;
    if (!env || env.v !== 1 || typeof env.at !== 'number') return null;
    const age = Date.now() - env.at;
    return { data: env.data, isStale: age > maxAgeMs };
  } catch {
    return null;
  }
}

/** Same as getCached but returns the data even if it's stale (caller decides). */
export function getCachedAny<T>(key: string): { data: T; ageMs: number } | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(PREFIX + key);
    if (!raw) return null;
    const env = JSON.parse(raw) as Envelope<T>;
    if (!env || env.v !== 1 || typeof env.at !== 'number') return null;
    return { data: env.data, ageMs: Date.now() - env.at };
  } catch {
    return null;
  }
}

export function setCached<T>(key: string, data: T): void {
  if (typeof window === 'undefined') return;
  try {
    const env: Envelope<T> = { v: 1, at: Date.now(), data };
    localStorage.setItem(PREFIX + key, JSON.stringify(env));
  } catch { /* quota / private mode — non-fatal */ }
}

export function clearCached(key: string): void {
  if (typeof window === 'undefined') return;
  try { localStorage.removeItem(PREFIX + key); } catch { /* noop */ }
}

/** Wipe every cache entry the app has stored. Useful from a "refresh"
 *  action or when something looks corrupt. */
export function clearAllCached(): void {
  if (typeof window === 'undefined') return;
  try {
    for (let i = localStorage.length - 1; i >= 0; i--) {
      const k = localStorage.key(i);
      if (k && k.startsWith(PREFIX)) localStorage.removeItem(k);
    }
  } catch { /* noop */ }
}
