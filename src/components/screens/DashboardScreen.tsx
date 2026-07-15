import { useEffect, useState } from 'react';
import { useNavigation } from '../../context/NavigationContext';
import { MGLogo } from '../common/MGLogo';
import { SkeletonPropertyCard, SkeletonFeedRow } from '../common/Skeletons';
import { StatusBadge } from '../common/StatusBadge';
import { ProgressBar } from '../common/ProgressBar';
import { PropPhoto } from '../common/PropPhoto';
import { PROPERTIES } from '../../data/properties';
import { MOCK_USER } from '../../data/user';
import { useUser } from '../../context/UserContext';
import { useMondayData } from '../../context/MondayDataContext';
import { useCCThumbnail } from '../../hooks/useCCThumbnail';
import { fetchInvestorFeed, relativeTimeHe, type AdminFeedEvent } from '../../services/timelineApi';
import { timeGreetingHe } from '../../utils/greeting';
import { StatValue } from '../common/StatValue';
import { getAndStampLastVisit } from '../../services/lastVisit';
import { userStorageKey } from '../../services/userStorage';
import type { MondayProperty } from '../../services/mondayApi';
import type { Property } from '../../types';

const GOLD = 'var(--gold-text)';

// ── Inner card component so useCCThumbnail can be called per-property ──
function MondayPropertyCard({ p, i, onPress }: { p: MondayProperty; i: number; onPress: () => void }) {
  const thumb = useCCThumbnail(p.address);
  return (
    <div className="gold-card" style={{ cursor: 'pointer' }} onClick={onPress}>
      <div style={{ position: 'relative' }}>
        <PropPhoto index={i} heightRatio={48} photoUrl={thumb} />
        <div style={{
          position: 'absolute', bottom: 0, left: 0, right: 0,
          background: 'linear-gradient(transparent 25%, rgba(8,8,10,0.82))',
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
          <div className="stat-chip">
            <div className="stat-label">מחיר קנייה</div>
            <div className="stat-value num" style={{ fontSize: 13 }}>{p.purchasePrice}</div>
          </div>
          <div className="stat-chip">
            <div className="stat-label">ARV</div>
            <div className="stat-value num" style={{ fontSize: 13, color: GOLD }}>{p.arv}</div>
          </div>
          <div className="stat-chip">
            <div className="stat-label">Equity</div>
            <div className="stat-value num" style={{ fontSize: 13, color: 'var(--success)' }}>
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
  const { investors: mondayInvestors, loading: mondayLoading } = useMondayData();
  const user = currentUser ?? MOCK_USER;

  // A real investor logs in via Monday and carries a mondayInvestorId. The demo
  // account (MOCK_USER) has none — it's the only user that should ever see the
  // sample properties. A real investor always sees their own portfolio, or a
  // clean empty state when they don't own anything yet — never the demo data.
  const isMondayMode = Boolean(user.mondayInvestorId);
  const mondayInvestor = isMondayMode
    ? mondayInvestors.find(inv => inv.mondayId === user.mondayInvestorId)
    : null;

  const mondayProps: MondayProperty[] = mondayInvestor?.properties ?? [];
  const staticProps: Property[] = isMondayMode ? [] : PROPERTIES;

  // Before the Monday data has loaded we haven't matched the investor yet, so
  // hold off on the empty state (and on any numbers) rather than flash "no
  // properties" at someone whose portfolio is still on its way.
  const investorPending = isMondayMode && !mondayInvestor && mondayLoading;

  const propCount   = isMondayMode ? mondayProps.length : staticProps.length;
  const portfolio   = isMondayMode ? (mondayInvestor?.portfolioValue ?? '—') : '$575K';
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

  // Investor activity feed — scoped to this investor's properties. Renovation
  // transfers and loan updates included in an investor-safe presentation.
  const [feed, setFeed] = useState<AdminFeedEvent[]>([]);
  const [feedLoading, setFeedLoading] = useState(false);
  // "New since last visit" banner — count feed events newer than the previous
  // visit's timestamp (stamped once per session; see lastVisit.ts).
  const [newSinceCount, setNewSinceCount] = useState(0);
  const [bannerDismissed, setBannerDismissed] = useState(false);
  useEffect(() => {
    if (!mondayInvestor?.mondayId) return;
    let cancelled = false;
    setFeedLoading(true);
    // Pull a larger window so we can show the 5 most recent regardless of recency —
    // the old cap hid the feed entirely for investors with no activity this week.
    fetchInvestorFeed(mondayInvestor.mondayId, 50)
      .then(list => {
        if (cancelled) return;
        setFeed(list);
        if (!user.isAdmin) {
          const prev = getAndStampLastVisit(userStorageKey(user));
          // First-ever visit (no prev) → stamp only, nothing is "new" yet.
          if (prev) {
            const count = list.filter(ev => ev.at && ev.at > prev).length;
            if (count > 0) setNewSinceCount(count);
          }
        }
      })
      .catch(err => console.error('investor feed failed:', err))
      .finally(() => { if (!cancelled) setFeedLoading(false); });
    return () => { cancelled = true; };
  }, [mondayInvestor?.mondayId]);

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: 'var(--bg-base)', overflow: 'hidden' }}>
      {/* Desktop title */}
      <div className="desktop-page-title">
        <div>
          <div className="subtitle">{timeGreetingHe()}, {user.fullNameHe}</div>
        </div>
        <h1>הנכסים שלי</h1>
      </div>

      {/* Header */}
      <div className="screen-header" style={{ padding: '16px 20px 10px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
        <MGLogo size={36} showWordmark={false} />
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div>
            <div style={{ fontSize: 11, color: 'var(--text-secondary)', textAlign: 'right' }}>{timeGreetingHe()},</div>
            <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)', textAlign: 'right' }}>{user.fullNameHe}</div>
          </div>
          <div style={{
            width: 36, height: 36, borderRadius: '50%',
            background: 'var(--gold-grad)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
            boxShadow: 'var(--gold-glow)',
          }}>
            <span style={{ fontSize: 14, fontWeight: 700, color: '#1A1508' }}>{user.initials}</span>
          </div>
        </div>
      </div>

      {/* Summary strip */}
      {isMondayMode ? (
        <div data-tour="stats" style={{ padding: '6px 20px 10px', flexShrink: 0 }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          {[
            { label: 'סה"כ נכסים', value: String(propCount), color: GOLD },
            { label: 'Equity',      value: equity,            color: 'var(--success)' },
            { label: 'שווי תיק',    value: portfolio,          color: GOLD },
            { label: 'ROI',         value: roi,                color: 'var(--success)' },
          ].map(s => (
            <div key={s.label} style={{
              background: (s.label === 'ROI' || s.label === 'Equity') ? 'var(--success-dim)' : 'var(--bg-surface-2)',
              borderRadius: 'var(--radius-sm)',
              padding: '10px 6px', textAlign: 'center',
              border: (s.label === 'ROI' || s.label === 'Equity') ? '1px solid var(--success-border)' : '1px solid var(--border)',
            }}>
              <div className="num" style={{ fontSize: 15, fontWeight: 700, color: s.color, marginBottom: 2 }}>
                {investorPending ? '—' : <StatValue value={s.value} />}
              </div>
              <div style={{ fontSize: 9, color: 'var(--text-secondary)' }}>{s.label}</div>
            </div>
          ))}
        </div>
        <button
          className="mg-btn-secondary"
          onClick={() => navigate('analytics')}
          style={{
            marginTop: 8, padding: '9px 12px', fontSize: 12, borderRadius: 'var(--radius-sm)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
          }}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor"
            strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="18" y1="20" x2="18" y2="10" />
            <line x1="12" y1="20" x2="12" y2="4" />
            <line x1="6" y1="20" x2="6" y2="14" />
          </svg>
          צפה באנליטיקות של התיק ←
        </button>
        </div>
      ) : (
        <div data-tour="stats" style={{ padding: '6px 20px 10px', display: 'flex', gap: 10, flexShrink: 0 }}>
          {[
            { label: 'סה"כ נכסים',  value: String(propCount) },
            { label: 'שווי תיק',    value: portfolio },
            { label: 'תשואה ממוצעת', value: avgYield },
          ].map(s => (
            <div key={s.label} style={{
              background: 'var(--bg-surface-2)', borderRadius: 'var(--radius-sm)',
              border: '1px solid var(--border)',
              padding: '10px 6px', flex: 1, textAlign: 'center',
            }}>
              <div className="num" style={{ fontSize: 16, fontWeight: 700, color: GOLD, marginBottom: 2 }}>
                <StatValue value={s.value} />
              </div>
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

      {/* Property cards + optional activity feed below */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '0 20px 12px' }}>

      {/* "New since last visit" banner */}
      {newSinceCount > 0 && !bannerDismissed && (
        <div className="fade-up" style={{
          display: 'flex', alignItems: 'center', gap: 10, flexDirection: 'row-reverse',
          background: 'var(--gold-dim)', border: '1px solid var(--gold-border)',
          borderRadius: 'var(--radius-sm)', padding: '10px 14px', marginBottom: 12,
        }}>
          <span style={{ fontSize: 13, color: 'var(--gold-text)', fontWeight: 600, flex: 1, textAlign: 'right' }}>
            מאז הביקור האחרון: {newSinceCount === 1 ? 'עדכון חדש אחד' : `${newSinceCount} עדכונים חדשים`}
          </span>
          <button
            onClick={() => navigate('timeline')}
            style={{
              background: 'transparent', border: 'none', color: GOLD,
              fontSize: 12, fontWeight: 700, cursor: 'pointer', padding: 0, whiteSpace: 'nowrap',
            }}
          >
            צפה בציר הזמן ←
          </button>
          <button
            aria-label="סגירה"
            onClick={() => setBannerDismissed(true)}
            style={{
              background: 'transparent', border: 'none', color: 'var(--text-muted)',
              fontSize: 14, cursor: 'pointer', padding: '0 2px', lineHeight: 1,
            }}
          >
            ✕
          </button>
        </div>
      )}

      <div data-tour="properties" className="property-grid stagger" style={{ padding: 0 }}>

        {/* ── Monday investor properties ── */}
        {isMondayMode && mondayProps.map((p, i) => (
          <MondayPropertyCard
            key={p.mondayId}
            p={p}
            i={i}
            onPress={() => navigate('property-detail', { propertyId: p.mondayId })}
          />
        ))}

        {/* ── Empty state: real investor with no properties yet ── */}
        {isMondayMode && mondayProps.length === 0 && (
          investorPending ? (
            <>
              <SkeletonPropertyCard />
              <SkeletonPropertyCard />
              <SkeletonPropertyCard />
            </>
          ) : (
            <div className="gold-card" style={{ gridColumn: '1 / -1', padding: '36px 24px', textAlign: 'center' }}>
              <div style={{ fontSize: 42, marginBottom: 14 }}>🏠</div>
              <div style={{ fontSize: 17, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 8 }}>
                אין לך נכסים עדיין
              </div>
              <div style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.7, marginBottom: 20 }}>
                הנכסים שלך יופיעו כאן ברגע שיצטרפו לתיק ההשקעות שלך.
                <br />בינתיים, אפשר לעיין בעסקאות הזמינות להשקעה.
              </div>
              <button
                className="mg-btn-secondary mg-btn-sm"
                onClick={() => navigate('deal-room')}
                style={{ width: 'auto', margin: '0 auto' }}
              >
                לצפייה בעסקאות זמינות ←
              </button>
            </div>
          )
        )}

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
                background: 'linear-gradient(transparent 25%, rgba(8,8,10,0.82))',
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

      {/* ── Activity feed (investor mode only) ── */}
      {isMondayMode && (
        <div data-tour="feed" style={{ marginTop: 20 }}>
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            flexDirection: 'row-reverse', marginBottom: 10,
          }}>
            <span style={{ fontFamily: 'var(--font-ui)', fontSize: 16, fontWeight: 700, color: 'var(--text-primary)' }}>
              ציר זמן · עדכונים אחרונים
            </span>
            {feedLoading
              ? <span className="mg-spinner" style={{ width: 12, height: 12 }} />
              : feed.length > 0 && (
                  <button
                    onClick={() => navigate('timeline')}
                    style={{
                      background: 'transparent', border: 'none', color: GOLD,
                      fontSize: 12, fontWeight: 700, cursor: 'pointer', padding: 0,
                    }}
                  >
                    צפה בציר זמן מלא ←
                  </button>
                )
            }
          </div>
          <div className="gold-card" style={{ padding: 12 }}>
            {!feedLoading && feed.length === 0 && (
              <div style={{ textAlign: 'center', padding: 14, fontSize: 12, color: 'var(--text-secondary)' }}>
                אין עדכונים אחרונים
              </div>
            )}
            {feedLoading && feed.length === 0 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <SkeletonFeedRow />
                <SkeletonFeedRow />
                <SkeletonFeedRow />
              </div>
            )}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {feed.slice(0, 5).map(ev => {
                const clickable = Boolean(ev.propertyId || ev.inquiryId);
                const onClick = () => {
                  if (ev.propertyId) navigate('property-detail', { propertyId: ev.propertyId });
                  else if (ev.inquiryId) navigate('inquiries');
                };
                return (
                  <div
                    key={ev.id}
                    onClick={clickable ? onClick : undefined}
                    style={{
                      display: 'flex', flexDirection: 'row-reverse', alignItems: 'flex-start',
                      gap: 10, padding: 10, borderRadius: 10, background: 'var(--bg-chip)',
                      cursor: clickable ? 'pointer' : 'default',
                    }}
                  >
                    <div style={{
                      width: 32, height: 32, borderRadius: 8,
                      background: `${ev.color}18`, border: `1px solid ${ev.color}44`,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: 14, flexShrink: 0,
                    }}>{ev.icon}</div>
                    <div style={{ flex: 1, textAlign: 'right', minWidth: 0 }}>
                      <div style={{
                        fontSize: 12, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 2,
                        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                      }}>{ev.title}</div>
                      {ev.propertyName && (
                        <div style={{
                          fontSize: 10, color: GOLD, fontWeight: 600, marginBottom: 2,
                          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                        }}>📍 {ev.propertyName}</div>
                      )}
                      {ev.subtitle && (
                        <div style={{
                          fontSize: 10, color: 'var(--text-secondary)',
                          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                        }}>{ev.subtitle}</div>
                      )}
                      <div style={{ fontSize: 9, color: 'var(--text-muted)', marginTop: 2 }}>{relativeTimeHe(ev.at)}</div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
      </div>

    </div>
  );
}
