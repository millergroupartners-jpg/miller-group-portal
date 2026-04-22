/**
 * Investor-facing Inquiries screen.
 * Shows the investor's inquiries with status badges, lets them open a thread
 * to read/reply, and lets them open a new inquiry to management.
 */

import { useState, useEffect, useCallback } from 'react';
import { useUser } from '../../context/UserContext';
import { useMondayData } from '../../context/MondayDataContext';
import { MGLogo } from '../common/MGLogo';
import {
  listInquiries, createInquiry, replyToInquiry,
  type Inquiry,
} from '../../services/inquiriesApi';

const GOLD = '#C9A84C';

type StatusColor = { bg: string; border: string; text: string; label: string };
function statusStyle(status: string): StatusColor {
  switch (status) {
    case 'New':         return { bg: 'rgba(100,181,246,0.12)', border: 'rgba(100,181,246,0.35)', text: '#64B5F6', label: 'חדש' };
    case 'In Progress': return { bg: 'rgba(255,152,0,0.12)',   border: 'rgba(255,152,0,0.35)',   text: '#ff9800', label: 'בטיפול' };
    case 'Resolved':    return { bg: 'rgba(76,175,80,0.12)',   border: 'rgba(76,175,80,0.35)',   text: '#4CAF50', label: 'טופל' };
    default:            return { bg: 'var(--bg-chip)',         border: 'var(--border)',          text: 'var(--text-secondary)', label: status };
  }
}

function fmtDate(iso: string): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '';
  return d.toLocaleDateString('he-IL', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
}

