/**
 * Renovation-loan tab on PropertyDetailScreen — shows THIS property's loan
 * (from the "הלוואות שיפוץ" Monday board): headline summary (total / drawn /
 * remaining / ready-to-draw / progress %) plus the per-category breakdown.
 *
 * There's nothing to sanitize per role — a renovation loan is the investor's own
 * loan on their own property — so investor and admin see the same figures. The
 * only role difference is an admin-only deep link to the Monday item.
 */

import { useEffect, useState } from 'react';
import { listLoans, getLoanForProperty, type LoanRecord } from '../../../services/loansApi';
import { LoanSummary, LoanCategoryBreakdown } from '../../common/LoanDetailCard';

const GOLD = 'var(--gold-text)';

interface Props {
  propertyId: string;
  propertyAddress?: string;
  role?: 'admin' | 'investor';
}

export function LoanTab({ propertyId, propertyAddress, role = 'investor' }: Props) {
  const isAdmin = role === 'admin';
  const [loan, setLoan] = useState<LoanRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    listLoans()
      .then(list => {
        if (cancelled) return;
        setLoan(getLoanForProperty(list, propertyId, propertyAddress));
        setError(null);
      })
      .catch(err => { if (!cancelled) setError(err?.message || 'שגיאה בטעינה'); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [propertyId, propertyAddress]);

  if (loading) {
    return <div style={{ padding: 24, textAlign: 'center', color: 'var(--text-secondary)', fontSize: 13 }}>טוען הלוואת שיפוץ…</div>;
  }
  if (error) {
    return <div style={{ padding: 24, textAlign: 'center', color: 'var(--danger)', fontSize: 13 }}>שגיאה: {error}</div>;
  }
  if (!loan) {
    return (
      <div style={{ padding: '24px 14px', textAlign: 'center', color: 'var(--text-secondary)' }}>
        <div style={{ fontSize: 36, marginBottom: 10 }}>🏦</div>
        <div style={{ fontSize: 13 }}>אין הלוואת שיפוץ מקושרת לנכס זה</div>
      </div>
    );
  }

  return (
    <div className="stagger" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <LoanSummary loan={loan} />
      <div className="gold-card" style={{ padding: 14 }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-secondary)', marginBottom: 10, textAlign: 'right' }}>
          פירוט לפי קטגוריה
        </div>
        <LoanCategoryBreakdown loan={loan} />
      </div>
      {isAdmin && (
        <a href={loan.mondayUrl} target="_blank" rel="noopener noreferrer" style={{
          display: 'block', padding: '8px 12px', borderRadius: 8, background: 'var(--gold-dim)',
          color: GOLD, fontSize: 11, fontWeight: 700, textDecoration: 'none', textAlign: 'center',
        }}>
          פתח הלוואה ב-Monday ↗
        </a>
      )}
    </div>
  );
}
