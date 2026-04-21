import { useNavigation } from '../../context/NavigationContext';
import { useTheme } from '../../context/ThemeContext';
import { useUser } from '../../context/UserContext';
import { MGLogo } from '../common/MGLogo';
import { GoldDivider } from '../common/GoldDivider';
import { BottomTabBar } from '../common/BottomTabBar';
import { MOCK_USER } from '../../data/user';

const GOLD = '#C9A84C';

function SettingRow({ icon, label, value, onPress, danger }: {
  icon: React.ReactNode;
  label: string;
  value?: string;
  onPress?: () => void;
  danger?: boolean;
}) {
  return (
    <div
      onClick={onPress}
      style={{
        display: 'flex', alignItems: 'center', gap: 14,
        padding: '14px 16px',
        cursor: onPress ? 'pointer' : 'default',
        transition: 'background 0.12s',
        flexDirection: 'row-reverse',
      }}
      onMouseEnter={e => { if (onPress) (e.currentTarget as HTMLDivElement).style.background = 'var(--bg-surface-hover)'; }}
      onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.background = 'transparent'; }}
    >
      <div style={{
        width: 38, height: 38, borderRadius: 10,
        background: danger ? 'rgba(255,59,48,0.12)' : 'var(--bg-chip)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        flexShrink: 0,
      }}>
        {icon}
      </div>
      <div style={{ flex: 1, textAlign: 'right' }}>
        <div style={{ fontSize: 14, fontWeight: 500, color: danger ? '#ff3b30' : 'var(--text-primary)' }}>{label}</div>
        {value && <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 2 }}>{value}</div>}
      </div>
      {onPress && !danger && (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" strokeWidth="2" strokeLinecap="round">
          <path d="M9 18l-6-6 6-6" />
        </svg>
      )}
    </div>
  );
}

function SectionCard({ children }: { children: React.ReactNode }) {
  return (
    <div className="gold-card" style={{ overflow: 'hidden', marginBottom: 16 }}>
      {children}
    </div>
  );
}

function Divider() {
  return <div style={{ height: 1, background: 'var(--divider)', marginRight: 68 }} />;
}

