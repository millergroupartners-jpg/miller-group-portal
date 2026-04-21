import { useNavigation } from '../../context/NavigationContext';
import { useUser } from '../../context/UserContext';
import { MGLogo } from './MGLogo';
import type { Screen } from '../../types';

const GOLD = '#C9A84C';

const TABS = [
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

  return (
    <aside className="desktop-sidebar">
      {/* Logo */}
      <div style={{ padding: '28px 24px 20px', borderBottom: '1px solid var(--border)' }}>
        <MGLogo size={40} />
      </div>

      {/* Nav */}
      <nav style={{ flex: 1, padding: '16px 12px', display: 'flex', flexDirection: 'column', gap: 4 }}>
        {TABS.map(tab => {
          const isActive = active === tab.id || (active === 'property-detail' && tab.id === 'dashboard');
          return (
            <button
              key={tab.id}
              onClick={() => navigate(tab.id)}
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
