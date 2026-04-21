import { useNavigation } from '../../context/NavigationContext';
import type { Screen } from '../../types';

const GOLD = '#C9A84C';

const TABS = [
  {
    id: 'dashboard' as Screen,
    label: 'נכסים',
    icon: (active: boolean) => (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none"
        stroke={active ? GOLD : 'var(--tab-icon)'}
        strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"
        style={{ transition: 'stroke 0.15s' }}>
        <path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z" />
      </svg>
    ),
  },
  {
    id: 'documents' as Screen,
    label: 'מסמכים',
    icon: (active: boolean) => (
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
    id: 'media' as Screen,
    label: 'מדיה',
    icon: (active: boolean) => (
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
    id: 'settings' as Screen,
    label: 'הגדרות',
    icon: (active: boolean) => (
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

interface BottomTabBarProps {
  active: Screen;
}

export function BottomTabBar({ active }: BottomTabBarProps) {
  const { navigate } = useNavigation();

  return (
    <div className="tab-bar">
      {TABS.map(tab => {
        const isActive = active === tab.id || (active === 'property-detail' && tab.id === 'dashboard');
        return (
          <div
            key={tab.id}
            className="tab-item"
            onClick={() => navigate(tab.id)}
          >
            {tab.icon(isActive)}
            <span style={{ color: isActive ? GOLD : 'var(--tab-icon)' }}>{tab.label}</span>
            {isActive && <div className="tab-dot" />}
          </div>
        );
      })}
    </div>
  );
}
