import { useState, useMemo, useEffect, useRef } from 'react';
import { useNavigation } from '../../../context/NavigationContext';
import { useMondayData } from '../../../context/MondayDataContext';
import { MGLogo } from '../../common/MGLogo';

const GOLD = '#C9A84C';

function fmtUSD(n: number): string {
  if (!n) return '—';
  if (n >= 1_000_000) return '$' + (n / 1_000_000).toFixed(2) + 'M';
  if (n >= 1_000)     return '$' + Math.round(n / 1000) + 'K';
  return '$' + n.toLocaleString('en-US');
}

export function InvestorsListScreen() {
  const { navigate, navState } = useNavigation();
  const highlightMode = navState.highlightInvestorMode;
  const { investors, loading, hasToken } = useMondayData();
  const [search, setSearch] = useState('');
  const scrollContainerRef = useRef<HTMLDivElement>(null);

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
      const aArv = a.properties.reduce((s, p) => s + p.arvRaw, 0);
      const bArv = b.properties.reduce((s, p) => s + p.arvRaw, 0);
      return bArv - aArv;
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
      <div style={{ padding: '12px 20px', flexShrink: 0 }}>
        <input
          className="mg-input"
          placeholder="חיפוש לפי שם או מייל..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          style={{ fontSize: 14, padding: '10px 14px' }}
        />
      </div>

      {/* Content */}
      <div ref={scrollContainerRef} style={{ flex: 1, overflowY: 'auto', padding: '0 20px 20px' }}>
        {!hasToken && (
          <div style={{
            background: 'rgba(255,77,77,0.1)', border: '1px solid rgba(255,77,77,0.3)',
            borderRadius: 10, padding: '12px 14px', fontSize: 12, color: '#ff6b6b', marginBottom: 12,
          }}>
            ⚠️ חסר Monday token — טוען Mock data
          </div>
        )}
        {loading && (
          <div style={{ textAlign: 'center', padding: '40px 0', color: GOLD, fontSize: 13 }}>⏳ טוען משקיעים...</div>
        )}

        {!loading && filtered.length === 0 && (
          <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--text-secondary)', fontSize: 13 }}>
            {search ? 'לא נמצאו תוצאות' : 'אין משקיעים להצגה'}
          </div>
        )}

        <div className="property-grid" style={{ padding: 0 }}>
          {filtered.map(inv => {
            const arv    = inv.properties.reduce((s, p) => s + p.arvRaw, 0);
            const allIn  = inv.properties.reduce((s, p) => s + p.allIn, 0);
            const equity = arv - allIn;
            const hasPassword = Boolean(inv.password);
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
                    background: 'linear-gradient(135deg, #C9A84C, #8a6a28)',
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
                    background: hasPassword ? 'rgba(76,175,80,0.15)' : 'rgba(255,193,7,0.15)',
                    border: `1px solid ${hasPassword ? 'rgba(76,175,80,0.3)' : 'rgba(255,193,7,0.3)'}`,
                    color: hasPassword ? '#4CAF50' : '#FFC107',
                    flexShrink: 0,
                  }}>
                    {hasPassword ? '✓ פעיל' : 'ללא סיסמה'}
                  </div>
                </div>

                {/* Stats row */}
                <div style={{ display: 'flex', gap: 8 }}>
                  <div style={{ background: 'var(--bg-chip)', borderRadius: 10, padding: '8px 10px', flex: 1 }}>
                    <div style={{ fontSize: 9, color: 'var(--text-secondary)', marginBottom: 2 }}>נכסים</div>
                    <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)' }}>{inv.properties.length}</div>
                  </div>
                  <div style={{ background: 'var(--bg-chip)', borderRadius: 10, padding: '8px 10px', flex: 1 }}>
                    <div style={{ fontSize: 9, color: 'var(--text-secondary)', marginBottom: 2 }}>ARV</div>
                    <div style={{ fontSize: 13, fontWeight: 700, color: GOLD }}>{fmtUSD(arv)}</div>
                  </div>
                  <div style={{ background: 'var(--bg-chip)', borderRadius: 10, padding: '8px 10px', flex: 1 }}>
                    <div style={{ fontSize: 9, color: 'var(--text-secondary)', marginBottom: 2 }}>Equity</div>
                    <div style={{ fontSize: 13, fontWeight: 700, color: '#4CAF50' }}>{fmtUSD(equity)}</div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
