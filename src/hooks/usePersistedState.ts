import { useState } from 'react';

/**
 * useState persisted to localStorage. Key convention: mg_ui_<screen>_<what>_v1.
 * Pass `validate` when the value comes from a fixed set (e.g. filter labels) so
 * a stale persisted value that no longer exists can't wedge the screen.
 */
export function usePersistedState<T>(
  key: string,
  initial: T,
  validate?: (v: unknown) => v is T,
): [T, (v: T) => void] {
  const [value, setValue] = useState<T>(() => {
    try {
      const raw = localStorage.getItem(key);
      if (raw === null) return initial;
      const parsed = JSON.parse(raw);
      if (validate ? validate(parsed) : parsed !== null && parsed !== undefined) {
        return parsed as T;
      }
    } catch { /* parse failure / private mode — fall through */ }
    return initial;
  });

  const set = (v: T) => {
    setValue(v);
    try {
      localStorage.setItem(key, JSON.stringify(v));
    } catch { /* private mode etc — non-fatal */ }
  };

  return [value, set];
}
