import { useMemo, useState, useEffect, useRef } from 'react';
import { useNavigation } from '../../../context/NavigationContext';
import { useMondayData } from '../../../context/MondayDataContext';
import { MGLogo } from '../../common/MGLogo';
import { StatusBadge } from '../../common/StatusBadge';
import { fetchMillerGroupProperties, type MondayProperty } from '../../../services/mondayApi';

const GOLD = '#C9A84C';

function parseDate(iso: string): Date | null {
  if (!iso) return null;
  const d = new Date(iso);
  return isNaN(d.getTime()) ? null : d;
}

function daysUntil(iso: string): number | null {
  const d = parseDate(iso);
  if (!d) return null;
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  const tgt = new Date(d);
  tgt.setHours(0, 0, 0, 0);
  return Math.round((tgt.getTime() - now.getTime()) / 86400000);
}

function fmtHe(iso: string): string {
  const d = parseDate(iso);
  if (!d) return '';
  const months = ['ינו׳','פבר׳','מרץ','אפר׳','מאי','יוני','יולי','אוג׳','ספט׳','אוק׳','נוב׳','דצמ׳'];
  return `${d.getDate()} ${months[d.getMonth()]} ${d.getFullYear()}`;
}

const SECTIONS: { key: string; label: string; filter: (d: number | null) => boolean }[] = [
  { key: 'today',     label: 'היום',          filter: d => d === 0 },
  { key: 'week',      label: 'השבוע',         filter: d => d !== null && d > 0 && d <= 7 },
  { key: 'month',     label: 'בחודש הקרוב',   filter: d => d !== null && d > 7 && d <= 30 },
  { key: 'later',     label: 'מעבר לחודש',    filter: d => d !== null && d > 30 },
  { key: 'past',      label: 'עבר',           filter: d => d !== null && d < 0 },
];

