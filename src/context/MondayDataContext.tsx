import { createContext, useContext, useEffect, useState, useCallback } from 'react';
import type { MondayBoardData, MondayInvestor, MondayProperty } from '../services/mondayApi';
import { fetchMondayData } from '../services/mondayApi';

interface MondayDataContextValue {
  properties: MondayProperty[];
  investors: MondayInvestor[];
  loading: boolean;
  error: string | null;
  refresh: () => void;
  hasToken: boolean;
}

const MondayDataContext = createContext<MondayDataContextValue>({
  properties: [],
  investors: [],
  loading: false,
  error: null,
  refresh: () => {},
  hasToken: false,
});

export function MondayDataProvider({ children }: { children: React.ReactNode }) {
  const [data, setData] = useState<MondayBoardData>({ properties: [], investors: [] });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const hasToken = Boolean(import.meta.env.VITE_MONDAY_API_TOKEN);

  const load = useCallback(async () => {
    if (!hasToken) return;
    setLoading(true);
    setError(null);
    try {
      const result = await fetchMondayData();
      setData(result);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'שגיאה בטעינת נתוני Monday');
    } finally {
      setLoading(false);
    }
  }, [hasToken]);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <MondayDataContext.Provider
      value={{
        properties: data.properties,
        investors: data.investors,
        loading,
        error,
        refresh: load,
        hasToken,
      }}
    >
      {children}
    </MondayDataContext.Provider>
  );
}

export const useMondayData = () => useContext(MondayDataContext);
