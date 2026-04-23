/**
 * Floating action cluster shown only on mobile (hidden on desktop via CSS).
 * Contains: notifications bell, settings gear, and a conditional
 * "back to admin" button (when admin is viewing investor-style screens).
 */

import { useNavigation } from '../../context/NavigationContext';
import { useUser } from '../../context/UserContext';
import { NotificationsPanel } from './NotificationsPanel';
import type { Screen } from '../../types';

const GOLD = '#C9A84C';

const iconBtnStyle: React.CSSProperties = {
  background: 'var(--bg-surface)',
  border: '1px solid var(--border)',
  borderRadius: 10,
  width: 36, height: 36,
  display: 'flex', alignItems: 'center', justifyContent: 'center',
  cursor: 'pointer',
  transition: 'background 0.15s',
  padding: 0,
};

export function MobileTopActions({ active }: { active: Screen }) {
  const { navigate } = useNavigation();
  const { currentUser } = useUser();
  const isAdmin = Boolean(currentUser?.isAdmin);

  const investorStyleScreens: Screen[] = ['property-detail', 'documents', 'media'];
  const showBackToAdmin = isAdmin && investorStyleScreens.includes(active);

  return (
    <div className="mobile-top-actions">
      <NotificationsPanel />

      <button
        onClick={() => navigate('settings')}
        title="הגדרות"
        style={iconBtnStyle}
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none"
          stroke={active === 'settings' ? GOLD : 'var(--tab-icon)'}
          strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="3" />
          <path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z" strokeWidth="1.5"/>
        </svg>
      </button>

      {showBackToAdmin && (
        <button
          onClick={() => navigate('admin-dashboard')}
          title="חזרה לתפריט אדמין"
          style={{
            ...iconBtnStyle,
            background: `${GOLD}15`,
            borderColor: `${GOLD}55`,
            paddingRight: 8, paddingLeft: 10,
            width: 'auto',
            gap: 4,
          }}
        >
          <span style={{ fontSize: 11, fontWeight: 700, color: GOLD, whiteSpace: 'nowrap' }}>לאדמין</span>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
            stroke={GOLD} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M15 18l-6-6 6-6" />
          </svg>
        </button>
      )}
    </div>
  );
}
