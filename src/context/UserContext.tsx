import { createContext, useContext, useEffect, useState } from 'react';
import type { User } from '../data/user';
import { clearAllCached } from '../services/cache';

interface UserContextValue {
  currentUser: User | null;
  setCurrentUser: (user: User | null) => void;
}

const UserContext = createContext<UserContextValue>({
  currentUser: null,
  setCurrentUser: () => {},
});

/**
 * Stored under this key. Bumping the suffix invalidates everyone's session
 * (use it if the User shape changes incompatibly).
 */
const STORAGE_KEY = 'mg_current_user_v1';

function readStoredUser(): User | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    // Light shape check — just enough to avoid feeding garbage into the app.
    if (!parsed || typeof parsed !== 'object' || typeof parsed.email !== 'string') return null;
    return parsed as User;
  } catch {
    return null;
  }
}

export function UserProvider({ children }: { children: React.ReactNode }) {
  // Hydrate from localStorage so a browser refresh keeps the user logged in.
  const [currentUser, setCurrentUserState] = useState<User | null>(() => readStoredUser());

  // Mirror every change back to localStorage. setting null logs out cleanly
  // and also wipes the per-app data caches so a different user signing in
  // on the same device doesn't briefly see the previous user's data.
  const setCurrentUser = (user: User | null) => {
    setCurrentUserState(user);
    try {
      if (user) {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(user));
      } else {
        localStorage.removeItem(STORAGE_KEY);
        clearAllCached();
      }
    } catch { /* private mode etc — non-fatal */ }
  };

  // Cross-tab sync: if user logs out in another tab, this one notices too.
  useEffect(() => {
    function onStorage(e: StorageEvent) {
      if (e.key !== STORAGE_KEY) return;
      setCurrentUserState(e.newValue ? readStoredUser() : null);
    }
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  return (
    <UserContext.Provider value={{ currentUser, setCurrentUser }}>
      {children}
    </UserContext.Provider>
  );
}

export const useUser = () => useContext(UserContext);
