/**
 * Renovations tab on PropertyDetailScreen — ADMIN ONLY.
 *
 * Shows renovation projects linked to this property with their subitem payments
 * (amounts, who paid, who was paid, receipts). This data must NOT be rendered
 * for investor users because it reveals internal contractor payments and the
 * delta between "שיפוץ שלנו" (our cost) and "שיפוץ ללקוח" (client-facing cost).
 */

import { useEffect, useState } from 'react';
import { listRenovations, paidToColor, paidByColor, type Renovation } from '../../../services/renovationsApi';

const GOLD = '#C9A84C';
const MONDAY_BOARD_URL = 'https://real-estate-usa-eden.monday.com/boards/2064106439';

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
  propertyId: string;   // Monday item id of the property
}

export function RenovationsTab({ propertyId }: Props) {
  const [items, setItems] = useState<Renovation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    listRenovations({ propertyId })
      .then(list => { if (!cancelled) { setItems(list); setError(null); } })
      .catch(err => { if (!cancelled) setError(err?.message || 'שגיאה בטעינה'); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [propertyId]);

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
        <div style={{ fontSize: 13 }}>אין פרויקטי שיפוצים מקושרים לנכס זה ב-Monday</div>
      </div>
    );
  }

  // Aggregates across all renovation items for this property
  const totals = items.reduce(
    (acc, r) => ({
      paid:   acc.paid   + r.totalPaid,
      addons: acc.addons + r.approvedAddons,
      our:    acc.our    + r.ourCost,
      client: acc.client + r.clientCost,
    }),
    { paid: 0, addons: 0, our: 0, client: 0 }
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {/* Summary card (admin KPIs) */}
      <div className="gold-card" style={{ padding: 14 }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 10 }}>
          {[
            { label: 'סה״כ שולם',   value: fmtMoney(totals.paid),   c: '#4CAF50' },
            { label: 'Addons מאושרים', value: fmtMoney(totals.addons), c: GOLD },
            { label: 'שיפוץ שלנו',   value: fmtMoney(totals.our),    c: '#64B5F6' },
            { label: 'שיפוץ ללקוח',  value: fmtMoney(totals.client), c: '#ff9800' },
          ].map(k => (
            <div key={k.label} style={{ background: 'var(--bg-chip)', borderRadius: 10, padding: '10px 14px' }}>
              <div style={{ fontSize: 9, color: 'var(--text-secondary)', marginBottom: 4, letterSpacing: 0.5 }}>{k.label}</div>
              <div style={{ fontSize: 16, fontWeight: 800, color: k.c }}>{k.value}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Renovation project rows */}
      {items.map(r => {
        const isOpen = openId === r.id;
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
                  {[r.groupTitle, r.contractorName, r.investorName].filter(Boolean).join(' · ')}
                </div>
              </div>
              <div style={{ textAlign: 'left', marginInlineStart: 10 }}>
                <div style={{ fontSize: 15, fontWeight: 800, color: '#4CAF50' }}>{fmtMoney(r.totalPaid)}</div>
                <div style={{ fontSize: 10, color: 'var(--text-secondary)' }}>{r.subitems.length} תשלומים</div>
              </div>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" strokeWidth="2"
                   style={{ transform: isOpen ? 'rotate(90deg)' : 'rotate(0)', transition: 'transform 0.2s', marginInlineStart: 6 }}>
                <path d="M9 18l6-6-6-6" />
              </svg>
            </button>

            {isOpen && (
              <div style={{ borderTop: '1px solid var(--border)', padding: '10px 14px 14px' }}>
                {r.subitems.length === 0 ? (
                  <div style={{ fontSize: 12, color: 'var(--text-secondary)', padding: 10, textAlign: 'center' }}>
                    אין העברות רשומות עדיין
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
                            {sub.name || '—'}
                          </div>
                          <div style={{ fontSize: 10, color: 'var(--text-secondary)' }}>
                            {fmtDate(sub.date || sub.createdAt)} · {sub.category || '—'}
                          </div>
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 4, alignItems: 'flex-end' }}>
                          <div style={{ fontSize: 14, fontWeight: 800, color: '#4CAF50' }}>{fmtMoney(sub.amount)}</div>
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
                <a href={`${MONDAY_BOARD_URL}/pulses/${r.id}`} target="_blank" rel="noopener noreferrer" style={{
                  display: 'block', marginTop: 10, padding: '8px 12px', borderRadius: 8, background: `${GOLD}14`,
                  color: GOLD, fontSize: 11, fontWeight: 700, textDecoration: 'none', textAlign: 'center',
                }}>
                  פתח פרויקט ב-Monday ↗
                </a>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