export function InquiriesScreen() {
  const { currentUser } = useUser();
  const { properties } = useMondayData();

  const [inquiries, setInquiries] = useState<Inquiry[]>([]);
  const [loading, setLoading] = useState(true);
  const [openId, setOpenId] = useState<string | null>(null);
  const [composeOpen, setComposeOpen] = useState(false);

  // Form state for new inquiry
  const [newSubject, setNewSubject] = useState('');
  const [newMessage, setNewMessage] = useState('');
  const [newProperty, setNewProperty] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Reply state
  const [replyText, setReplyText] = useState('');
  const [replying, setReplying] = useState(false);

  const investorMondayId = currentUser?.mondayInvestorId || '';

  const refresh = useCallback(async () => {
    if (!investorMondayId) { setInquiries([]); setLoading(false); return; }
    try {
      setLoading(true);
      const list = await listInquiries(investorMondayId);
      setInquiries(list);
    } catch (e: any) {
      setError(e?.message || 'שגיאה בטעינת פניות');
    } finally {
      setLoading(false);
    }
  }, [investorMondayId]);

  useEffect(() => { refresh(); }, [refresh]);

  const handleSubmitNew = async () => {
    if (!newSubject.trim() || !newMessage.trim() || !currentUser) return;
    setSending(true); setError(null);
    try {
      await createInquiry({
        subject: newSubject.trim(),
        message: newMessage.trim(),
        investorId: investorMondayId,
        investorName: currentUser.fullNameHe,
        investorEmail: currentUser.email,
        property: newProperty,
        direction: 'investor-to-admin',
      });
      setNewSubject(''); setNewMessage(''); setNewProperty('');
      setComposeOpen(false);
      await refresh();
    } catch (e: any) {
      setError(e?.message || 'שליחה נכשלה');
    } finally {
      setSending(false);
    }
  };

  const handleReply = async (inq: Inquiry) => {
    if (!replyText.trim() || !currentUser) return;
    setReplying(true); setError(null);
    try {
      await replyToInquiry({
        inquiryId: inq.id,
        message: replyText.trim(),
        replyFrom: 'investor',
        investorName: currentUser.fullNameHe,
        investorEmail: currentUser.email,
        subject: inq.subject,
      });
      setReplyText('');
      await refresh();
    } catch (e: any) {
      setError(e?.message || 'שליחה נכשלה');
    } finally {
      setReplying(false);
    }
  };

  const openInquiry = openId ? inquiries.find(i => i.id === openId) : null;

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: 'var(--bg-base)', overflow: 'hidden' }}>
      <div className="desktop-page-title">
        <div className="subtitle">{inquiries.length} פניות</div>
        <h1>פניות</h1>
      </div>

      <div className="screen-header" style={{ padding: '16px 20px 10px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
        <MGLogo size={36} showWordmark={false} />
        <span style={{ fontSize: 20, fontWeight: 700, color: 'var(--text-primary)' }}>פניות</span>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: '16px 20px 20px', display: 'flex', flexDirection: 'column', gap: 14 }}>
        {/* New inquiry button */}
        <button
          onClick={() => setComposeOpen(true)}
          style={{
            background: GOLD, color: '#000', border: 'none',
            padding: '14px', borderRadius: 12, fontSize: 14, fontWeight: 700,
            cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
          }}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#000" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
          </svg>
          פנייה חדשה להנהלה
        </button>

        {error && (
          <div style={{ background: 'rgba(255,77,77,0.1)', border: '1px solid rgba(255,77,77,0.3)', borderRadius: 10, padding: '12px 14px', fontSize: 12, color: '#ff6b6b' }}>
            ⚠️ {error}
          </div>
        )}

        {loading && (
          <div style={{ textAlign: 'center', padding: '24px', color: GOLD, fontSize: 13 }}>⏳ טוען פניות...</div>
        )}

        {!loading && inquiries.length === 0 && (
          <div className="gold-card" style={{ padding: 30, textAlign: 'center', color: 'var(--text-secondary)', fontSize: 13 }}>
            אין פניות עדיין. לחץ על "פנייה חדשה להנהלה" כדי לפתוח את הראשונה.
          </div>
        )}

        {!loading && inquiries.map(inq => {
          const st = statusStyle(inq.status);
          const isOpen = openId === inq.id;
          const isFromAdmin = inq.direction === 'Management→Investor';
          return (
            <div key={inq.id} className="gold-card interactive" style={{ overflow: 'hidden' }}>
              <div
                onClick={() => setOpenId(isOpen ? null : inq.id)}
                style={{ padding: '14px 16px', cursor: 'pointer' }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6, flexDirection: 'row-reverse' }}>
                  <div style={{
                    fontSize: 10, fontWeight: 700,
                    background: st.bg, border: `1px solid ${st.border}`, color: st.text,
                    padding: '3px 8px', borderRadius: 100,
                  }}>{st.label}</div>
                  <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>{inq.inquiryNumber}</div>
                </div>
                <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)', textAlign: 'right', marginBottom: 4 }}>
                  {isFromAdmin && <span style={{ color: GOLD, fontSize: 10, marginLeft: 6 }}>מהנהלה</span>}
                  {inq.subject}
                </div>
                <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', fontSize: 11, color: 'var(--text-secondary)' }}>
                  {inq.property && <span>📍 {inq.property}</span>}
                  <span>{fmtDate(inq.updatedAt)}</span>
                  {inq.replies.length > 0 && (
                    <span style={{ color: GOLD }}>💬 {inq.replies.length}</span>
                  )}
                </div>
              </div>

              {/* Thread */}
              {isOpen && (
                <div style={{ borderTop: '1px solid var(--divider)', padding: '14px 16px', background: 'var(--bg-base)' }}>
                  {inq.replies.length === 0 && (
                    <div style={{ fontSize: 12, color: 'var(--text-secondary)', textAlign: 'center', padding: 12 }}>
                      אין תגובות עדיין
                    </div>
                  )}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                    {inq.replies.map(r => {
                      const isMe = r.author.includes(currentUser?.fullNameHe || '___') || r.author === currentUser?.fullNameHe;
                      return (
                        <div key={r.id} style={{
                          alignSelf: isMe ? 'flex-start' : 'flex-end',
                          maxWidth: '85%',
                          background: isMe ? `${GOLD}15` : 'var(--bg-surface)',
                          border: `1px solid ${isMe ? `${GOLD}33` : 'var(--border)'}`,
                          padding: '10px 12px', borderRadius: 12,
                        }}>
                          <div style={{ fontSize: 11, color: isMe ? GOLD : 'var(--text-secondary)', marginBottom: 4, fontWeight: 600, textAlign: 'right' }}>
                            {r.author} · {fmtDate(r.createdAt)}
                          </div>
                          <div style={{ fontSize: 13, color: 'var(--text-primary)', textAlign: 'right', lineHeight: 1.6 }}
                            dangerouslySetInnerHTML={{ __html: r.body }} />
                        </div>
                      );
                    })}
                  </div>

                  {/* Reply input */}
                  {inq.status !== 'Resolved' && (
                    <div style={{ display: 'flex', gap: 8, marginTop: 14, flexDirection: 'row-reverse' }}>
                      <input
                        value={replyText}
                        onChange={e => setReplyText(e.target.value)}
                        placeholder="כתוב תגובה..."
                        className="mg-input"
                        style={{ fontSize: 13, padding: '10px 14px', flex: 1 }}
                        onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleReply(inq); } }}
                      />
                      <button
                        onClick={() => handleReply(inq)}
                        disabled={replying || !replyText.trim()}
                        style={{
                          background: GOLD, color: '#000', border: 'none',
                          padding: '10px 18px', borderRadius: 10, fontSize: 13, fontWeight: 700,
                          cursor: replyText.trim() ? 'pointer' : 'not-allowed',
                          opacity: replyText.trim() ? 1 : 0.5,
                          whiteSpace: 'nowrap',
                        }}
                      >{replying ? '...' : 'שלח'}</button>
                    </div>
                  )}
                  {inq.status === 'Resolved' && (
                    <div style={{ marginTop: 14, fontSize: 12, color: '#4CAF50', textAlign: 'center', padding: 10, background: 'rgba(76,175,80,0.08)', borderRadius: 8 }}>
                      ✓ הפנייה סומנה כטופלה
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Compose modal */}
      {composeOpen && (
        <>
          <div onClick={() => !sending && setComposeOpen(false)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 400 }} />
          <div style={{
            position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%, -50%)',
            width: 'min(480px, calc(100vw - 32px))',
            background: 'var(--bg-surface)', borderRadius: 16,
            border: '1px solid var(--border)', zIndex: 401,
            maxHeight: '90vh', overflowY: 'auto',
          }}>
            <div style={{ padding: '18px 20px', borderBottom: '1px solid var(--border)' }}>
              <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-primary)', textAlign: 'right' }}>פנייה חדשה להנהלה</div>
            </div>
            <div style={{ padding: '18px 20px', display: 'flex', flexDirection: 'column', gap: 12 }}>
              <input
                value={newSubject}
                onChange={e => setNewSubject(e.target.value)}
                placeholder="נושא הפנייה"
                className="mg-input"
                style={{ fontSize: 14 }}
              />
              {properties.length > 0 && (
                <select
                  value={newProperty}
                  onChange={e => setNewProperty(e.target.value)}
                  className="mg-input"
                  style={{ fontSize: 14, appearance: 'none' }}
                >
                  <option value="">ללא נכס ספציפי (אופציונלי)</option>
                  {properties.map(p => (
                    <option key={p.mondayId} value={`${p.address}, ${p.city}`}>
                      {p.address}, {p.city}
                    </option>
                  ))}
                </select>
              )}
              <textarea
                value={newMessage}
                onChange={e => setNewMessage(e.target.value)}
                placeholder="תוכן הפנייה..."
                className="mg-input"
                rows={6}
                style={{ fontSize: 14, resize: 'vertical', minHeight: 120, fontFamily: 'var(--font-ui)' }}
              />
              {error && <div style={{ fontSize: 12, color: '#ff6b6b' }}>{error}</div>}
            </div>
            <div style={{ padding: '14px 20px', borderTop: '1px solid var(--border)', display: 'flex', gap: 10, flexDirection: 'row-reverse' }}>
              <button
                onClick={handleSubmitNew}
                disabled={sending || !newSubject.trim() || !newMessage.trim()}
                style={{
                  background: GOLD, color: '#000', border: 'none',
                  padding: '10px 22px', borderRadius: 10, fontSize: 14, fontWeight: 700,
                  cursor: sending ? 'wait' : 'pointer',
                  opacity: (sending || !newSubject.trim() || !newMessage.trim()) ? 0.6 : 1,
                }}
              >{sending ? 'שולח...' : 'שלח פנייה'}</button>
              <button
                onClick={() => !sending && setComposeOpen(false)}
                style={{
                  background: 'transparent', color: 'var(--text-secondary)',
                  border: '1px solid var(--border)',
                  padding: '10px 22px', borderRadius: 10, fontSize: 14, cursor: 'pointer',
                }}
              >ביטול</button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
