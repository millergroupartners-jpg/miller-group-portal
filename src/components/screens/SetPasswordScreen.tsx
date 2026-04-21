import { useState } from 'react';
import { useNavigation } from '../../context/NavigationContext';
import { useUser } from '../../context/UserContext';
import { useMondayData } from '../../context/MondayDataContext';
import { setInvestorPassword } from '../../services/mondayApi';
import { MGLogo } from '../common/MGLogo';
import { GoldDivider } from '../common/GoldDivider';
import type { User } from '../../data/user';

const GOLD = '#C9A84C';

interface SetPasswordScreenProps {
  investorMondayId: string;
  investorName: string;
}

export function SetPasswordScreen({ investorMondayId, investorName }: SetPasswordScreenProps) {
  const { navigate } = useNavigation();
  const { setCurrentUser } = useUser();
  const { investors } = useMondayData();
  const [pass, setPass] = useState('');
  const [confirm, setConfirm] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async () => {
    setError('');
    if (pass.length < 6) {
      setError('הסיסמה חייבת להכיל לפחות 6 תווים');
      return;
    }
    if (pass !== confirm) {
      setError('הסיסמאות אינן תואמות');
      return;
    }

    setLoading(true);
    try {
      await setInvestorPassword(investorMondayId, pass);

      // Auto-login
      const mondayInv = investors.find(inv => inv.mondayId === investorMondayId);
      const nameParts = investorName.trim().split(/\s+/);
      const mondayUser: User = {
        id: investorMondayId,
        firstNameHe: nameParts[0] ?? investorName,
        lastNameHe: nameParts.slice(1).join(' '),
        fullNameHe: investorName,
        initials: mondayInv?.initials ?? (investorName[0] ?? '?').toUpperCase(),
        email: mondayInv?.email ?? '',
        password: '',
        phone: mondayInv?.phone ?? '',
        investorSince: mondayInv?.investorSince ?? '',
        isAdmin: false,
        mondayInvestorId: investorMondayId,
      };
      setCurrentUser(mondayUser);
      navigate('dashboard');
    } catch (e) {
      setError('שגיאה בשמירת הסיסמה, נסה שוב');
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') handleSubmit();
  };

  const firstName = investorName.trim().split(/\s+/)[0] ?? investorName;

  return (
    <div style={{
      flex: 1, display: 'flex', flexDirection: 'column',
      background: 'var(--bg-base)', padding: '0 28px', overflowY: 'auto',
    }}>
      {/* Logo */}
      <div style={{ paddingTop: 48, paddingBottom: 28, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 20 }}>
        <MGLogo size={56} />
        <GoldDivider />
        <div style={{ textAlign: 'center' }}>
          <h1 style={{ fontFamily: 'var(--font-ui)', fontSize: 26, fontWeight: 700, color: 'var(--text-primary)', lineHeight: 1.3, marginBottom: 8 }}>
            ברוכים הבאים, {firstName}!
          </h1>
          <p style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.6 }}>
            בחר סיסמה אישית לכניסה לפורטל
          </p>
        </div>
      </div>

      {/* Form */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div>
          <label style={{ display: 'block', fontSize: 12, color: 'var(--text-secondary)', marginBottom: 6 }}>סיסמה (לפחות 6 תווים)</label>
          <input
            className="mg-input"
            type="password"
            placeholder="••••••••"
            value={pass}
            onChange={e => { setPass(e.target.value); setError(''); }}
            onKeyDown={handleKeyDown}
          />
        </div>
        <div>
          <label style={{ display: 'block', fontSize: 12, color: 'var(--text-secondary)', marginBottom: 6 }}>אישור סיסמה</label>
          <input
            className="mg-input"
            type="password"
            placeholder="••••••••"
            value={confirm}
            onChange={e => { setConfirm(e.target.value); setError(''); }}
            onKeyDown={handleKeyDown}
          />
        </div>

        {error && (
          <div style={{ fontSize: 12, color: '#ff4d4d', textAlign: 'center', marginTop: -4 }}>
            {error}
          </div>
        )}

        <div style={{ marginTop: 4 }}>
          <button
            className="mg-btn"
            onClick={handleSubmit}
            disabled={loading || !pass || !confirm}
          >
            {loading ? '...' : 'הגדר סיסמה וכנס'}
          </button>
        </div>

        {/* Info chip */}
        <div style={{ background: 'var(--bg-chip)', borderRadius: 10, padding: '10px 14px', marginTop: 4 }}>
          <div style={{ fontSize: 11, color: 'var(--text-secondary)', lineHeight: 1.8, textAlign: 'right' }}>
            <span style={{ color: GOLD }}>🔒</span> הסיסמה תישמר ותשמש לכניסות עתידיות
          </div>
        </div>
      </div>

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
