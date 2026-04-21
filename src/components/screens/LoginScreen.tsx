import { useState } from 'react';
import { useNavigation } from '../../context/NavigationContext';
import { useTheme } from '../../context/ThemeContext';
import { useUser } from '../../context/UserContext';
import { useMondayData } from '../../context/MondayDataContext';
import { findInvestorByEmailLive, setInvestorPassword } from '../../services/mondayApi';
import { MGLogo } from '../common/MGLogo';
import { GoldDivider } from '../common/GoldDivider';
import { ALL_USERS } from '../../data/user';
import type { User } from '../../data/user';

const GOLD = '#C9A84C';

type ForgotState = 'idle' | 'sending' | 'done' | 'notfound';

export function LoginScreen() {
  const { navigate } = useNavigation();
  const { theme, toggleTheme } = useTheme();
  const { setCurrentUser } = useUser();
  const { loading: mondayLoading } = useMondayData();
  const [email, setEmail] = useState('');
  const [pass, setPass] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // ── Forgot password state ──
  const [forgotMode, setForgotMode] = useState(false);
  const [forgotEmail, setForgotEmail] = useState('');
  const [forgotState, setForgotState] = useState<ForgotState>('idle');

  const handleLogin = async () => {
    setError('');

    // 1. Check static users (admin + demo) — local, instant
    const staticUser = ALL_USERS.find(
      u => u.email.toLowerCase() === email.toLowerCase() && u.password === pass
    );
    if (staticUser) {
      setLoading(true);
      setTimeout(() => {
        setLoading(false);
        setCurrentUser(staticUser);
        navigate(staticUser.isAdmin ? 'admin-dashboard' : 'dashboard');
      }, 800);
      return;
    }

    // 2. Query Monday directly — always live, never cached
    setLoading(true);
    try {
      const mondayInv = await findInvestorByEmailLive(email);
      if (!mondayInv) {
        setError('אימייל לא נמצא');
        return;
      }
      // First-time login: no password set yet
      if (!mondayInv.password) {
        navigate('set-password', {
          investorId: mondayInv.mondayId,
          investorName: mondayInv.fullName,
        });
        return;
      }
      // Verify password
      if (mondayInv.password === pass) {
        const nameParts = mondayInv.fullName.trim().split(/\s+/);
        const mondayUser: User = {
          id: mondayInv.mondayId,
          firstNameHe: nameParts[0] ?? mondayInv.fullName,
          lastNameHe: nameParts.slice(1).join(' '),
          fullNameHe: mondayInv.fullName,
          initials: mondayInv.initials,
          email: mondayInv.email,
          password: '',
          phone: mondayInv.phone,
          investorSince: mondayInv.investorSince,
          isAdmin: false,
          mondayInvestorId: mondayInv.mondayId,
        };
        setCurrentUser(mondayUser);
        navigate('dashboard');
        return;
      }
      setError('סיסמה שגויה');
    } catch {
      setError('שגיאת חיבור, נסה שוב');
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') handleLogin();
  };

  const handleForgot = async () => {
    if (!forgotEmail.trim()) return;
    setForgotState('sending');
    try {
      const inv = await findInvestorByEmailLive(forgotEmail.trim());
      if (!inv) { setForgotState('notfound'); return; }
      // Clear the password so next login → SetPasswordScreen
      await setInvestorPassword(inv.mondayId, '');
      setForgotState('done');
    } catch {
      setForgotState('notfound');
    }
  };

  return (
    <div style={{
      flex: 1, display: 'flex', flexDirection: 'column',
      background: 'var(--bg-base)', padding: '0 28px', overflowY: 'auto',
    }}>
      {/* Theme toggle */}
      <div style={{ display: 'flex', justifyContent: 'flex-start', paddingTop: 16 }}>
        <button onClick={toggleTheme} style={{
          background: 'transparent', border: '1px solid var(--border)',
          borderRadius: 100, padding: '5px 14px', cursor: 'pointer',
          display: 'flex', alignItems: 'center', gap: 6,
          fontFamily: 'var(--font-ui)', fontSize: 12, color: 'var(--text-secondary)',
        }}>
          <span style={{ fontSize: 14 }}>{theme === 'dark' ? '☀️' : '🌙'}</span>
          <span>{theme === 'dark' ? 'מצב בהיר' : 'מצב כהה'}</span>
        </button>
      </div>

      {/* Logo */}
      <div style={{ paddingTop: 24, paddingBottom: 32, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 20 }}>
        <MGLogo size={90} />
        <GoldDivider />
        <div style={{ textAlign: 'center' }}>
          <h1 style={{ fontFamily: 'var(--font-ui)', fontSize: 30, fontWeight: 700, color: 'var(--text-primary)', lineHeight: 1.2, marginBottom: 8 }}>
            ברוכים הבאים
          </h1>
          <p style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.6 }}>
            פורטל המשקיעים של MillerGroup
          </p>
        </div>
      </div>

      {/* ── Login form ── */}
      {!forgotMode && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div>
            <label style={{ display: 'block', fontSize: 12, color: 'var(--text-secondary)', marginBottom: 6 }}>דואר אלקטרוני</label>
            <input
              className="mg-input" type="email" placeholder="your@email.com"
              value={email} onChange={e => { setEmail(e.target.value); setError(''); }}
              onKeyDown={handleKeyDown} style={{ direction: 'ltr', textAlign: 'left' }}
            />
          </div>
          <div>
            <label style={{ display: 'block', fontSize: 12, color: 'var(--text-secondary)', marginBottom: 6 }}>סיסמה</label>
            <input
              className="mg-input" type="password" placeholder="••••••••"
              value={pass} onChange={e => { setPass(e.target.value); setError(''); }}
              onKeyDown={handleKeyDown}
            />
          </div>

          {error && (
            <div style={{ fontSize: 12, color: '#ff4d4d', textAlign: 'center', marginTop: -4 }}>
              {error}
            </div>
          )}

          <div style={{ textAlign: 'right', marginTop: -4 }}>
            <span
              style={{ fontSize: 12, color: GOLD, cursor: 'pointer' }}
              onClick={() => { setForgotEmail(email); setForgotMode(true); setForgotState('idle'); setError(''); }}
            >
              שכחתי סיסמה
            </span>
          </div>

          <div style={{ marginTop: 4 }}>
            <button className="mg-btn" onClick={handleLogin} disabled={loading || !email}>
              {loading ? '...' : 'כניסה למערכת'}
            </button>
          </div>

          {mondayLoading && (
            <div style={{ fontSize: 12, color: GOLD, textAlign: 'center' }}>⏳ טוען נתוני משקיעים...</div>
          )}
        </div>
      )}

      {/* ── Forgot password form ── */}
      {forgotMode && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>

          {forgotState === 'done' ? (
            /* Success state */
            <div style={{ textAlign: 'center', paddingTop: 16 }}>
              <div style={{ fontSize: 52, marginBottom: 20 }}>✅</div>
              <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 10 }}>
                הסיסמה אופסה בהצלחה
              </div>
              <div style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.8, marginBottom: 28 }}>
                בכניסה הבאה עם האימייל שלך<br />תוכל להגדיר סיסמה חדשה.
              </div>
              <button className="mg-btn" onClick={() => { setForgotMode(false); setForgotEmail(''); setForgotState('idle'); }}>
                חזרה לכניסה
              </button>
            </div>
          ) : (
            /* Reset form */
            <>
              {/* Back button */}
              <button
                onClick={() => { setForgotMode(false); setForgotState('idle'); }}
                style={{
                  display: 'flex', alignItems: 'center', gap: 6,
                  background: 'transparent', border: 'none',
                  color: 'var(--text-secondary)', fontSize: 13,
                  cursor: 'pointer', padding: '0', alignSelf: 'flex-end',
                }}
              >
                חזרה לכניסה
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                  <path d="M9 18l6-6-6-6" />
                </svg>
              </button>

              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: 20, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 6 }}>
                  שכחתי סיסמה
                </div>
                <div style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.7 }}>
                  הכנס את האימייל שלך — נאפס את הסיסמה ובכניסה הבאה תוכל להגדיר סיסמה חדשה.
                </div>
              </div>

              <div style={{ marginTop: 4 }}>
                <label style={{ display: 'block', fontSize: 12, color: 'var(--text-secondary)', marginBottom: 6 }}>דואר אלקטרוני</label>
                <input
                  className="mg-input"
                  type="email"
                  placeholder="your@email.com"
                  value={forgotEmail}
                  onChange={e => { setForgotEmail(e.target.value); setForgotState('idle'); }}
                  onKeyDown={e => { if (e.key === 'Enter') handleForgot(); }}
                  style={{ direction: 'ltr', textAlign: 'left' }}
                  autoFocus
                />
              </div>

              {forgotState === 'notfound' && (
                <div style={{ fontSize: 12, color: '#ff4d4d', textAlign: 'center' }}>
                  האימייל לא נמצא במערכת
                </div>
              )}

              <button
                className="mg-btn"
                onClick={handleForgot}
                disabled={forgotState === 'sending' || !forgotEmail.trim()}
              >
                {forgotState === 'sending' ? '⏳ מאפס...' : 'אפס סיסמה'}
              </button>
            </>
          )}
        </div>
      )}

      {/* Footer */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', paddingBottom: 40, marginTop: 32 }}>
        <GoldDivider />
        <p style={{ textAlign: 'center', fontSize: 11, color: 'var(--text-muted)', marginTop: 16, lineHeight: 1.8 }}>
          Miller Group Partners LLC<br />
          <span style={{ fontSize: 10 }}>© 2026 · כל הזכויות שמורות</span>
        </p>
      </div>
    </div>
  );
}
