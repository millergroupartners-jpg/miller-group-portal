import { useState } from 'react';
import { useNavigation } from '../../context/NavigationContext';
import { useUser } from '../../context/UserContext';
import { StatusBadge } from '../common/StatusBadge';
import { ProgressBar } from '../common/ProgressBar';
import { PropPhoto } from '../common/PropPhoto';
import { PROPERTIES } from '../../data/properties';
import { FOLDERS } from '../../data/documents';
import { useMondayData } from '../../context/MondayDataContext';
import { useCCThumbnail } from '../../hooks/useCCThumbnail';
import { RenovationsTab } from './property/RenovationsTab';
import { UtilitiesTab } from './property/UtilitiesTab';
import { TimelineTab } from './property/TimelineTab';

/**
 * Tabs on the Monday-property detail screen.
 *   'renovations' is ADMIN-ONLY — exposing contractor/commission transfers to
 *   investors would reveal Miller Group's internal margins. The tab is not
 *   rendered at all for investor users.
 */
type MondayTabKey = 'details' | 'utilities' | 'timeline' | 'renovations';

const GOLD = '#C9A84C';

const COLOR_PAIRS: [string, string][] = [
  ['#2a3a52', '#3d5a8a'], ['#3a2a1e', '#5a3d2a'], ['#1e3a2a', '#2a5a3d'],
  ['#3a1e2a', '#5a2a3d'], ['#2a2a1e', '#5a5a2a'], ['#1e2a3a', '#2a3d5a'],
];

/** Single row inside the "חברת ניהול" card: RTL label on right, value on left (tappable if href). */
function ManagementRow({ label, value, href }: { label: string; value: string; href?: string }) {
  const valueNode = href ? (
    <a
      href={href}
      style={{ color: GOLD, fontSize: 13, fontWeight: 600, textDecoration: 'none', direction: 'ltr' }}
    >
      {value}
    </a>
  ) : (
    <span style={{ color: 'var(--text-primary)', fontSize: 13, fontWeight: 600, direction: 'ltr' }}>
      {value}
    </span>
  );
  return (
    <div style={{
      background: 'var(--bg-chip)', borderRadius: 10, padding: '10px 14px',
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      flexDirection: 'row-reverse',
    }}>
      <span style={{ fontSize: 11, color: 'var(--text-secondary)' }}>{label}</span>
      {valueNode}
    </div>
  );
}

interface PropertyDetailScreenProps {
  propertyId: string;
}

