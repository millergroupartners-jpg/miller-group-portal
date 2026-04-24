import { useNavigation } from '../../context/NavigationContext';
import { useUser } from '../../context/UserContext';
import { useTheme } from '../../context/ThemeContext';
import { MGLogo } from './MGLogo';
import { NotificationsPanel } from './NotificationsPanel';
import type { Screen } from '../../types';

const GOLD = '#C9A84C';

const INVESTOR_TABS = [
  {
    id: 'dashboard' as Screen,
    label: 'נכסים',
    icon: (active: boolean) => (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none"
        stroke={active ? GOLD : 'var(--tab-icon)'}
        strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z" />
      </svg>
    ),
  },
  {
    id: 'documents' as Screen,
    label: 'מסמכים',
    icon: (active: boolean) => (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none"
        stroke={active ? GOLD : 'var(--tab-icon)'}
        strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
        <polyline points="14 2 14 8 20 8" />
      </svg>
    ),
  },
  {
    id: 'media' as Screen,
    label: 'מדיה',
    icon: (active: boolean) => (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none"
        stroke={active ? GOLD : 'var(--tab-icon)'}
        strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="3" width="18" height="18" rx="2" />
        <circle cx="8.5" cy="8.5" r="1.5" strokeWidth="1.5" />
        <polyline points="21 15 16 10 5 21" />
      </svg>
    ),
  },
  {
    id: 'inquiries' as Screen,
    label: 'פניות',
    icon: (active: boolean) => (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none"
        stroke={active ? GOLD : 'var(--tab-icon)'}
        strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M21 11.5a8.38 8.38 0 01-.9 3.8 8.5 8.5 0 01-7.6 4.7 8.38 8.38 0 01-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 01-.9-3.8 8.5 8.5 0 014.7-7.6 8.38 8.38 0 013.8-.9h.5a8.48 8.48 0 018 8v.5z" />
      </svg>
    ),
  },
  {
    id: 'settings' as Screen,
    label: 'הגדרות',
    icon: (active: boolean) => (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none"
        stroke={active ? GOLD : 'var(--tab-icon)'}
        strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="3" />
        <path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z" strokeWidth="1.5" />
      </svg>
    ),
  },
];

const ADMIN_TABS = [
  {
    id: 'admin-dashboard' as Screen,
    label: 'לוח בקרה',
    icon: (active: boolean) => (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none"
        stroke={active ? GOLD : 'var(--tab-icon)'}
        strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="3" width="7" height="9" />
        <rect x="14" y="3" width="7" height="5" />
        <rect x="14" y="12" width="7" height="9" />
        <rect x="3" y="16" width="7" height="5" />
      </svg>
    ),
  },
  {
    id: 'admin-investors' as Screen,
    label: 'משקיעים',
    icon: (active: boolean) => (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none"
        stroke={active ? GOLD : 'var(--tab-icon)'}
        strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" />
        <circle cx="9" cy="7" r="4" />
        <path d="M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75" />
      </svg>
    ),
  },
  {
    id: 'admin-properties' as Screen,
    label: 'נכסי משקיעים',
    icon: (active: boolean) => (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none"
        stroke={active ? GOLD : 'var(--tab-icon)'}
        strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z" />
      </svg>
    ),
  },
  {
    id: 'admin-mg-deals' as Screen,
    label: 'Miller Group',
    icon: (active: boolean) => (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none"
        stroke={active ? GOLD : 'var(--tab-icon)'}
        strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16" />
        <path d="M9 21V11h6v10" />
        <path d="M9 7h.01M13 7h.01" />
      </svg>
    ),
  },
  {
    id: 'admin-closings' as Screen,
    label: 'יומן סגירות',
    icon: (active: boolean) => (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none"
        stroke={active ? GOLD : 'var(--tab-icon)'}
        strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="4" width="18" height="18" rx="2" />
        <line x1="16" y1="2" x2="16" y2="6" />
        <line x1="8" y1="2" x2="8" y2="6" />
        <line x1="3" y1="10" x2="21" y2="10" />
      </svg>
    ),
  },
  {
    id: 'admin-renovations' as Screen,
    label: 'שיפוצים',
    icon: (active: boolean) => (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none"
        stroke={active ? GOLD : 'var(--tab-icon)'}
        strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M14.7 6.3a1 1 0 000 1.4l1.6 1.6a1 1 0 001.4 0l3.77-3.77a6 6 0 01-7.94 7.94l-6.91 6.91a2.12 2.12 0 01-3-3l6.91-6.91a6 6 0 017.94-7.94l-3.76 3.76z" />
      </svg>
    ),
  },
  {
    id: 'admin-inquiries' as Screen,
    label: 'פניות',
    icon: (active: boolean) => (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none"
        stroke={active ? GOLD : 'var(--tab-icon)'}
        strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M21 11.5a8.38 8.38 0 01-.9 3.8 8.5 8.5 0 01-7.6 4.7 8.38 8.38 0 01-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 01-.9-3.8 8.5 8.5 0 014.7-7.6 8.38 8.38 0 013.8-.9h.5a8.48 8.48 0 018 8v.5z" />
      </svg>
    ),
  },
  {
    id: 'settings' as Screen,
    label: 'הגדרות',
    icon: (active: boolean) => (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none"
        stroke={active ? GOLD : 'var(--tab-icon)'}
        strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="3" />
        <path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z" strokeWidth="1.5" />
      </svg>
    ),
  },
];

