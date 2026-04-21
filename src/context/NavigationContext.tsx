import { createContext, useContext, useState } from 'react';
import type { Screen, NavState } from '../types';

interface NavigationContextValue {
  navState: NavState;
  navigate: (screen: Screen, opts?: { propertyId?: string; investorId?: string; investorName?: string }) => void;
  goBack: () => void;
  resetTo: (screen: Screen) => void;
}

const NavigationContext = createContext<NavigationContextValue>({
  navState: { screen: 'login', selectedPropertyId: null, selectedInvestorId: null, direction: 'forward' },
  navigate: () => {},
  goBack: () => {},
  resetTo: () => {},
});

export function NavigationProvider({ children }: { children: React.ReactNode }) {
  const [stack, setStack] = useState<NavState[]>([
    { screen: 'login', selectedPropertyId: null, selectedInvestorId: null, direction: 'forward' },
  ]);

  const current = stack[stack.length - 1];

  const navigate = (screen: Screen, opts?: { propertyId?: string; investorId?: string; investorName?: string }) => {
    setStack(s => [...s, {
      screen,
      selectedPropertyId: opts?.propertyId ?? null,
      selectedInvestorId: opts?.investorId ?? null,
      investorName: opts?.investorName,
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
