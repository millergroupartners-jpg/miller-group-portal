import { useUser } from '../context/UserContext';
import { useMondayData } from '../context/MondayDataContext';
import { isOpenDeal } from '../services/mondayApi';
import { getSeenDealIds } from '../services/lastVisit';
import { userStorageKey } from '../services/userStorage';

/**
 * True when the deal room holds an open deal this investor hasn't seen yet —
 * drives the gold dot on the deal-room nav tab. Always false for admins and
 * while Monday data is still cold-loading. Re-reads localStorage on every
 * render, so visiting the deal room (which marks deals seen) clears the dot
 * on the next navigation without any event plumbing.
 */
export function useNewDeals(): boolean {
  const { currentUser } = useUser();
  const { properties, loading } = useMondayData();

  if (!currentUser || currentUser.isAdmin) return false;
  if (loading && properties.length === 0) return false;

  const openDeals = properties.filter(isOpenDeal);
  if (openDeals.length === 0) return false;

  const seen = getSeenDealIds(userStorageKey(currentUser));
  return openDeals.some(d => !seen.has(d.mondayId));
}
