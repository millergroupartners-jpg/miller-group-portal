import type { User } from '../data/user';

/**
 * Per-user localStorage helpers. Same key rule as the onboarding tour:
 * Monday id for real investors, local id ('u1') for the demo account.
 */
export function userStorageKey(user: User): string {
  return user.mondayInvestorId ?? user.id;
}

export function readJson<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

export function writeJson(key: string, value: unknown): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch { /* private mode etc — non-fatal */ }
}
