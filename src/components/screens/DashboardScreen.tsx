import { useNavigation } from '../../context/NavigationContext';
import { MGLogo } from '../common/MGLogo';
import { StatusBadge } from '../common/StatusBadge';
import { ProgressBar } from '../common/ProgressBar';
import { PropPhoto } from '../common/PropPhoto';
import { PROPERTIES } from '../../data/properties';
import { MOCK_USER } from '../../data/user';
import { useUser } from '../../context/UserContext';
import { useMondayData } from '../../context/MondayDataContext';
import { useCCThumbnail } from '../../hooks/useCCThumbnail';
import type { MondayProperty } from '../../services/mondayApi';
import type { Property } from '../../types';

const GOLD = '#C9A84C';

// ── Inner card component so useCCThumbnail can be called per-property ──
function MondayPropertyCard({ p, i, onPress }: { p: MondayProperty; i: number; onPress: () => void }) {
  const thumb = useCCThumbnail(p.address);
  return (
    <div className="gold-card" style={{ cursor: 'pointer' }} onClick={onPress}>
      <div style={{ position: 'relative' }}>
        <PropPhoto index={i} heightRatio={48} photoUrl={thumb} />
        <div style={{
          position: 'absolute', bottom: 0, left: 0, right: 0,
          background: 'linear-gradient(transparent, rgba(0,0,0,0.75))',
          padding: '18px 12px 10px',
        }}>
          <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between' }}>
            <StatusBadge type={p.statusType}>{p.status}</StatusBadge>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: '#fff', lineHeight: 1.3 }}>{p.address}</div>
              <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.65)', marginTop: 2 }}>{p.city}</div>
            </div>
          </div>
        </div>
      </div>
      <div style={{ padding: '10px 14px 16px', display: 'flex', flexDirection: 'column', gap: 8 }}>
        <div style={{ display: 'flex', gap: 8 }}>
          <div style={{ background: 'var(--bg-chip)', borderRadius: 10, padding: '8px 12px', flex: 1 }}>
            <div style={{ fontSize: 10, color: 'var(--text-secondary)', marginBottom: 3 }}>מחיר קנייה</div>
            <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)' }}>{p.purchasePrice}</div>
          </div>
          <div style={{ background: 'var(--bg-chip)', borderRadius: 10, padding: '8px 12px', flex: 1 }}>
            <div style={{ fontSize: 10, color: 'var(--text-secondary)', marginBottom: 3 }}>ARV</div>
            <div style={{ fontSize: 13, fontWeight: 700, color: GOLD }}>{p.arv}</div>
          </div>
          <div style={{ background: 'var(--bg-chip)', borderRadius: 10, padding: '8px 12px', flex: 1 }}>
            <div style={{ fontSize: 10, color: 'var(--text-secondary)', marginBottom: 3 }}>Equity</div>
            <div style={{ fontSize: 13, fontWeight: 700, color: '#4CAF50' }}>
              {p.arvRaw > 0 && p.allIn > 0 ? '$' + (p.arvRaw - p.allIn).toLocaleString('en-US') : '—'}
            </div>
          </div>
        </div>
        {p.statusType !== 'blue' && (
          <div style={{ marginTop: 2 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
              <span style={{ fontSize: 10, color: GOLD, fontWeight: 600 }}>{p.progress}%</span>
              <span style={{ fontSize: 10, color: 'var(--text-secondary)' }}>התקדמות</span>
            </div>
            <ProgressBar target={p.progress} height={8} />
          </div>
        )}
      </div>
    </div>
  );
}