export function SettingsScreen() {
  const { resetTo, navigate } = useNavigation();
  const { theme, toggleTheme } = useTheme();
  const { currentUser, setCurrentUser } = useUser();
  const user = currentUser ?? MOCK_USER;

  const handleLogout = () => {
    setCurrentUser(null);
    resetTo('login');
  };

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: 'var(--bg-base)', overflow: 'hidden' }}>
      {/* Header */}
      <div className="screen-header" style={{ padding: '16px 20px 12px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
        <MGLogo size={36} showWordmark={false} />
        <span style={{ fontFamily: 'var(--font-ui)', fontSize: 22, fontWeight: 700, color: 'var(--text-primary)' }}>
          הגדרות
        </span>
      </div>
      <GoldDivider />

      <div style={{ flex: 1, overflowY: 'auto', padding: '16px 20px' }}>

        {/* Profile card */}
        <div className="gold-card" style={{ padding: '16px', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 14, flexDirection: 'row-reverse' }}>
          <div style={{
            width: 52, height: 52, borderRadius: '50%',
            background: 'linear-gradient(135deg, #C9A84C, #8a6a28)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
          }}>
            <span style={{ fontSize: 20, fontWeight: 700, color: '#000' }}>{user.initials}</span>
          </div>
          <div style={{ flex: 1, textAlign: 'right' }}>
            <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-primary)' }}>{user.fullNameHe}</div>
            <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 2, direction: 'ltr', textAlign: 'right' }}>{user.email}</div>
            <div style={{ marginTop: 6, display: 'inline-flex', alignItems: 'center', gap: 4, background: user.isAdmin ? 'rgba(10,132,255,0.12)' : 'var(--gold-dim)', borderRadius: 100, padding: '2px 10px' }}>
              <span style={{ fontSize: 11, fontWeight: 600, color: user.isAdmin ? '#0a84ff' : GOLD }}>
                {user.isAdmin ? '🔑 אדמין' : '👤 משקיע'}
              </span>
            </div>
          </div>
        </div>

        {/* Account */}
        <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-secondary)', textAlign: 'right', marginBottom: 8, paddingRight: 4 }}>
          חשבון
        </div>
        <SectionCard>
          <SettingRow
            icon={<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={GOLD} strokeWidth="1.8" strokeLinecap="round"><path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>}
            label="שם מלא"
            value={user.fullNameHe}
          />
          <Divider />
          <SettingRow
            icon={<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={GOLD} strokeWidth="1.8" strokeLinecap="round"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>}
            label="אימייל"
            value={user.email}
          />
          <Divider />
          <SettingRow
            icon={<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={GOLD} strokeWidth="1.8" strokeLinecap="round"><path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07A19.5 19.5 0 013.07 9.81a19.79 19.79 0 01-3.07-8.67A2 2 0 012 .84h3a2 2 0 012 1.72c.127.96.361 1.903.7 2.81a2 2 0 01-.45 2.11L6.09 8.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0122 16.92z"/></svg>}
            label="טלפון"
            value={user.phone}
          />
          <Divider />
          <SettingRow
            icon={<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={GOLD} strokeWidth="1.8" strokeLinecap="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>}
            label="משקיע מאז"
            value={user.investorSince}
          />
        </SectionCard>

        {/* Appearance */}
        <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-secondary)', textAlign: 'right', marginBottom: 8, paddingRight: 4 }}>
          תצוגה
        </div>
        <SectionCard>
          <div
            onClick={toggleTheme}
            style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 16px', cursor: 'pointer', flexDirection: 'row-reverse' }}
            onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.background = 'var(--bg-surface-hover)'; }}
            onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.background = 'transparent'; }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 14, flexDirection: 'row-reverse' }}>
              <div style={{ width: 38, height: 38, borderRadius: 10, background: 'var(--bg-chip)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <span style={{ fontSize: 18 }}>{theme === 'dark' ? '🌙' : '☀️'}</span>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: 14, fontWeight: 500, color: 'var(--text-primary)' }}>מצב תצוגה</div>
                <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 2 }}>{theme === 'dark' ? 'כהה' : 'בהיר'}</div>
              </div>
            </div>
            {/* Toggle switch */}
            <div style={{
              width: 44, height: 26, borderRadius: 13,
              background: theme === 'dark' ? GOLD : '#ddd',
              position: 'relative', transition: 'background 0.2s', flexShrink: 0,
            }}>
              <div style={{
                width: 20, height: 20, borderRadius: '50%', background: '#fff',
                position: 'absolute', top: 3,
                right: theme === 'dark' ? 3 : undefined,
                left: theme === 'dark' ? undefined : 3,
                transition: 'left 0.2s, right 0.2s',
                boxShadow: '0 1px 3px rgba(0,0,0,0.3)',
              }} />
            </div>
          </div>
        </SectionCard>

        {/* Admin panel link */}
        {user.isAdmin && (
          <>
            <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-secondary)', textAlign: 'right', marginBottom: 8, paddingRight: 4 }}>
              ניהול
            </div>
            <SectionCard>
              <SettingRow
                icon={<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#0a84ff" strokeWidth="1.8" strokeLinecap="round"><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 00-3-3.87"/><path d="M16 3.13a4 4 0 010 7.75"/></svg>}
                label="פאנל אדמין"
                value="ניהול משקיעים ונכסים"
                onPress={() => navigate('admin-dashboard')}
              />
            </SectionCard>
          </>
        )}

        {/* About */}
        <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-secondary)', textAlign: 'right', marginBottom: 8, paddingRight: 4 }}>
          אודות
        </div>
        <SectionCard>
          <SettingRow
            icon={<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={GOLD} strokeWidth="1.8" strokeLinecap="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>}
            label="גרסה"
            value="1.0.0 (Build 2026.04)"
          />
          <Divider />
          <SettingRow
            icon={<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={GOLD} strokeWidth="1.8" strokeLinecap="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>}
            label="מדיניות פרטיות"
            onPress={() => {}}
          />
        </SectionCard>

        {/* Sign out */}
        <SectionCard>
          <SettingRow
            icon={<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#ff3b30" strokeWidth="1.8" strokeLinecap="round"><path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>}
            label="התנתקות"
            onPress={handleLogout}
            danger
          />
        </SectionCard>

      </div>

      <BottomTabBar active="settings" />
    </div>
  );
}
