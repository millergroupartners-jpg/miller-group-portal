/**
 * AdminRenovationsScreen — overview of every renovation project across all
 * investor properties. ADMIN ONLY.
 *
 * Shows, per project:
 *   - Property address + investor + contractor + status
 *   - ourCost ↔ clientCost and renovation PROFIT
 *   - Total paid so far via subitems (contractor payments)
 * Expanding a row reveals the individual subitem payments.
 *
 * DO NOT route investor users here — this page exposes internal margins and
 * contractor payment breakdowns.
 */

import { useEffect, useMemo, useState } from 'react';
import { listRenovations, paidToColor, paidByColor, type Renovation } from '../../../services/renovationsApi';
import { MGLogo } from '../../common/MGLogo';
import { useNavigation } from '../../../context/NavigationContext';

const GOLD = '#C9A84C';
const MONDAY_BOARD_URL = 'https://real-estate-usa-eden.monday.com/boards/2064106439';

function fmtMoney(n: number): string {
  if (!n) return '—';
  return '$' + n.toLocaleString('en-US');
}
function fmtDate(iso: string): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  return d.toLocaleDateString('he-IL', { day: '2-digit', month: 'short', year: '2-digit' });
}

type GroupFilter = 'all' | string;

export function AdminRenovationsScreen() {
  const { navigate } = useNavigation();
  const [items, setItems] = useState<Renovation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [groupFilter, setGroupFilter] = useState<GroupFilter>('all');
  const [search, setSearch] = useState('');
  const [openId, setOpenId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    listRenovations()
      .then(list => { if (!cancelled) { setItems(list); setError(null); } })
      .catch(err => { if (!cancelled) setError(err?.message || 'שגיאה בטעינה'); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  // Unique group titles for filter chips
  const groups = useMemo(() => {
    const s = new Set<string>();
    items.forEach(r => { if (r.groupTitle) s.add(r.groupTitle); });
    return Array.from(s);
  }, [items]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return items.filter(r => {
      if (groupFilter !== 'all' && r.groupTitle !== groupFilter) return false;
      if (!q) return true;
      return [r.name, r.propertyName, r.investorName, r.contractorName]
        .some(v => (v || '').toLowerCase().includes(q));
    });
  }, [items, groupFilter, search]);

  // Aggregates across filtered set
  const totals = useMemo(() => filtered.reduce(
    (acc, r) => ({
      paid:   acc.paid   + r.totalPaid,
      our:    acc.our    + r.ourCost,
      client: acc.client + r.clientCost,
      addons: acc.addons + r.approvedAddons,
      profit: acc.profit + (r.clientCost - r.ourCost),
    }),
    { paid: 0, our: 0, client: 0, addons: 0, profit: 0 }
  ), [filtered]);

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: 'var(--bg-base)', overflow: 'hidden' }}>
      <div className="desktop-page-title">
        <div className="subtitle">{items.length} פרויקטים · ADMIN VIEW · נתונים פנימיים</div>
        <h1>שיפוצים</h1>
      </div>

      <div className="screen-header" style={{ padding: '16px 20px 10px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
        <MGLogo size={36} showWordmark={false} />
        <span style={{ fontSize: 20, fontWeight: 700, color: 'var(--text-primary)' }}>שיפוצים</span>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: '8px 20px 20px', display: 'flex', flexDirection: 'column', gap: 14 }}>
        {/* KPI summary */}
        <div className="gold-card" style={{ padding: 14 }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 10 }}>
            {[
              { label: 'סה״כ שולם',      value: fmtMoney(totals.paid),   c: '#4CAF50' },
              { label: 'רווח משיפוצים',   value: fmtMoney(totals.profit), c: GOLD },
              { label: 'שיפוץ שלנו',     value: fmtMoney(totals.our),    c: '#64B5F6' },
              { label: 'שיפוץ ללקוח',    value: fmtMoney(totals.client), c: '#ff9800' },
            ].map(k => (
              <div key={k.label} style={{ background: 'var(--bg-chip)', borderRadius: 10, padding: '10px 14px' }}>
                <div style={{ fontSize: 9, color: 'var(--text-secondary)', marginBottom: 4, letterSpacing: 0.5 }}>{k.label}</div>
                <div style={{ fontSize: 16, fontWeight: 800, color: k.c }}>{k.value}</div>
              </div>
            ))}
          </div>
          <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 8, textAlign: 'right' }}>
            🔒 נתונים פנימיים — לא חשופים למשקיעים
          </div>
        </div>

        {/* Search + group filter */}
        <div style={{ display: 'flex', gap: 8, flexDirection: 'row-reverse' }}>
          <input
            className="mg-input"
            placeholder="חיפוש לפי כתובת, משקיע או קבלן…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            style={{ flex: 1, direction: 'rtl' }}
          />
        </div>
        <div style={{ display: 'flex', gap: 6, overflowX: 'auto', flexDirection: 'row-reverse' }}>
          {['all', ...groups].map(g => (
            <button
              key={g}
              onClick={() => setGroupFilter(g)}
              style={{
                padding: '6px 14px', borderRadius: 100,
                background: groupFilter === g ? GOLD : 'var(--bg-chip)',
                color: groupFilter === g ? '#000' : 'var(--text-secondary)',
                border: '1px solid var(--border)',
                fontSize: 11, fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap', flexShrink: 0,
              }}
            >
              {g === 'all' ? 'הכל' : g}
            </button>
          ))}
        </div>

        {loading && <div style={{ padding: 24, textAlign: 'center', color: 'var(--text-secondary)' }}>טוען…</div>}
        {error && <div style={{ padding: 24, textAlign: 'center', color: '#ff4d4d' }}>שגיאה: {error}</div>}

        {!loading && filtered.length === 0 && !error && (
          <div className="gold-card" style={{ padding: 30, textAlign: 'center', color: 'var(--text-secondary)', fontSize: 13 }}>
            אין פרויקטי שיפוצים להצגה
          </div>
        )}

        {filtered.map(r => {
          const isOpen = openId === r.id;
          const profit = r.clientCost - r.ourCost;
          return (
            <div key={r.id} className="gold-card" style={{ padding: 0, overflow: 'hidden' }}>
              <button
                onClick={() => setOpenId(isOpen ? null : r.id)}
                style={{
                  width: '100%', padding: '14px 16px', background: 'transparent', border: 'none',
                  display: 'flex', flexDirection: 'row-reverse', gap: 12, alignItems: 'center',
                  cursor: 'pointer', textAlign: 'right', color: 'var(--text-primary)',
                }}
              >
                <div style={{ flex: 1, textAlign: 'right' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, justifyContent: 'flex-end', marginBottom: 4 }}>
                    <span style={{ fontSize: 14, fontWeight: 700 }}>{r.propertyName || r.name}</span>
                    {r.groupTitle && (
                      <span style={{ fontSize: 9, fontWeight: 700, padding: '2px 8px', borderRadius: 100, background: `${GOLD}22`, color: GOLD }}>
                        {r.groupTitle}
                      </span>
                    )}
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>
                    {[r.investorName, r.contractorName].filter(Boolean).join(' · ') || '—'}
                  </div>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 2, alignItems: 'flex-end', minWidth: 120 }}>
                  <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>שולם · <b style={{ color: '#4CAF50' }}>{fmtMoney(r.totalPaid)}</b></div>
                  <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>רווח · <b style={{ color: profit >= 0 ? GOLD : '#ff4d4d' }}>{fmtMoney(profit)}</b></div>
                </div>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" strokeWidth="2"
                     style={{ transform: isOpen ? 'rotate(90deg)' : 'rotate(0)', transition: 'transform 0.2s' }}>
                  <path d="M9 18l6-6-6-6" />
                </svg>
              </button>

              {isOpen && (
                <div style={{ borderTop: '1px solid var(--border)', padding: '12px 16px 16px', background: 'var(--bg-surface)' }}>
                  {/* Detail money grid — admin only */}
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 6, marginBottom: 10 }}>
                    {[
                      { l: 'שיפוץ שלנו', v: fmtMoney(r.ourCost),      c: '#64B5F6' },
                      { l: 'שיפוץ ללקוח', v: fmtMoney(r.clientCost),   c: '#ff9800' },
                      { l: 'רווח',        v: fmtMoney(profit),          c: profit >= 0 ? GOLD : '#ff4d4d' },
                    ].map(k => (
                      <div key={k.l} style={{ background: 'var(--bg-chip)', borderRadius: 8, padding: '7px 10px', textAlign: 'center' }}>
                        <div style={{ fontSize: 9, color: 'var(--text-secondary)', marginBottom: 2 }}>{k.l}</div>
                        <div style={{ fontSize: 13, fontWeight: 800, color: k.c }}>{k.v}</div>
                      </div>
                    ))}
                  </div>

                  {r.subitems.length === 0 ? (
                    <div style={{ fontSize: 12, color: 'var(--text-secondary)', padding: 8, textAlign: 'center' }}>
                      אין העברות רשומות עדיין
                    </div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                      {r.subitems.map(sub => (
                        <div key={sub.id} style={{
                          display: 'flex', flexDirection: 'row-reverse', gap: 10, alignItems: 'center',
                          padding: '8px 10px', borderRadius: 8, background: 'var(--bg-chip)',
                        }}>
                          <div style={{ flex: 1, textAlign: 'right' }}>
                            <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 2 }}>
                              {sub.name || '—'}
                            </div>
                            <div style={{ fontSize: 10, color: 'var(--text-secondary)' }}>
                              {fmtDate(sub.date || sub.createdAt)} · {sub.category || '—'}
                            </div>
                          </div>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 3, alignItems: 'flex-end' }}>
                            <div style={{ fontSize: 13, fontWeight: 800, color: '#4CAF50' }}>{fmtMoney(sub.amount)}</div>
                            <div style={{ display: 'flex', gap: 3 }}>
                              {sub.paidTo && (
                                <span style={{ fontSize: 9, fontWeight: 700, padding: '2px 6px', borderRadius: 100,
                                   background: `${paidToColor(sub.paidTo)}22`, color: paidToColor(sub.paidTo) }}>
                                  {sub.paidTo}
                                </span>
                              )}
                              {sub.paidBy && (
                                <span style={{ fontSize: 9, fontWeight: 700, padding: '2px 6px', borderRadius: 100,
                                   background: `${paidByColor(sub.paidBy)}22`, color: paidByColor(sub.paidBy) }}>
                                  שילם: {sub.paidBy}
                                </span>
                              )}
                            </div>
                          </div>
                          {sub.receiptUrl && (
                            <a href={sub.receiptUrl} target="_blank" rel="noopener noreferrer" style={{
                              width: 30, height: 30, borderRadius: 8, background: `${GOLD}18`, border: `1px solid ${GOLD}55`,
                              display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, textDecoration: 'none',
                            }}>
                              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke={GOLD} strokeWidth="2">
                                <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
                                <polyline points="14 2 14 8 20 8" />
                              </svg>
                            </a>
                          )}
                        </div>
                      ))}
                    </div>
                  )}

                  <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
                    {r.propertyId && (
                      <button
                        onClick={() => navigate('property-detail', { propertyId: r.propertyId })}
                        style={{
                          flex: 1, padding: '8px 10px', borderRadius: 8, border: '1px solid var(--border)',
                          background: 'var(--bg-chip)', color: 'var(--text-primary)', cursor: 'pointer',
                          fontSize: 11, fontWeight: 600,
                        }}
                      >
                        לנכס בפורטל
                      </button>
                    )}
                    <a
                      href={`${MONDAY_BOARD_URL}/pulses/${r.id}`}
                      target="_blank" rel="noopener noreferrer"
                      style={{
                        flex: 1, padding: '8px 10px', borderRadius: 8, background: `${GOLD}14`,
                        color: GOLD, fontSize: 11, fontWeight: 700, textDecoration: 'none', textAlign: 'center',
                      }}
                    >
                      Monday ↗
                    </a>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