export function AdminClosingsScreen() {
  const { navigate, navState } = useNavigation();
  const highlightMode = navState.highlightClosingMode;
  const { properties } = useMondayData();
  const [mgProps, setMgProps] = useState<MondayProperty[]>([]);
  const [loadingMg, setLoadingMg] = useState(false);
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  // Also fetch MG deals so closings include both
  useEffect(() => {
    let cancelled = false;
    setLoadingMg(true);
    fetchMillerGroupProperties()
      .then(p => { if (!cancelled) setMgProps(p); })
      .catch(() => { if (!cancelled) setMgProps([]); })
      .finally(() => { if (!cancelled) setLoadingMg(false); });
    return () => { cancelled = true; };
  }, []);

  const allWithDates = useMemo(() => {
    const combined = [
      ...properties.map(p => ({ ...p, _isMg: false })),
      ...mgProps.map(p => ({ ...p, _isMg: true })),
    ];
    return combined
      .filter(p => p.closingDate)
      .map(p => ({ p, days: daysUntil(p.closingDate) }))
      .sort((a, b) => {
        // Sort upcoming ascending, then past descending
        if (a.days === null) return 1;
        if (b.days === null) return -1;
        if (a.days >= 0 && b.days >= 0) return a.days - b.days;
        if (a.days < 0 && b.days < 0)  return b.days - a.days;
        return a.days >= 0 ? -1 : 1;
      });
  }, [properties, mgProps]);

  // Scroll to first highlighted item after the list renders
  useEffect(() => {
    if (!highlightMode || loadingMg) return;
    const timer = setTimeout(() => {
      const container = scrollContainerRef.current;
      if (!container) return;
      const first = container.querySelector('[data-flash="true"]') as HTMLElement | null;
      first?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 350);
    return () => clearTimeout(timer);
  }, [highlightMode, loadingMg, allWithDates.length]);

  const STALE_STATUSES = ['על חוזה', 'בשלבי הלוואה וחתימות'];
  const isFlashTarget = (days: number | null, status?: string): boolean => {
    if (!highlightMode || days === null) return false;
    if (highlightMode === 'week')    return days >= 0 && days <= 7;
    if (highlightMode === 'overdue') return days < 0 && STALE_STATUSES.includes(status ?? '');
    return false;
  };

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: 'var(--bg-base)', overflow: 'hidden' }}>
      <div className="desktop-page-title">
        <div className="subtitle">{allWithDates.length} סגירות מתוכננות</div>
        <h1>יומן סגירות</h1>
      </div>

      <div className="screen-header" style={{ padding: '16px 20px 10px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
        <MGLogo size={36} showWordmark={false} />
        <span style={{ fontSize: 20, fontWeight: 700, color: 'var(--text-primary)' }}>יומן סגירות</span>
      </div>

      <div ref={scrollContainerRef} style={{ flex: 1, overflowY: 'auto', padding: '16px 20px 20px', display: 'flex', flexDirection: 'column', gap: 20 }}>
        {loadingMg && (
          <div style={{ textAlign: 'center', color: GOLD, fontSize: 12 }}>⏳ טוען עסקאות Miller Group...</div>
        )}

        {allWithDates.length === 0 && !loadingMg && (
          <div className="gold-card" style={{ padding: 30, textAlign: 'center', color: 'var(--text-secondary)', fontSize: 13 }}>
            אין סגירות רשומות
          </div>
        )}

        {SECTIONS.map(section => {
          const items = allWithDates.filter(x => section.filter(x.days));
          if (items.length === 0) return null;
          const urgent = section.key === 'today' || section.key === 'week';
          return (
            <div key={section.key}>
              <div style={{
                display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10, direction: 'rtl',
              }}>
                <span style={{
                  fontSize: 13, fontWeight: 700,
                  color: urgent ? '#ff6b6b' : GOLD,
                  whiteSpace: 'nowrap',
                }}>{section.label}</span>
                <div style={{ flex: 1, height: 1, background: `${urgent ? '#ff6b6b' : GOLD}33` }} />
                <span style={{ fontSize: 11, color: 'var(--text-secondary)' }}>{items.length}</span>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {items.map(({ p, days }: any) => {
                  const color = days === null ? 'var(--text-secondary)' : days === 0 ? '#ff6b6b' : days < 0 ? 'var(--text-muted)' : days <= 7 ? '#ff9800' : GOLD;
                  const flash = isFlashTarget(days, p.status);
                  return (
                    <div
                      key={p.mondayId}
                      className={`gold-card interactive${flash ? ' flash-highlight' : ''}`}
                      data-flash={flash ? 'true' : undefined}
                      style={{
                        padding: '14px 16px', cursor: 'pointer',
                        display: 'flex', alignItems: 'center', gap: 12, flexDirection: 'row-reverse',
                      }}
                      onClick={() => navigate('property-detail', { propertyId: p.mondayId })}
                    >
                      <div style={{
                        minWidth: 76, textAlign: 'center',
                        padding: '8px 6px', borderRadius: 8,
                        background: `${color === GOLD ? GOLD : color}15`,
                        border: `1px solid ${color}44`,
                      }}>
                        <div style={{ fontSize: 11, fontWeight: 700, color, lineHeight: 1.3, textAlign: 'center' }}>
                          {days === null
                            ? '—'
                            : days === 0
                            ? 'היום'
                            : days > 0
                            ? `בעוד ${days} ימים`
                            : `עברו ${Math.abs(days)} ימים`}
                        </div>
                      </div>
                      <div style={{ flex: 1, textAlign: 'right', overflow: 'hidden' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, justifyContent: 'flex-end', marginBottom: 4 }}>
                          {p._isMg && (
                            <span style={{ fontSize: 9, fontWeight: 700, color: '#fff', background: GOLD, padding: '2px 6px', borderRadius: 4 }}>MG</span>
                          )}
                          <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            {p.address}
                          </span>
                        </div>
                        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', alignItems: 'center', flexWrap: 'wrap' }}>
                          <StatusBadge type={p.statusType}>{p.status}</StatusBadge>
                          <span style={{ fontSize: 11, color: 'var(--text-secondary)' }}>{p.city}</span>
                          {p.investorName && <span style={{ fontSize: 11, color: GOLD }}>{p.investorName}</span>}
                          <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{fmtHe(p.closingDate)}</span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
