import { useState } from 'react';

const GOLD = '#C9A84C';

interface Notification {
  id: string;
  title: string;
  body: string;
  date: string;
}

const ALL_NOTIFICATIONS: Notification[] = [
  {
    id: 'notif-portal-v2',
    title: 'פורטל המשקיעים עודכן — גרסה 2.0',
    body: 'פרטי חברת ניהול לכל נכס, יומן סגירות עם התראות חכמות, פידבק עכבר מלא ועיצוב מהיר יותר.',
    date: '22 אפריל 2026',
  },
  {
    id: 'notif-closings-week',
    title: 'תזכורת: סגירות השבוע',
    body: 'ישנן סגירות מתוכננות בשבוע הקרוב. כדאי לוודא תיאום עם המשקיעים הרלוונטיים.',
    date: '21 אפריל 2026',
  },
  {
    id: 'notif-welcome',
    title: 'ברוכים הבאים למערכת',
    body: 'כל הנתונים מסונכרנים עם Monday בזמן אמת. ניתן לנהל משקיעים, נכסים וסגירות ממקום אחד.',
    date: '15 אפריל 2026',
  },
];

const STORAGE_KEY = 'mg_dismissed_notifs_v1';

function getDismissed(): Set<string> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return new Set(raw ? JSON.parse(raw) : []);
  } catch {
    return new Set();
  }
}

function saveDismissed(ids: Set<string>) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify([...ids]));
  } catch {}
}

export function NotificationsPanel() {
  const [open, setOpen] = useState(false);
  const [dismissed, setDismissed] = useState<Set<string>>(getDismissed);

  const unread = ALL_NOTIFICATIONS.filter(n => !dismissed.has(n.id));
  const unreadCount = unread.length;

  const dismiss = (id: string) => {
    setDismissed(prev => {
      const next = new Set(prev);
      next.add(id);
      saveDismissed(next);
      return next;
    });
  };

  const dismissAll = () => {
    const all = new Set(ALL_NOTIFICATIONS.map(n => n.id));
    setDismissed(all);
    saveDismissed(all);
    setOpen(false);
  };

  return (
    <>
      {/* Bell button */}
      <button
        onClick={() => setOpen(o => !o)}
        title="התראות"
        style={{
          background: open ? `${GOLD}12` : 'none',
          border: 'none', cursor: 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          width: 36, height: 36, borderRadius: 10,
          position: 'relative', transition: 'background 0.15s',
          flexShrink: 0,
        }}
        onMouseOver={e => (e.currentTarget.style.background = `${GOLD}18`)}
        onMouseOut={e => (e.currentTarget.style.background = open ? `${GOLD}12` : 'none')}
      >
        <svg width="19" height="19" viewBox="0 0 24 24" fill="none"
          stroke={unreadCount > 0 ? GOLD : 'var(--tab-icon)'}
          strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
          <path d="M13.73 21a2 2 0 0 1-3.46 0" />
        </svg>
        {unreadCount > 0 && (
          <div style={{
            position: 'absolute', top: 5, right: 5,
            width: 15, height: 15, borderRadius: '50%',
            background: '#ff4d4d',
            fontSize: 8, fontWeight: 800, color: '#fff',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            border: '1.5px solid var(--bg-base)',
            lineHeight: 1,
          }}>{unreadCount}</div>
        )}
      </button>

      {/* Overlay backdrop */}
      {open && (
        <div
          style={{ position: 'fixed', inset: 0, zIndex: 200 }}
          onClick={() => setOpen(false)}
        />
      )}

      {/* Panel */}
      {open && (
        <div style={{
          position: 'fixed',
          top: 72,
          left: '50%',
          transform: 'translateX(-50%)',
          width: 'min(420px, calc(100vw - 32px))',
          zIndex: 201,
          background: 'var(--bg-surface)',
          borderRadius: 16,
          border: '1px solid var(--border)',
          boxShadow: '0 14px 48px rgba(0,0,0,0.55)',
          overflow: 'hidden',
          animation: 'slideDownNotif 0.2s ease',
        }}>
          {/* Header */}
          <div style={{
            padding: '14px 18px',
            borderBottom: '1px solid var(--border)',
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          }}>
            <button
              onClick={dismissAll}
              style={{
                background: 'none', border: 'none',
                fontSize: 11, color: 'var(--text-secondary)',
                cursor: 'pointer', transition: 'color 0.15s',
              }}
              onMouseOver={e => (e.currentTarget.style.color = GOLD)}
              onMouseOut={e => (e.currentTarget.style.color = 'var(--text-secondary)')}
            >נקה הכל</button>
            <div style={{
              fontSize: 14, fontWeight: 700, color: 'var(--text-primary)',
              display: 'flex', alignItems: 'center', gap: 8,
            }}>
              <span>התראות</span>
              {unreadCount > 0 && (
                <span style={{
                  fontSize: 9, fontWeight: 800, color: '#fff',
                  background: '#ff4d4d', borderRadius: '50%',
                  width: 18, height: 18,
                  display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                }}>{unreadCount}</span>
              )}
            </div>
          </div>

          {/* Notification list */}
          {unread.length === 0 ? (
            <div style={{
              padding: '32px 18px', textAlign: 'center',
              color: 'var(--text-secondary)', fontSize: 13,
            }}>
              ✓ אין התראות חדשות
            </div>
          ) : (
            <div style={{ maxHeight: 380, overflowY: 'auto' }}>
              {unread.map((n, i) => (
                <div
                  key={n.id}
                  className="interactive"
                  onClick={() => dismiss(n.id)}
                  style={{
                    padding: '14px 18px',
                    borderBottom: i < unread.length - 1 ? '1px solid var(--divider)' : 'none',
                    cursor: 'pointer',
                    display: 'flex', gap: 12, flexDirection: 'row-reverse', alignItems: 'flex-start',
                  }}
                >
                  <div style={{
                    width: 7, height: 7, borderRadius: '50%',
                    background: GOLD, flexShrink: 0, marginTop: 6,
                  }} />
                  <div style={{ flex: 1, textAlign: 'right' }}>
                    <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 4 }}>
                      {n.title}
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--text-secondary)', lineHeight: 1.6 }}>
                      {n.body}
                    </div>
                    <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 6 }}>
                      {n.date}
                    </div>
                  </div>
                  <button
                    onClick={e => { e.stopPropagation(); dismiss(n.id); }}
                    style={{
                      background: 'none', border: 'none',
                      color: 'var(--text-muted)', cursor: 'pointer',
                      fontSize: 18, lineHeight: 1, padding: '0 2px', flexShrink: 0,
                      transition: 'color 0.15s',
                    }}
                    onMouseOver={e => (e.currentTarget.style.color = '#ff4d4d')}
                    onMouseOut={e => (e.currentTarget.style.color = 'var(--text-muted)')}
                  >×</button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </>
  );
}
