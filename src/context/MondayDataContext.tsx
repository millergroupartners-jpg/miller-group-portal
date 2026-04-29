import { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react';
import type { MondayBoardData, MondayInvestor, MondayProperty } from '../services/mondayApi';
import { fetchMondayData, fetchMillerGroupProperties } from '../services/mondayApi';
import { getCachedAny, setCached } from '../services/cache';

interface MondayDataContextValue {
  properties: MondayProperty[];
  /** Miller Group's own deals (group "עסקאות Miller Group") */
  mgProperties: MondayProperty[];
  investors: MondayInvestor[];
  /** True ONLY when there's no cached data yet (first ever load). */
  loading: boolean;
  /** True while a background refresh is in flight after a cache hit. UI can
   *  show a subtle spinner, but content remains visible. */
  refreshing: boolean;
  /** When the visible data was last successfully fetched (epoch ms). */
  lastFetchedAt: number | null;
  error: string | null;
  refresh: () => void;
  hasToken: boolean;
}

const MondayDataContext = createContext<MondayDataContextValue>({
  properties: [],
  mgProperties: [],
  investors: [],
  loading: false,
  refreshing: false,
  lastFetchedAt: null,
  error: null,
  refresh: () => {},
  hasToken: false,
});

const CACHE_KEY_MAIN = 'monday_main';   // properties + investors
const CACHE_KEY_MG   = 'monday_mg';     // mg properties

interface CachedShape {
  properties: MondayProperty[];
  investors: MondayInvestor[];
}

export function MondayDataProvider({ children }: { children: React.ReactNode }) {
  // Hydrate immediately from localStorage so the first paint shows real
  // content instead of an empty spinner. We always refetch in the background.
  const cachedMain = getCachedAny<CachedShape>(CACHE_KEY_MAIN);
  const cachedMg   = getCachedAny<MondayProperty[]>(CACHE_KEY_MG);

  const [data, setData] = useState<MondayBoardData>(
    cachedMain ? cachedMain.data : { properties: [], investors: [] }
  );
  const [mgProperties, setMgProperties] = useState<MondayProperty[]>(
    cachedMg ? cachedMg.data : []
  );
  const [loading, setLoading] = useState<boolean>(!cachedMain); // only true on a cold start
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [lastFetchedAt, setLastFetchedAt] = useState<number | null>(
    cachedMain ? Date.now() - cachedMain.ageMs : null
  );
  const [error, setError] = useState<string | null>(null);
  const inFlight = useRef(false);

  const hasToken = Boolean(import.meta.env.VITE_MONDAY_API_TOKEN);

  const load = useCallback(async () => {
    if (!hasToken || inFlight.current) return;
    inFlight.current = true;
    // Cold load → loading spinner. Warm refresh → just a "refreshing" pulse.
    if (!cachedMain) setLoading(true);
    else setRefreshing(true);
    setError(null);
    try {
      const [result, mg] = await Promise.all([
        fetchMondayData(),
        fetchMillerGroupProperties().catch(() => [] as MondayProperty[]),
      ]);
      setData(result);
      setMgProperties(mg);
      setLastFetchedAt(Date.now());
      setCached<CachedShape>(CACHE_KEY_MAIN, { properties: result.properties, investors: result.investors });
      setCached<MondayProperty[]>(CACHE_KEY_MG, mg);
    } catch (e) {
      // Don't blow away stale-but-usable data on a transient error.
      setError(e instanceof Error ? e.message : 'שגיאה בטעינת נתוני Monday');
    } finally {
      setLoading(false);
      setRefreshing(false);
      inFlight.current = false;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
        refreshing,
        lastFetchedAt,
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
