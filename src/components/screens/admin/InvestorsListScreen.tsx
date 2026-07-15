import { useState, useMemo, useEffect, useRef } from 'react';
import { useNavigation } from '../../../context/NavigationContext';
import { useUser } from '../../../context/UserContext';
import { useMondayData } from '../../../context/MondayDataContext';
import { MGLogo } from '../../common/MGLogo';
import { useToast } from '../../common/ToastProvider';
import { usePersistedState } from '../../../hooks/usePersistedState';
import { fmtUSD } from '../../../utils/format';
import { downloadCsv, csvFilename } from '../../../utils/csv';
import { buildInviteMessage, buildWhatsAppInviteUrl } from '../../../utils/invite';
import type { MondayInvestor } from '../../../services/mondayApi';

const GOLD = 'var(--gold-text)';

type SortKey = 'arv' | 'equity' | 'name';

const SORT_OPTIONS: { key: SortKey; label: string }[] = [
  { key: 'arv',    label: 'ARV' },
  { key: 'equity', label: 'Equity' },
  { key: 'name',   label: 'שם' },
];

const isSortKey = (v: unknown): v is SortKey => v === 'arv' || v === 'equity' || v === 'name';

/** Icon button on an investor card. Stops propagation so the card's navigate doesn't fire. */
function QuickAction({ title, onClick, icon, gold }: {
  title: string;
  onClick: () => void;
  icon: React.ReactNode;
  gold?: boolean;
}) {
  return (
    <button
      title={title}
      aria-label={title}
      onClick={e => { e.stopPropagation(); onClick(); }}
      style={{
        width: 36, height: 36, borderRadius: 'var(--radius-sm)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: gold ? 'var(--gold-dim)' : 'var(--bg-chip)',
        border: `1px solid ${gold ? 'var(--gold-border)' : 'var(--border)'}`,
        color: gold ? GOLD : 'var(--text-secondary)',
        cursor: 'pointer', flexShrink: 0,
      }}
    >
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        {icon}
      </svg>
    </button>
  );
}

function investorTotals(inv: MondayInvestor) {
  const arv   = inv.properties.reduce((s, p) => s + p.arvRaw, 0);
  const allIn = inv.properties.reduce((s, p) => s + p.allIn, 0);
  return { arv, equity: arv - allIn };
}

