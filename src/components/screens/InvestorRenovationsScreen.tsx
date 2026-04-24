/**
 * InvestorRenovationsScreen — top-level "שיפוצים" menu for investors.
 *
 * Lists every renovation project across all of the investor's properties so
 * they can see total budget, what they've transferred, and what's still owed
 * in one place. The API is called with role=investor, which sanitizes the
 * payload server-side (strips contractor name, our internal cost, and our
 * own transfers), so no commission / contractor info reaches this screen.
 */

import { useEffect, useMemo, useState } from 'react';
import { useNavigation } from '../../context/NavigationContext';
import { useUser } from '../../context/UserContext';
import { MGLogo } from '../common/MGLogo';
import { listRenovations, type Renovation } from '../../services/renovationsApi';

const GOLD = '#C9A84C';

function fmtMoney(n: number): string {
  if (!n) return '$0';
  return '$' + n.toLocaleString('en-US');
}
function fmtDate(iso: string): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  return d.toLocaleDateString('he-IL', { day: '2-digit', month: 'short', year: '2-digit' });
}

export function InvestorRenovationsScreen() {
  const { navigate } = useNavigation();
  const { currentUser } = useUser();
  const investorId = currentUser?.mondayInvestorId || '';

  const [items, setItems] = useState<Renovation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);

  useEffect(() => {
    if (!investorId) { setLoading(false); return; }
    let cancelled = false;
    setLoading(true);
    listRenovations({ investorId, role: 'investor' })
      .then(list => { if (!cancelled) { setItems(list); setError(null); } })
      .catch(err => { if (!cancelled) setError(err?.message || 'שגיאה בטעינה'); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [investorId]);

  const totals = useMemo(() => items.reduce(
    (acc, r) => ({
      budget:    acc.budget    + r.clientCost,
      paid:      acc.paid      + r.totalPaid,
      remaining: acc.remaining + Math.max(0, r.clientCost - r.totalPaid),
    }),
    { budget: 0, paid: 0, remaining: 0 }
  ), [items]);

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: 'var(--bg-base)', overflow: 'hidden' }}>
      <div className="desktop-page-title">
        <div className="subtitle">סיכום שיפוצים לכל הנכסים שלך</div>
        <h1>שיפוצים</h1>
      </div>

      <div className="screen-header" style={{ padding: '16px 20px 10px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
        <MGLogo size={36} showWordmark={false} />
        <span style={{ fontSize: 20, fontWeight: 700, color: 'var(--text-primary)' }}>שיפוצים</span>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: '8px 20px 20px', display: 'flex', flexDirection: 'column', gap: 12 }}>
        {/* Summary KPIs */}
        <div className="gold-card" style={{ padding: 14 }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10 }}>
            {[
              { label: 'תקציב כולל',   value: fmtMoney(totals.budget),    c: '#ff9800' },
              { label: 'העברת עד כה', value: fmtMoney(totals.paid),      c: '#4CAF50' },
              { label: 'נותר להעברה', value: fmtMoney(totals.remaining), c: GOLD },
            ].map(k => (
              <div key={k.label} style={{ background: 'var(--bg-chip)', borderRadius: 10, padding: '12px 10px', textAlign: 'center' }}>
                <div style={{ fontSize: 9, color: 'var(--text-secondary)', marginBottom: 4, letterSpacing: 0.3 }}>{k.label}</div>
                <div style={{ fontSize: 15, fontWeight: 800, color: k.c }}>{k.value}</div>
              </div>
            ))}
          </div>
        </div>

        {loading && <div style={{ padding: 24, textAlign: 'center', color: 'var(--text-secondary)', fontSize: 13 }}>טוען…</div>}
        {error && <div style={{ padding: 24, textAlign: 'center', color: '#ff4d4d', fontSize: 13 }}>שגיאה: {error}</div>}
        {!loading && items.length === 0 && !error && (
          <div className="gold-card" style={{ padding: 30, textAlign: 'center', color: 'var(--text-secondary)', fontSize: 13 }}>
            אין פרויקטי שיפוצים זמינים עבור הנכסים שלך
          </div>
        )}

        {items.map(r => {
          const isOpen = openId === r.id;
          const remaining = Math.max(0, r.clientCost - r.totalPaid);
          return (
            <div key={r.id} className="gold-card" style={{ padding: 0, overflow: 'hidden' }}>
              <button
                onClick={() => setOpenId(isOpen ? null : r.id)}
                style={{
                  width: '100%', padding: '14px', background: 'transparent', border: 'none',
                  display: 'flex', flexDirection: 'row-reverse', gap: 12, alignItems: 'center',
                  cursor: 'pointer', textAlign: 'right', color: 'var(--text-primary)',
                }}
              >
                <div style={{ flex: 1, textAlign: 'right' }}>
                  <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 4 }}>
                    {r.propertyName || r.name}
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>
                    חברת השיפוצים שלנו
                  </div>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 2, alignItems: 'flex-end', minWidth: 140 }}>
                  <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>שולם · <b style={{ color: '#4CAF50' }}>{fmtMoney(r.totalPaid)}</b></div>
                  <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>נותר · <b style={{ color: GOLD }}>{fmtMoney(remaining)}</b></div>
                </div>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" strokeWidth="2"
                     style={{ transform: isOpen ? 'rotate(90deg)' : 'rotate(0)', transition: 'transform 0.2s' }}>
                  <path d="M9 18l6-6-6-6" />
                </svg>
              </button>

              {isOpen && (
                <div style={{ borderTop: '1px solid var(--border)', padding: '12px 16px 14px', background: 'var(--bg-surface)' }}>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 6, marginBottom: 10 }}>
                    {[
                      { l: 'תקציב',    v: fmtMoney(r.clientCost), c: '#ff9800' },
                      { l: 'שולם',     v: fmtMoney(r.totalPaid),  c: '#4CAF50' },
                      { l: 'נותר',     v: fmtMoney(remaining),    c: GOLD },
                    ].map(k => (
                      <div key={k.l} style={{ background: 'var(--bg-chip)', borderRadius: 8, padding: '7px 10px', textAlign: 'center' }}>
                        <div style={{ fontSize: 9, color: 'var(--text-secondary)', marginBottom: 2 }}>{k.l}</div>
                        <div style={{ fontSize: 13, fontWeight: 800, color: k.c }}>{k.v}</div>
                      </div>
                    ))}
                  </div>

                  {r.subitems.length === 0 ? (
                    <div style={{ fontSize: 12, color: 'var(--text-secondary)', padding: 8, textAlign: 'center' }}>
                      טרם בוצעו העברות
                    </div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                      {r.subitems.map(sub => (
                        <div key={sub.id} style={{
                          display: 'flex', flexDirection: 'row-reverse', alignItems: 'center',
                          gap: 10, padding: '8px 10px', borderRadius: 8, background: 'var(--bg-chip)',
                        }}>
                          <div style={{ flex: 1, textAlign: 'right' }}>
                            <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)' }}>
                              {sub.name || 'העברה לחברת השיפוצים'}
                            </div>
                            <div style={{ fontSize: 10, color: 'var(--text-secondary)' }}>
                              {fmtDate(sub.date || sub.createdAt)}{sub.category ? ` · ${sub.category}` : ''}
                            </div>
                          </div>
                          <div style={{ fontSize: 13, fontWeight: 800, color: '#4CAF50' }}>{fmtMoney(sub.amount)}</div>
                        </div>
                      ))}
                    </div>
                  )}

                  {r.propertyId && (
                    <button
                      onClick={() => navigate('property-detail', { propertyId: r.propertyId })}
                      style={{
                        width: '100%', marginTop: 10, padding: '8px 10px', borderRadius: 8,
                        border: '1px solid var(--border)', background: 'var(--bg-chip)',
                        color: 'var(--text-primary)', cursor: 'pointer', fontSize: 11, fontWeight: 600,
                      }}
                    >
                      לעמוד הנכס המלא
                    </button>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
