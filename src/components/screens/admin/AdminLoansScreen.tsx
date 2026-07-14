/**
 * AdminLoansScreen — overview of every renovation loan across all properties,
 * pulled from the "הלוואות שיפוץ" Monday board. Each loan is resolved to its
 * property's investor via the Monday data context (board relation, then address
 * fallback for items not yet linked on Monday).
 *
 * ADMIN view: KPI totals, search by address/investor, and expandable rows that
 * reveal the full per-category draw breakdown.
 */

import { useEffect, useMemo, useState } from 'react';
import { listLoans, loanMatchesProperty, type LoanRecord } from '../../../services/loansApi';
import { LoanSummary, LoanCategoryBreakdown, fmtMoney } from '../../common/LoanDetailCard';
import { MGLogo } from '../../common/MGLogo';
import { useMondayData } from '../../../context/MondayDataContext';

const GOLD = 'var(--gold-text)';

interface LoanRow extends LoanRecord {
  investorName: string;
  city: string;
}

/**
 * @param embedded  When true, render only the inner content (KPIs, search,
 *   rows) with no outer flex/scroll container or page headers — used when this
 *   screen is hosted inside AdminRenovationsScreen's "הלוואות שיפוץ" toggle.
 */
export function AdminLoansScreen({ embedded = false }: { embedded?: boolean } = {}) {
  const { properties, mgProperties } = useMondayData();
  const [items, setItems] = useState<LoanRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [openId, setOpenId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    listLoans()
      .then(list => { if (!cancelled) { setItems(list); setError(null); } })
      .catch(err => { if (!cancelled) setError(err?.message || 'שגיאה בטעינה'); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  // Resolve each loan → its property's investor (board relation first, then a
  // normalized-address fallback for the items not yet linked on Monday).
  const rows: LoanRow[] = useMemo(() => {
    const allProps = [...properties, ...mgProperties];
    return items.map(loan => {
      const prop = allProps.find(p => loanMatchesProperty(loan, p.mondayId, `${p.address} ${p.city}`));
      return { ...loan, investorName: prop?.investorName || '', city: prop?.city || '' };
    });
  }, [items, properties, mgProperties]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter(r => [r.name, r.investorName, r.city].some(v => (v || '').toLowerCase().includes(q)));
  }, [rows, search]);

  const totals = useMemo(() => filtered.reduce(
    (a, r) => ({
      total:     a.total     + r.total,
      drawn:     a.drawn     + r.drawn,
      remaining: a.remaining + r.remaining,
      ready:     a.ready     + r.readyToDraw,
    }),
    { total: 0, drawn: 0, remaining: 0, ready: 0 }
  ), [filtered]);

  const body = (
    <>
      {/* KPI totals */}
        <div className="gold-card" style={{ padding: 14 }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: 10 }}>
            {[
              { label: 'סה״כ הלוואות', value: fmtMoney(totals.total),     c: 'var(--text-primary)' },
              { label: 'כבר נמשך',     value: fmtMoney(totals.drawn),     c: 'var(--success)' },
              { label: 'נשאר בהלוואה', value: fmtMoney(totals.remaining), c: GOLD },
              { label: 'מוכן למשיכה',  value: fmtMoney(totals.ready),     c: 'var(--info)' },
            ].map(k => (
              <div key={k.label} className="stat-chip" style={{ textAlign: 'center' }}>
                <div className="stat-label" style={{ letterSpacing: 0.5 }}>{k.label}</div>
                <div className="stat-value num" style={{ fontSize: 16, fontWeight: 800, color: k.c }}>{k.value}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Search */}
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="חיפוש לפי כתובת / משקיע…"
          className="mg-input"
          style={{ textAlign: 'right' }}
        />

        {loading && <div style={{ padding: 24, textAlign: 'center', color: 'var(--text-secondary)', fontSize: 13 }}>טוען…</div>}
        {error && <div style={{ padding: 24, textAlign: 'center', color: 'var(--danger)', fontSize: 13 }}>שגיאה: {error}</div>}
        {!loading && !error && filtered.length === 0 && (
          <div style={{ padding: 24, textAlign: 'center', color: 'var(--text-secondary)', fontSize: 13 }}>לא נמצאו הלוואות</div>
        )}

        {/* Rows */}
        {filtered.map(r => {
          const isOpen = openId === r.id;
          return (
            <div key={r.id} className="gold-card" style={{ padding: 0, overflow: 'hidden' }}>
              <button
                onClick={() => setOpenId(isOpen ? null : r.id)}
                style={{
                  width: '100%', padding: 14, background: 'transparent', border: 'none',
                  display: 'flex', flexDirection: 'row-reverse', justifyContent: 'space-between',
                  alignItems: 'center', cursor: 'pointer', textAlign: 'right', color: 'var(--text-primary)',
                }}
              >
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 4 }}>{r.name}</div>
                  <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>
                    {[r.investorName, `${r.progressPct}% התקדמות`].filter(Boolean).join(' · ')}
                    {r.linkedPropertyIds.length === 0 && (
                      <span style={{ color: '#ff9800', marginInlineStart: 6 }}>· לא מקושר לנכס</span>
                    )}
                  </div>
                </div>
                <div style={{ textAlign: 'left', marginInlineStart: 10 }}>
                  <div className="num" style={{ fontSize: 15, fontWeight: 800, color: 'var(--success)' }}>{fmtMoney(r.drawn)}</div>
                  <div style={{ fontSize: 10, color: 'var(--text-secondary)' }}>
                    מתוך {fmtMoney(r.total)} · נשאר {fmtMoney(r.remaining)}
                  </div>
                </div>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" strokeWidth="2"
                     style={{ transform: isOpen ? 'rotate(90deg)' : 'rotate(0)', transition: 'transform 0.2s', marginInlineStart: 6 }}>
                  <path d="M9 18l6-6-6-6" />
                </svg>
              </button>

              {isOpen && (
                <div style={{ borderTop: '1px solid var(--border)', padding: '12px 14px 14px', display: 'flex', flexDirection: 'column', gap: 12 }}>
                  <LoanSummary loan={r} />
                  <LoanCategoryBreakdown loan={r} />
                  <a href={r.mondayUrl} target="_blank" rel="noopener noreferrer" style={{
                    display: 'block', padding: '8px 12px', borderRadius: 8, background: 'var(--gold-dim)',
                    color: GOLD, fontSize: 11, fontWeight: 700, textDecoration: 'none', textAlign: 'center',
                  }}>
                    פתח הלוואה ב-Monday ↗
                  </a>
                </div>
              )}
            </div>
          );
        })}
    </>
  );

  // Embedded inside AdminRenovationsScreen's toggle — flow within the host's
  // scroll body, no extra headers or scroll container.
  if (embedded) return body;

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: 'var(--bg-base)', overflow: 'hidden' }}>
      <div className="desktop-page-title">
        <div className="subtitle">{items.length} הלוואות · ADMIN VIEW</div>
        <h1>הלוואות שיפוץ</h1>
      </div>

      <div className="screen-header" style={{ padding: '16px 20px 10px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
        <MGLogo size={36} showWordmark={false} />
        <span style={{ fontSize: 20, fontWeight: 700, color: 'var(--text-primary)' }}>הלוואות שיפוץ</span>
      </div>

      <div className="stagger" style={{ flex: 1, overflowY: 'auto', padding: '8px 20px 20px', display: 'flex', flexDirection: 'column', gap: 14 }}>
        {body}
      </div>
    </div>
  );
}
