import { useState, useEffect, useMemo } from 'react';
import { useUser } from '../../context/UserContext';
import { useMondayData } from '../../context/MondayDataContext';
import { useNavigation } from '../../context/NavigationContext';
import { listInquiries, parseReplyAuthor, type Inquiry } from '../../services/inquiriesApi';
import type { MondayProperty } from '../../services/mondayApi';

const GOLD = '#C9A84C';

/**
 * Each notification has a stable ID derived from the underlying event
 * (inquiry ID, reply ID, property ID + closing date). Once the user
 * dismisses a notification, we remember its ID in localStorage so the
 * same notification never comes back — but a new event (new reply,
 * new inquiry, new closing date) produces a different ID and thus
 * appears as fresh.
 */
interface Notification {
  id: string;
  title: string;
  body: string;
  date: string;
  target?: { screen: 'inquiries' | 'admin-inquiries' | 'admin-closings' | 'property-detail'; propertyId?: string };
  accentColor?: string;
}

/**
 * System/version notification — bump the id whenever you want to announce a
 * new portal update to all users. Once a user dismisses a specific version,
 * it never comes back for them. New versions produce a new id → appears fresh.
 */
const PORTAL_VERSION_NOTIF = {
  id: 'portal-v2.1',
  title: 'פורטל עודכן — גרסה 2.1',
  body: 'פעמון התראות חכם (מבוסס פעילות אמיתית), פניות דו-כיווניות עם קבצים מצורפים, ותיקוני תצוגה במובייל.',
  date: '23 אפר׳ 2026',
};

const STORAGE_KEY = 'mg_dismissed_notifs_v2';

function getDismissed(): Set<string> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return new Set(raw ? JSON.parse(raw) : []);
  } catch { return new Set(); }
}
function saveDismissed(ids: Set<string>) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify([...ids])); } catch {}
}

function fmtDateHe(iso: string): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '';
  return d.toLocaleDateString('he-IL', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
}

function buildNotifications(opts: {
  isAdmin: boolean;
  investorMondayId: string;
  inquiries: Inquiry[];
  relevantProperties: MondayProperty[];
}): Notification[] {
  const { isAdmin, investorMondayId, inquiries, relevantProperties } = opts;
  const out: Notification[] = [];

  // ── System notifications (welcome + portal version) ────────────
  // Welcome — ONLY for an investor, once per investorId (different each investor)
  if (!isAdmin && investorMondayId) {
    out.push({
      id: `welcome-${investorMondayId}`,
      title: 'ברוכים הבאים לפורטל המשקיעים',
      body: 'כאן תוכל לצפות בנכסים שלך, לקבל את המסמכים והתמונות העדכניות, ולפתוח פניות ישירות להנהלה.',
      date: '',
      accentColor: GOLD,
    });
  }
  // Portal version — for everyone, once per version (bump PORTAL_VERSION_NOTIF.id on future updates)
  out.push({
    id: PORTAL_VERSION_NOTIF.id,
    title: PORTAL_VERSION_NOTIF.title,
    body: PORTAL_VERSION_NOTIF.body,
    date: PORTAL_VERSION_NOTIF.date,
    accentColor: GOLD,
  });

  // ── Inquiry notifications ─────────────────────────────────────
  for (const inq of inquiries) {
    if (inq.status === 'Resolved') continue;

    if (isAdmin) {
      // Admin: any non-resolved inquiry from investors
      if (inq.direction === 'Investor→Management') {
        // Latest reply authored by the investor (functional author, parsed from body)
        const latestInvReply = [...inq.replies].reverse().find(r => !parseReplyAuthor(r).isAdmin);
        const eventId = latestInvReply?.id ?? `${inq.id}-initial`;
        const isNew = inq.status === 'New';
        out.push({
          id: `inq-${inq.id}-${eventId}`,
          title: isNew
            ? `פנייה חדשה מאת ${inq.investorName}`
            : `תגובה מאת ${inq.investorName}`,
          body: inq.subject,
          date: fmtDateHe(inq.updatedAt),
          target: { screen: 'admin-inquiries' },
          accentColor: '#64B5F6',
        });
      }
    } else {
      // Investor: only my own inquiries
      if (inq.investorId !== investorMondayId) continue;

      // Latest reply authored by admin (parsed from body)
      const latestAdminReply = [...inq.replies].reverse().find(r => parseReplyAuthor(r).isAdmin);
      if (latestAdminReply) {
        out.push({
          id: `inq-${inq.id}-reply-${latestAdminReply.id}`,
          title: inq.direction === 'Management→Investor' && inq.replies[0]?.id === latestAdminReply.id
            ? `פנייה חדשה מההנהלה`
            : `תגובה חדשה מההנהלה`,
          body: inq.subject,
          date: fmtDateHe(latestAdminReply.createdAt),
          target: { screen: 'inquiries' },
          accentColor: GOLD,
        });
      }
    }
  }

  // ── Closing-date notifications (only for user's actual properties) ─
  const now = Date.now();
  const cutoff = now + 7 * 24 * 3600 * 1000;
  for (const p of relevantProperties) {
    if (!p.closingDate) continue;
    const d = new Date(p.closingDate).getTime();
    if (isNaN(d)) continue;
    if (d < now || d > cutoff) continue;
    const days = Math.round((d - now) / 86400000);
    out.push({
      id: `closing-${p.mondayId}-${p.closingDate}`,
      title: days === 0 ? `סגירה היום — ${p.address}` : `סגירה בעוד ${days} ${days === 1 ? 'יום' : 'ימים'}`,
      body: `${p.address} · ${p.city}`,
      date: p.closingDate,
      target: { screen: 'property-detail', propertyId: p.mondayId },
      accentColor: '#ff9800',
    });
  }

  return out;
}

