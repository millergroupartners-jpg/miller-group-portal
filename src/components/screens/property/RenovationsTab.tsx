/**
 * Renovations tab on PropertyDetailScreen.
 *
 * Two viewing modes controlled by `role`:
 *
 * ─── role='admin' ───
 *   Full breakdown: every subitem with paidTo / paidBy labels, receipts,
 *   contractor name, ourCost vs clientCost, renovation profit, and the
 *   remaining-to-us vs remaining-to-contractor balance.
 *
 * ─── role='investor' ───
 *   Sanitized view showing ONLY the investor's own transfers to
 *   "חברת השיפוצים שלנו". The server (api/renovations/list.ts) strips the
 *   real contractor name, our internal cost, and any transfers we made, then
 *   blanks the paidTo labels. This component further flattens the presentation
 *   so the investor sees a single counterparty — they must not know a separate
 *   contractor exists in the middle.
 */

import { useEffect, useState } from 'react';
import { listRenovations, calcBalance, paidToColor, paidByColor, type Renovation } from '../../../services/renovationsApi';

const GOLD = '#C9A84C';
const MONDAY_BOARD_URL = 'https://real-estate-usa-eden.monday.com/boards/2064106439';
/** Investor-facing label. Must stay neutral — the renovation company is ours
 *  but we don't want the investor to know that, and we also don't want them to
 *  realize there's a subcontractor in the middle. "קבלן" is the safe generic. */
const INVESTOR_COMPANY_LABEL = 'קבלן';

function fmtMoney(n: number): string {
  return '$' + n.toLocaleString('en-US');
}
function fmtDate(iso: string): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  return d.toLocaleDateString('he-IL', { day: '2-digit', month: 'short', year: '2-digit' });
}

interface Props {
  propertyId: string;
  role?: 'admin' | 'investor';
}

