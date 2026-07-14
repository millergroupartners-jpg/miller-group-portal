/**
 * Stale-while-revalidate loader for renovation projects — same pattern as
 * MondayDataContext: hydrate instantly from localStorage so a revisit paints
 * real content with no spinner, then refetch in the background and update.
 *
 * Also exposes `loadReceipts(itemId)` for lazy receipt-URL hydration: the
 * list endpoint intentionally returns receiptUrl/receiptThumb empty (signed
 * asset URLs are the slowest part of the Monday query), so screens call this
 * when a renovation card is expanded.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { listRenovations, fetchRenovationReceipts, type Renovation } from '../services/renovationsApi';
import { getCachedAny, setCached } from '../services/cache';

interface Options {
  propertyId?: string;
  investorId?: string;
  role?: 'admin' | 'investor';
  /** Skip fetching entirely (e.g. investor id not resolved yet). */
  enabled?: boolean;
}

export function useRenovations(opts: Options = {}) {
  const { propertyId = '', investorId = '', role = 'admin', enabled = true } = opts;
  const cacheKey = `renovations:${role}:${propertyId}:${investorId}`;

  const [items, setItems] = useState<Renovation[]>(() =>
    enabled ? (getCachedAny<Renovation[]>(cacheKey)?.data ?? []) : []
  );
  // Cold start (no cache) → full loading state. Warm → background refresh only.
  const [loading, setLoading] = useState<boolean>(enabled && items.length === 0);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const receiptsLoaded = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (!enabled) { setLoading(false); return; }
    let cancelled = false;
    const cached = getCachedAny<Renovation[]>(cacheKey);
    if (cached) {
      setItems(cached.data);
      setLoading(false);
      setRefreshing(true);
    } else {
      setItems([]);
      setLoading(true);
    }
    receiptsLoaded.current = new Set();
    listRenovations({
      propertyId: propertyId || undefined,
      investorId: investorId || undefined,
      role,
    })
      .then(list => {
        if (cancelled) return;
        setItems(list);
        setError(null);
        setCached(cacheKey, list);
        // The fresh list arrives with empty receipt URLs — forget what was
        // hydrated so the screen's expand-effect re-requests for open cards.
        receiptsLoaded.current = new Set();
      })
      .catch(err => {
        // Keep stale-but-usable cached data on a transient error.
        if (!cancelled) setError(err?.message || 'שגיאה בטעינה');
      })
      .finally(() => {
        if (!cancelled) { setLoading(false); setRefreshing(false); }
      });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cacheKey, enabled]);

  /** Hydrate receipt URLs for one renovation's subitems (idempotent per item). */
  const loadReceipts = useCallback((itemId: string) => {
    if (!itemId || receiptsLoaded.current.has(itemId)) return;
    receiptsLoaded.current.add(itemId);
    fetchRenovationReceipts(itemId, role)
      .then(receipts => {
        if (Object.keys(receipts).length === 0) return;
        setItems(prev => prev.map(r => r.id !== itemId ? r : {
          ...r,
          subitems: r.subitems.map(s => receipts[s.id]
            ? { ...s, receiptUrl: receipts[s.id].url, receiptThumb: receipts[s.id].thumb }
            : s),
        }));
      })
      .catch(() => { receiptsLoaded.current.delete(itemId); });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [role]);

  return { items, loading, refreshing, error, loadReceipts };
}