export function NotificationsPanel() {
  const { currentUser } = useUser();
  const { properties, mgProperties, investors } = useMondayData();
  const { navigate } = useNavigation();

  const [open, setOpen] = useState(false);
  const [dismissed, setDismissed] = useState<Set<string>>(getDismissed);
  const [inquiries, setInquiries] = useState<Inquiry[]>([]);

  const isAdmin = Boolean(currentUser?.isAdmin);
  const investorMondayId = currentUser?.mondayInvestorId ?? '';

  // Fetch inquiries (polling)
  useEffect(() => {
    if (!currentUser) return;
    let cancelled = false;
    const fetchOnce = () => {
      listInquiries(isAdmin ? undefined : investorMondayId)
        .then(list => { if (!cancelled) setInquiries(list); })
        .catch(() => {});
    };
    fetchOnce();
    const t = window.setInterval(fetchOnce, 60_000);
    return () => { cancelled = true; window.clearInterval(t); };
  }, [currentUser?.id, isAdmin, investorMondayId]);

  const relevantProperties = useMemo<MondayProperty[]>(() => {
    if (!currentUser) return [];
    if (isAdmin) return [...properties, ...mgProperties];
    const inv = investors.find(i => i.mondayId === investorMondayId);
    return inv?.properties ?? [];
  }, [currentUser, isAdmin, investorMondayId, properties, mgProperties, investors]);

  const all = useMemo(() => buildNotifications({
    isAdmin, investorMondayId, inquiries, relevantProperties,
  }), [isAdmin, investorMondayId, inquiries, relevantProperties]);

  const unread = all.filter(n => !dismissed.has(n.id));
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
    const allIds = new Set([...dismissed, ...all.map(n => n.id)]);
    setDismissed(allIds);
    saveDismissed(allIds);
    setOpen(false);
  };

  const clickNotification = (n: Notification) => {
    dismiss(n.id);
    setOpen(false);
    if (n.target) {
      if (n.target.screen === 'property-detail' && n.target.propertyId) {
        navigate('property-detail', { propertyId: n.target.propertyId });
      } else {
        navigate(n.target.screen);
      }
    }
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
            minWidth: 15, height: 15, padding: '0 3px', borderRadius: '50%',
            background: '#ff4d4d',
            fontSize: 8, fontWeight: 800, color: '#fff',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            border: '1.5px solid var(--bg-base)',
            lineHeight: 1,
          }}>{unreadCount > 9 ? '9+' : unreadCount}</div>
        )}
      </button>

      {/* Overlay backdrop */}
      {open && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 200 }} onClick={() => setOpen(false)} />
      )}

      {/* Panel */}
      {open && (
        <div style={{
          position: 'fixed', top: 72, left: '50%', transform: 'translateX(-50%)',
          width: 'min(420px, calc(100vw - 32px))', zIndex: 201,
          background: 'var(--bg-surface)',
          borderRadius: 16, border: '1px solid var(--border)',
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
            {unreadCount > 0 ? (
              <button
                onClick={dismissAll}
                style={{ background: 'none', border: 'none', fontSize: 11, color: 'var(--text-secondary)', cursor: 'pointer' }}
              >נקה הכל</button>
            ) : <span />}
            <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: 8 }}>
              <span>התראות</span>
              {unreadCount > 0 && (
                <span style={{
                  fontSize: 9, fontWeight: 800, color: '#fff',
                  background: '#ff4d4d', borderRadius: '50%',
                  minWidth: 18, height: 18, padding: '0 4px',
                  display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                }}>{unreadCount}</span>
              )}
            </div>
          </div>

          {/* List */}
          {unread.length === 0 ? (
            <div style={{ padding: '32px 18px', textAlign: 'center', color: 'var(--text-secondary)', fontSize: 13 }}>
              ✓ אין התראות חדשות
            </div>
          ) : (
            <div style={{ maxHeight: 380, overflowY: 'auto' }}>
              {unread.map((n, i) => (
                <div
                  key={n.id}
                  className="interactive"
                  onClick={() => clickNotification(n)}
                  style={{
                    padding: '14px 18px',
                    borderBottom: i < unread.length - 1 ? '1px solid var(--divider)' : 'none',
                    cursor: 'pointer',
                    display: 'flex', gap: 12, flexDirection: 'row-reverse', alignItems: 'flex-start',
                  }}
                >
                  <div style={{
                    width: 7, height: 7, borderRadius: '50%',
                    background: n.accentColor || GOLD, flexShrink: 0, marginTop: 6,
                  }} />
                  <div style={{ flex: 1, textAlign: 'right' }}>
                    <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 4 }}>{n.title}</div>
                    <div style={{ fontSize: 11, color: 'var(--text-secondary)', lineHeight: 1.6 }}>{n.body}</div>
                    {n.date && <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 6 }}>{n.date}</div>}
                  </div>
                  <button
                    onClick={e => { e.stopPropagation(); dismiss(n.id); }}
                    style={{
                      background: 'none', border: 'none',
                      color: 'var(--text-muted)', cursor: 'pointer',
                      fontSize: 18, lineHeight: 1, padding: '0 2px', flexShrink: 0,
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
