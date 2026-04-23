/**
 * Small hook that polls /api/inquiries/list and returns the count of
 * inquiries with status !== 'Resolved'.
 *
 * For an investor, only their own inquiries are counted.
 * For an admin, all inquiries are counted.
 */

import { useState, useEffect, useRef } from 'react';
import { listInquiries } from '../services/inquiriesApi';
import { useUser } from '../context/UserContext';

const POLL_INTERVAL_MS = 60_000; // 1 minute

export function useOpenInquiryCount(): number {
  const { currentUser } = useUser();
  const [count, setCount] = useState(0);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    if (!currentUser) return;

    let timer: number | undefined;

    const fetchCount = async () => {
      try {
        const list = await listInquiries(currentUser.isAdmin ? undefined : currentUser.mondayInvestorId);
        const n = list.filter(i => i.status !== 'Resolved').length;
        if (mountedRef.current) setCount(n);
      } catch {
        // Silent fail — keep previous count
      }
    };

    fetchCount();
    timer = window.setInterval(fetchCount, POLL_INTERVAL_MS);

    return () => {
      mountedRef.current = false;
      if (timer) window.clearInterval(timer);
    };
  }, [currentUser?.id, currentUser?.isAdmin, currentUser?.mondayInvestorId]);

  return count;
}
