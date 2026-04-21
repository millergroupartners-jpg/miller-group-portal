import { useEffect, useState } from 'react';
import { useNavigation } from '../../../context/NavigationContext';
import { MGLogo } from '../../common/MGLogo';
import { StatusBadge } from '../../common/StatusBadge';
import { ProgressBar } from '../../common/ProgressBar';
import { PropPhoto } from '../../common/PropPhoto';
import { useCCThumbnail } from '../../../hooks/useCCThumbnail';
import { fetchMillerGroupProperties, type MondayProperty } from '../../../services/mondayApi';

const GOLD = '#C9A84C';

function fmtUSD(n: number): string {
  if (!n) return '$0';
  if (n >= 1_000_000) return '$' + (n / 1_000_000).toFixed(2) + 'M';
  if (n >= 1_000)     return '$' + Math.round(n / 1000) + 'K';
  return '$' + n.toLocaleString('en-US');
}

function Card({ p, i }: { p: MondayProperty; i: number }) {
  const thumb = useCCThumbnail(p.address);
  const { navigate } = useNavigation();
  return (
    <div className="gold-card" style={{ cursor: 'pointer' }} onClick={() => navigate('property-detail', { propertyId: p.mondayId })}>
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

export function AdminMGDealsScreen() {
  const [props, setProps] = useState<MondayProperty[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [statusFilter, setStatusFilter] = useState('הכל');

  useEffect(() => {
    fetchMillerGroupProperties()
      .then(setProps)
      .catch(e => setError(e?.message ?? 'שגיאה'))
      .finally(() => setLoading(false));
  }, []);

  const STATUS_FILTERS = ['הכל', ...Array.from(new Set(props.map(p => p.status))).filter(Boolean)];
  const filtered = props.filter(p => statusFilter === 'הכל' || p.status === statusFilter);

  const totalArv    = props.reduce((s, p) => s + p.arvRaw, 0);
  const totalAllIn  = props.reduce((s, p) => s + p.allIn, 0);
  const totalEquity = totalArv - totalAllIn;
  const roi         = totalAllIn > 0 ? ((totalEquity / totalAllIn) * 100).toFixed(1) + '%' : '—';

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: 'var(--bg-base)', overflow: 'hidden' }}>
      <div className="desktop-page-title">
        <div className="subtitle">עסקאות Miller Group · {props.length} נכסים</div>
        <h1>העסקאות שלנו</h1>
      </div>

      <div className="screen-header" style={{ padding: '16px 20px 10px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
        <MGLogo size={36} showWordmark={false} />
        <span style={{ fontSize: 20, fontWeight: 700, color: 'var(--text-primary)' }}>העסקאות שלנו</span>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: '16px 20px 20px', display: 'flex', flexDirection: 'column', gap: 16 }}>

        {loading && <div style={{ textAlign: 'center', color: GOLD, fontSize: 13, padding: '40px 0' }}>⏳ טוען עסקאות Miller Group...</div>}
        {error && <div style={{ color: '#ff6b6b', fontSize: 12, textAlign: 'center' }}>{error}</div>}

        {!loading && (
          <>
            {/* KPIs */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 10 }}>
              {[
                { label: 'AUM',           value: fmtUSD(totalArv),     color: GOLD },
                { label: 'Equity',        value: fmtUSD(totalEquity),  color: '#4CAF50' },
                { label: 'ROI',           value: roi,                  color: '#4CAF50' },
                { label: 'נכסים',         value: String(props.length), color: 'var(--text-primary)' },
              ].map(s => (
                <div key={s.label} className="gold-card" style={{ padding: '14px', textAlign: 'center' }}>
                  <div style={{ fontSize: 20, fontWeight: 700, color: s.color, marginBottom: 3 }}>{s.value}</div>
                  <div style={{ fontSize: 10, color: 'var(--text-secondary)' }}>{s.label}</div>
                </div>
              ))}
            </div>

            {/* Filter chips */}
            <div style={{ display: 'flex', gap: 6, overflowX: 'auto' }}>
              {STATUS_FILTERS.map(status => (
                <button
                  key={status}
                  onClick={() => setStatusFilter(status)}
                  style={{
                    flexShrink: 0,
                    padding: '6px 12px', borderRadius: 100,
                    border: statusFilter === status ? 'none' : '1px solid var(--border)',
                    background: statusFilter === status ? GOLD : 'var(--bg-chip)',
                    color: statusFilter === status ? '#000' : 'var(--text-secondary)',
                    fontSize: 11, fontWeight: 600, cursor: 'pointer',
                    fontFamily: 'var(--font-ui)',
                  }}
                >{status}</button>
              ))}
            </div>

            {filtered.length === 0 ? (
              <div style={{ textAlign: 'center', color: 'var(--text-secondary)', fontSize: 13, padding: '40px 0' }}>
                אין עסקאות בסינון זה
              </div>
            ) : (
              <div className="property-grid" style={{ padding: 0 }}>
                {filtered.map((p, i) => <Card key={p.mondayId} p={p} i={i} />)}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
