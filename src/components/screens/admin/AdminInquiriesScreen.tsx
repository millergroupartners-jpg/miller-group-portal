/**
 * Admin-facing Inquiries screen.
 * Shows ALL inquiries with status/direction filters, lets admin reply,
 * mark as resolved, and open a new inquiry to a specific investor.
 */

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useUser } from '../../../context/UserContext';
import { useMondayData } from '../../../context/MondayDataContext';
import { MGLogo } from '../../common/MGLogo';
import {
  listInquiries, createInquiry, replyToInquiry, resolveInquiry, uploadFilesToInquiry,
  type Inquiry,
} from '../../../services/inquiriesApi';

const GOLD = '#C9A84C';

function statusStyle(status: string) {
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

type Filter = 'all' | 'New' | 'In Progress' | 'Resolved';

export function AdminInquiriesScreen() {
  const { currentUser } = useUser();
  const { investors } = useMondayData();

  const [inquiries, setInquiries] = useState<Inquiry[]>([]);
  const [loading, setLoading] = useState(true);
  const [openId, setOpenId] = useState<string | null>(null);
  const [filter, setFilter] = useState<Filter>('all');
  const [replyText, setReplyText] = useState('');
  const [replyFiles, setReplyFiles] = useState<File[]>([]);
  const [replying, setReplying] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resolving, setResolving] = useState(false);

  // Compose-to-investor state
  const [composeOpen, setComposeOpen] = useState(false);
  const [targetInvestorId, setTargetInvestorId] = useState('');
  const [newSubject, setNewSubject] = useState('');
  const [newMessage, setNewMessage] = useState('');
  const [newFiles, setNewFiles] = useState<File[]>([]);
  const [sending, setSending] = useState(false);

  const refresh = useCallback(async () => {
    try {
      setLoading(true);
      const list = await listInquiries(); // no investorId → all
      setInquiries(list);
    } catch (e: any) {
      setError(e?.message || 'שגיאה בטעינת פניות');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  const filtered = useMemo(() => {
    if (filter === 'all') return inquiries;
    return inquiries.filter(i => i.status === filter);
  }, [inquiries, filter]);

  const counts = useMemo(() => ({
    all:           inquiries.length,
    New:           inquiries.filter(i => i.status === 'New').length,
    'In Progress': inquiries.filter(i => i.status === 'In Progress').length,
    Resolved:      inquiries.filter(i => i.status === 'Resolved').length,
  }), [inquiries]);

  const handleReply = async (inq: Inquiry) => {
    if ((!replyText.trim() && replyFiles.length === 0) || !currentUser) return;
    setReplying(true); setError(null);
    try {
      const effectiveText = replyText.trim() || '(צירוף קובץ)';
      await replyToInquiry({
        inquiryId: inq.id,
        message: effectiveText,
        replyFrom: 'admin',
        investorName: inq.investorName,
        investorEmail: inq.investorEmail,
        subject: inq.subject,
      });
      if (replyFiles.length > 0) {
        await uploadFilesToInquiry(inq.id, replyFiles);
      }
      setReplyText(''); setReplyFiles([]);
      await refresh();
    } catch (e: any) {
      setError(e?.message || 'שליחה נכשלה');
    } finally {
      setReplying(false);
    }
  };

  const handleResolve = async (inq: Inquiry) => {
    if (!window.confirm('לסמן את הפנייה כטופלה?')) return;
    setResolving(true);
    try {
      await resolveInquiry(inq.id);
      await refresh();
    } catch (e: any) {
      setError(e?.message || 'שגיאה');
    } finally {
      setResolving(false);
    }
  };

  const handleComposeSend = async () => {
    const inv = investors.find(i => i.mondayId === targetInvestorId);
    if (!inv || !newSubject.trim() || !newMessage.trim()) return;
    setSending(true); setError(null);
    try {
      const { inquiryId } = await createInquiry({
        subject: newSubject.trim(),
        message: newMessage.trim(),
        investorId: inv.mondayId,
        investorName: inv.fullName,
        investorEmail: inv.email,
        direction: 'admin-to-investor',
      });
      if (newFiles.length > 0 && inquiryId) {
        await uploadFilesToInquiry(inquiryId, newFiles);
      }
      setNewSubject(''); setNewMessage(''); setTargetInvestorId(''); setNewFiles([]);
      setComposeOpen(false);
      await refresh();
    } catch (e: any) {
      setError(e?.message || 'שליחה נכשלה');
    } finally {
      setSending(false);
    }
  };

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: 'var(--bg-base)', overflow: 'hidden' }}>
      <div className="desktop-page-title">
        <div className="subtitle">{inquiries.length} פניות · {counts.New} חדשות · {counts['In Progress']} בטיפול</div>
        <h1>פניות</h1>
      </div>

      <div className="screen-header" style={{ padding: '16px 20px 10px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
        <MGLogo size={36} showWordmark={false} />
        <span style={{ fontSize: 20, fontWeight: 700, color: 'var(--text-primary)' }}>פניות</span>
      </div>

      {/* Filter tabs + new inquiry button */}
      <div style={{ padding: '8px 20px 12px', display: 'flex', gap: 8, alignItems: 'center', flexShrink: 0, flexDirection: 'row-reverse' }}>
        <button
          onClick={() => setComposeOpen(true)}
          style={{
            background: GOLD, color: '#000', border: 'none',
            padding: '9px 16px', borderRadius: 10, fontSize: 12, fontWeight: 700,
            cursor: 'pointer', whiteSpace: 'nowrap',
          }}
        >+ פנייה למשקיע</button>
        <div style={{ display: 'flex', gap: 6, overflowX: 'auto' }}>
          {([
            { k: 'all' as Filter,         l: 'הכל',    c: counts.all },
            { k: 'New' as Filter,         l: 'חדשות',  c: counts.New },
            { k: 'In Progress' as Filter, l: 'בטיפול', c: counts['In Progress'] },
            { k: 'Resolved' as Filter,    l: 'טופלו',  c: counts.Resolved },
          ]).map(f => (
            <button
              key={f.k}
              onClick={() => setFilter(f.k)}
              style={{
                background: filter === f.k ? `${GOLD}22` : 'var(--bg-chip)',
                border: `1px solid ${filter === f.k ? `${GOLD}66` : 'var(--border)'}`,
                color: filter === f.k ? GOLD : 'var(--text-secondary)',
                padding: '7px 12px', borderRadius: 100, fontSize: 12,
                fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap',
              }}
            >{f.l} ({f.c})</button>
          ))}
        </div>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: '0 20px 20px', display: 'flex', flexDirection: 'column', gap: 10 }}>
        {error && (
          <div style={{ background: 'rgba(255,77,77,0.1)', border: '1px solid rgba(255,77,77,0.3)', borderRadius: 10, padding: '12px 14px', fontSize: 12, color: '#ff6b6b' }}>
            ⚠️ {error}
          </div>
        )}

        {loading && <div style={{ textAlign: 'center', padding: 24, color: GOLD, fontSize: 13 }}>⏳ טוען פניות...</div>}

        {!loading && filtered.length === 0 && (
          <div className="gold-card" style={{ padding: 30, textAlign: 'center', color: 'var(--text-secondary)', fontSize: 13 }}>
            אין פניות להצגה
          </div>
        )}

        {!loading && filtered.map(inq => {
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
                  <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>
                    {isFromAdmin && <span style={{ color: GOLD, marginLeft: 6 }}>→ משקיע</span>}
                    {inq.inquiryNumber}
                  </div>
                </div>
                <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)', textAlign: 'right', marginBottom: 4 }}>
                  {inq.subject}
                </div>
                <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', fontSize: 11, color: 'var(--text-secondary)', flexWrap: 'wrap' }}>
                  <span style={{ color: GOLD, fontWeight: 600 }}>👤 {inq.investorName}</span>
                  {inq.property && <span>📍 {inq.property}</span>}
                  <span>{fmtDate(inq.updatedAt)}</span>
                  {inq.replies.length > 0 && (
                    <span style={{ color: GOLD }}>💬 {inq.replies.length}</span>
                  )}
                </div>
              </div>

              {isOpen && (
                <div style={{ borderTop: '1px solid var(--divider)', padding: '14px 16px', background: 'var(--bg-base)' }}>
                  {/* Attached files */}
                  {inq.files && inq.files.length > 0 && (
                    <div style={{ marginBottom: 14, padding: '10px 12px', background: `${GOLD}08`, border: `1px solid ${GOLD}22`, borderRadius: 10 }}>
                      <div style={{ fontSize: 11, fontWeight: 700, color: GOLD, marginBottom: 8, textAlign: 'right' }}>
                        📎 קבצים מצורפים ({inq.files.length})
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'row-reverse', flexWrap: 'wrap', gap: 8 }}>
                        {inq.files.map(f => (
                          <a key={f.id} href={f.url} target="_blank" rel="noopener noreferrer"
                             style={{ textDecoration: 'none' }}>
                            {f.thumbUrl ? (
                              <img src={f.thumbUrl} alt={f.name}
                                   style={{ width: 56, height: 56, borderRadius: 8, objectFit: 'cover', border: '1px solid var(--border)', cursor: 'pointer' }}
                                   title={f.name}/>
                            ) : (
                              <div style={{
                                display: 'flex', alignItems: 'center', gap: 6,
                                padding: '6px 10px', background: 'var(--bg-chip)',
                                border: '1px solid var(--border)', borderRadius: 100,
                                fontSize: 11, color: 'var(--text-primary)',
                              }}>
                                📄 {f.name.length > 25 ? f.name.slice(0, 22) + '...' : f.name}
                              </div>
                            )}
                          </a>
                        ))}
                      </div>
                    </div>
                  )}

                  {inq.replies.length === 0 && (
                    <div style={{ fontSize: 12, color: 'var(--text-secondary)', textAlign: 'center', padding: 12 }}>
                      אין תגובות עדיין
                    </div>
                  )}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                    {inq.replies.map(r => {
                      const isAdminReply = r.author.includes('Miller') || r.author.includes('הנהלת');
                      return (
                        <div key={r.id} style={{
                          alignSelf: isAdminReply ? 'flex-start' : 'flex-end',
                          maxWidth: '85%',
                          background: isAdminReply ? `${GOLD}15` : 'var(--bg-surface)',
                          border: `1px solid ${isAdminReply ? `${GOLD}33` : 'var(--border)'}`,
                          padding: '10px 12px', borderRadius: 12,
                        }}>
                          <div style={{ fontSize: 11, color: isAdminReply ? GOLD : 'var(--text-secondary)', marginBottom: 4, fontWeight: 600, textAlign: 'right' }}>
                            {r.author} · {fmtDate(r.createdAt)}
                          </div>
                          <div style={{ fontSize: 13, color: 'var(--text-primary)', textAlign: 'right', lineHeight: 1.6 }}
                            dangerouslySetInnerHTML={{ __html: r.body }} />
                        </div>
                      );
                    })}
                  </div>

                  {inq.status !== 'Resolved' && (
                    <>
                      <div style={{ display: 'flex', gap: 8, marginTop: 14, flexDirection: 'row-reverse' }}>
                        <textarea
                          value={replyText}
                          onChange={e => setReplyText(e.target.value)}
                          placeholder="כתוב תגובה..."
                          className="mg-input"
                          rows={2}
                          style={{ fontSize: 13, padding: '10px 14px', flex: 1, resize: 'vertical', fontFamily: 'var(--font-ui)' }}
                        />
                        <button
                          onClick={() => handleReply(inq)}
                          disabled={replying || (!replyText.trim() && replyFiles.length === 0)}
                          style={{
                            background: GOLD, color: '#000', border: 'none',
                            padding: '10px 18px', borderRadius: 10, fontSize: 13, fontWeight: 700,
                            cursor: 'pointer',
                            opacity: (replyText.trim() || replyFiles.length > 0) ? 1 : 0.5,
                            whiteSpace: 'nowrap', alignSelf: 'flex-end',
                          }}
                        >{replying ? '...' : 'שלח'}</button>
                      </div>
                      {/* File attach for reply */}
                      <div style={{ marginTop: 8, display: 'flex', alignItems: 'center', gap: 10, flexDirection: 'row-reverse', flexWrap: 'wrap' }}>
                        <label style={{
                          display: 'inline-flex', alignItems: 'center', gap: 6,
                          padding: '6px 12px', borderRadius: 100, cursor: 'pointer',
                          background: 'var(--bg-chip)', border: '1px solid var(--border)',
                          fontSize: 11, color: 'var(--text-secondary)',
                        }}>
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M21.44 11.05l-9.19 9.19a6 6 0 01-8.49-8.49l9.19-9.19a4 4 0 015.66 5.66l-9.2 9.19a2 2 0 01-2.83-2.83l8.49-8.48" />
                          </svg>
                          צרף קובץ
                          <input
                            type="file"
                            multiple
                            onChange={e => setReplyFiles(Array.from(e.target.files || []))}
                            style={{ display: 'none' }}
                          />
                        </label>
                        {replyFiles.map((f, i) => (
                          <span key={i} style={{ fontSize: 11, color: GOLD, background: `${GOLD}12`, padding: '4px 10px', borderRadius: 100 }}>
                            📎 {f.name}
                            <span
                              onClick={() => setReplyFiles(replyFiles.filter((_, j) => j !== i))}
                              style={{ marginRight: 8, cursor: 'pointer', color: '#ff6b6b' }}
                            >×</span>
                          </span>
                        ))}
                      </div>
                      <button
                        onClick={() => handleResolve(inq)}
                        disabled={resolving}
                        style={{
                          marginTop: 10, width: '100%',
                          background: 'rgba(76,175,80,0.12)', color: '#4CAF50',
                          border: '1px solid rgba(76,175,80,0.4)',
                          padding: '9px', borderRadius: 8, fontSize: 12, fontWeight: 700,
                          cursor: 'pointer',
                        }}
                      >✓ סמן כטופל</button>
                    </>
                  )}
                  {inq.status === 'Resolved' && (
                    <div style={{ marginTop: 14, fontSize: 12, color: '#4CAF50', textAlign: 'center', padding: 10, background: 'rgba(76,175,80,0.08)', borderRadius: 8 }}>
                      ✓ הפנייה טופלה
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Compose-to-investor modal */}
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
              <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-primary)', textAlign: 'right' }}>פנייה חדשה למשקיע</div>
            </div>
            <div style={{ padding: '18px 20px', display: 'flex', flexDirection: 'column', gap: 12 }}>
              <select
                value={targetInvestorId}
                onChange={e => setTargetInvestorId(e.target.value)}
                className="mg-input"
                style={{ fontSize: 14, appearance: 'none' }}
              >
                <option value="">בחר משקיע</option>
                {investors.filter(i => i.email).map(i => (
                  <option key={i.mondayId} value={i.mondayId}>
                    {i.fullName} ({i.email})
                  </option>
                ))}
              </select>
              <input
                value={newSubject}
                onChange={e => setNewSubject(e.target.value)}
                placeholder="נושא הפנייה"
                className="mg-input"
                style={{ fontSize: 14 }}
              />
              <textarea
                value={newMessage}
                onChange={e => setNewMessage(e.target.value)}
                placeholder="תוכן הפנייה..."
                className="mg-input"
                rows={6}
                style={{ fontSize: 14, resize: 'vertical', minHeight: 120, fontFamily: 'var(--font-ui)' }}
              />
              {/* File attach */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexDirection: 'row-reverse', flexWrap: 'wrap' }}>
                <label style={{
                  display: 'inline-flex', alignItems: 'center', gap: 6,
                  padding: '8px 14px', borderRadius: 100, cursor: 'pointer',
                  background: 'var(--bg-chip)', border: '1px solid var(--border)',
                  fontSize: 12, color: 'var(--text-secondary)',
                }}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M21.44 11.05l-9.19 9.19a6 6 0 01-8.49-8.49l9.19-9.19a4 4 0 015.66 5.66l-9.2 9.19a2 2 0 01-2.83-2.83l8.49-8.48" />
                  </svg>
                  צרף קובץ / תמונה
                  <input
                    type="file"
                    multiple
                    onChange={e => setNewFiles(Array.from(e.target.files || []))}
                    style={{ display: 'none' }}
                  />
                </label>
                {newFiles.map((f, i) => (
                  <span key={i} style={{ fontSize: 11, color: GOLD, background: `${GOLD}12`, padding: '4px 10px', borderRadius: 100 }}>
                    📎 {f.name}
                    <span
                      onClick={() => setNewFiles(newFiles.filter((_, j) => j !== i))}
                      style={{ marginRight: 8, cursor: 'pointer', color: '#ff6b6b' }}
                    >×</span>
                  </span>
                ))}
              </div>
              {error && <div style={{ fontSize: 12, color: '#ff6b6b' }}>{error}</div>}
            </div>
            <div style={{ padding: '14px 20px', borderTop: '1px solid var(--border)', display: 'flex', gap: 10, flexDirection: 'row-reverse' }}>
              <button
                onClick={handleComposeSend}
                disabled={sending || !targetInvestorId || !newSubject.trim() || !newMessage.trim()}
                style={{
                  background: GOLD, color: '#000', border: 'none',
                  padding: '10px 22px', borderRadius: 10, fontSize: 14, fontWeight: 700,
                  cursor: sending ? 'wait' : 'pointer',
                  opacity: (sending || !targetInvestorId || !newSubject.trim() || !newMessage.trim()) ? 0.6 : 1,
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
