import { useState } from 'react';
import { MGLogo } from '../common/MGLogo';
import { StatusBadge } from '../common/StatusBadge';
import { PropPhoto } from '../common/PropPhoto';
import { useCCThumbnail } from '../../hooks/useCCThumbnail';
import { useUser } from '../../context/UserContext';
import { useMondayData } from '../../context/MondayDataContext';
import { OPEN_FOR_INVESTMENT_STATUS, type MondayProperty } from '../../services/mondayApi';
import { createInquiry } from '../../services/inquiriesApi';
import { MOCK_USER } from '../../data/user';

const GOLD = '#C9A84C';

/**
 * Investor-facing deal room: MG deals flagged "פתוח להשקעה" on Monday.
 * Cards deliberately do NOT navigate to property-detail — that screen exposes
 * lockbox codes and manager contact info that must stay off pre-purchase deals.
 */

function Stat({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div style={{ background: 'var(--bg-chip)', borderRadius: 10, padding: '8px 12px', flex: 1, minWidth: 0 }}>
      <div style={{ fontSize: 10, color: 'var(--text-secondary)', marginBottom: 3 }}>{label}</div>
      <div style={{ fontSize: 13, fontWeight: 700, color, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{value}</div>
    </div>
  );
}

function DealCard({ p, i, onInterest }: { p: MondayProperty; i: number; onInterest: (p: MondayProperty) => void }) {
  const thumb = useCCThumbnail(p.address);
  const equity = p.arvRaw > 0 && p.allIn > 0 ? '$' + (p.arvRaw - p.allIn).toLocaleString('en-US') : '—';
  return (
    <div className="gold-card">
      <div style={{ position: 'relative' }}>
        <PropPhoto index={i} heightRatio={48} photoUrl={thumb} />
        <div style={{
          position: 'absolute', bottom: 0, left: 0, right: 0,
          background: 'linear-gradient(transparent, rgba(0,0,0,0.75))',
          padding: '18px 12px 10px',
        }}>
          <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between' }}>
            <StatusBadge type={p.statusType}>{p.status}</StatusBadge>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: '#fff', lineHeight: 1.3 }}>{p.address}</div>
              <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.65)', marginTop: 2 }}>{p.city}</div>
            </div>
          </div>
        </div>
      </div>
      <div style={{ padding: '10px 14px 16px', display: 'flex', flexDirection: 'column', gap: 8 }}>
        <div style={{ display: 'flex', gap: 8 }}>
          <Stat label="מחיר קנייה" value={p.purchasePrice} color="var(--text-primary)" />
          <Stat label="שיפוץ" value={p.renovCost} color="var(--text-primary)" />
          <Stat label="ARV" value={p.arv} color={GOLD} />
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <Stat label="שכירות חזויה" value={p.rentMonthly} color="var(--text-primary)" />
          <Stat label="תשואה חזויה" value={p.rentYield} color="#4CAF50" />
          <Stat label="Equity" value={equity} color="#4CAF50" />
        </div>
        <button
          onClick={() => onInterest(p)}
          style={{
            marginTop: 4, padding: '12px 16px', borderRadius: 12, border: 'none',
            background: `linear-gradient(135deg, ${GOLD}, #8a6a28)`,
            color: '#000', fontSize: 14, fontWeight: 700, cursor: 'pointer',
            fontFamily: 'var(--font-ui)',
          }}
        >
          אני מעוניין בעסקה זו
        </button>
      </div>
    </div>
  );
}

