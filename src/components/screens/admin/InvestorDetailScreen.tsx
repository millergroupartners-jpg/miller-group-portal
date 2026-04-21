import { useState } from 'react';
import { useNavigation } from '../../../context/NavigationContext';
import { useMondayData } from '../../../context/MondayDataContext';
import { StatusBadge } from '../../common/StatusBadge';
import { ProgressBar } from '../../common/ProgressBar';
import { PropPhoto } from '../../common/PropPhoto';
import { useCCThumbnail } from '../../../hooks/useCCThumbnail';
import type { MondayProperty } from '../../../services/mondayApi';

const GOLD = '#C9A84C';

function fmtUSD(n: number): string {
  if (!n) return '—';
  if (n >= 1_000_000) return '$' + (n / 1_000_000).toFixed(2) + 'M';
  if (n >= 1_000)     return '$' + Math.round(n / 1000) + 'K';
  return '$' + n.toLocaleString('en-US');
}

function PropCard({ p, i, onPress }: { p: MondayProperty; i: number; onPress: () => void }) {
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

interface Props { investorId: string }

export function InvestorDetailScreen({ investorId }: Props) {
  const { navigate, goBack } = useNavigation();
  const { investors } = useMondayData();
  const [copied, setCopied] = useState(false);

  const inv = investors.find(i => i.mondayId === investorId);

  if (!inv) {
    return (
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 12, background: 'var(--bg-base)' }}>
        <div style={{ fontSize: 14, color: 'var(--text-secondary)' }}>משקיע לא נמצא</div>
        <button onClick={goBack} className="mg-btn" style={{ width: 160 }}>חזור</button>
      </div>
    );
  }

  const arv    = inv.properties.reduce((s, p) => s + p.arvRaw, 0);
  const allIn  = inv.properties.reduce((s, p) => s + p.allIn, 0);
  const equity = arv - allIn;
  const roi    = allIn > 0 ? ((equity / allIn) * 100).toFixed(1) + '%' : '—';

  const portalOrigin = typeof window !== 'undefined' ? window.location.origin : 'https://miller-group-portal.vercel.app';
  const inviteUrl = `${portalOrigin}/?email=${encodeURIComponent(inv.email)}`;

  const copyInvite = async () => {
    const msg = `שלום ${inv.fullName},\n\nברוך הבא לפורטל המשקיעים של Miller Group.\nכנס לקישור: ${inviteUrl}\nסיסמה: ${inv.password || '(יוגדר ע״י המנהל)'}`;
    try {
      await navigator.clipboard.writeText(msg);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {}
  };

  const whatsappMsg = encodeURIComponent(`שלום ${inv.fullName},\nברוך הבא לפורטל המשקיעים של Miller Group 👋\n\n🔗 ${inviteUrl}\n🔑 סיסמה: ${inv.password || '(צור קשר)'}`);
  const phoneClean = inv.phone.replace(/[^0-9+]/g, '');
  const waUrl = phoneClean ? `https://wa.me/${phoneClean.replace(/^\+/, '')}?text=${whatsappMsg}` : '';
  const mailUrl = inv.email ? `mailto:${inv.email}?subject=${encodeURIComponent('פורטל המשקיעים - Miller Group')}&body=${whatsappMsg}` : '';

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: 'var(--bg-base)', overflow: 'hidden' }}>
      {/* Desktop title */}
      <div className="desktop-page-title">
        <div className="subtitle">{inv.email || '—'}</div>
        <h1>{inv.fullName}</h1>
      </div>

      {/* Mobile header */}
      <div className="screen-header" style={{ padding: '12px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0, borderBottom: '1px solid var(--border)' }}>
        <button onClick={goBack} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4 }}>
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="var(--text-primary)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="9 18 15 12 9 6" />
          </svg>
        </button>
        <span style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-primary)' }}>{inv.fullName}</span>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: '16px 20px 20px', display: 'flex', flexDirection: 'column', gap: 16 }}>

        {/* Profile card */}
        <div className="gold-card" style={{ padding: '20px', display: 'flex', alignItems: 'center', gap: 16, flexDirection: 'row-reverse' }}>
          <div style={{
            width: 64, height: 64, borderRadius: '50%',
            background: 'linear-gradient(135deg, #C9A84C, #8a6a28)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 22, fontWeight: 700, color: '#000', flexShrink: 0,
          }}>{inv.initials}</div>
          <div style={{ flex: 1, textAlign: 'right' }}>
            <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 4 }}>{inv.fullName}</div>
            {inv.email && <div style={{ fontSize: 12, color: 'var(--text-secondary)', direction: 'ltr', textAlign: 'right' }}>{inv.email}</div>}
            {inv.phone && <div style={{ fontSize: 12, color: 'var(--text-secondary)', direction: 'ltr', textAlign: 'right', marginTop: 2 }}>{inv.phone}</div>}
          </div>
        </div>

        {/* Stats grid */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: 10 }}>
          {[
            { label: 'נכסים',     value: String(inv.properties.length), color: 'var(--text-primary)' },
            { label: 'ARV',       value: fmtUSD(arv),                   color: GOLD },
            { label: 'Equity',    value: fmtUSD(equity),                color: '#4CAF50' },
            { label: 'ROI',       value: roi,                           color: '#4CAF50' },
          ].map(s => (
            <div key={s.label} className="gold-card" style={{ padding: '14px', textAlign: 'center' }}>
              <div style={{ fontSize: 20, fontWeight: 700, color: s.color, marginBottom: 3 }}>{s.value}</div>
              <div style={{ fontSize: 10, color: 'var(--text-secondary)' }}>{s.label}</div>
            </div>
          ))}
        </div>

        {/* Actions */}
        <div className="gold-card" style={{ padding: '16px 18px' }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 12, textAlign: 'right' }}>
            פעולות
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 8 }}>
            <button
              onClick={() => navigate('set-password', { investorId: inv.mondayId, investorName: inv.fullName })}
              style={{
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                padding: '11px 14px', borderRadius: 10,
                background: `${GOLD}15`, border: `1px solid ${GOLD}44`,
                color: GOLD, fontSize: 12, fontWeight: 600, cursor: 'pointer',
                fontFamily: 'var(--font-ui)',
              }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={GOLD} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="11" width="18" height="11" rx="2" />
                <path d="M7 11V7a5 5 0 0110 0v4" />
              </svg>
              {inv.password ? 'שנה סיסמה' : 'הגדר סיסמה'}
            </button>

            <button
              onClick={copyInvite}
              style={{
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                padding: '11px 14px', borderRadius: 10,
                background: 'var(--bg-chip)', border: '1px solid var(--border)',
                color: 'var(--text-primary)', fontSize: 12, fontWeight: 600, cursor: 'pointer',
                fontFamily: 'var(--font-ui)',
              }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="9" y="9" width="13" height="13" rx="2" />
                <path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1" />
              </svg>
              {copied ? '✓ הועתק' : 'העתק הזמנה'}
            </button>

            {waUrl && (
              <a
                href={waUrl} target="_blank" rel="noopener noreferrer"
                style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                  padding: '11px 14px', borderRadius: 10,
                  background: 'rgba(37,211,102,0.1)', border: '1px solid rgba(37,211,102,0.3)',
                  color: '#25D366', fontSize: 12, fontWeight: 600,
                  textDecoration: 'none', fontFamily: 'var(--font-ui)',
                }}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
                </svg>
                WhatsApp
              </a>
            )}

            {mailUrl && (
              <a
                href={mailUrl}
                style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                  padding: '11px 14px', borderRadius: 10,
                  background: 'var(--bg-chip)', border: '1px solid var(--border)',
                  color: 'var(--text-primary)', fontSize: 12, fontWeight: 600,
                  textDecoration: 'none', fontFamily: 'var(--font-ui)',
                }}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
                  <polyline points="22,6 12,13 2,6" />
                </svg>
                מייל
              </a>
            )}
          </div>
          <div style={{ marginTop: 10, padding: '8px 10px', background: 'var(--bg-chip)', borderRadius: 8, fontSize: 11, color: 'var(--text-secondary)', direction: 'ltr', textAlign: 'right', fontFamily: 'monospace' }}>
            {inviteUrl}
          </div>
        </div>

        {/* Properties */}
        {inv.properties.length > 0 && (
          <>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 4 }}>
              <span style={{ fontSize: 11, color: 'var(--text-secondary)' }}>{inv.properties.length} נכסים</span>
              <span style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-primary)' }}>הנכסים של המשקיע</span>
            </div>
            <div className="property-grid" style={{ padding: 0 }}>
              {inv.properties.map((p, i) => (
                <PropCard
                  key={p.mondayId}
                  p={p} i={i}
                  onPress={() => navigate('property-detail', { propertyId: p.mondayId })}
                />
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
