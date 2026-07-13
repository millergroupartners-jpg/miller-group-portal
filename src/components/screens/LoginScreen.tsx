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

const GOLD = 'var(--gold-text)';

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
    <div className="login-screen">
      {/* Theme toggle — floats above the card */}
      <div style={{ display: 'flex', justifyContent: 'flex-start', paddingTop: 16, alignSelf: 'stretch', position: 'absolute', top: 0, right: 28, left: 28 }}>
        <button className="mg-btn-ghost" onClick={toggleTheme} style={{
          display: 'flex', alignItems: 'center', gap: 6, padding: '6px 14px', fontSize: 12,
        }}>
          {theme === 'dark' ? (
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
              stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="4" />
              <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41" />
            </svg>
          ) : (
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
              stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
            </svg>
          )}
          <span>{theme === 'dark' ? 'מצב בהיר' : 'מצב כהה'}</span>
        </button>
      </div>

      <div className="login-card">
        {/* Logo */}
        <div className="stagger" style={{ paddingTop: 24, paddingBottom: 32, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 20 }}>
          <MGLogo size={90} />
          <GoldDivider />
          <div style={{ textAlign: 'center' }}>
            <h1 style={{ fontFamily: 'var(--font-ui)', fontSize: 34, fontWeight: 800, color: 'var(--text-primary)', lineHeight: 1.15, letterSpacing: '-0.02em', marginBottom: 8 }}>
              ברוכים הבאים
            </h1>
            <p style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.6 }}>
              פורטל המשקיעים של MillerGroup
            </p>
          </div>
        </div>

      {/* ── Login form ── */}
      {!forgotMode && (
        <div className="stagger" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
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
            <div style={{ fontSize: 12, color: 'var(--danger)', textAlign: 'center', marginTop: -4 }}>
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
            <button className="mg-btn" onClick={handleLogin} disabled={loading || !email}
              style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
              {loading && <span className="mg-spinner" style={{ borderTopColor: '#1A1508', borderColor: 'rgba(26,21,8,0.25)', borderTopWidth: 2 }} />}
              <span>{loading ? 'מתחבר...' : 'כניסה למערכת'}</span>
            </button>
          </div>

          {mondayLoading && (
            <div style={{ fontSize: 12, color: GOLD, textAlign: 'center', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
              <span className="mg-spinner" style={{ width: 12, height: 12 }} />
              <span>טוען נתוני משקיעים...</span>
            </div>
          )}
        </div>
      )}

      {/* ── Forgot password form ── */}
      {forgotMode && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>

          {forgotState === 'done' ? (
            /* Success state */
            <div className="fade-up" style={{ textAlign: 'center', paddingTop: 16 }}>
              <div style={{ marginBottom: 20, display: 'flex', justifyContent: 'center' }}>
                <div style={{
                  width: 64, height: 64, borderRadius: '50%',
                  background: 'var(--gold-dim)', border: '1px solid var(--gold-border)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  <svg width="30" height="30" viewBox="0 0 24 24" fill="none"
                    stroke="var(--gold)" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                </div>
              </div>
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
                <div style={{ fontSize: 12, color: 'var(--danger)', textAlign: 'center' }}>
                  האימייל לא נמצא במערכת
                </div>
              )}

              <button
                className="mg-btn"
                onClick={handleForgot}
                disabled={forgotState === 'sending' || !forgotEmail.trim()}
              >
                {forgotState === 'sending' ? 'מאפס...' : 'אפס סיסמה'}
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
    </div>
  );
}
