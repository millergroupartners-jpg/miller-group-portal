import { createContext, useContext, useEffect, useState, useCallback } from 'react';
import type { MondayBoardData, MondayInvestor, MondayProperty } from '../services/mondayApi';
import { fetchMondayData, fetchMillerGroupProperties } from '../services/mondayApi';

interface MondayDataContextValue {
  properties: MondayProperty[];
  /** Miller Group's own deals (group "עסקאות Miller Group") */
  mgProperties: MondayProperty[];
  investors: MondayInvestor[];
  loading: boolean;
  error: string | null;
  refresh: () => void;
  hasToken: boolean;
}

const MondayDataContext = createContext<MondayDataContextValue>({
  properties: [],
  mgProperties: [],
  investors: [],
  loading: false,
  error: null,
  refresh: () => {},
  hasToken: false,
});

export function MondayDataProvider({ children }: { children: React.ReactNode }) {
  const [data, setData] = useState<MondayBoardData>({ properties: [], investors: [] });
  const [mgProperties, setMgProperties] = useState<MondayProperty[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const hasToken = Boolean(import.meta.env.VITE_MONDAY_API_TOKEN);

  const load = useCallback(async () => {
    if (!hasToken) return;
    setLoading(true);
    setError(null);
    try {
      const [result, mg] = await Promise.all([
        fetchMondayData(),
        fetchMillerGroupProperties().catch(() => [] as MondayProperty[]),
      ]);
      setData(result);
      setMgProperties(mg);
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
        mgProperties,
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
