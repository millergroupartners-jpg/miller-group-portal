import { useNavigation } from '../../context/NavigationContext';
import { useUser } from '../../context/UserContext';
import { useOpenInquiryCount } from '../../hooks/useOpenInquiryCount';
import type { Screen } from '../../types';

const GOLD = '#C9A84C';

interface Tab {
  id: Screen;
  label: string;
  icon: (active: boolean) => JSX.Element;
}

const INVESTOR_TABS: Tab[] = [
  {
    id: 'dashboard',
    label: 'נכסים',
    icon: active => (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none"
        stroke={active ? GOLD : 'var(--tab-icon)'}
        strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"
        style={{ transition: 'stroke 0.15s' }}>
        <path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z" />
      </svg>
    ),
  },
  {
    id: 'documents',
    label: 'מסמכים',
    icon: active => (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none"
        stroke={active ? GOLD : 'var(--tab-icon)'}
        strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"
        style={{ transition: 'stroke 0.15s' }}>
        <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
        <polyline points="14 2 14 8 20 8" />
      </svg>
    ),
  },
  {
    id: 'media',
    label: 'מדיה',
    icon: active => (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none"
        stroke={active ? GOLD : 'var(--tab-icon)'}
        strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"
        style={{ transition: 'stroke 0.15s' }}>
        <rect x="3" y="3" width="18" height="18" rx="2" />
        <circle cx="8.5" cy="8.5" r="1.5" strokeWidth="1.5" />
        <polyline points="21 15 16 10 5 21" />
      </svg>
    ),
  },
  {
    id: 'inquiries',
    label: 'פניות',
    icon: active => (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none"
        stroke={active ? GOLD : 'var(--tab-icon)'}
        strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"
        style={{ transition: 'stroke 0.15s' }}>
        <path d="M21 11.5a8.38 8.38 0 01-.9 3.8 8.5 8.5 0 01-7.6 4.7 8.38 8.38 0 01-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 01-.9-3.8 8.5 8.5 0 014.7-7.6 8.38 8.38 0 013.8-.9h.5a8.48 8.48 0 018 8v.5z" />
      </svg>
    ),
  },
  {
    id: 'settings',
    label: 'הגדרות',
    icon: active => (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none"
        stroke={active ? GOLD : 'var(--tab-icon)'}
        strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"
        style={{ transition: 'stroke 0.15s' }}>
        <circle cx="12" cy="12" r="3" />
        <path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z" strokeWidth="1.5" />
      </svg>
    ),
  },
];

const ADMIN_TABS: Tab[] = [
  {
    id: 'admin-dashboard',
    label: 'לוח',
    icon: active => (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none"
        stroke={active ? GOLD : 'var(--tab-icon)'}
        strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"
        style={{ transition: 'stroke 0.15s' }}>
        <rect x="3" y="3" width="7" height="9" />
        <rect x="14" y="3" width="7" height="5" />
        <rect x="14" y="12" width="7" height="9" />
        <rect x="3" y="16" width="7" height="5" />
      </svg>
    ),
  },
  {
    id: 'admin-investors',
    label: 'משקיעים',
    icon: active => (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none"
        stroke={active ? GOLD : 'var(--tab-icon)'}
        strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"
        style={{ transition: 'stroke 0.15s' }}>
        <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" />
        <circle cx="9" cy="7" r="4" />
        <path d="M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75" />
      </svg>
    ),
  },
  {
    id: 'admin-properties',
    label: 'נכסים',
    icon: active => (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none"
        stroke={active ? GOLD : 'var(--tab-icon)'}
        strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"
        style={{ transition: 'stroke 0.15s' }}>
        <path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z" />
      </svg>
    ),
  },
  {
    id: 'admin-mg-deals',
    label: 'מילר',
    icon: active => (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none"
        stroke={active ? GOLD : 'var(--tab-icon)'}
        strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"
        style={{ transition: 'stroke 0.15s' }}>
        <path d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16" />
        <path d="M9 21V11h6v10" />
        <path d="M9 7h.01M13 7h.01" />
      </svg>
    ),
  },
  {
    id: 'admin-inquiries',
    label: 'פניות',
    icon: active => (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none"
        stroke={active ? GOLD : 'var(--tab-icon)'}
        strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"
        style={{ transition: 'stroke 0.15s' }}>
        <path d="M21 11.5a8.38 8.38 0 01-.9 3.8 8.5 8.5 0 01-7.6 4.7 8.38 8.38 0 01-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 01-.9-3.8 8.5 8.5 0 014.7-7.6 8.38 8.38 0 013.8-.9h.5a8.48 8.48 0 018 8v.5z" />
      </svg>
    ),
  },
  {
    id: 'admin-closings',
    label: 'סגירות',
    icon: active => (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none"
        stroke={active ? GOLD : 'var(--tab-icon)'}
        strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"
        style={{ transition: 'stroke 0.15s' }}>
        <rect x="3" y="4" width="18" height="18" rx="2" />
        <line x1="16" y1="2" x2="16" y2="6" />
        <line x1="8" y1="2" x2="8" y2="6" />
        <line x1="3" y1="10" x2="21" y2="10" />
      </svg>
    ),
  },
];

interface BottomTabBarProps {
  active: Screen;
}

export function BottomTabBar({ active }: BottomTabBarProps) {
  const { navigate } = useNavigation();
  const { currentUser } = useUser();
  const isAdmin = Boolean(currentUser?.isAdmin);
  const openInquiryCount = useOpenInquiryCount();

  // When admin is viewing a property/documents/media, keep investor-style tabs so
  // docs/media are easy to reach (mirrors DesktopSidebar behavior).
  const adminInInvestorView = isAdmin && (
    active === 'property-detail' || active === 'documents' || active === 'media'
  );
  const TABS = (isAdmin && !adminInInvestorView) ? ADMIN_TABS : INVESTOR_TABS;

  return (
    <div className="tab-bar">
      {TABS.map(tab => {
        const isActive =
          active === tab.id ||
          (active === 'property-detail' && tab.id === 'dashboard') ||
          (active === 'admin-investor-detail' && tab.id === 'admin-investors');
        const showBadge = (tab.id === 'inquiries' || tab.id === 'admin-inquiries') && openInquiryCount > 0;
        return (
          <div
            key={tab.id}
            className="tab-item"
            onClick={() => navigate(isAdmin && tab.id === 'dashboard' ? 'admin-properties' : tab.id)}
            style={{ position: 'relative' }}
          >
            {tab.icon(isActive)}
            <span style={{ color: isActive ? GOLD : 'var(--tab-icon)' }}>{tab.label}</span>
            {isActive && <div className="tab-dot" />}
            {showBadge && (
              <div style={{
                position: 'absolute',
                top: 0,
                right: 4,
                minWidth: 16,
                height: 16,
                padding: '0 4px',
                borderRadius: 100,
                background: '#ff4d4d',
                color: '#fff',
                fontSize: 9,
                fontWeight: 800,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                border: '1.5px solid var(--bg-tab)',
                lineHeight: 1,
              }}>{openInquiryCount > 9 ? '9+' : openInquiryCount}</div>
            )}
          </div>
        );
      })}
    </div>
  );
}
