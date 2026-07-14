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
import { AdminLoansScreen } from './AdminLoansScreen';
import { useNavigation } from '../../../context/NavigationContext';
import { useMondayData } from '../../../context/MondayDataContext';

/** Top-level view — the renovation-loans board is now a sub-view here rather
 *  than a standalone nav entry. */
type View = 'renovations' | 'loans';

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
      marginTop: 10, padding: 10, borderRadius: 'var(--radius-sm)',
      background: 'var(--bg-chip)', border: '1px solid var(--border)',
    }}>
      <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-secondary)', marginBottom: 8, textAlign: 'right' }}>
        עדכונים פנימיים · {updates.length}
      </div>

      {loading && <div style={{ fontSize: 11, color: 'var(--text-secondary)', padding: 6, textAlign: 'center' }}>טוען…</div>}
      {error && <div style={{ fontSize: 11, color: 'var(--danger)', padding: 6, textAlign: 'center' }}>{error}</div>}

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
            background: draft.trim() ? 'var(--gold)' : 'var(--bg-chip)',
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

const GOLD = 'var(--gold-text)';
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
  const [view, setView] = useState<View>('renovations');

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
  // For MG rows, "paid" sums every transfer (no investor in the middle) and
  // profit doesn't apply (we are both the client and the company).
  const isMgMode = source === 'mg';
  const totals = useMemo(() => filtered.reduce(
    (acc, r) => {
      const b = calcBalance(r, isMgMode ? 'mg' : 'investor');
      const rowPaid = isMgMode ? (r.totalPaidAll ?? r.totalPaid) : r.totalPaid;
      return {
        paid:               acc.paid               + rowPaid,
        our:                acc.our                + r.ourCost,
        client:             acc.client             + r.clientCost,
        addons:             acc.addons             + (r.approvedAddons || 0),
        profit:             acc.profit             + (isMgMode ? 0 : (r.clientCost - r.ourCost)),
        remainingTotal:     acc.remainingTotal     + b.remainingTotal,
        remainingToUs:      acc.remainingToUs      + b.remainingToUs,
        remainingToContr:   acc.remainingToContr   + b.remainingToContractor,
      };
    },
    { paid: 0, our: 0, client: 0, addons: 0, profit: 0, remainingTotal: 0, remainingToUs: 0, remainingToContr: 0 }
  ), [filtered, isMgMode]);

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: 'var(--bg-base)', overflow: 'hidden' }}>
      <div className="desktop-page-title">
        <div className="subtitle">
          {view === 'loans'
            ? 'הלוואות שיפוץ · ADMIN VIEW'
            : `${items.length} פרויקטים · ADMIN VIEW · נתונים פנימיים`}
        </div>
        <h1>{view === 'loans' ? 'הלוואות שיפוץ' : 'שיפוצים'}</h1>
      </div>

      <div className="screen-header" style={{ padding: '16px 20px 10px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
        <MGLogo size={36} showWordmark={false} />
        <span style={{ fontSize: 20, fontWeight: 700, color: 'var(--text-primary)' }}>
          {view === 'loans' ? 'הלוואות שיפוץ' : 'שיפוצים'}
        </span>
      </div>

      <div className="stagger" style={{ flex: 1, overflowY: 'auto', padding: '8px 20px 20px', display: 'flex', flexDirection: 'column', gap: 14 }}>
        {/* Primary view switcher — שיפוצים vs the renovation-loans board (merged
            in here so mobile can free its bottom-bar slot for מיילים). Styled as
            a bold full-width segmented control — deliberately distinct from the
            small filter chips below so it doesn't read as "just another filter". */}
        <div style={{
          display: 'flex', flexDirection: 'row-reverse', gap: 5, padding: 5,
          borderRadius: 16, background: 'var(--bg-surface-2)',
          border: '1px solid var(--border)',
        }}>
          {([
            {
              key: 'renovations' as View,
              label: 'שיפוצים',
              icon: (
                <path d="M14.7 6.3a1 1 0 000 1.4l1.6 1.6a1 1 0 001.4 0l3.77-3.77a6 6 0 01-7.94 7.94l-6.91 6.91a2.12 2.12 0 01-3-3l6.91-6.91a6 6 0 017.94-7.94l-3.76 3.76z" />
              ),
            },
            {
              key: 'loans' as View,
              label: 'הלוואות שיפוץ',
              icon: (
                <>
                  <rect x="2" y="6" width="20" height="12" rx="2" />
                  <circle cx="12" cy="12" r="2.5" />
                  <path d="M6 12h.01M18 12h.01" />
                </>
              ),
            },
          ]).map(opt => {
            const isOn = view === opt.key;
            return (
              <button
                key={opt.key}
                onClick={() => setView(opt.key)}
                style={{
                  flex: 1, minWidth: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
                  gap: 8, padding: '11px 10px', borderRadius: 11, border: 'none',
                  cursor: 'pointer', fontFamily: 'inherit', fontSize: 14, fontWeight: 800,
                  whiteSpace: 'nowrap',
                  background: isOn ? 'var(--gold-grad)' : 'transparent',
                  color: isOn ? '#1a1400' : 'var(--text-secondary)',
                  boxShadow: isOn ? '0 3px 12px rgba(201,168,76,0.35)' : 'none',
                  transition: 'background var(--dur-fast) var(--ease-out), color var(--dur-fast) var(--ease-out), box-shadow var(--dur-fast) var(--ease-out)',
                }}
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none"
                  stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
                  {opt.icon}
                </svg>
                {opt.label}
              </button>
            );
          })}
        </div>

        {view === 'loans' && <AdminLoansScreen embedded />}

        {view === 'renovations' && <>
        {/* KPI summary — adapts to MG mode (no investor / no profit). */}
        <div className="gold-card" style={{ padding: 14 }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 10, marginBottom: 10 }}>
            {(isMgMode
              ? [
                  { label: 'סה״כ שולם',  value: fmtMoney(totals.paid),                       c: 'var(--success)', extra: '' },
                  { label: 'תקציב שיפוץ', value: fmtMoney(totals.our || totals.client),       c: 'var(--info)', extra: totals.addons > 0 ? `+${fmtMoney(totals.addons)}` : '' },
                ]
              : [
                  { label: 'סה״כ שולם',    value: fmtMoney(totals.paid),   c: 'var(--success)', extra: '' },
                  { label: 'רווח משיפוצים', value: fmtMoney(totals.profit), c: GOLD,      extra: '' },
                  { label: 'שיפוץ שלנו',   value: fmtMoney(totals.our),    c: 'var(--info)', extra: totals.addons > 0 ? `+${fmtMoney(totals.addons)}` : '' },
                  { label: 'שיפוץ ללקוח',  value: fmtMoney(totals.client), c: '#ff9800', extra: totals.addons > 0 ? `+${fmtMoney(totals.addons)}` : '' },
                ]
            ).map(k => (
              <div key={k.label} className="stat-chip">
                <div className="stat-label" style={{ letterSpacing: 0.5 }}>{k.label}</div>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, flexDirection: 'row-reverse' }}>
                  <div className="stat-value num" style={{ fontSize: 16, fontWeight: 800, color: k.c }}>{k.value}</div>
                  {k.extra && (
                    <span className="num" style={{ fontSize: 10, fontWeight: 700, color: GOLD }}>{k.extra}</span>
                  )}
                </div>
              </div>
            ))}
          </div>
          {/* What's still owed — auto-fit so it fits any screen width. */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(110px, 1fr))',
            gap: 8,
            background: 'rgba(255,153,0,0.06)', border: '1px solid rgba(255,153,0,0.25)', borderRadius: 'var(--radius-sm)', padding: 10,
          }}>
            {(isMgMode
              ? [
                  { l: 'נותר לתשלום', v: fmtMoney(totals.remainingTotal),   c: '#ff9800' },
                  { l: 'נותר לקבלן',  v: fmtMoney(totals.remainingToContr), c: '#225091' },
                ]
              : [
                  { l: 'נותר לתשלום', v: fmtMoney(totals.remainingTotal),   c: '#ff9800' },
                  { l: 'נותר לנו',    v: fmtMoney(totals.remainingToUs),    c: GOLD },
                  { l: 'נותר לקבלן',  v: fmtMoney(totals.remainingToContr), c: '#225091' },
                ]
            ).map(k => (
              <div key={k.l} style={{ textAlign: 'center' }}>
                <div style={{ fontSize: 9, color: 'var(--text-secondary)', marginBottom: 2, letterSpacing: 0.5 }}>{k.l}</div>
                <div className="num" style={{ fontSize: 14, fontWeight: 800, color: k.c }}>{k.v}</div>
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
              className={'chip-filter' + (source === opt.key ? ' active' : '')}
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
                className={'chip-filter' + (statusFilter === s ? ' active' : '')}
                style={{ flexShrink: 0 }}
              >
                {s === 'all' ? 'הכל' : s}
                <span className="num" style={{
                  fontSize: 9, fontWeight: 700, padding: '1px 6px', borderRadius: 100,
                  background: statusFilter === s ? 'var(--gold-border)' : 'var(--border)',
                  color: statusFilter === s ? 'var(--gold-text)' : 'var(--text-muted)',
                }}>{count}</span>
              </button>
            );
          })}
        </div>

        {loading && <div style={{ padding: 24, textAlign: 'center', color: 'var(--text-secondary)' }}>טוען…</div>}
        {error && <div style={{ padding: 24, textAlign: 'center', color: 'var(--danger)' }}>שגיאה: {error}</div>}

        {!loading && filtered.length === 0 && !error && (
          <div className="gold-card" style={{ padding: 30, textAlign: 'center', color: 'var(--text-secondary)', fontSize: 13 }}>
            אין פרויקטי שיפוצים להצגה
          </div>
        )}

        {filtered.map(r => {
          const isOpen = openId === r.id;
          const rowIsMg = mgPropertyIds.has(r.propertyId);
          const profit = rowIsMg ? 0 : (r.clientCost - r.ourCost);
          const bal = calcBalance(r, rowIsMg ? 'mg' : 'investor');
          const rowPaid = rowIsMg ? (r.totalPaidAll ?? r.totalPaid) : r.totalPaid;
          // Per-recipient totals — same regardless of investor/MG mode.
          // "סה״כ שולם" here means everything that's gone OUT (any subitem),
          // matching how the user thinks about contractor payment progress.
          const paidToContractor    = r.subitems.filter(s => s.paidTo === 'לקבלן').reduce((s, x) => s + (x.amount || 0), 0);
          const paidToSubContractor = r.subitems.filter(s => s.paidTo === 'קבלן משנה').reduce((s, x) => s + (x.amount || 0), 0);
          const paidTotalAll        = r.subitems.reduce((s, x) => s + (x.amount || 0), 0);
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
                      <span style={{ fontSize: 9, fontWeight: 700, padding: '2px 8px', borderRadius: 100, background: 'var(--gold-dim)', color: GOLD }}>
                        {r.status}
                      </span>
                    )}
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>
                    {[r.investorName, r.contractorName].filter(Boolean).join(' · ') || '—'}
                  </div>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 2, alignItems: 'flex-end', minWidth: 140 }}>
                  <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>שולם · <b className="num" style={{ color: 'var(--success)' }}>{fmtMoney(rowPaid)}</b></div>
                  <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>נותר · <b className="num" style={{ color: '#ff9800' }}>{fmtMoney(bal.remainingTotal)}</b></div>
                </div>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" strokeWidth="2"
                     style={{ transform: isOpen ? 'rotate(90deg)' : 'rotate(0)', transition: 'transform 0.2s' }}>
                  <path d="M9 18l6-6-6-6" />
                </svg>
              </button>

              {isOpen && (
                <div style={{ borderTop: '1px solid var(--border)', padding: '12px 14px 16px', background: 'var(--bg-surface)' }}>
                  {/* All grids below use auto-fit + minmax so they keep 3
                      columns on desktop and gracefully wrap to 2 / 1 columns
                      on narrow phone widths instead of clipping money values. */}

                  {/* Balance breakdown — what's left to pay. For MG rows we
                      drop the "נותר לנו" column (no investor in the middle). */}
                  <div style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(95px, 1fr))',
                    gap: 6, marginBottom: 10,
                    background: 'rgba(255,153,0,0.06)', border: '1px solid rgba(255,153,0,0.25)', borderRadius: 8, padding: 8,
                  }}>
                    {(rowIsMg
                      ? [
                          { l: 'נותר לתשלום', v: fmtMoney(bal.remainingTotal),        c: '#ff9800' },
                          { l: 'נותר לקבלן',  v: fmtMoney(bal.remainingToContractor), c: '#225091' },
                        ]
                      : [
                          { l: 'נותר לתשלום', v: fmtMoney(bal.remainingTotal),        c: '#ff9800' },
                          { l: 'נותר לנו',    v: fmtMoney(bal.remainingToUs),         c: GOLD },
                          { l: 'נותר לקבלן',  v: fmtMoney(bal.remainingToContractor), c: '#225091' },
                        ]
                    ).map(k => (
                      <div key={k.l} style={{ textAlign: 'center', minWidth: 0 }}>
                        <div style={{ fontSize: 9, color: 'var(--text-secondary)', marginBottom: 2, whiteSpace: 'nowrap' }}>{k.l}</div>
                        <div className="num" style={{ fontSize: 13, fontWeight: 800, color: k.c, whiteSpace: 'nowrap' }}>{k.v}</div>
                      </div>
                    ))}
                  </div>

                  {/* Where the money has actually gone out — paid to the main
                      contractor, paid to a sub-contractor, and the grand total
                      across every subitem. */}
                  <div style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(95px, 1fr))',
                    gap: 6, marginBottom: 10,
                    background: 'rgba(34,80,145,0.06)', border: '1px solid rgba(34,80,145,0.25)', borderRadius: 8, padding: 8,
                  }}>
                    {[
                      ...(!rowIsMg ? [{ l: 'שולם לנו', v: fmtMoney(bal.clientPaidToUs), c: GOLD }] : []),
                      { l: 'שולם לקבלן',      v: fmtMoney(paidToContractor),    c: '#225091' },
                      { l: 'שולם לקבלן משנה', v: fmtMoney(paidToSubContractor), c: '#5e8ad6' },
                      { l: 'סה״כ שולם',       v: fmtMoney(rowIsMg ? paidTotalAll : bal.clientPaidTotal), c: 'var(--success)' },
                    ].map(k => (
                      <div key={k.l} style={{ textAlign: 'center', minWidth: 0 }}>
                        <div style={{ fontSize: 9, color: 'var(--text-secondary)', marginBottom: 2, whiteSpace: 'nowrap' }}>{k.l}</div>
                        <div className="num" style={{ fontSize: 13, fontWeight: 800, color: k.c, whiteSpace: 'nowrap' }}>{k.v}</div>
                      </div>
                    ))}
                  </div>

                  {/* Detail money grid — for investor rows we show ourCost /
                      clientCost / profit. For MG rows there's no client/our
                      split — we show "תקציב שיפוץ" + addons instead. */}
                  <div style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(95px, 1fr))',
                    gap: 6, marginBottom: 10,
                  }}>
                    {(rowIsMg
                      ? [
                          { l: 'תקציב שיפוץ', v: fmtMoney(r.ourCost || r.clientCost), c: 'var(--info)', addon: r.approvedAddons > 0 },
                          { l: 'Addons',      v: fmtMoney(r.approvedAddons),          c: GOLD,      addon: false },
                        ]
                      : [
                          { l: 'שיפוץ שלנו',  v: fmtMoney(r.ourCost),    c: 'var(--info)', addon: r.approvedAddons > 0 },
                          { l: 'שיפוץ ללקוח', v: fmtMoney(r.clientCost), c: '#ff9800', addon: r.approvedAddons > 0 },
                          { l: 'רווח',        v: fmtMoney(profit),       c: profit >= 0 ? GOLD : 'var(--danger)', addon: false },
                        ]
                    ).map(k => (
                      <div key={k.l} className="stat-chip" style={{ textAlign: 'center', minWidth: 0 }}>
                        <div className="stat-label" style={{ whiteSpace: 'nowrap' }}>{k.l}</div>
                        <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'center', gap: 4, flexDirection: 'row-reverse', flexWrap: 'wrap' }}>
                          <div className="num" style={{ fontSize: 13, fontWeight: 800, color: k.c, whiteSpace: 'nowrap' }}>{k.v}</div>
                          {k.addon && (
                            <span className="num" style={{ fontSize: 9, fontWeight: 700, color: GOLD, whiteSpace: 'nowrap' }}>
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
                            <div className="num" style={{ fontSize: 13, fontWeight: 800, color: 'var(--success)' }}>{fmtMoney(sub.amount)}</div>
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
                              width: 30, height: 30, borderRadius: 8, background: 'var(--gold-dim)', border: '1px solid var(--gold-border)',
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
                        flex: 1, padding: '8px 10px', borderRadius: 8, background: 'var(--gold-dim)',
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
        </>}
      </div>
    </div>
  );
}
