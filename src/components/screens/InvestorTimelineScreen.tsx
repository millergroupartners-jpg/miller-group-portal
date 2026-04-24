/**
 * InvestorTimelineScreen — full chronological activity feed across all of an
 * investor's properties. Navigated to from the "ציר זמן מלא" link on the
 * dashboard. Includes a back button that works on both mobile and desktop.
 *
 * The feed is scoped server-side to this investor's properties and sanitized
 * (no renovation payments) — see fetchInvestorFeed + api/timeline/admin-feed.
 */

import { useEffect, useMemo, useState } from 'react';
import { useNavigation } from '../../context/NavigationContext';
import { useUser } from '../../context/UserContext';
import { MGLogo } from '../common/MGLogo';
import { fetchInvestorFeed, relativeTimeHe, type AdminFeedEvent } from '../../services/timelineApi';

const GOLD = '#C9A84C';

type FilterKey = 'all' | 'status' | 'inquiry' | 'utility';

export function InvestorTimelineScreen() {
  const { navigate, goBack } = useNavigation();
  const { currentUser } = useUser();
  const investorId = currentUser?.mondayInvestorId || '';

  const [events, setEvents] = useState<AdminFeedEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<FilterKey>('all');

  useEffect(() => {
    if (!investorId) { setLoading(false); return; }
    let cancelled = false;
    setLoading(true);
    fetchInvestorFeed(investorId, 100)
      .then(list => { if (!cancelled) { setEvents(list); setError(null); } })
      .catch(err => { if (!cancelled) setError(err?.message || 'שגיאה בטעינה'); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [investorId]);

  const filtered = useMemo(() => {
    if (filter === 'all') return events;
    if (filter === 'status')  return events.filter(e => e.kind === 'status-change');
    if (filter === 'inquiry') return events.filter(e => e.kind === 'inquiry-new' || e.kind === 'inquiry-reply');
    if (filter === 'utility') return events.filter(e => e.kind === 'utility-scheduled' || e.kind === 'utility-activated');
    return events;
  }, [events, filter]);

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: 'var(--bg-base)', overflow: 'hidden' }}>
      <div className="desktop-page-title">
        <div className="subtitle">כל העדכונים לכל הנכסים שלך</div>
        <h1>ציר זמן מלא</h1>
      </div>

      <div className="screen-header" style={{ padding: '16px 20px 10px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0, gap: 10 }}>
        {/* Back button — explicit so it works on both mobile and desktop */}
        <button
          onClick={goBack}
          style={{
            background: 'var(--bg-surface)', border: '1px solid var(--border)',
            borderRadius: 10, width: 36, height: 36,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            cursor: 'pointer', padding: 0, flexShrink: 0,
          }}
          title="חזרה"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--text-primary)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M15 18l-6-6 6-6" />
          </svg>
        </button>
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
          <MGLogo size={32} showWordmark={false} />
          <span style={{ fontSize: 18, fontWeight: 700, color: 'var(--text-primary)' }}>ציר זמן</span>
        </div>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: '8px 20px 20px' }}>
        {/* Filter chips */}
        <div style={{
          display: 'flex', gap: 6, overflowX: 'auto', padding: '2px 0 12px',
          flexDirection: 'row-reverse', scrollbarWidth: 'none',
        }}>
          {([
            { key: 'all' as FilterKey,     label: 'הכל' },
            { key: 'status' as FilterKey,  label: '🔄 סטטוס' },
            { key: 'utility' as FilterKey, label: '⚡ Utilities' },
            { key: 'inquiry' as FilterKey, label: '💬 פניות' },
          ]).map(c => (
            <button
              key={c.key}
              onClick={() => setFilter(c.key)}
              style={{
                padding: '6px 14px', borderRadius: 100,
                background: filter === c.key ? GOLD : 'var(--bg-chip)',
                color: filter === c.key ? '#000' : 'var(--text-secondary)',
                border: '1px solid var(--border)',
                fontSize: 11, fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap', flexShrink: 0,
              }}
            >
              {c.label}
            </button>
          ))}
        </div>

        {loading && <div style={{ padding: 24, textAlign: 'center', color: 'var(--text-secondary)', fontSize: 13 }}>טוען…</div>}
        {error && <div style={{ padding: 24, textAlign: 'center', color: '#ff4d4d', fontSize: 13 }}>שגיאה: {error}</div>}
        {!loading && filtered.length === 0 && !error && (
          <div style={{ padding: '24px 14px', textAlign: 'center', color: 'var(--text-secondary)' }}>
            <div style={{ fontSize: 36, marginBottom: 10 }}>📭</div>
            <div style={{ fontSize: 13 }}>אין עדכונים להצגה</div>
          </div>
        )}

        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {filtered.map(ev => {
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
                  gap: 10, padding: 12, borderRadius: 12, background: 'var(--bg-surface)',
                  border: '1px solid var(--border)',
                  cursor: clickable ? 'pointer' : 'default',
                }}
              >
                <div style={{
                  width: 38, height: 38, borderRadius: 10,
                  background: `${ev.color}18`, border: `1px solid ${ev.color}44`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 18, flexShrink: 0,
                }}>{ev.icon}</div>
                <div style={{ flex: 1, textAlign: 'right', minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 3 }}>{ev.title}</div>
                  {ev.propertyName && (
                    <div style={{ fontSize: 11, color: GOLD, fontWeight: 600, marginBottom: 2 }}>
                      📍 {ev.propertyName}
                    </div>
                  )}
                  {ev.subtitle && (
                    <div style={{ fontSize: 11, color: 'var(--text-secondary)', lineHeight: 1.5 }}>{ev.subtitle}</div>
                  )}
                  <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 4 }}>{relativeTimeHe(ev.at)}</div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
