/**
 * Timeline tab on PropertyDetailScreen.
 * Aggregates events from 5 sources into a unified chronological feed:
 *   photos, renovation payments (admin only), status changes, inquiries, utility milestones.
 *
 * The `role` prop controls visibility: pass 'admin' only when the viewer is an
 * administrator. The server filters out renovation-payment events for non-admin
 * requests so that internal contractor/commission transfers never reach investors.
 */

import { useEffect, useMemo, useState } from 'react';
import { fetchPropertyTimeline, relativeTimeHe, type TimelineEvent, type TimelineEventKind } from '../../../services/timelineApi';

type FilterKey = 'all' | 'photo' | 'renovation' | 'inquiry' | 'status' | 'utility';

function eventFilter(ev: TimelineEvent): FilterKey {
  switch (ev.kind) {
    case 'photo':               return 'photo';
    case 'renovation-payment':  return 'renovation';
    case 'inquiry-new':
    case 'inquiry-reply':       return 'inquiry';
    case 'status-change':       return 'status';
    case 'utility-scheduled':
    case 'utility-activated':   return 'utility';
    default:                     return 'all';
  }
}

interface Props {
  propertyId: string;
  role: 'admin' | 'investor';
  onNavigateInquiry?: (inquiryId: string) => void;
}

export function TimelineTab({ propertyId, role, onNavigateInquiry }: Props) {
  const [events, setEvents] = useState<TimelineEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<FilterKey>('all');

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetchPropertyTimeline(propertyId, role)
      .then(list => { if (!cancelled) { setEvents(list); setError(null); } })
      .catch(err => { if (!cancelled) setError(err?.message || 'שגיאה בטעינה'); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [propertyId, role]);

  const filtered = useMemo(() => {
    if (filter === 'all') return events;
    return events.filter(e => eventFilter(e) === filter);
  }, [events, filter]);

  const chips: { key: FilterKey; label: string }[] = [
    { key: 'all',        label: 'הכל' },
    { key: 'photo',      label: '📸 תמונות' },
    { key: 'status',     label: '🔄 סטטוס' },
    { key: 'inquiry',    label: '💬 פניות' },
    { key: 'utility',    label: '⚡ Utilities' },
  ];
  if (role === 'admin') {
    chips.splice(4, 0, { key: 'renovation', label: '🔨 תשלומים' });
  }

  if (loading) {
    return <div style={{ padding: 24, textAlign: 'center', color: 'var(--text-secondary)', fontSize: 13 }}>טוען ציר זמן…</div>;
  }
  if (error) {
    return <div style={{ padding: 24, textAlign: 'center', color: '#ff4d4d', fontSize: 13 }}>שגיאה: {error}</div>;
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {/* Filter chips */}
      <div style={{
        display: 'flex', gap: 6, overflowX: 'auto', padding: '2px 0 6px',
        flexDirection: 'row-reverse', scrollbarWidth: 'none',
      }}>
        {chips.map(c => (
          <button
            key={c.key}
            onClick={() => setFilter(c.key)}
            style={{
              padding: '6px 14px', borderRadius: 100,
              background: filter === c.key ? 'var(--gold, #C9A84C)' : 'var(--bg-chip)',
              color: filter === c.key ? '#000' : 'var(--text-secondary)',
              border: '1px solid var(--border)',
              fontSize: 11, fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap', flexShrink: 0,
            }}
          >
            {c.label}
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <div style={{ padding: '24px 14px', textAlign: 'center', color: 'var(--text-secondary)' }}>
          <div style={{ fontSize: 36, marginBottom: 10 }}>📭</div>
          <div style={{ fontSize: 13 }}>אין אירועים להצגה</div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {filtered.map(ev => {
            const isClickable = ev.href?.startsWith('#inquiry-') && onNavigateInquiry;
            const handleClick = () => {
              if (ev.href?.startsWith('#inquiry-') && onNavigateInquiry) {
                onNavigateInquiry(ev.href.slice('#inquiry-'.length));
              }
            };
            return (
              <div
                key={ev.id}
                onClick={isClickable ? handleClick : undefined}
                style={{
                  display: 'flex', flexDirection: 'row-reverse', alignItems: 'flex-start',
                  gap: 10, padding: 12, borderRadius: 12, background: 'var(--bg-surface)',
                  border: '1px solid var(--border)',
                  cursor: isClickable ? 'pointer' : 'default',
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
                  {ev.subtitle && (
                    <div style={{
                      fontSize: 11, color: 'var(--text-secondary)', lineHeight: 1.5,
                      overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                    }}>{ev.subtitle}</div>
                  )}
                  <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 4 }}>{relativeTimeHe(ev.at)}</div>
                </div>
                {ev.thumbnailUrl && (
                  <img src={ev.thumbnailUrl} alt=""
                       style={{ width: 52, height: 52, borderRadius: 8, objectFit: 'cover', flexShrink: 0 }} />
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