export function InvestorsListScreen() {
  const { navigate, navState, resetTo } = useNavigation();
  const { viewAsInvestor } = useUser();
  const toast = useToast();
  const highlightMode = navState.highlightInvestorMode;
  const { investors, loading, hasToken } = useMondayData();
  const [search, setSearch] = useState('');
  const [sortKey, setSortKey] = usePersistedState<SortKey>('mg_ui_investors_sort_v1', 'arv', isSortKey);
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  const copyToClipboard = async (text: string, label: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast.success(`${label} הועתק`);
    } catch {
      toast.error('ההעתקה נכשלה');
    }
  };

  const exportCsv = () => {
    downloadCsv(
      csvFilename('investors'),
      ['שם', 'אימייל', 'טלפון', 'נכסים', 'ARV', 'Equity', 'סטטוס סיסמה'],
      filtered.map(inv => {
        const t = investorTotals(inv);
        return [inv.fullName, inv.email, inv.phone, inv.properties.length, t.arv, t.equity, inv.password ? 'פעיל' : 'ללא סיסמה'];
      }),
    );
    toast.success(`יוצאו ${filtered.length} משקיעים`);
  };

  // IDs of investors that should flash (those without a password, when arriving from the alert)
  const flashIds = useMemo(() => {
    if (highlightMode !== 'no-password') return new Set<string>();
    return new Set(investors.filter(i => !i.password && i.email).map(i => i.mondayId));
  }, [highlightMode, investors]);

  // Scroll to first flash target after render
  useEffect(() => {
    if (flashIds.size === 0) return;
    const timer = setTimeout(() => {
      const container = scrollContainerRef.current;
      if (!container) return;
      const first = container.querySelector('[data-flash="true"]') as HTMLElement | null;
      first?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 350);
    return () => clearTimeout(timer);
  }, [flashIds.size]);

  const filtered = investors
    .filter(inv => {
      if (!search) return true;
      const s = search.toLowerCase();
      return inv.fullName.toLowerCase().includes(s) || inv.email.toLowerCase().includes(s);
    })
    .sort((a, b) => {
      if (sortKey === 'name') return a.fullName.localeCompare(b.fullName, 'he');
      const ta = investorTotals(a), tb = investorTotals(b);
      return sortKey === 'equity' ? tb.equity - ta.equity : tb.arv - ta.arv;
    });

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: 'var(--bg-base)', overflow: 'hidden' }}>
      {/* Desktop title */}
      <div className="desktop-page-title">
        <div className="subtitle">{investors.length} משקיעים רשומים</div>
        <h1>משקיעים</h1>
      </div>

      {/* Mobile header */}
      <div className="screen-header" style={{ padding: '16px 20px 10px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
        <MGLogo size={36} showWordmark={false} />
        <span style={{ fontSize: 20, fontWeight: 700, color: 'var(--text-primary)' }}>משקיעים</span>
      </div>

      {/* Search */}
      <div style={{ padding: '12px 20px 0', flexShrink: 0 }}>
        <input
          className="mg-input"
          placeholder="חיפוש לפי שם או מייל..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          style={{ fontSize: 14, padding: '10px 14px' }}
        />
      </div>

      {/* Sort + export toolbar */}
      <div style={{
        padding: '10px 20px 12px', display: 'flex', alignItems: 'center', gap: 6,
        flexDirection: 'row-reverse', flexWrap: 'wrap', flexShrink: 0,
      }}>
        <span style={{ fontSize: 11, color: 'var(--text-secondary)' }}>מיון:</span>
        {SORT_OPTIONS.map(opt => (
          <button
            key={opt.key}
            onClick={() => setSortKey(opt.key)}
            className={'chip-filter' + (sortKey === opt.key ? ' active' : '')}
          >
            {opt.label}
          </button>
        ))}
        <div style={{ flex: 1 }} />
        <button
          className="chip-filter"
          onClick={exportCsv}
          disabled={filtered.length === 0}
          style={filtered.length === 0 ? { opacity: 0.5, cursor: 'default' } : undefined}
        >
          ⬇ ייצוא CSV
        </button>
      </div>

      {/* Content */}
      <div ref={scrollContainerRef} style={{ flex: 1, overflowY: 'auto', padding: '0 20px 20px' }}>
        {!hasToken && (
          <div style={{
            background: 'var(--danger-dim)', border: '1px solid var(--danger-border)',
            borderRadius: 'var(--radius-sm)', padding: '12px 14px', fontSize: 12, color: 'var(--danger)', marginBottom: 12,
          }}>
            ⚠️ חסר Monday token — טוען Mock data
          </div>
        )}
        {loading && (
          <div style={{ textAlign: 'center', padding: '40px 0', color: GOLD, fontSize: 13, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
            <span className="mg-spinner" style={{ width: 12, height: 12 }} /> טוען משקיעים...
          </div>
        )}

        {!loading && filtered.length === 0 && (
          <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--text-secondary)', fontSize: 13 }}>
            {search ? 'לא נמצאו תוצאות' : 'אין משקיעים להצגה'}
          </div>
        )}

        <div className="property-grid stagger" style={{ padding: 0 }}>
          {filtered.map(inv => {
            const { arv, equity } = investorTotals(inv);
            const hasPassword = Boolean(inv.password);
            const waUrl = buildWhatsAppInviteUrl(inv);
            const flash = flashIds.has(inv.mondayId);
            return (
              <div
                key={inv.mondayId}
                className={`gold-card interactive${flash ? ' flash-highlight' : ''}`}
                data-flash={flash ? 'true' : undefined}
                style={{ padding: '18px', cursor: 'pointer', display: 'flex', flexDirection: 'column', gap: 14 }}
                onClick={() => navigate('admin-investor-detail', { investorId: inv.mondayId })}
              >
                {/* Header: avatar + name + status */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexDirection: 'row-reverse' }}>
                  <div style={{
                    width: 48, height: 48, borderRadius: '50%',
                    background: 'var(--gold-grad)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 16, fontWeight: 700, color: '#000', flexShrink: 0,
                  }}>{inv.initials}</div>
                  <div style={{ flex: 1, textAlign: 'right', overflow: 'hidden' }}>
                    <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {inv.fullName}
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--text-secondary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {inv.email || '—'}
                    </div>
                  </div>
                  <div style={{
                    fontSize: 9, padding: '3px 8px', borderRadius: 100,
                    background: hasPassword ? 'var(--success-dim)' : 'rgba(255,193,7,0.15)',
                    border: `1px solid ${hasPassword ? 'var(--success-border)' : 'rgba(255,193,7,0.3)'}`,
                    color: hasPassword ? 'var(--success)' : '#FFC107',
                    flexShrink: 0,
                  }}>
                    {hasPassword ? '✓ פעיל' : 'ללא סיסמה'}
                  </div>
                </div>

                {/* Stats row */}
                <div style={{ display: 'flex', gap: 8 }}>
                  <div className="stat-chip">
                    <div className="stat-label">נכסים</div>
                    <div className="stat-value num">{inv.properties.length}</div>
                  </div>
                  <div className="stat-chip">
                    <div className="stat-label">ARV</div>
                    <div className="stat-value num" style={{ color: GOLD }}>{fmtUSD(arv)}</div>
                  </div>
                  <div className="stat-chip">
                    <div className="stat-label">Equity</div>
                    <div className="stat-value num" style={{ color: 'var(--success)' }}>{fmtUSD(equity)}</div>
                  </div>
                </div>

                {/* Quick actions */}
                <div style={{
                  display: 'flex', gap: 6, flexDirection: 'row-reverse',
                  borderTop: '1px solid var(--divider)', paddingTop: 10, marginTop: -4,
                }}>
                  <QuickAction
                    title="צפה כמשקיע"
                    onClick={() => { viewAsInvestor(inv); resetTo('dashboard'); }}
                    gold
                    icon={<><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" /><circle cx="12" cy="12" r="3" /></>}
                  />
                  {inv.email && (
                    <QuickAction
                      title="העתק אימייל"
                      onClick={() => copyToClipboard(inv.email, 'האימייל')}
                      icon={<><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" /><polyline points="22,6 12,13 2,6" /></>}
                    />
                  )}
                  {inv.phone && (
                    <QuickAction
                      title="העתק טלפון"
                      onClick={() => copyToClipboard(inv.phone, 'הטלפון')}
                      icon={<path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07 19.5 19.5 0 01-6-6 19.79 19.79 0 01-3.07-8.67A2 2 0 014.11 2h3a2 2 0 012 1.72 12.84 12.84 0 00.7 2.81 2 2 0 01-.45 2.11L8.09 9.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45 12.84 12.84 0 002.81.7A2 2 0 0122 16.92z" />}
                    />
                  )}
                  {waUrl && (
                    <QuickAction
                      title="שלח הזמנה ב-WhatsApp"
                      onClick={() => window.open(waUrl, '_blank', 'noopener,noreferrer')}
                      icon={<><path d="M21 11.5a8.38 8.38 0 01-.9 3.8 8.5 8.5 0 01-7.6 4.7 8.38 8.38 0 01-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 01-.9-3.8 8.5 8.5 0 014.7-7.6 8.38 8.38 0 013.8-.9h.5a8.48 8.48 0 018 8v.5z" /></>}
                    />
                  )}
                  <QuickAction
                    title="העתק הודעת הזמנה"
                    onClick={() => copyToClipboard(buildInviteMessage(inv), 'הזמנה')}
                    icon={<><rect x="9" y="9" width="13" height="13" rx="2" /><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1" /></>}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
