import { createContext, useContext, useEffect, useState } from 'react';
import type { User } from '../data/user';
import { mondayInvestorToUser, type InvestorIdentity } from '../utils/investorUser';
import { clearAllCached } from '../services/cache';

interface UserContextValue {
  /** The effective user: the impersonated investor while "view as investor" is active, otherwise the logged-in user. */
  currentUser: User | null;
  /** The actually logged-in user, regardless of impersonation. */
  realUser: User | null;
  impersonating: boolean;
  /** Admin-only: view the portal as this investor. No-op for non-admins. */
  viewAsInvestor: (inv: InvestorIdentity) => void;
  stopImpersonation: () => void;
  setCurrentUser: (user: User | null) => void;
}

const UserContext = createContext<UserContextValue>({
  currentUser: null,
  realUser: null,
  impersonating: false,
  viewAsInvestor: () => {},
  stopImpersonation: () => {},
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
  const [realUser, setRealUserState] = useState<User | null>(() => readStoredUser());
  // Impersonation is deliberately in-memory only: a refresh silently returns
  // the admin to their own session, and localStorage keeps a single schema.
  const [impersonatedUser, setImpersonatedUser] = useState<User | null>(null);

  // Mirror every change back to localStorage. setting null logs out cleanly
  // and also wipes the per-app data caches so a different user signing in
  // on the same device doesn't briefly see the previous user's data.
  const setCurrentUser = (user: User | null) => {
    setRealUserState(user);
    setImpersonatedUser(null);
    try {
      if (user) {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(user));
      } else {
        localStorage.removeItem(STORAGE_KEY);
        clearAllCached();
      }
    } catch { /* private mode etc — non-fatal */ }
  };

  const viewAsInvestor = (inv: InvestorIdentity) => {
    if (!realUser?.isAdmin) return;
    setImpersonatedUser(mondayInvestorToUser(inv));
  };

  const stopImpersonation = () => setImpersonatedUser(null);

  // Cross-tab sync: if user logs out in another tab, this one notices too.
  useEffect(() => {
    function onStorage(e: StorageEvent) {
      if (e.key !== STORAGE_KEY) return;
      setRealUserState(e.newValue ? readStoredUser() : null);
      if (!e.newValue) setImpersonatedUser(null);
    }
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  return (
    <UserContext.Provider value={{
      currentUser: impersonatedUser ?? realUser,
      realUser,
      impersonating: impersonatedUser !== null,
      viewAsInvestor,
      stopImpersonation,
      setCurrentUser,
    }}>
      {children}
    </UserContext.Provider>
  );
}

export const useUser = () => useContext(UserContext);