export function RenovationsTab({ propertyId, role = 'admin' }: Props) {
  const isAdmin = role === 'admin';
  const [items, setItems] = useState<Renovation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    listRenovations({ propertyId, role })
      .then(list => { if (!cancelled) { setItems(list); setError(null); } })
      .catch(err => { if (!cancelled) setError(err?.message || 'שגיאה בטעינה'); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [propertyId, role]);

  if (loading) {
    return <div style={{ padding: 24, textAlign: 'center', color: 'var(--text-secondary)', fontSize: 13 }}>טוען שיפוצים…</div>;
  }
  if (error) {
    return <div style={{ padding: 24, textAlign: 'center', color: '#ff4d4d', fontSize: 13 }}>שגיאה: {error}</div>;
  }
  if (items.length === 0) {
    return (
      <div style={{ padding: '24px 14px', textAlign: 'center', color: 'var(--text-secondary)' }}>
        <div style={{ fontSize: 36, marginBottom: 10 }}>🔨</div>
        <div style={{ fontSize: 13 }}>
          {isAdmin
            ? 'אין פרויקטי שיפוצים מקושרים לנכס זה ב-Monday'
            : 'אין נתוני שיפוצים זמינים לנכס זה'}
        </div>
      </div>
    );
  }

  // Aggregates
  const totalsAdmin = items.reduce(
    (acc, r) => {
      const b = calcBalance(r);
      return {
        paid:   acc.paid   + r.totalPaid,
        client: acc.client + r.clientCost,
        our:    acc.our    + r.ourCost,
        profit: acc.profit + (r.clientCost - r.ourCost),
        remaining:       acc.remaining       + b.remainingTotal,
        remainingToUs:   acc.remainingToUs   + b.remainingToUs,
        remainingToCont: acc.remainingToCont + b.remainingToContractor,
      };
    },
    { paid: 0, client: 0, our: 0, profit: 0, remaining: 0, remainingToUs: 0, remainingToCont: 0 }
  );

  // For investors, use the server-sanitized totals. Approved addons are
  // included server-side on each item — we display them as a small "+$X"
  // badge next to the base budget and remaining so the investor sees that
  // the total and what's left have grown due to approved extras.
  const totalsInvestor = items.reduce(
    (acc, r) => {
      const addons = r.approvedAddons || 0;
      return {
        paid:       acc.paid       + r.totalPaid,
        budget:     acc.budget     + r.clientCost,
        addons:     acc.addons     + addons,
        remaining:  acc.remaining  + Math.max(0, r.clientCost + addons - r.totalPaid),
      };
    },
    { paid: 0, budget: 0, addons: 0, remaining: 0 }
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {/* Summary card — different KPIs per role */}
      <div className="gold-card" style={{ padding: 14 }}>
        {isAdmin ? (
          <>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 10, marginBottom: 10 }}>
              {[
                { label: 'סה״כ שולם',     value: fmtMoney(totalsAdmin.paid),   c: '#4CAF50' },
                { label: 'רווח משיפוצים',  value: fmtMoney(totalsAdmin.profit), c: GOLD },
                { label: 'שיפוץ שלנו',    value: fmtMoney(totalsAdmin.our),    c: '#64B5F6' },
                { label: 'שיפוץ ללקוח',   value: fmtMoney(totalsAdmin.client), c: '#ff9800' },
              ].map(k => (
                <div key={k.label} style={{ background: 'var(--bg-chip)', borderRadius: 10, padding: '10px 14px' }}>
                  <div style={{ fontSize: 9, color: 'var(--text-secondary)', marginBottom: 4, letterSpacing: 0.5 }}>{k.label}</div>
                  <div style={{ fontSize: 16, fontWeight: 800, color: k.c }}>{k.value}</div>
                </div>
              ))}
            </div>
            <div style={{
              display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8,
              background: 'rgba(255,153,0,0.06)', border: '1px solid rgba(255,153,0,0.25)', borderRadius: 10, padding: 10,
            }}>
              {[
                { l: 'נותר לתשלום', v: fmtMoney(totalsAdmin.remaining),       c: '#ff9800' },
                { l: 'נותר לנו',    v: fmtMoney(totalsAdmin.remainingToUs),   c: GOLD },
                { l: 'נותר לקבלן',  v: fmtMoney(totalsAdmin.remainingToCont), c: '#225091' },
              ].map(k => (
                <div key={k.l} style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: 9, color: 'var(--text-secondary)', marginBottom: 2, letterSpacing: 0.5 }}>{k.l}</div>
                  <div style={{ fontSize: 14, fontWeight: 800, color: k.c }}>{k.v}</div>
                </div>
              ))}
            </div>
            <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 8, textAlign: 'right' }}>
              🔒 נתונים פנימיים — לא חשופים למשקיעים
            </div>
          </>
        ) : (
          /* Investor-safe KPIs — 3-column: budget, paid, remaining. No profit/our-cost.
             Addons shown as a small "+$X" badge next to budget & remaining. */
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10 }}>
            {[
              { label: 'תקציב שיפוץ', value: fmtMoney(totalsInvestor.budget),    c: '#ff9800', addon: totalsInvestor.addons > 0 },
              { label: 'העברת עד כה', value: fmtMoney(totalsInvestor.paid),      c: '#4CAF50', addon: false },
              { label: 'נותר להעברה', value: fmtMoney(totalsInvestor.remaining), c: GOLD,      addon: totalsInvestor.addons > 0 },
            ].map(k => (
              <div key={k.label} style={{ background: 'var(--bg-chip)', borderRadius: 10, padding: '12px 10px', textAlign: 'center' }}>
                <div style={{ fontSize: 9, color: 'var(--text-secondary)', marginBottom: 4, letterSpacing: 0.3 }}>{k.label}</div>
                <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'center', gap: 4, flexDirection: 'row-reverse' }}>
                  <div style={{ fontSize: 15, fontWeight: 800, color: k.c }}>{k.value}</div>
                  {k.addon && (
                    <span
                      title="תוספות מאושרות מעבר לתקציב המקורי"
                      style={{ fontSize: 10, fontWeight: 700, color: GOLD }}
                    >
                      +{fmtMoney(totalsInvestor.addons)}
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Per-project rows */}
      {items.map(r => {
        const isOpen = openId === r.id;
        const bal = isAdmin ? calcBalance(r) : null;
        const addons = r.approvedAddons || 0;
        const investorRemaining = !isAdmin ? Math.max(0, r.clientCost + addons - r.totalPaid) : 0;
        return (
          <div key={r.id} className="gold-card" style={{ padding: 0, overflow: 'hidden' }}>
            <button
              onClick={() => setOpenId(isOpen ? null : r.id)}
              style={{
                width: '100%', padding: '14px', background: 'transparent', border: 'none',
                display: 'flex', flexDirection: 'row-reverse', justifyContent: 'space-between',
                alignItems: 'center', cursor: 'pointer', textAlign: 'right', color: 'var(--text-primary)',
              }}
            >
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 4 }}>{r.name}</div>
                <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>
                  {isAdmin
                    ? [r.status, r.contractorName, r.investorName].filter(Boolean).join(' · ')
                    : INVESTOR_COMPANY_LABEL}
                </div>
              </div>
              <div style={{ textAlign: 'left', marginInlineStart: 10 }}>
                <div style={{ fontSize: 15, fontWeight: 800, color: '#4CAF50' }}>{fmtMoney(r.totalPaid)}</div>
                <div style={{ fontSize: 10, color: 'var(--text-secondary)' }}>
                  {isAdmin ? (
                    `${r.subitems.length} תשלומים · נותר ${fmtMoney(bal!.remainingTotal)}`
                  ) : (
                    <>
                      נותר להעברה · {fmtMoney(investorRemaining)}
                      {addons > 0 && (
                        <span style={{ color: GOLD, fontWeight: 700, marginInlineStart: 4 }}>
                          (+{fmtMoney(addons)})
                        </span>
                      )}
                    </>
                  )}
                </div>
              </div>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" strokeWidth="2"
                   style={{ transform: isOpen ? 'rotate(90deg)' : 'rotate(0)', transition: 'transform 0.2s', marginInlineStart: 6 }}>
                <path d="M9 18l6-6-6-6" />
              </svg>
            </button>

            {isOpen && (
              <div style={{ borderTop: '1px solid var(--border)', padding: '10px 14px 14px' }}>
                {isAdmin && bal && (
                  /* Admin balance breakdown */
                  <div style={{
                    display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 6, marginBottom: 10,
                    background: 'rgba(255,153,0,0.06)', border: '1px solid rgba(255,153,0,0.25)', borderRadius: 8, padding: 8,
                  }}>
                    {[
                      { l: 'נותר לתשלום', v: fmtMoney(bal.remainingTotal),        c: '#ff9800' },
                      { l: 'נותר לנו',    v: fmtMoney(bal.remainingToUs),         c: GOLD },
                      { l: 'נותר לקבלן',  v: fmtMoney(bal.remainingToContractor), c: '#225091' },
                    ].map(k => (
                      <div key={k.l} style={{ textAlign: 'center' }}>
                        <div style={{ fontSize: 9, color: 'var(--text-secondary)', marginBottom: 2 }}>{k.l}</div>
                        <div style={{ fontSize: 13, fontWeight: 800, color: k.c }}>{k.v}</div>
                      </div>
                    ))}
                  </div>
                )}

                {r.subitems.length === 0 ? (
                  <div style={{ fontSize: 12, color: 'var(--text-secondary)', padding: 10, textAlign: 'center' }}>
                    {isAdmin ? 'אין העברות רשומות עדיין' : 'טרם בוצעו העברות'}
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {r.subitems.map(sub => (
                      <div key={sub.id} style={{
                        display: 'flex', flexDirection: 'row-reverse', alignItems: 'center',
                        gap: 10, padding: '10px 12px', borderRadius: 10, background: 'var(--bg-chip)',
                      }}>
                        <div style={{ flex: 1, textAlign: 'right' }}>
                          <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 2 }}>
                            {sub.name || (isAdmin ? '—' : 'העברה לקבלן')}
                          </div>
                          <div style={{ fontSize: 10, color: 'var(--text-secondary)' }}>
                            {fmtDate(sub.date || sub.createdAt)}{sub.category ? ` · ${sub.category}` : ''}
                          </div>
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 4, alignItems: 'flex-end' }}>
                          <div style={{ fontSize: 14, fontWeight: 800, color: '#4CAF50' }}>{fmtMoney(sub.amount)}</div>
                          {isAdmin && (
                            <div style={{ display: 'flex', gap: 4 }}>
                              {sub.paidTo && (
                                <span style={{
                                  fontSize: 9, fontWeight: 700, padding: '2px 6px', borderRadius: 100,
                                  background: `${paidToColor(sub.paidTo)}22`, color: paidToColor(sub.paidTo),
                                }}>{sub.paidTo}</span>
                              )}
                              {sub.paidBy && (
                                <span style={{
                                  fontSize: 9, fontWeight: 700, padding: '2px 6px', borderRadius: 100,
                                  background: `${paidByColor(sub.paidBy)}22`, color: paidByColor(sub.paidBy),
                                }}>שילם: {sub.paidBy}</span>
                              )}
                            </div>
                          )}
                        </div>
                        {sub.receiptUrl && (
                          <a href={sub.receiptUrl} target="_blank" rel="noopener noreferrer" style={{
                            width: 32, height: 32, borderRadius: 8, background: `${GOLD}18`, border: `1px solid ${GOLD}55`,
                            display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, textDecoration: 'none',
                          }}>
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={GOLD} strokeWidth="2">
                              <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
                              <polyline points="14 2 14 8 20 8" />
                            </svg>
                          </a>
                        )}
                      </div>
                    ))}
                  </div>
                )}

                {isAdmin && (
                  <a href={`${MONDAY_BOARD_URL}/pulses/${r.id}`} target="_blank" rel="noopener noreferrer" style={{
                    display: 'block', marginTop: 10, padding: '8px 12px', borderRadius: 8, background: `${GOLD}14`,
                    color: GOLD, fontSize: 11, fontWeight: 700, textDecoration: 'none', textAlign: 'center',
                  }}>
                    פתח פרויקט ב-Monday ↗
                  </a>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
