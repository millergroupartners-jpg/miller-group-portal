import { useNavigation } from '../../../context/NavigationContext';
import { useUser } from '../../../context/UserContext';
import { useMondayData } from '../../../context/MondayDataContext';
import { MGLogo } from '../../common/MGLogo';

const GOLD = '#C9A84C';

/** Ordered pipeline stages (aligns with progressFromStatus in mondayApi) */
const PIPELINE_STAGES = [
  { label: 'על חוזה',               color: '#64B5F6' },
  { label: 'בשלבי הלוואה וחתימות',  color: '#9575CD' },
  { label: 'בשיפוץ',                color: GOLD },
  { label: 'מעבר לניהול',           color: '#4DB6AC' },
  { label: 'מרקט',                  color: '#81C784' },
  { label: 'מושכר',                 color: '#4CAF50' },
] as const;

function fmtUSD(n: number): string {
  if (!n) return '$0';
  if (n >= 1_000_000) return '$' + (n / 1_000_000).toFixed(2) + 'M';
  if (n >= 1_000)     return '$' + Math.round(n / 1000) + 'K';
  return '$' + n.toLocaleString('en-US');
}

export function AdminDashboardScreen() {
  const { navigate } = useNavigation();
  const { currentUser } = useUser();
  const { investors, properties, loading, hasToken } = useMondayData();

  // Aggregate metrics
  const totalAllIn   = properties.reduce((s, p) => s + p.allIn, 0);
  const totalArv     = properties.reduce((s, p) => s + p.arvRaw, 0);
  const totalEquity  = totalArv - totalAllIn;
  const roi          = totalAllIn > 0 ? ((totalEquity / totalAllIn) * 100).toFixed(1) + '%' : '—';

  // Pipeline breakdown
  const stageCounts = PIPELINE_STAGES.map(stage => ({
    ...stage,
    count: properties.filter(p => p.status === stage.label).length,
  }));

  // Top investors by portfolio size (ARV)
  const topInvestors = [...investors]
    .sort((a, b) => {
      const aArv = a.properties.reduce((s, p) => s + p.arvRaw, 0);
      const bArv = b.properties.reduce((s, p) => s + p.arvRaw, 0);
      return bArv - aArv;
    })
    .slice(0, 5);

  // Next closing (earliest future date)
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const upcomingClosings = properties
    .filter(p => p.closingDate)
    .map(p => ({ p, d: new Date(p.closingDate) }))
    .filter(({ d }) => !isNaN(d.getTime()) && d.getTime() >= today.getTime())
    .sort((a, b) => a.d.getTime() - b.d.getTime());
  const nextClosing = upcomingClosings[0];
  const daysToNext  = nextClosing ? Math.round((nextClosing.d.getTime() - today.getTime()) / 86400000) : null;

  // Health alerts
  const investorsWithoutPassword = investors.filter(i => !i.password && i.email);
  const closingsThisWeek = upcomingClosings.filter(x => {
    const d = Math.round((x.d.getTime() - today.getTime()) / 86400000);
    return d <= 7;
  }).length;

  const STALE_STATUSES = ['על חוזה', 'בשלבי הלוואה וחתימות'];
  const overdueProperties = properties.filter(p => {
    if (!p.closingDate) return false;
    const d = new Date(p.closingDate);
    if (isNaN(d.getTime())) return false;
    d.setHours(0, 0, 0, 0);
    return d < today && STALE_STATUSES.includes(p.status);
  });

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: 'var(--bg-base)', overflow: 'hidden' }}>
      {/* Desktop title */}
      <div className="desktop-page-title">
        <div className="subtitle">ניהול Miller Group</div>
        <h1>לוח בקרה</h1>
      </div>

      {/* Mobile header */}
      <div className="screen-header" style={{ padding: '16px 20px 10px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
        <MGLogo size={36} showWordmark={false} />
        <div>
          <div style={{ fontSize: 11, color: 'var(--text-secondary)', textAlign: 'right' }}>מערכת ניהול</div>
          <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)', textAlign: 'right' }}>{currentUser?.fullNameHe}</div>
        </div>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: '16px 20px 20px', display: 'flex', flexDirection: 'column', gap: 18 }}>

        {!hasToken && (
          <div style={{
            background: 'rgba(255,77,77,0.1)', border: '1px solid rgba(255,77,77,0.3)',
            borderRadius: 10, padding: '12px 14px', fontSize: 12, color: '#ff6b6b',
          }}>
            ⚠️ VITE_MONDAY_API_TOKEN חסר — לא ניתן לטעון נתונים חיים
          </div>
        )}

        {loading && (
          <div style={{ fontSize: 12, color: GOLD, textAlign: 'center' }}>⏳ טוען נתונים מ-Monday...</div>
        )}

        {/* KPI row */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 10 }}>
          {[
            { label: 'AUM',           value: fmtUSD(totalArv),     color: GOLD },
            { label: 'Equity כולל',   value: fmtUSD(totalEquity),  color: '#4CAF50' },
            { label: 'ROI ממוצע',     value: roi,                  color: '#4CAF50' },
            { label: 'משקיעים',       value: String(investors.length),    color: 'var(--text-primary)' },
            { label: 'נכסים פעילים',  value: String(properties.length),   color: 'var(--text-primary)' },
          ].map(s => (
            <div key={s.label} className="gold-card" style={{ padding: '16px 14px', textAlign: 'center' }}>
              <div style={{ fontSize: 22, fontWeight: 700, color: s.color, marginBottom: 3 }}>{s.value}</div>
              <div style={{ fontSize: 10, color: 'var(--text-secondary)', letterSpacing: 0.5 }}>{s.label}</div>
            </div>
          ))}
        </div>

        {/* Health alerts */}
        {(investorsWithoutPassword.length > 0 || closingsThisWeek > 0 || overdueProperties.length > 0) && (
          <div className="gold-card" style={{ padding: '14px 18px', borderRight: '3px solid #ff9800' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10, flexDirection: 'row-reverse' }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#ff9800" strokeWidth="2" strokeLinecap="round">
                <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
                <line x1="12" y1="9" x2="12" y2="13" />
                <line x1="12" y1="17" x2="12.01" y2="17" />
              </svg>
              <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)' }}>דורש טיפול</span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {closingsThisWeek > 0 && (
                <div
                  className="interactive"
                  onClick={() => navigate('admin-closings', { highlightClosingMode: 'week' })}
                  style={{
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                    padding: '8px 12px', background: 'rgba(255,152,0,0.08)', borderRadius: 8,
                    cursor: 'pointer', fontSize: 12, color: 'var(--text-primary)',
                  }}
                >
                  <span style={{ color: '#ff9800', fontWeight: 700 }}>{closingsThisWeek}</span>
                  <span>סגירות השבוע →</span>
                </div>
              )}
              {investorsWithoutPassword.length > 0 && (
                <div
                  className="interactive"
                  onClick={() => navigate('admin-investors')}
                  style={{
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                    padding: '8px 12px', background: 'rgba(255,152,0,0.08)', borderRadius: 8,
                    cursor: 'pointer', fontSize: 12, color: 'var(--text-primary)',
                  }}
                >
                  <span style={{ color: '#ff9800', fontWeight: 700 }}>{investorsWithoutPassword.length}</span>
                  <span>משקיעים ללא סיסמת פורטל →</span>
                </div>
              )}
              {overdueProperties.length > 0 && (
                <div
                  className="interactive"
                  onClick={() => navigate('admin-closings', { highlightClosingMode: 'overdue' })}
                  style={{
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                    padding: '8px 12px', background: 'rgba(255,77,77,0.08)', borderRadius: 8,
                    cursor: 'pointer', fontSize: 12, color: 'var(--text-primary)',
                  }}
                >
                  <span style={{ color: '#ff4d4d', fontWeight: 700 }}>{overdueProperties.length}</span>
                  <span>נכסים שעברו תאריך סגירה ועדיין בחוזה / הלוואה →</span>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Next closing */}
        {nextClosing && (
          <div
            className="gold-card"
            onClick={() => navigate('property-detail', { propertyId: nextClosing.p.mondayId })}
            style={{
              padding: '16px 18px', cursor: 'pointer',
              background: `linear-gradient(90deg, ${GOLD}08, transparent)`,
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
              <button
                onClick={e => { e.stopPropagation(); navigate('admin-closings'); }}
                style={{ background: 'none', border: 'none', color: GOLD, fontSize: 12, cursor: 'pointer' }}
              >יומן מלא →</button>
              <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)' }}>סגירה הבאה</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 14, flexDirection: 'row-reverse' }}>
              <div style={{
                width: 64, minWidth: 64, textAlign: 'center',
                padding: '10px 6px', borderRadius: 10,
                background: `${GOLD}15`, border: `1px solid ${GOLD}44`,
              }}>
                <div style={{ fontSize: 22, fontWeight: 800, color: GOLD, lineHeight: 1 }}>
                  {daysToNext === 0 ? 'היום' : daysToNext}
                </div>
                {daysToNext !== 0 && (
                  <div style={{ fontSize: 9, color: 'var(--text-secondary)', marginTop: 2 }}>ימים</div>
                )}
              </div>
              <div style={{ flex: 1, textAlign: 'right' }}>
                <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 3 }}>
                  {nextClosing.p.address}
                </div>
                <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>
                  {nextClosing.p.city}
                  {nextClosing.p.investorName && ` · ${nextClosing.p.investorName}`}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Pipeline breakdown */}
        <div className="gold-card" style={{ padding: '16px 18px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
            <span style={{ fontSize: 11, color: 'var(--text-secondary)' }}>{properties.length} נכסים</span>
            <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)' }}>פייפליין</span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {stageCounts.map(s => {
              const pct = properties.length > 0 ? (s.count / properties.length) * 100 : 0;
              return (
                <div key={s.label}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4, fontSize: 11 }}>
                    <span style={{ color: s.color, fontWeight: 700 }}>{s.count}</span>
                    <span style={{ color: 'var(--text-secondary)' }}>{s.label}</span>
                  </div>
                  <div style={{ height: 6, background: 'var(--progress-track)', borderRadius: 100, overflow: 'hidden' }}>
                    <div style={{ width: `${pct}%`, height: '100%', background: s.color, borderRadius: 100, transition: 'width 0.8s ease' }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Top investors */}
        <div className="gold-card" style={{ padding: '16px 18px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <button
              onClick={() => navigate('admin-investors')}
              style={{ background: 'none', border: 'none', color: GOLD, fontSize: 12, cursor: 'pointer' }}
            >הכל →</button>
            <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)' }}>Top משקיעים</span>
          </div>
          {topInvestors.length === 0 ? (
            <div style={{ fontSize: 12, color: 'var(--text-secondary)', textAlign: 'center', padding: '20px 0' }}>
              אין משקיעים להצגה
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              {topInvestors.map((inv, i) => {
                const arv = inv.properties.reduce((s, p) => s + p.arvRaw, 0);
                return (
                  <div
                    key={inv.mondayId}
                    className="interactive"
                    onClick={() => navigate('admin-investor-detail', { investorId: inv.mondayId })}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 12,
                      padding: '10px 0', cursor: 'pointer',
                      borderBottom: i < topInvestors.length - 1 ? '1px solid var(--divider)' : 'none',
                      flexDirection: 'row-reverse',
                    }}
                  >
                    <div style={{
                      width: 36, height: 36, borderRadius: '50%',
                      background: `${GOLD}22`, border: `1px solid ${GOLD}44`,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: 13, fontWeight: 700, color: GOLD, flexShrink: 0,
                    }}>{inv.initials}</div>
                    <div style={{ flex: 1, textAlign: 'right' }}>
                      <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>{inv.fullName}</div>
                      <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>{inv.properties.length} נכסים</div>
                    </div>
                    <div style={{ textAlign: 'left' }}>
                      <div style={{ fontSize: 13, fontWeight: 700, color: GOLD }}>{fmtUSD(arv)}</div>
                      <div style={{ fontSize: 10, color: 'var(--text-secondary)' }}>ARV</div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Open Monday board button */}
        <a
          href="https://real-estate-usa-eden.monday.com/boards/1997938102"
          target="_blank" rel="noopener noreferrer"
          style={{ textDecoration: 'none' }}
        >
          <div className="gold-card" style={{
            padding: '14px', display: 'flex', alignItems: 'center', justifyContent: 'center',
            gap: 10, border: `1px solid ${GOLD}44`, background: `${GOLD}08`,
          }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={GOLD} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6" />
              <polyline points="15 3 21 3 21 9" />
              <line x1="10" y1="14" x2="21" y2="3" />
            </svg>
            <span style={{ fontSize: 13, fontWeight: 600, color: GOLD }}>פתח בלוח Monday להוספה/עריכה</span>
          </div>
        </a>

      </div>
    </div>
  );
}