export function DesktopSidebar({ active }: { active: Screen }) {
  const { navigate } = useNavigation();
  const { currentUser } = useUser();
  const { theme, toggleTheme } = useTheme();

  const isAdmin = Boolean(currentUser?.isAdmin);
  // Admin viewing a property or investor-style screen — show the same tabs an investor sees,
  // so documents/media are one click away. Otherwise (admin on an admin-* screen, or a real
  // investor), use the role-appropriate tab set.
  const adminInInvestorView = isAdmin && (
    active === 'property-detail' || active === 'documents' || active === 'media'
  );
  const TABS = (isAdmin && !adminInInvestorView) ? ADMIN_TABS : INVESTOR_TABS;

  return (
    <aside className="desktop-sidebar">
      {/* Logo + notifications bell */}
      <div style={{
        padding: '20px 16px 16px',
        borderBottom: '1px solid var(--border)',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      }}>
        <MGLogo size={40} />
        <NotificationsPanel />
      </div>

      {/* "Back to admin menu" button — only when admin is in investor-style view */}
      {adminInInvestorView && (
        <div style={{ padding: '14px 12px 4px' }}>
          <button
            onClick={() => navigate('admin-dashboard')}
            style={{
              display: 'flex', alignItems: 'center', gap: 10,
              padding: '10px 14px', borderRadius: 10, cursor: 'pointer',
              background: `${GOLD}12`, border: `1px solid ${GOLD}33`,
              width: '100%', textAlign: 'right',
              transition: 'background 0.15s',
            }}
            onMouseOver={e => (e.currentTarget.style.background = `${GOLD}22`)}
            onMouseOut={e => (e.currentTarget.style.background = `${GOLD}12`)}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
              stroke={GOLD} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M15 18l-6-6 6-6" />
            </svg>
            <span style={{
              fontFamily: 'var(--font-ui)', fontSize: 13, fontWeight: 600, color: GOLD,
            }}>
              חזרה לתפריט אדמין
            </span>
          </button>
        </div>
      )}

      {/* Nav */}
      <nav style={{ flex: 1, padding: '16px 12px', display: 'flex', flexDirection: 'column', gap: 4 }}>
        {TABS.map(tab => {
          const isActive =
            active === tab.id ||
            (active === 'property-detail' && tab.id === 'dashboard') ||
            (active === 'admin-investor-detail' && tab.id === 'admin-investors');
          return (
            <button
              key={tab.id}
              onClick={() => navigate(isAdmin && tab.id === 'dashboard' ? 'admin-properties' : tab.id)}
              style={{
                display: 'flex', alignItems: 'center', gap: 12,
                padding: '11px 14px', borderRadius: 10, border: 'none', cursor: 'pointer',
                background: isActive ? `${GOLD}15` : 'transparent',
                width: '100%', textAlign: 'right',
                transition: 'background 0.15s',
              }}
            >
              {tab.icon(isActive)}
              <span style={{
                fontFamily: 'var(--font-ui)', fontSize: 14, fontWeight: isActive ? 700 : 500,
                color: isActive ? GOLD : 'var(--text-secondary)',
              }}>
                {tab.label}
              </span>
              {isActive && (
                <div style={{
                  marginRight: 'auto', width: 4, height: 4, borderRadius: '50%', background: GOLD,
                }} />
              )}
            </button>
          );
        })}
      </nav>

      {/* Theme toggle */}
      <div style={{ padding: '8px 12px', borderTop: '1px solid var(--border)' }}>
        <button
          onClick={toggleTheme}
          style={{
            display: 'flex', alignItems: 'center', gap: 12,
            padding: '11px 14px', borderRadius: 10, border: 'none', cursor: 'pointer',
            background: 'transparent', width: '100%', textAlign: 'right',
            transition: 'background 0.15s',
          }}
          onMouseOver={e => (e.currentTarget.style.background = `${GOLD}10`)}
          onMouseOut={e => (e.currentTarget.style.background = 'transparent')}
        >
          {theme === 'dark' ? (
            /* Sun icon (click to go light) */
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none"
              stroke="var(--tab-icon)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="4" />
              <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41" />
            </svg>
          ) : (
            /* Moon icon (click to go dark) */
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none"
              stroke="var(--tab-icon)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
            </svg>
          )}
          <span style={{
            fontFamily: 'var(--font-ui)', fontSize: 14, fontWeight: 500,
            color: 'var(--text-secondary)',
          }}>
            {theme === 'dark' ? 'מצב בהיר' : 'מצב כהה'}
          </span>
        </button>
      </div>

      {/* User */}
      {currentUser && (
        <div style={{
          padding: '16px', borderTop: '1px solid var(--border)',
          display: 'flex', alignItems: 'center', gap: 12,
        }}>
          <div style={{
            width: 36, height: 36, borderRadius: '50%',
            background: `${GOLD}22`, border: `1px solid ${GOLD}44`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 13, fontWeight: 700, color: GOLD, flexShrink: 0,
          }}>
            {currentUser.initials}
          </div>
          <div style={{ overflow: 'hidden' }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {currentUser.fullNameHe}
            </div>
            <div style={{ fontSize: 11, color: 'var(--text-secondary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {currentUser.email}
            </div>
          </div>
        </div>
      )}
    </aside>
  );
}