export function DealRoomScreen() {
  const { currentUser } = useUser();
  const { mgProperties, loading } = useMondayData();
  const user = currentUser ?? MOCK_USER;

  const deals = mgProperties.filter(p => p.status === OPEN_FOR_INVESTMENT_STATUS);

  // Interest modal state
  const [selected, setSelected] = useState<MondayProperty | null>(null);
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState('');
  const [toast, setToast] = useState('');

  const openModal = (p: MondayProperty) => {
    setSelected(p);
    setMessage('');
    setSendError('');
  };

  const send = async () => {
    if (!selected || sending) return;
    setSending(true);
    setSendError('');
    const dealName = `${selected.address}${selected.city ? ', ' + selected.city : ''}`;
    try {
      await createInquiry({
        subject: `התעניינות בעסקה — ${dealName}`,
        message: message.trim() || 'אשמח לקבל פרטים נוספים על העסקה ולשמוע איך מתקדמים.',
        investorId: user.mondayInvestorId ?? '',
        investorName: user.fullNameHe,
        investorEmail: user.email,
        property: dealName,
        direction: 'investor-to-admin',
      });
      setSelected(null);
      setToast('הפנייה נשלחה! ניצור איתך קשר בהקדם.');
      setTimeout(() => setToast(''), 4000);
    } catch (e) {
      setSendError(e instanceof Error ? e.message : 'שליחת הפנייה נכשלה');
    } finally {
      setSending(false);
    }
  };

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: 'var(--bg-base)', overflow: 'hidden' }}>
      <div className="desktop-page-title">
        <div className="subtitle">הזדמנויות השקעה חדשות מבית Miller Group</div>
        <h1>חדר עסקאות</h1>
      </div>

      <div className="screen-header" style={{ padding: '16px 20px 10px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
        <MGLogo size={36} showWordmark={false} />
        <span style={{ fontSize: 20, fontWeight: 700, color: 'var(--text-primary)' }}>חדר עסקאות</span>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: '16px 20px 20px', display: 'flex', flexDirection: 'column', gap: 16 }}>
        {loading && deals.length === 0 && (
          <div style={{ textAlign: 'center', color: GOLD, fontSize: 13, padding: '40px 0' }}>⏳ טוען עסקאות...</div>
        )}

        {!loading && deals.length === 0 && (
          <div style={{ textAlign: 'center', padding: '60px 20px' }}>
            <div style={{ fontSize: 40, marginBottom: 12 }}>🏗️</div>
            <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 6 }}>
              אין כרגע עסקאות פתוחות להשקעה
            </div>
            <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
              עסקאות חדשות יופיעו כאן ברגע שייפתחו — שווה לחזור ולבדוק
            </div>
          </div>
        )}

        {deals.length > 0 && (
          <>
            <div style={{ fontSize: 12, color: 'var(--text-secondary)', textAlign: 'right' }}>
              {deals.length} עסקאות פתוחות להשקעה · המספרים הם צפי ואינם מהווים התחייבות
            </div>
            <div className="property-grid" style={{ padding: 0 }}>
              {deals.map((p, i) => <DealCard key={p.mondayId} p={p} i={i} onInterest={openModal} />)}
            </div>
          </>
        )}
      </div>

      {/* ── Interest modal ── */}
      {selected && (
        <div
          onClick={() => !sending && setSelected(null)}
          style={{
            position: 'fixed', inset: 0, zIndex: 1000,
            background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(2px)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20,
          }}
        >
          <div
            onClick={e => e.stopPropagation()}
            className="gold-card"
            style={{ width: '100%', maxWidth: 420, padding: 20, display: 'flex', flexDirection: 'column', gap: 12 }}
          >
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-primary)' }}>אני מעוניין בעסקה</div>
              <div style={{ fontSize: 12, color: GOLD, marginTop: 4 }}>
                📍 {selected.address}{selected.city ? `, ${selected.city}` : ''}
              </div>
            </div>
            <textarea
              value={message}
              onChange={e => setMessage(e.target.value)}
              placeholder="הודעה (לא חובה) — למשל: מעניין אותי סכום ההשקעה והלו״ז הצפוי"
              rows={4}
              style={{
                width: '100%', boxSizing: 'border-box', resize: 'vertical',
                background: 'var(--bg-chip)', border: '1px solid var(--border)', borderRadius: 10,
                padding: '10px 12px', fontSize: 13, color: 'var(--text-primary)',
                fontFamily: 'var(--font-ui)', direction: 'rtl',
              }}
            />
            {sendError && <div style={{ fontSize: 12, color: '#ff6b6b', textAlign: 'right' }}>{sendError}</div>}
            <div style={{ display: 'flex', gap: 8 }}>
              <button
                onClick={send}
                disabled={sending}
                style={{
                  flex: 1, padding: '12px 16px', borderRadius: 12, border: 'none',
                  background: `linear-gradient(135deg, ${GOLD}, #8a6a28)`,
                  color: '#000', fontSize: 14, fontWeight: 700,
                  cursor: sending ? 'wait' : 'pointer', opacity: sending ? 0.7 : 1,
                  fontFamily: 'var(--font-ui)',
                }}
              >
                {sending ? 'שולח...' : 'שליחת פנייה להנהלה'}
              </button>
              <button
                onClick={() => setSelected(null)}
                disabled={sending}
                style={{
                  padding: '12px 16px', borderRadius: 12, border: '1px solid var(--border)',
                  background: 'var(--bg-chip)', color: 'var(--text-secondary)',
                  fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'var(--font-ui)',
                }}
              >
                ביטול
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Success toast ── */}
      {toast && (
        <div style={{
          position: 'fixed', bottom: 90, left: '50%', transform: 'translateX(-50%)', zIndex: 1001,
          background: '#1d3323', border: '1px solid #4CAF50', color: '#a5e0aa',
          borderRadius: 100, padding: '10px 20px', fontSize: 13, fontWeight: 600,
          whiteSpace: 'nowrap', boxShadow: '0 6px 24px rgba(0,0,0,0.4)',
        }}>
          ✓ {toast}
        </div>
      )}
    </div>
  );
}
