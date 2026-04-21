import { useState } from 'react';
import { useNavigation } from '../../../context/NavigationContext';
import { AdminTabBar } from './AdminTabBar';
import { INVESTORS } from '../../../data/investors';

const GOLD = '#C9A84C';

function FormField({ label, placeholder, value, onChange, type = 'text' }: {
  label: string; placeholder: string; value: string;
  onChange: (v: string) => void; type?: string;
}) {
  return (
    <div>
      <label style={{ display: 'block', fontSize: 12, color: 'var(--text-secondary)', marginBottom: 6, textAlign: 'right' }}>{label}</label>
      <input className="mg-input" type={type} placeholder={placeholder} value={value} onChange={e => onChange(e.target.value)} style={{ textAlign: 'right' }} />
    </div>
  );
}

export function AddPropertyScreen() {
  const { goBack, navigate } = useNavigation();
  const [form, setForm] = useState({
    address: '', city: '', purchasePrice: '', arv: '', renovCost: '',
    rentYield: '', status: 'בבדיקה', investorId: '',
  });
  const [saved, setSaved] = useState(false);

  const canSave = form.address && form.city && form.purchasePrice && form.investorId;

  const handleSave = () => {
    setSaved(true);
    setTimeout(() => navigate('admin-dashboard'), 1400);
  };

  if (saved) {
    return (
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: 'var(--bg-base)', gap: 16 }}>
        <div style={{ fontSize: 52 }}>🏠</div>
        <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--text-primary)' }}>הנכס נוסף בהצלחה!</div>
        <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>{form.address}</div>
      </div>
    );
  }

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: 'var(--bg-base)', overflow: 'hidden' }}>
      <div style={{ padding: '16px 20px 12px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
        <button onClick={goBack} style={{ background: 'var(--bg-chip)', border: 'none', borderRadius: 10, padding: '8px 12px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, color: 'var(--text-primary)' }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M15 18l-6-6 6-6" /></svg>
          <span style={{ fontSize: 13 }}>ביטול</span>
        </button>
        <span style={{ fontFamily: 'var(--font-ui)', fontSize: 18, fontWeight: 700, color: 'var(--text-primary)' }}>נכס חדש</span>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: '8px 20px' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>

          <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-secondary)', textAlign: 'right' }}>פרטי נכס</div>
          <FormField label="כתובת" placeholder="123 Main St, City" value={form.address} onChange={v => setForm(f => ({ ...f, address: v }))} />
          <FormField label="עיר ומדינה" placeholder="Indianapolis, IN" value={form.city} onChange={v => setForm(f => ({ ...f, city: v }))} />

          <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-secondary)', textAlign: 'right', marginTop: 4 }}>נתונים פיננסיים</div>
          <div style={{ display: 'flex', gap: 10 }}>
            <div style={{ flex: 1 }}><FormField label="מחיר רכישה" placeholder="$120,000" value={form.purchasePrice} onChange={v => setForm(f => ({ ...f, purchasePrice: v }))} /></div>
            <div style={{ flex: 1 }}><FormField label="ARV" placeholder="$200,000" value={form.arv} onChange={v => setForm(f => ({ ...f, arv: v }))} /></div>
          </div>
          <div style={{ display: 'flex', gap: 10 }}>
            <div style={{ flex: 1 }}><FormField label="עלות שיפוץ" placeholder="$30,000" value={form.renovCost} onChange={v => setForm(f => ({ ...f, renovCost: v }))} /></div>
            <div style={{ flex: 1 }}><FormField label="תשואה צפויה" placeholder="10%" value={form.rentYield} onChange={v => setForm(f => ({ ...f, rentYield: v }))} /></div>
          </div>

          {/* Status */}
          <div>
            <label style={{ display: 'block', fontSize: 12, color: 'var(--text-secondary)', marginBottom: 8, textAlign: 'right' }}>סטטוס</label>
            <div style={{ display: 'flex', gap: 8 }}>
              {[
                { val: 'בבדיקה', color: '#0a84ff', bg: 'rgba(10,132,255,0.12)' },
                { val: 'בשיפוץ', color: GOLD, bg: 'rgba(201,168,76,0.12)' },
                { val: 'מושכר', color: '#34c759', bg: 'rgba(52,199,89,0.12)' },
              ].map(s => (
                <button key={s.val} onClick={() => setForm(f => ({ ...f, status: s.val }))}
                  style={{
                    flex: 1, padding: '8px 4px', borderRadius: 10, border: `1px solid ${form.status === s.val ? s.color : 'var(--border)'}`,
                    background: form.status === s.val ? s.bg : 'transparent',
                    color: form.status === s.val ? s.color : 'var(--text-secondary)',
                    fontFamily: 'var(--font-ui)', fontSize: 12, fontWeight: 600, cursor: 'pointer',
                  }}
                >
                  {s.val}
                </button>
              ))}
            </div>
          </div>

          {/* Assign to investor */}
          <div>
            <label style={{ display: 'block', fontSize: 12, color: 'var(--text-secondary)', marginBottom: 8, textAlign: 'right' }}>שיוך למשקיע</label>
            <div className="gold-card" style={{ overflow: 'hidden' }}>
              {INVESTORS.map((inv, i) => (
                <div
                  key={inv.id}
                  onClick={() => setForm(f => ({ ...f, investorId: inv.id }))}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px',
                    borderBottom: i < INVESTORS.length - 1 ? '1px solid var(--divider)' : 'none',
                    cursor: 'pointer', flexDirection: 'row-reverse',
                    background: form.investorId === inv.id ? 'rgba(201,168,76,0.08)' : 'transparent',
                  }}
                >
                  <div style={{
                    width: 36, height: 36, borderRadius: '50%',
                    background: 'linear-gradient(135deg, #C9A84C, #8a6a28)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                  }}>
                    <span style={{ fontSize: 14, fontWeight: 700, color: '#000' }}>{inv.initials}</span>
                  </div>
                  <div style={{ flex: 1, textAlign: 'right' }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>{inv.fullNameHe}</div>
                    <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>{inv.propertyIds.length} נכסים קיימים</div>
                  </div>
                  {form.investorId === inv.id && (
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={GOLD} strokeWidth="2.5" strokeLinecap="round">
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                  )}
                </div>
              ))}
            </div>
          </div>

          <button className="mg-btn" onClick={handleSave} disabled={!canSave} style={{ marginTop: 4 }}>
            הוסף נכס
          </button>
        </div>
      </div>

      <AdminTabBar active="admin-add-investor" />
    </div>
  );
}
