import { useNavigation } from '../../../context/NavigationContext';
import { useUser } from '../../../context/UserContext';
import { useMondayData } from '../../../context/MondayDataContext';
import { MGLogo } from '../../common/MGLogo';
import { GoldDivider } from '../../common/GoldDivider';
import { AdminTabBar } from './AdminTabBar';
import { INVESTORS } from '../../../data/investors'; // fallback

const GOLD = '#C9A84C';

function StatCard({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="gold-card" style={{ padding: '14px 12px', flex: 1, textAlign: 'center' }}>
      <div style={{ fontSize: 20, fontWeight: 800, color: GOLD }}>{value}</div>
      <div style={{ fontSize: 10, color: 'var(--text-secondary)', marginTop: 3 }}>{label}</div>
      {sub && <div style={{ fontSize: 9, color: 'var(--text-muted)', marginTop: 2 }}>{sub}</div>}
    </div>
  );
}

export function AdminDashboardScreen() {
  const { navigate } = useNavigation();
  const { currentUser } = useUser();
  const { properties, investors, loading, error, hasToken } = useMondayData();

  // Use live Monday data when available, else fall back to mock data
  const liveMode = hasToken && (properties.length > 0 || loading);
  const allProps   = liveMode ? properties : [];
  const allInvestors = liveMode ? investors : INVESTORS;

  const totalAUM = liveMode
    ? '$' + allProps.reduce((s, p) => s + p.allIn, 0).toLocaleString('en-US')
    : '$1,438,000';

  const totalProperties  = liveMode ? allProps.length : 8;
  const activeInvestors  = allInvestors.length;
  const rented  = liveMode ? allProps.filter(p => p.statusType === 'green').length : 3;
  const inReno  = liveMode ? allProps.filter(p => p.statusType === 'gold').length  : 3;
  const inReview= liveMode ? allProps.filter(p => p.statusType === 'blue').length  : 2;

  const safeTotal = totalProperties || 1;

  // Yield across all properties
  const avgYield = (() => {
    if (!liveMode) return '9.8%';
    const yields = allProps
      .filter(p => p.rentYield !== '—')
      .map(p => parseFloat(p.rentYield));
    if (!yields.length) return '—';
    return (yields.reduce((a, b) => a + b, 0) / yields.length).toFixed(1) + '%';
  })();

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: 'var(--bg-base)', overflow: 'hidden' }}>
      {/* Header */}
      <div style={{ padding: '16px 20px 10px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
        <MGLogo size={36} showWordmark={false} />
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>פאנל ניהול</div>
          <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)' }}>{currentUser?.fullNameHe}</div>
        </div>
      </div>
      <GoldDivider />

      <div style={{ flex: 1, overflowY: 'auto', padding: '14px 20px' }}>

        {/* Loading / error banner */}
        {loading && (
          <div style={{ textAlign: 'center', padding: '10px 0', color: 'var(--text-secondary)', fontSize: 12, marginBottom: 12 }}>
            ⏳ טוען נתונים מ-Monday...
          </div>
        )}
        {error && (
          <div style={{ background: 'rgba(255,59,48,0.12)', borderRadius: 10, padding: '10px 14px', marginBottom: 12, fontSize: 12, color: '#ff3b30', textAlign: 'right' }}>
            {error}
          </div>
        )}
        {!hasToken && (
          <div style={{ background: 'rgba(201,168,76,0.12)', borderRadius: 10, padding: '10px 14px', marginBottom: 12, fontSize: 12, color: GOLD, textAlign: 'right' }}>
            הוסף <strong>VITE_MONDAY_API_TOKEN</strong> לקובץ .env לחיבור ל-Monday
          </div>
        )}

        {/* AUM banner */}
        <div className="gold-card" style={{ padding: '16px', marginBottom: 14, textAlign: 'center' }}>
          <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginBottom: 4 }}>סך נכסים תחת ניהול (AUM)</div>
          <div style={{ fontSize: 32, fontWeight: 800, color: GOLD, letterSpacing: -1 }}>{totalAUM}</div>
          <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 4 }}>
            תשואה ממוצעת כלל-תיקית: <span style={{ color: GOLD, fontWeight: 600 }}>{avgYield}</span>
          </div>
        </div>

        {/* Stats row */}
        <div style={{ display: 'flex', gap: 10, marginBottom: 14 }}>
          <StatCard label="נכסים" value={String(totalProperties)} />
          <StatCard label="משקיעים" value={String(activeInvestors)} />
          <StatCard label="מושכרים" value={String(rented)} sub={`${Math.round(rented / safeTotal * 100)}%`} />
        </div>

        {/* Portfolio status bars */}
        <div className="gold-card" style={{ padding: '14px', marginBottom: 14 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)', textAlign: 'right', marginBottom: 12 }}>סטטוס תיק</div>
          {[
            { label: 'מושכר',  count: rented,   color: '#34c759', pct: Math.round(rented   / safeTotal * 100) },
            { label: 'בשיפוץ', count: inReno,   color: GOLD,      pct: Math.round(inReno   / safeTotal * 100) },
            { label: 'בתהליך', count: inReview, color: '#0a84ff', pct: Math.round(inReview / safeTotal * 100) },
          ].map(s => (
            <div key={s.label} style={{ marginBottom: 10 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5 }}>
                <span style={{ fontSize: 11, color: s.color, fontWeight: 600 }}>{s.count} נכסים · {s.pct}%</span>
                <span style={{ fontSize: 11, color: 'var(--text-secondary)' }}>{s.label}</span>
              </div>
              <div className="progress-track" style={{ height: 5 }}>
                <div className="progress-fill" style={{ width: `${s.pct}%`, background: s.color }} />
              </div>
            </div>
          ))}
        </div>

        {/* Quick actions */}
        <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-secondary)', textAlign: 'right', marginBottom: 8 }}>פעולות מהירות</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 14 }}>
          {[
            { label: 'הוסף משקיע',    icon: '👤', screen: 'admin-add-investor' as const, color: 'rgba(201,168,76,0.15)' },
            { label: 'הוסף נכס',      icon: '🏠', screen: 'admin-add-property' as const, color: 'rgba(52,199,89,0.12)' },
            { label: 'כל המשקיעים',   icon: '📋', screen: 'admin-investors' as const,    color: 'rgba(10,132,255,0.12)' },
            { label: 'דוח כספי',      icon: '📊', screen: null as any,                   color: 'rgba(255,149,0,0.12)' },
          ].map(a => (
            <div
              key={a.label}
              onClick={() => a.screen && navigate(a.screen)}
              className="gold-card"
              style={{ padding: '14px 10px', textAlign: 'center', cursor: a.screen ? 'pointer' : 'default', background: a.color }}
            >
              <div style={{ fontSize: 22, marginBottom: 6 }}>{a.icon}</div>
              <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)' }}>{a.label}</div>
            </div>
          ))}
        </div>

        {/* Recent investors */}
        <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-secondary)', textAlign: 'right', marginBottom: 8 }}>
          משקיעים אחרונים
          {liveMode && <span style={{ color: GOLD, marginRight: 6, fontSize: 10 }}>● Live</span>}
        </div>
        <div className="gold-card" style={{ overflow: 'hidden' }}>
          {(liveMode ? investors.slice(0, 4) : INVESTORS.slice(0, 3)).map((inv, i) => {
            const isMonday = 'mondayId' in inv;
            const id       = isMonday ? (inv as any).mondayId : (inv as any).id;
            const name     = isMonday ? (inv as any).fullName : (inv as any).fullNameHe;
            const initials = inv.initials;
            const propCount = isMonday ? (inv as any).properties.length : (inv as any).propertyIds.length;
            const portfolio = inv.portfolioValue;
            const last      = liveMode ? i < investors.slice(0,4).length - 1 : i < 2;
            return (
              <div
                key={id}
                onClick={() => navigate('admin-investor-detail', { investorId: id })}
                style={{
                  display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px',
                  borderBottom: last ? '1px solid var(--divider)' : 'none',
                  cursor: 'pointer', flexDirection: 'row-reverse',
                }}
                onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.background = 'var(--bg-surface-hover)'; }}
                onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.background = 'transparent'; }}
              >
                <div style={{
                  width: 38, height: 38, borderRadius: '50%',
                  background: 'linear-gradient(135deg, #C9A84C, #8a6a28)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                }}>
                  <span style={{ fontSize: 15, fontWeight: 700, color: '#000' }}>{initials}</span>
                </div>
                <div style={{ flex: 1, textAlign: 'right' }}>
                  <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>{name}</div>
                  <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>{propCount} נכסים · {portfolio}</div>
                </div>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" strokeWidth="2" strokeLinecap="round">
                  <path d="M9 18l-6-6 6-6" />
                </svg>
              </div>
            );
          })}
        </div>

      </div>

      <AdminTabBar active="admin-dashboard" />
    </div>
  );
}