export function PropertyDetailScreen({ propertyId }: PropertyDetailScreenProps) {
  const { goBack, navigate } = useNavigation();
  const { currentUser } = useUser();
  const isAdmin = Boolean(currentUser?.isAdmin);
  const { properties: mondayProperties, mgProperties } = useMondayData();
  const [activeTab, setActiveTab] = useState<'details' | 'documents' | 'media'>('details');
  const [mondayTab, setMondayTab] = useState<MondayTabKey>('details');
  const [lightbox, setLightbox] = useState<number | null>(null);

  // Try static data first, then fall back to Monday (investor deals, then Miller Group deals)
  const staticProperty = PROPERTIES.find(p => p.id === propertyId);
  const mondayProperty = !staticProperty
    ? (mondayProperties.find(p => p.mondayId === propertyId)
       ?? mgProperties.find(p => p.mondayId === propertyId))
    : null;

  // Fetch real CompanyCam photo (hook must be called unconditionally)
  const ccThumb = useCCThumbnail(mondayProperty?.address);

  // If it's a Monday property, render a simplified detail view
  if (!staticProperty && mondayProperty) {
    const mp = mondayProperty;

    // Build tab list — 'renovations' only included for admin users so investors
    // never see internal contractor payments / commissions.
    const mondayTabs: { key: MondayTabKey; label: string }[] = [
      { key: 'details',    label: 'פרטים' },
      { key: 'utilities',  label: 'Utilities' },
      { key: 'timeline',   label: 'ציר זמן' },
    ];
    if (isAdmin) mondayTabs.push({ key: 'renovations', label: 'שיפוצים' });

    const mondayItemUrl = `https://real-estate-usa-eden.monday.com/boards/1997938102/pulses/${mp.mondayId}`;
    const hasManagerData = Boolean(mp.managerContactName || mp.managerCompanyName || mp.managerPhone || mp.managerEmail);
    const roi = (mp.allIn > 0 && mp.arvRaw > 0)
      ? (((mp.arvRaw - mp.allIn) / mp.allIn) * 100).toFixed(1) + '%'
      : null;
    const equity = (mp.allIn > 0 && mp.arvRaw > 0)
      ? '$' + (mp.arvRaw - mp.allIn).toLocaleString('en-US')
      : null;

    const detailsContent = (
      <>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 10, marginBottom: 10 }}>
          {[
            { label: 'מחיר רכישה', value: mp.purchasePrice, gold: false },
            { label: 'ARV',         value: mp.arv,           gold: true },
            { label: 'שכ"ד חזוי',  value: mp.rentMonthly,   gold: true },
            { label: 'תשואה שנתית', value: mp.rentYield,     gold: true },
            { label: 'עלות שיפוץ', value: mp.renovCost,     gold: false },
            { label: 'All-in',      value: '$' + mp.allIn.toLocaleString('en-US'), gold: false },
          ].map(s => (
            <div key={s.label} style={{ background: 'var(--bg-chip)', borderRadius: 10, padding: '10px 14px' }}>
              <div style={{ fontSize: 9, color: 'var(--text-secondary)', marginBottom: 4 }}>{s.label}</div>
              <div style={{ fontSize: 15, fontWeight: 700, color: s.gold ? '#C9A84C' : 'var(--text-primary)' }}>{s.value}</div>
            </div>
          ))}
        </div>

        {mp.loanStatus && (
          <div style={{
            background: 'var(--bg-chip)', borderRadius: 10, padding: '10px 14px',
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            marginBottom: 10,
          }}>
            <span style={{ fontSize: 13, fontWeight: 600, color: '#C9A84C' }}>{mp.loanStatus}</span>
            <span style={{ fontSize: 10, color: 'var(--text-secondary)', letterSpacing: 0.5 }}>סטטוס הלוואה</span>
          </div>
        )}

        {mp.lockboxCode && (
          <div style={{
            background: 'var(--bg-chip)', borderRadius: 10, padding: '10px 14px',
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            marginBottom: 10,
          }}>
            <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)', direction: 'ltr', letterSpacing: 1 }}>
              🔑 {mp.lockboxCode}
            </span>
            <span style={{ fontSize: 10, color: 'var(--text-secondary)', letterSpacing: 0.5 }}>Lockbox code</span>
          </div>
        )}

        {(roi || equity) && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 14 }}>
            {[{ label: 'ROI', value: roi ?? '—' }, { label: 'Equity', value: equity ?? '—' }].map(s => (
              <div key={s.label} style={{
                background: 'rgba(76,175,80,0.10)', border: '1px solid rgba(76,175,80,0.28)',
                borderRadius: 10, padding: '12px 14px', textAlign: 'center',
              }}>
                <div style={{ fontSize: 9, color: 'rgba(76,175,80,0.7)', marginBottom: 4, letterSpacing: 1 }}>{s.label}</div>
                <div style={{ fontSize: 22, fontWeight: 800, color: '#4CAF50', lineHeight: 1 }}>{s.value}</div>
              </div>
            ))}
          </div>
        )}

        {mp.statusType !== 'blue' && (
          <div className="gold-card" style={{ padding: '14px', marginBottom: 14 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
              <span style={{ fontSize: 12, color: '#C9A84C', fontWeight: 600 }}>{mp.progress}%</span>
              <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>התקדמות פרויקט</span>
            </div>
            <ProgressBar target={mp.progress} />
          </div>
        )}

        {(hasManagerData || isAdmin) && (
          <div className="gold-card" style={{ padding: '14px', marginBottom: 14 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12, flexDirection: 'row-reverse' }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={GOLD} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z" />
                <polyline points="9 22 9 12 15 12 15 22" />
              </svg>
              <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)' }}>חברת ניהול</span>
            </div>
            {hasManagerData ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {mp.managerCompanyName && <ManagementRow label="שם החברה" value={mp.managerCompanyName} />}
                {mp.managerContactName && <ManagementRow label="איש קשר" value={mp.managerContactName} />}
                {mp.managerRole && <ManagementRow label="תפקיד" value={mp.managerRole} />}
                {mp.managerPhone && <ManagementRow label="טלפון" value={mp.managerPhone} href={`tel:${mp.managerPhone}`} />}
                {mp.managerEmail && <ManagementRow label="אימייל" value={mp.managerEmail} href={`mailto:${mp.managerEmail}`} />}
              </div>
            ) : (
              <div style={{ background: 'var(--bg-chip)', borderRadius: 10, padding: '14px', display: 'flex', flexDirection: 'column', gap: 10 }}>
                <div style={{ fontSize: 12, color: 'var(--text-secondary)', textAlign: 'right', lineHeight: 1.6 }}>
                  לא הוגדרה חברת ניהול. פתח את הפריט ב-Monday להגדרת עמודת <b>"מנהל הנכס"</b>.
                </div>
                <a href={mondayItemUrl} target="_blank" rel="noopener noreferrer" style={{
                  textAlign: 'center', padding: '10px 14px', borderRadius: 10,
                  background: `${GOLD}18`, border: `1px solid ${GOLD}55`, color: GOLD,
                  fontSize: 12, fontWeight: 700, textDecoration: 'none',
                }}>
                  פתח ב-Monday להוספת מנהל ↗
                </a>
              </div>
            )}
          </div>
        )}
      </>
    );

    return (
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: 'var(--bg-base)', overflow: 'hidden', position: 'relative' }}>
        <div className="detail-hero">
          <PropPhoto index={0} heightRatio={45} photoUrl={ccThumb} />
          <button onClick={goBack} style={{
            position: 'absolute', top: 12, right: 12,
            width: 36, height: 36, borderRadius: '50%',
            background: 'rgba(0,0,0,0.55)', border: '1px solid rgba(255,255,255,0.15)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            cursor: 'pointer', backdropFilter: 'blur(8px)',
          }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="round">
              <path d="M15 18l-6-6 6-6" />
            </svg>
          </button>
          <div style={{
            position: 'absolute', bottom: 0, left: 0, right: 0,
            background: 'linear-gradient(transparent, rgba(0,0,0,0.85))',
            padding: '30px 16px 14px',
          }}>
            <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between' }}>
              <StatusBadge type={mp.statusType}>{mp.status}</StatusBadge>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: 16, fontWeight: 700, color: '#fff' }}>{mp.address}</div>
                <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.65)' }}>{mp.city}</div>
              </div>
            </div>
          </div>
        </div>

        {/* Tab strip */}
        <div style={{ display: 'flex', borderBottom: '1px solid var(--border)', background: 'var(--bg-surface)', flexShrink: 0, flexDirection: 'row-reverse', overflowX: 'auto' }}>
          {mondayTabs.map(t => (
            <div
              key={t.key}
              className={`prop-tab ${mondayTab === t.key ? 'active' : ''}`}
              onClick={() => setMondayTab(t.key)}
              style={{ whiteSpace: 'nowrap' }}
            >
              {t.label}
            </div>
          ))}
        </div>

        <div style={{ flex: 1, overflowY: 'auto', padding: '16px 20px' }}>
          {mondayTab === 'details' && detailsContent}
          {mondayTab === 'utilities' && <UtilitiesTab propertyId={mp.mondayId} />}
          {mondayTab === 'timeline' && (
            <TimelineTab
              propertyId={mp.mondayId}
              role={isAdmin ? 'admin' : 'investor'}
              onNavigateInquiry={() => navigate(isAdmin ? 'admin-inquiries' : 'inquiries')}
            />
          )}
          {mondayTab === 'renovations' && isAdmin && (
            <RenovationsTab propertyId={mp.mondayId} />
          )}
        </div>
      </div>
    );
  }

  const property = staticProperty;
  if (!property) return null;

  const propIndex = PROPERTIES.findIndex(p => p.id === propertyId);

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: 'var(--bg-base)', overflow: 'hidden', position: 'relative' }}>
      {/* Hero */}
      <div className="detail-hero">
        <PropPhoto index={propIndex} heightRatio={45} />
        {/* Back button */}
        <button
          onClick={goBack}
          style={{
            position: 'absolute', top: 12, right: 12,
            width: 36, height: 36, borderRadius: '50%',
            background: 'rgba(0,0,0,0.55)',
            border: '1px solid rgba(255,255,255,0.15)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            cursor: 'pointer', backdropFilter: 'blur(8px)',
          }}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="round">
            <path d="M15 18l-6-6 6-6" />
          </svg>
        </button>
        {/* Hero overlay */}
        <div style={{
          position: 'absolute', bottom: 0, left: 0, right: 0,
          background: 'linear-gradient(transparent, rgba(0,0,0,0.8))',
          padding: '20px 16px 10px',
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
            <StatusBadge type={property.statusType}>{property.status}</StatusBadge>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: '#fff' }}>{property.address}</div>
            </div>
          </div>
        </div>
      </div>

      {/* Tab strip */}
      <div style={{ display: 'flex', borderBottom: '1px solid var(--border)', background: 'var(--bg-surface)', flexShrink: 0 }}>
        {(['details', 'documents', 'media'] as const).map(tab => (
          <div
            key={tab}
            className={`prop-tab ${activeTab === tab ? 'active' : ''}`}
            onClick={() => setActiveTab(tab)}
          >
            {tab === 'details' ? 'פרטים' : tab === 'documents' ? 'מסמכים' : 'מדיה'}
          </div>
        ))}
      </div>

      {/* Content */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '16px' }}>
        {activeTab === 'details' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {/* 2×2 stats grid */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              {[
                { label: 'מחיר קנייה', value: property.purchasePrice, gold: false },
                { label: 'עלות שיפוץ', value: property.renovCost, gold: false },
                { label: 'ARV', value: property.arv, gold: true },
                { label: 'תשואה צפויה', value: property.rentYield, gold: true },
              ].map(s => (
                <div key={s.label} className="gold-card" style={{ padding: '14px 12px' }}>
                  <div style={{ fontSize: 10, color: 'var(--text-secondary)', marginBottom: 5 }}>{s.label}</div>
                  <div style={{
                    fontFamily: 'var(--font-ui)',
                    fontSize: 20,
                    fontWeight: 700,
                    color: s.gold ? GOLD : 'var(--text-primary)',
                  }}>
                    {s.value}
                  </div>
                </div>
              ))}
            </div>

            {/* Progress card */}
            <div className="gold-card" style={{ padding: '14px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 10 }}>
                <span style={{ fontSize: 12, color: GOLD, fontWeight: 700 }}>{property.progress}%</span>
                <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>התקדמות השיפוץ</span>
              </div>
              <ProgressBar target={property.progress} height={8} />
              <div style={{ marginTop: 10, display: 'flex', justifyContent: 'space-between', fontSize: 10, color: 'var(--text-muted)' }}>
                <span>יעד סיום: יוני 2026</span>
                <span>התחלה: ינואר 2026</span>
              </div>
            </div>

            {/* Timeline */}
            <div className="gold-card" style={{ padding: '14px' }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 12, textAlign: 'right' }}>
                עדכונים אחרונים
              </div>
              {property.updates.map((item, i) => (
                <div key={i} style={{ display: 'flex', gap: 10, alignItems: 'flex-start', marginBottom: 10, flexDirection: 'row-reverse' }}>
                  <div style={{
                    width: 8, height: 8, borderRadius: '50%', marginTop: 4, flexShrink: 0,
                    background: item.done ? GOLD : 'var(--border)',
                    border: item.done ? 'none' : '2px solid var(--border)',
                  }} />
                  <div style={{ flex: 1, textAlign: 'right' }}>
                    <div style={{ fontSize: 12, color: 'var(--text-primary)', marginBottom: 2 }}>{item.text}</div>
                    <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>{item.date}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {activeTab === 'documents' && (
          <div className="gold-card" style={{ overflow: 'hidden' }}>
            {FOLDERS.map((f, i) => (
              <div
                key={f.id}
                className="doc-row"
                style={{ borderBottom: i < FOLDERS.length - 1 ? '1px solid var(--divider)' : 'none' }}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" strokeWidth="2" strokeLinecap="round">
                  <path d="M9 18l-6-6 6-6" />
                </svg>
                <div style={{ flex: 1, textAlign: 'right' }}>
                  <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 3 }}>{f.name}</div>
                  <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>{f.count} קבצים · עודכן {f.updated}</div>
                </div>
                <div style={{
                  width: 40, height: 40, borderRadius: 10,
                  background: 'rgba(201,168,76,0.12)',
                  border: '1px solid rgba(201,168,76,0.2)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                }}>
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={GOLD} strokeWidth="1.8" strokeLinecap="round">
                    <path d="M22 19a2 2 0 01-2 2H4a2 2 0 01-2-2V5a2 2 0 012-2h5l2 3h9a2 2 0 012 2z" />
                  </svg>
                </div>
              </div>
            ))}
          </div>
        )}

        {activeTab === 'media' && (
          <div>
            <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 8, textAlign: 'right' }}>
              אפריל 2026
            </div>
            <div className="photo-grid">
              {Array.from({ length: 6 }).map((_, i) => {
                const [bg, accent] = COLOR_PAIRS[i % COLOR_PAIRS.length];
                return (
                  <div key={i} className="photo-thumb" onClick={() => setLightbox(i)} style={{ background: bg }}>
                    <svg viewBox="0 0 80 80" width="100%" height="100%" style={{ display: 'block' }}>
                      <rect width="80" height="80" fill={bg} />
                      <rect x="10" y="25" width="60" height="40" rx="3" fill={accent} opacity="0.75" />
                      <polygon points="10,25 40,8 70,25" fill={bg} opacity="0.7" />
                      <rect x="20" y="36" width="12" height="10" rx="1" fill={bg} opacity="0.55" />
                      <rect x="48" y="36" width="12" height="10" rx="1" fill={bg} opacity="0.55" />
                      <circle cx="13" cy="13" r="4" fill={GOLD} opacity="0.45" />
                    </svg>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>


      {/* Lightbox */}
      {lightbox !== null && (
        <div
          onClick={() => setLightbox(null)}
          style={{
            position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.94)',
            zIndex: 999, display: 'flex', flexDirection: 'column',
            alignItems: 'center', justifyContent: 'center', gap: 16,
          }}
        >
          <button
            onClick={() => setLightbox(null)}
            style={{
              position: 'absolute', top: 52, right: 16,
              background: 'rgba(255,255,255,0.12)', border: 'none',
              color: '#fff', fontSize: 18, cursor: 'pointer',
              width: 34, height: 34, borderRadius: '50%',
            }}
          >
            ×
          </button>
          <div style={{ width: '80%', aspectRatio: '1', borderRadius: 12, overflow: 'hidden', border: `1px solid ${GOLD}44` }}>
            {(() => {
              const [bg, accent] = COLOR_PAIRS[lightbox % COLOR_PAIRS.length];
              return (
                <svg viewBox="0 0 200 200" width="100%" height="100%">
                  <rect width="200" height="200" fill={bg} />
                  <rect x="20" y="60" width="160" height="100" rx="6" fill={accent} opacity="0.8" />
                  <polygon points="20,60 100,15 180,60" fill={bg} opacity="0.8" />
                  <rect x="40" y="85" width="35" height="28" rx="3" fill={bg} opacity="0.7" />
                  <rect x="125" y="85" width="35" height="28" rx="3" fill={bg} opacity="0.7" />
                </svg>
              );
            })()}
          </div>
          <div style={{ fontSize: 13, color: '#888' }}>תמונה #{lightbox + 1}</div>
        </div>
      )}
    </div>
  );
}
