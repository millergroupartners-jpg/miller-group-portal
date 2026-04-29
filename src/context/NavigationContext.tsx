import { createContext, useContext, useEffect, useState } from 'react';
import type { Screen, NavState } from '../types';

interface NavigationContextValue {
  navState: NavState;
  navigate: (screen: Screen, opts?: { propertyId?: string; investorId?: string; investorName?: string; highlightClosingMode?: 'week' | 'overdue'; highlightInvestorMode?: 'no-password'; highlightPropertyMode?: 'no-manager' }) => void;
  goBack: () => void;
  resetTo: (screen: Screen) => void;
}

const NavigationContext = createContext<NavigationContextValue>({
  navState: { screen: 'login', selectedPropertyId: null, selectedInvestorId: null, direction: 'forward' },
  navigate: () => {},
  goBack: () => {},
  resetTo: () => {},
});

const NAV_STORAGE_KEY = 'mg_nav_state_v1';
const USER_STORAGE_KEY = 'mg_current_user_v1'; // mirror of UserContext

const LOGIN_STATE: NavState = { screen: 'login', selectedPropertyId: null, selectedInvestorId: null, direction: 'forward' };

function readStoredNav(): NavState | null {
  if (typeof window === 'undefined') return null;
  // Don't restore if there's no stored user — refresh on the login screen
  // should stay on login, not jump to wherever the previous person was.
  try {
    if (!localStorage.getItem(USER_STORAGE_KEY)) return null;
    const raw = localStorage.getItem(NAV_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed.screen !== 'string') return null;
    // 'login' / 'set-password' are transient — never restore them.
    if (parsed.screen === 'login' || parsed.screen === 'set-password') return null;
    return { ...parsed, direction: 'forward' } as NavState;
  } catch {
    return null;
  }
}

export function NavigationProvider({ children }: { children: React.ReactNode }) {
  const [stack, setStack] = useState<NavState[]>(() => {
    const restored = readStoredNav();
    return restored ? [restored] : [LOGIN_STATE];
  });

  const current = stack[stack.length - 1];

  // Persist the current screen so a browser refresh keeps the user where
  // they were. Login + set-password are intentionally NOT persisted.
  useEffect(() => {
    try {
      if (!current || current.screen === 'login' || current.screen === 'set-password') {
        localStorage.removeItem(NAV_STORAGE_KEY);
      } else {
        localStorage.setItem(NAV_STORAGE_KEY, JSON.stringify(current));
      }
    } catch { /* private mode etc — non-fatal */ }
  }, [current]);

  const navigate = (screen: Screen, opts?: { propertyId?: string; investorId?: string; investorName?: string; highlightClosingMode?: 'week' | 'overdue'; highlightInvestorMode?: 'no-password'; highlightPropertyMode?: 'no-manager' }) => {
    setStack(s => [...s, {
      screen,
      selectedPropertyId: opts?.propertyId ?? null,
      selectedInvestorId: opts?.investorId ?? null,
      investorName: opts?.investorName,
      highlightClosingMode: opts?.highlightClosingMode,
      highlightInvestorMode: opts?.highlightInvestorMode,
      highlightPropertyMode: opts?.highlightPropertyMode,
      direction: 'forward',
    }]);
  };

  const goBack = () => {
    setStack(s => (s.length > 1 ? s.slice(0, -1) : s));
  };

  const resetTo = (screen: Screen) => {
    setStack([{ screen, selectedPropertyId: null, selectedInvestorId: null, direction: 'forward' }]);
  };

  return (
    <NavigationContext.Provider value={{ navState: current, navigate, goBack, resetTo }}>
      {children}
    </NavigationContext.Provider>
  );
}

export const useNavigation = () => useContext(NavigationContext);
