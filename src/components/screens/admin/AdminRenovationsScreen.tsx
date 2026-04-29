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
import {
  listRenovations, calcBalance, paidToColor, paidByColor,
  listRenovationUpdates, postRenovationUpdate,
  type Renovation, type RenovationUpdate,
} from '../../../services/renovationsApi';
import { MGLogo } from '../../common/MGLogo';
import { useNavigation } from '../../../context/NavigationContext';
import { useMondayData } from '../../../context/MondayDataContext';

/** Source toggle — which set of properties the admin wants to see renovations for. */
type SourceKey = 'investors' | 'mg';

/** Property rental statuses — used for the primary filter. Ordered by "most relevant to renovations first". */
const STATUS_FILTERS = [
  'בשיפוץ',
  'על חוזה',
  'בשלבי הלוואה וחתימות',
  'מעבר לניהול',
  'מרקט',
  'מושכר',
  'new construction',
] as const;
type StatusFilter = typeof STATUS_FILTERS[number] | 'all';

/** Inline updates (notes/comments) panel for a single renovation item.
 *  Lists existing Monday Updates and lets an admin post a new one. */
function UpdatesSection({ itemId }: { itemId: string }) {
  const [updates, setUpdates] = useState<RenovationUpdate[]>([]);
  const [loading, setLoading]   = useState(true);
  const [draft,   setDraft]     = useState('');
  const [posting, setPosting]   = useState(false);
  const [error,   setError]     = useState<string | null>(null);

  const load = () => {
    setLoading(true);
    listRenovationUpdates(itemId)
      .then(list => { setUpdates(list); setError(null); })
      .catch(err => setError(err?.message || 'שגיאה בטעינה'))
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [itemId]);

  const handlePost = async () => {
    const text = draft.trim();
    if (!text) return;
    setPosting(true);
    try {
      await postRenovationUpdate(itemId, text);
      setDraft('');
      load();
    } catch (err: any) {
      setError(err?.message || 'שגיאה בשמירת עדכון');
    } finally {
      setPosting(false);
    }
  };

  return (
    <div style={{
      marginTop: 10, padding: 10, borderRadius: 10,
      background: 'var(--bg-chip)', border: '1px solid var(--border)',
    }}>
      <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-secondary)', marginBottom: 8, textAlign: 'right' }}>
        עדכונים פנימיים · {updates.length}
      </div>

      {loading && <div style={{ fontSize: 11, color: 'var(--text-secondary)', padding: 6, textAlign: 'center' }}>טוען…</div>}
      {error && <div style={{ fontSize: 11, color: '#ff4d4d', padding: 6, textAlign: 'center' }}>{error}</div>}

      {!loading && updates.length === 0 && !error && (
        <div style={{ fontSize: 11, color: 'var(--text-muted)', padding: 6, textAlign: 'center' }}>
          אין עדכונים עדיין
        </div>
      )}

      {updates.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 10 }}>
          {updates.map(u => {
            const when = new Date(u.createdAt);
            const whenStr = !isNaN(when.getTime())
              ? when.toLocaleDateString('he-IL', { day: '2-digit', month: 'short', year: '2-digit', hour: '2-digit', minute: '2-digit' })
              : '';
            return (
              <div key={u.id} style={{
                padding: '8px 10px', borderRadius: 8, background: 'var(--bg-surface)',
                border: '1px solid var(--border)',
              }}>
                <div style={{
                  fontSize: 11, color: 'var(--text-primary)', lineHeight: 1.5,
                  direction: 'rtl', textAlign: 'right',
                }} dangerouslySetInnerHTML={{ __html: u.body }} />
                <div style={{ fontSize: 9, color: 'var(--text-muted)', marginTop: 4, textAlign: 'left' }}>
                  {whenStr}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Compose new update */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        <textarea
          value={draft}
          onChange={e => setDraft(e.target.value)}
          placeholder="הוסף עדכון פנימי על הפרויקט…"
          style={{
            resize: 'vertical', minHeight: 56, padding: 8, borderRadius: 8,
            border: '1px solid var(--border)', background: 'var(--bg-surface)',
            color: 'var(--text-primary)', fontSize: 12, direction: 'rtl', fontFamily: 'inherit',
          }}
        />
        <button
          onClick={handlePost}
          disabled={!draft.trim() || posting}
          style={{
            padding: '8px 10px', borderRadius: 8, border: 'none',
            background: draft.trim() ? '#C9A84C' : 'var(--bg-chip)',
            color: draft.trim() ? '#000' : 'var(--text-muted)',
            fontSize: 12, fontWeight: 700,
            cursor: draft.trim() && !posting ? 'pointer' : 'not-allowed',
          }}
        >
          {posting ? 'שומר…' : 'שמור עדכון'}
        </button>
      </div>
    </div>
  );
}

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

export function AdminRenovationsScreen() {
  const { navigate } = useNavigation();
  // The Monday context already has the canonical "investor deals" vs
  // "Miller Group deals" split via two separate group fetches. We use that
  // set instead of trying to read the property group id off the renovations
  // API (which is unreliable — items(ids:){group} doesn't always populate).
  const { mgProperties } = useMondayData();
  const mgPropertyIds = useMemo(() => new Set(mgProperties.map(p => p.mondayId)), [mgProperties]);

  const [items, setItems] = useState<Renovation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  /** Filter by the property's rental status, not by the renovations-board group.
   *  Default = "בשיפוץ" per product request. */
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('בשיפוץ');
  const [source, setSource] = useState<SourceKey>('investors');
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

  // Per-source counts for the toggle badge
  const sourceCounts = useMemo(() => ({
    investors: items.filter(r => !mgPropertyIds.has(r.propertyId)).length,
    mg:        items.filter(r =>  mgPropertyIds.has(r.propertyId)).length,
  }), [items, mgPropertyIds]);

  // Items after source filter — status counts and list operate on this subset
  const sourceItems = useMemo(() => {
    return items.filter(r =>
      source === 'mg' ? mgPropertyIds.has(r.propertyId) : !mgPropertyIds.has(r.propertyId)
    );
  }, [items, source, mgPropertyIds]);

  // Count renovations per status (within selected source) so filter chips can show a badge
  const statusCounts = useMemo(() => {
    const m: Record<string, number> = {};
    sourceItems.forEach(r => { if (r.status) m[r.status] = (m[r.status] || 0) + 1; });
    return m;
  }, [sourceItems]);

  // If the user switched source and the current status filter has no matching
  // items (e.g. switched to "Miller Group" while filter was "בשיפוץ" and MG has
  // none in that status), fall back to "הכל" so the screen isn't deceptively
  // empty.
  useEffect(() => {
    if (sourceItems.length === 0) return;
    if (statusFilter === 'all') return;
    const matched = sourceItems.filter(r => r.status === statusFilter).length;
    if (matched === 0) setStatusFilter('all');
  }, [source, sourceItems.length]); // eslint-disable-line react-hooks/exhaustive-deps

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return sourceItems.filter(r => {
      if (statusFilter !== 'all' && r.status !== statusFilter) return false;
      if (!q) return true;
      return [r.name, r.propertyName, r.investorName, r.contractorName]
        .some(v => (v || '').toLowerCase().includes(q));
    });
  }, [sourceItems, statusFilter, search]);

  // Aggregates across filtered set — include balance sums.
  // Approved addons add equally to what the client owes AND to what the
  // contractor should get, so profit stays on (clientCost - ourCost).
  const totals = useMemo(() => filtered.reduce(
    (acc, r) => {
      const b = calcBalance(r);
      return {
        paid:               acc.paid               + r.totalPaid,
        our:                acc.our                + r.ourCost,
        client:             acc.client             + r.clientCost,
        addons:             acc.addons             + (r.approvedAddons || 0),
        profit:             acc.profit             + (r.clientCost - r.ourCost),
        remainingTotal:     acc.remainingTotal     + b.remainingTotal,
        remainingToUs:      acc.remainingToUs      + b.remainingToUs,
        remainingToContr:   acc.remainingToContr   + b.remainingToContractor,
      };
    },
    { paid: 0, our: 0, client: 0, addons: 0, profit: 0, remainingTotal: 0, remainingToUs: 0, remainingToContr: 0 }
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
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 10, marginBottom: 10 }}>
            {[
              { label: 'סה״כ שולם',      value: fmtMoney(totals.paid),   c: '#4CAF50' },
              { label: 'רווח משיפוצים',   value: fmtMoney(totals.profit), c: GOLD },
              { label: 'שיפוץ שלנו',     value: fmtMoney(totals.our),    c: '#64B5F6', extra: totals.addons > 0 ? `+${fmtMoney(totals.addons)}` : '' },
              { label: 'שיפוץ ללקוח',    value: fmtMoney(totals.client), c: '#ff9800', extra: totals.addons > 0 ? `+${fmtMoney(totals.addons)}` : '' },
            ].map(k => (
              <div key={k.label} style={{ background: 'var(--bg-chip)', borderRadius: 10, padding: '10px 14px' }}>
                <div style={{ fontSize: 9, color: 'var(--text-secondary)', marginBottom: 4, letterSpacing: 0.5 }}>{k.label}</div>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, flexDirection: 'row-reverse' }}>
                  <div style={{ fontSize: 16, fontWeight: 800, color: k.c }}>{k.value}</div>
                  {(k as any).extra && (
                    <span style={{ fontSize: 10, fontWeight: 700, color: GOLD }}>{(k as any).extra}</span>
                  )}
                </div>
              </div>
            ))}
          </div>
          {/* What's still owed — 3 columns */}
          <div style={{
            display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8,
            background: 'rgba(255,153,0,0.06)', border: '1px solid rgba(255,153,0,0.25)', borderRadius: 10, padding: 10,
          }}>
            {[
              { l: 'נותר לתשלום',   v: fmtMoney(totals.remainingTotal),   c: '#ff9800' },
              { l: 'נותר לנו',      v: fmtMoney(totals.remainingToUs),    c: GOLD },
              { l: 'נותר לקבלן',    v: fmtMoney(totals.remainingToContr), c: '#225091' },
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
        </div>

        {/* Source toggle — investor-owned renovations vs Miller Group's own */}
        <div style={{
          display: 'inline-flex', gap: 4, padding: 3, borderRadius: 100,
          background: 'var(--bg-chip)', border: '1px solid var(--border)',
          flexDirection: 'row-reverse', alignSelf: 'flex-end',
        }}>
          {([
            { key: 'investors' as SourceKey, label: `משקיעים (${sourceCounts.investors})` },
            { key: 'mg'        as SourceKey, label: `Miller Group (${sourceCounts.mg})` },
          ]).map(opt => (
            <button
              key={opt.key}
              onClick={() => setSource(opt.key)}
              style={{
                padding: '6px 14px', borderRadius: 100, border: 'none',
                background: source === opt.key ? GOLD : 'transparent',
                color: source === opt.key ? '#000' : 'var(--text-secondary)',
                fontSize: 11, fontWeight: 700, cursor: 'pointer',
                transition: 'background 0.15s',
              }}
            >
              {opt.label}
            </button>
          ))}
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
        {/* Status filter chips — wrap onto multiple rows so every option is
            visible on desktop too (the previous overflowX:auto+row-reverse
            combo was clipping the list off-screen). */}
        <div style={{
          display: 'flex', gap: 6, flexWrap: 'wrap',
          flexDirection: 'row-reverse', justifyContent: 'flex-start',
        }}>
          {(['בשיפוץ', ...STATUS_FILTERS.filter(s => s !== 'בשיפוץ'), 'all'] as StatusFilter[]).map(s => {
            // "הכל" reflects the count after the source toggle (משקיעים / MG),
            // not the raw items list — otherwise the badge mismatches the rows.
            const count = s === 'all' ? sourceItems.length : (statusCounts[s] || 0);
            return (
              <button
                key={s}
                onClick={() => setStatusFilter(s)}
                style={{
                  padding: '6px 12px', borderRadius: 100,
                  background: statusFilter === s ? GOLD : 'var(--bg-chip)',
                  color: statusFilter === s ? '#000' : 'var(--text-secondary)',
                  border: '1px solid var(--border)',
                  fontSize: 11, fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap', flexShrink: 0,
                  display: 'inline-flex', alignItems: 'center', gap: 6,
                }}
              >
                {s === 'all' ? 'הכל' : s}
                <span style={{
                  fontSize: 9, fontWeight: 700, padding: '1px 6px', borderRadius: 100,
                  background: statusFilter === s ? 'rgba(0,0,0,0.15)' : 'var(--border)',
                  color: statusFilter === s ? '#000' : 'var(--text-muted)',
                }}>{count}</span>
              </button>
            );
          })}
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
          const bal = calcBalance(r);
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
                    {r.status && (
                      <span style={{ fontSize: 9, fontWeight: 700, padding: '2px 8px', borderRadius: 100, background: `${GOLD}22`, color: GOLD }}>
                        {r.status}
                      </span>
                    )}
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>
                    {[r.investorName, r.contractorName].filter(Boolean).join(' · ') || '—'}
                  </div>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 2, alignItems: 'flex-end', minWidth: 140 }}>
                  <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>שולם · <b style={{ color: '#4CAF50' }}>{fmtMoney(r.totalPaid)}</b></div>
                  <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>נותר · <b style={{ color: '#ff9800' }}>{fmtMoney(bal.remainingTotal)}</b></div>
                </div>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" strokeWidth="2"
                     style={{ transform: isOpen ? 'rotate(90deg)' : 'rotate(0)', transition: 'transform 0.2s' }}>
                  <path d="M9 18l6-6-6-6" />
                </svg>
              </button>

              {isOpen && (
                <div style={{ borderTop: '1px solid var(--border)', padding: '12px 16px 16px', background: 'var(--bg-surface)' }}>
                  {/* Balance breakdown — what's left to pay */}
                  <div style={{
                    display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 6, marginBottom: 10,
                    background: 'rgba(255,153,0,0.06)', border: '1px solid rgba(255,153,0,0.25)', borderRadius: 8, padding: 8,
                  }}>
                    {[
                      { l: 'נותר לתשלום',   v: fmtMoney(bal.remainingTotal),        c: '#ff9800' },
                      { l: 'נותר לנו',      v: fmtMoney(bal.remainingToUs),         c: GOLD },
                      { l: 'נותר לקבלן',    v: fmtMoney(bal.remainingToContractor), c: '#225091' },
                    ].map(k => (
                      <div key={k.l} style={{ textAlign: 'center' }}>
                        <div style={{ fontSize: 9, color: 'var(--text-secondary)', marginBottom: 2 }}>{k.l}</div>
                        <div style={{ fontSize: 13, fontWeight: 800, color: k.c }}>{k.v}</div>
                      </div>
                    ))}
                  </div>

                  {/* Detail money grid — admin only. Addons shown as a small
                      "+" badge next to both "שיפוץ שלנו" and "שיפוץ ללקוח" since
                      addons pass through at cost (profit unchanged). */}
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 6, marginBottom: 10 }}>
                    {[
                      { l: 'שיפוץ שלנו',  v: fmtMoney(r.ourCost),    c: '#64B5F6', addon: r.approvedAddons > 0 },
                      { l: 'שיפוץ ללקוח', v: fmtMoney(r.clientCost), c: '#ff9800', addon: r.approvedAddons > 0 },
                      { l: 'רווח',        v: fmtMoney(profit),       c: profit >= 0 ? GOLD : '#ff4d4d', addon: false },
                    ].map(k => (
                      <div key={k.l} style={{ background: 'var(--bg-chip)', borderRadius: 8, padding: '7px 10px', textAlign: 'center' }}>
                        <div style={{ fontSize: 9, color: 'var(--text-secondary)', marginBottom: 2 }}>{k.l}</div>
                        <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'center', gap: 4, flexDirection: 'row-reverse' }}>
                          <div style={{ fontSize: 13, fontWeight: 800, color: k.c }}>{k.v}</div>
                          {k.addon && (
                            <span style={{ fontSize: 9, fontWeight: 700, color: GOLD }}>
                              +{fmtMoney(r.approvedAddons)}
                            </span>
                          )}
                        </div>
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

                  {/* Internal project updates — admin-only notes */}
                  <UpdatesSection itemId={r.id} />

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