export function DashboardScreen() {
  const { navigate } = useNavigation();
  const { currentUser } = useUser();
  const { investors: mondayInvestors } = useMondayData();
  const user = currentUser ?? MOCK_USER;

  // If logged in as a Monday investor, show their live properties
  const mondayInvestor = user.mondayInvestorId
    ? mondayInvestors.find(inv => inv.mondayId === user.mondayInvestorId)
    : null;

  const isMondayMode = Boolean(mondayInvestor);
  const mondayProps: MondayProperty[] = mondayInvestor?.properties ?? [];
  const staticProps: Property[] = isMondayMode ? [] : PROPERTIES;

  const propCount   = isMondayMode ? mondayProps.length : staticProps.length;
  const portfolio   = mondayInvestor?.portfolioValue ?? '$575K';
  const avgYield    = mondayInvestor?.avgYield       ?? '10.5%';

  // Monday-mode extras
  const totalAllIn  = mondayInvestor?.totalAllIn ?? 0;
  const totalArv    = mondayProps.reduce((s, p) => s + p.arvRaw, 0);
  const roi         = (totalAllIn > 0 && totalArv > 0)
    ? (((totalArv - totalAllIn) / totalAllIn) * 100).toFixed(1) + '%'
    : '—';
  const equity      = (totalArv > 0 && totalAllIn > 0)
    ? '$' + (totalArv - totalAllIn).toLocaleString('en-US')
    : '—';

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: 'var(--bg-base)', overflow: 'hidden' }}>
      {/* Desktop title */}
      <div className="desktop-page-title">
        <div>
          <div className="subtitle">שלום, {user.fullNameHe}</div>
        </div>
        <h1>הנכסים שלי</h1>
      </div>

      {/* Header */}
      <div className="screen-header" style={{ padding: '16px 20px 10px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
        <MGLogo size={36} showWordmark={false} />
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div>
            <div style={{ fontSize: 11, color: 'var(--text-secondary)', textAlign: 'right' }}>שלום,</div>
            <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)', textAlign: 'right' }}>{user.fullNameHe}</div>
          </div>
          <div style={{
            width: 36, height: 36, borderRadius: '50%',
            background: 'linear-gradient(135deg, #C9A84C, #8a6a28)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
          }}>
            <span style={{ fontSize: 14, fontWeight: 700, color: '#000' }}>{user.initials}</span>
          </div>
        </div>
      </div>

      {/* Summary strip */}
      {isMondayMode ? (
        <div style={{ padding: '6px 20px 10px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, flexShrink: 0 }}>
          {[
            { label: 'סה"כ נכסים', value: String(propCount), color: GOLD },
            { label: 'Equity',      value: equity,            color: '#4CAF50' },
            { label: 'שווי תיק',    value: portfolio,          color: GOLD },
            { label: 'ROI',         value: roi,                color: '#4CAF50' },
          ].map(s => (
            <div key={s.label} style={{
              background: (s.label === 'ROI' || s.label === 'Equity') ? 'rgba(76,175,80,0.08)' : 'var(--bg-chip)',
              borderRadius: 10,
              padding: '10px 6px', textAlign: 'center',
              border: (s.label === 'ROI' || s.label === 'Equity') ? '1px solid rgba(76,175,80,0.25)' : 'none',
            }}>
              <div style={{ fontSize: 15, fontWeight: 700, color: s.color, marginBottom: 2 }}>{s.value}</div>
              <div style={{ fontSize: 9, color: 'var(--text-secondary)' }}>{s.label}</div>
            </div>
          ))}
        </div>
      ) : (
        <div style={{ padding: '6px 20px 10px', display: 'flex', gap: 10, flexShrink: 0 }}>
          {[
            { label: 'סה"כ נכסים',  value: String(propCount) },
            { label: 'שווי תיק',    value: portfolio },
            { label: 'תשואה ממוצעת', value: avgYield },
          ].map(s => (
            <div key={s.label} style={{
              background: 'var(--bg-chip)', borderRadius: 10,
              padding: '10px 6px', flex: 1, textAlign: 'center',
            }}>
              <div style={{ fontSize: 16, fontWeight: 700, color: GOLD, marginBottom: 2 }}>{s.value}</div>
              <div style={{ fontSize: 9, color: 'var(--text-secondary)' }}>{s.label}</div>
            </div>
          ))}
        </div>
      )}

      {/* Section title */}
      <div style={{ padding: '6px 20px 10px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
        {isMondayMode
          ? <span style={{ fontSize: 10, color: GOLD }}>● Live</span>
          : <span style={{ fontSize: 12, color: GOLD, cursor: 'pointer' }}>הכל</span>
        }
        <span style={{ fontFamily: 'var(--font-ui)', fontSize: 20, fontWeight: 700, color: 'var(--text-primary)' }}>
          הנכסים שלי
        </span>
      </div>

      {/* Property cards */}
      <div className="property-grid" style={{ flex: 1, overflowY: 'auto', padding: '0 20px 12px' }}>

        {/* ── Monday investor properties ── */}
        {isMondayMode && mondayProps.map((p, i) => (
          <MondayPropertyCard
            key={p.mondayId}
            p={p}
            i={i}
            onPress={() => navigate('property-detail', { propertyId: p.mondayId })}
          />
        ))}

        {/* ── Static / demo properties ── */}
        {!isMondayMode && staticProps.map((p, i) => (
          <div
            key={p.id}
            className="gold-card"
            style={{ cursor: 'pointer' }}
            onClick={() => navigate('property-detail', { propertyId: p.id })}
          >
            <div style={{ position: 'relative' }}>
              <PropPhoto index={i} heightRatio={48} />
              <div style={{
                position: 'absolute', bottom: 0, left: 0, right: 0,
                background: 'linear-gradient(transparent, rgba(0,0,0,0.75))',
                padding: '18px 12px 10px',
              }}>
                <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between' }}>
                  <StatusBadge type={p.statusType}>{p.status}</StatusBadge>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: 13, fontWeight: 700, color: '#fff', lineHeight: 1.3 }}>{p.address}</div>
                    <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.65)', marginTop: 2 }}>{p.city}</div>
                  </div>
                </div>
              </div>
            </div>
            <div style={{ padding: '10px 14px 16px', display: 'flex', flexDirection: 'column', gap: 8 }}>
              <div style={{ display: 'flex', gap: 8 }}>
                <div style={{ background: 'var(--bg-chip)', borderRadius: 10, padding: '8px 12px', flex: 1 }}>
                  <div style={{ fontSize: 10, color: 'var(--text-secondary)', marginBottom: 3 }}>מחיר קנייה</div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)' }}>{p.purchasePrice}</div>
                </div>
                <div style={{ background: 'var(--bg-chip)', borderRadius: 10, padding: '8px 12px', flex: 1 }}>
                  <div style={{ fontSize: 10, color: 'var(--text-secondary)', marginBottom: 3 }}>ARV</div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: GOLD }}>{p.arv}</div>
                </div>
                <div style={{ background: 'var(--bg-chip)', borderRadius: 10, padding: '8px 12px', flex: 1 }}>
                  <div style={{ fontSize: 10, color: 'var(--text-secondary)', marginBottom: 3 }}>תשואה</div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: GOLD }}>{p.rentYield}</div>
                </div>
              </div>
              {p.statusType !== 'blue' && (
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5 }}>
                    <span style={{ fontSize: 10, color: GOLD, fontWeight: 600 }}>{p.progress}%</span>
                    <span style={{ fontSize: 10, color: 'var(--text-secondary)' }}>התקדמות השיפוץ</span>
                  </div>
                  <ProgressBar target={p.progress} />
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

    </div>
  );
}
