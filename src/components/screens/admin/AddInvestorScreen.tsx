import { useState } from 'react';
import { useNavigation } from '../../../context/NavigationContext';
import { AdminTabBar } from './AdminTabBar';

const GOLD = '#C9A84C';

function FormField({ label, placeholder, value, onChange, type = 'text' }: {
  label: string; placeholder: string; value: string;
  onChange: (v: string) => void; type?: string;
}) {
  return (
    <div>
      <label style={{ display: 'block', fontSize: 12, color: 'var(--text-secondary)', marginBottom: 6, textAlign: 'right' }}>{label}</label>
      <input
        className="mg-input"
        type={type}
        placeholder={placeholder}
        value={value}
        onChange={e => onChange(e.target.value)}
        style={{ textAlign: 'right' }}
      />
    </div>
  );
}

export function AddInvestorScreen() {
  const { goBack, navigate } = useNavigation();
  const [form, setForm] = useState({ firstName: '', lastName: '', email: '', phone: '', password: '' });
  const [saved, setSaved] = useState(false);

  const canSave = form.firstName && form.lastName && form.email && form.password;

  const handleSave = () => {
    setSaved(true);
    setTimeout(() => {
      navigate('admin-investors');
    }, 1200);
  };

  if (saved) {
    return (
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: 'var(--bg-base)', gap: 16 }}>
        <div style={{ fontSize: 52 }}>✅</div>
        <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--text-primary)' }}>המשקיע נוסף בהצלחה!</div>
        <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>{form.firstName} {form.lastName}</div>
      </div>
    );
  }

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: 'var(--bg-base)', overflow: 'hidden' }}>
      {/* Header */}
      <div style={{ padding: '16px 20px 12px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
        <button onClick={goBack} style={{ background: 'var(--bg-chip)', border: 'none', borderRadius: 10, padding: '8px 12px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, color: 'var(--text-primary)' }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
            <path d="M15 18l-6-6 6-6" />
          </svg>
          <span style={{ fontSize: 13 }}>ביטול</span>
        </button>
        <span style={{ fontFamily: 'var(--font-ui)', fontSize: 18, fontWeight: 700, color: 'var(--text-primary)' }}>משקיע חדש</span>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: '8px 20px' }}>

        {/* Avatar preview */}
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 20 }}>
          <div style={{
            width: 72, height: 72, borderRadius: '50%',
            background: 'linear-gradient(135deg, #C9A84C, #8a6a28)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            border: `2px solid ${GOLD}`,
          }}>
            <span style={{ fontSize: 28, fontWeight: 700, color: '#000' }}>
              {form.firstName ? form.firstName[0] : '?'}
            </span>
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div style={{ display: 'flex', gap: 10 }}>
            <div style={{ flex: 1 }}>
              <FormField label="שם פרטי" placeholder="דוד" value={form.firstName} onChange={v => setForm(f => ({ ...f, firstName: v }))} />
            </div>
            <div style={{ flex: 1 }}>
              <FormField label="שם משפחה" placeholder="לוי" value={form.lastName} onChange={v => setForm(f => ({ ...f, lastName: v }))} />
            </div>
          </div>
          <FormField label="דואר אלקטרוני" placeholder="investor@example.com" value={form.email} onChange={v => setForm(f => ({ ...f, email: v }))} type="email" />
          <FormField label="טלפון" placeholder="+972-5X-XXX-XXXX" value={form.phone} onChange={v => setForm(f => ({ ...f, phone: v }))} type="tel" />
          <FormField label="סיסמה ראשונית" placeholder="••••••••" value={form.password} onChange={v => setForm(f => ({ ...f, password: v }))} type="password" />

          <div style={{ background: 'var(--bg-chip)', borderRadius: 10, padding: '10px 14px' }}>
            <div style={{ fontSize: 11, color: 'var(--text-secondary)', lineHeight: 1.7 }}>
              📧 המשקיע יקבל אימייל עם פרטי הכניסה לאחר ההוספה.
            </div>
          </div>

          <button
            className="mg-btn"
            onClick={handleSave}
            disabled={!canSave}
            style={{ marginTop: 8 }}
          >
            הוסף משקיע
          </button>
        </div>
      </div>

      <AdminTabBar active="admin-add-investor" />
    </div>
  );
}
