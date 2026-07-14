import { useEffect, useState } from 'react';
import { MGLogo } from '../../common/MGLogo';
import {
  fetchEmailLog, fetchScheduledEmails, createScheduledEmail, setScheduledEmailActive,
  sendAdminEmail, type EmailLogEntry, type ScheduledEmail, type Audience,
} from '../../../services/emailCenterApi';

const GOLD = 'var(--gold)';

type Tab = 'log' | 'auto' | 'compose';

/** Built-in automations — described here so the admin can see what runs when. */
const BUILT_IN_AUTOMATIONS = [
  { icon: '💼', title: 'עסקה חדשה בחדר העסקאות', when: 'כל בוקר ב-10:15 (כשמסומנת עסקה חדשה)', who: 'כל המשקיעים עם מייל, אלא אם ביטלו בהגדרות' },
  { icon: '📝', title: 'תזכורת הרשמה לפורטל', when: 'כל יום ראשון ב-10:15', who: 'משקיעים שטרם קבעו סיסמה' },
  { icon: '📊', title: 'סיכום יומי להנהלה', when: 'כל בוקר ב-10:00', who: 'מיילים של האדמין בלבד' },
  { icon: '🔌', title: 'תזכורת Utilities חודשית', when: 'ה-1 לכל חודש ב-10:30', who: 'לפי הגדרות בורד ה-Utilities' },
];

function fmtDateTime(iso: string): string {
  if (!iso) return '—';
  try {
    const d = new Date(iso);
    return d.toLocaleDateString('he-IL', { day: 'numeric', month: 'short' }) + ' · ' +
      d.toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' });
  } catch { return iso; }
}

function Chip({ text, color }: { text: string; color: string }) {
  return (
    <span style={{
      fontSize: 10, fontWeight: 700, color, background: `color-mix(in srgb, ${color} 12%, transparent)`,
      border: `1px solid color-mix(in srgb, ${color} 35%, transparent)`,
      borderRadius: 100, padding: '2px 8px', whiteSpace: 'nowrap',
    }}>{text}</span>
  );
}

// ─── Tab: יומן ───────────────────────────────────────────────────────────────

/**
 * The logged text is extracted from the full branded email, so it starts with
 * the template header ("MILLER GROUP" + title) and ends with the footer line.
 * Strip that boilerplate so the modal (which re-draws the branded frame) shows
 * only the actual message body. Best-effort — old truncated entries pass through.
 */
function emailBodyText(e: EmailLogEntry): string {
  let t = (e.bodyPreview || '').trim();
  t = t.replace(/^MILLER GROUP\s*/, '');
  if (e.subject && t.startsWith(e.subject)) t = t.slice(e.subject.length).trim();
  t = t.replace(/Miller Group · מערכת ניהול המשקיעים(?: · פורטל המשקיעים)?\s*$/, '');
  return t.trim();
}

/** Modal that re-renders a logged email inside the branded template frame,
 *  so it looks like the email the recipient saw. Colors intentionally mirror
 *  the fixed light-mode palette of the server-side wrapEmail() template. */
function EmailViewModal({ entry, onClose }: { entry: EmailLogEntry; onClose: () => void }) {
  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)', zIndex: 400, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div onClick={ev => ev.stopPropagation()} style={{
        width: 'min(620px, calc(100vw - 32px))', maxHeight: '88vh',
        display: 'flex', flexDirection: 'column', borderRadius: 16, overflow: 'hidden',
        background: 'var(--bg-elevated, var(--bg-base))', border: '1px solid var(--border)',
        boxShadow: '0 20px 60px rgba(0,0,0,0.35)',
      }}>
        {/* chrome header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexDirection: 'row-reverse', gap: 10, padding: '12px 16px', borderBottom: '1px solid var(--divider)', flexShrink: 0 }}>
          <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexDirection: 'row-reverse', minWidth: 0 }}>
            <span style={{ fontSize: 12, color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>
              {fmtDateTime(entry.sentAt)} · {entry.recipientCount} נמענים
            </span>
            {!entry.ok && <Chip text="נכשל" color="#e2445c" />}
            {entry.category && <Chip text={entry.category} color="var(--info, #579bfc)" />}
            <Chip text={entry.kind || 'אוטומטי'} color={entry.kind === 'ידני' ? '#a25ddc' : '#4CAF50'} />
          </div>
          <button onClick={onClose} style={{
            border: 'none', background: 'var(--bg-chip)', color: 'var(--text-secondary)',
            width: 28, height: 28, borderRadius: '50%', cursor: 'pointer', fontSize: 13, flexShrink: 0,
          }}>✕</button>
        </div>

        {/* email paper — mirrors wrapEmail() */}
        <div style={{ overflowY: 'auto', padding: 16, background: '#f5f0e8' }}>
          <div style={{ maxWidth: 560, margin: '0 auto', background: '#ffffff', borderRadius: 16, overflow: 'hidden', border: '1px solid #e5dfd4', direction: 'rtl' }}>
            <div style={{ background: 'linear-gradient(90deg,#C9A84C,#f0d080,#C9A84C)', height: 4 }} />
            <div style={{ padding: '24px 24px 16px', borderBottom: '1px solid #e5dfd4', textAlign: 'right' }}>
              <div style={{ fontSize: 11, color: '#888', letterSpacing: 1 }}>MILLER GROUP</div>
              <div style={{ marginTop: 6, fontSize: 18, color: '#111', fontWeight: 700 }}>{entry.subject}</div>
            </div>
            <div style={{ padding: '20px 24px', color: '#333', fontSize: 13.5, lineHeight: 1.7, whiteSpace: 'pre-wrap', textAlign: 'right', wordBreak: 'break-word' }}>
              {emailBodyText(entry) || '— אין תוכן שמור למייל זה —'}
            </div>
            <div style={{ padding: '12px 24px', background: '#faf7f2', color: '#999', fontSize: 11, textAlign: 'center', borderTop: '1px solid #e5dfd4' }}>
              Miller Group · מערכת ניהול המשקיעים
            </div>
          </div>
          {entry.recipients && (
            <div style={{ marginTop: 12, fontSize: 11, color: 'var(--text-secondary)', direction: 'ltr', textAlign: 'left', wordBreak: 'break-all' }}>
              {entry.recipients}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function LogTab() {
  const [log, setLog] = useState<EmailLogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [kindFilter, setKindFilter] = useState('הכל');
  const [viewing, setViewing] = useState<EmailLogEntry | null>(null);

  useEffect(() => {
    fetchEmailLog().then(setLog).catch(console.error).finally(() => setLoading(false));
  }, []);

  const filtered = log.filter(e => kindFilter === 'הכל' || e.kind === kindFilter);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
        {['הכל', 'אוטומטי', 'ידני'].map(k => (
          <button key={k} onClick={() => setKindFilter(k)} style={{
            padding: '6px 12px', borderRadius: 100,
            border: kindFilter === k ? 'none' : '1px solid var(--border)',
            background: kindFilter === k ? GOLD : 'var(--bg-chip)',
            color: kindFilter === k ? '#000' : 'var(--text-secondary)',
            fontSize: 11, fontWeight: 600, cursor: 'pointer', fontFamily: 'var(--font-ui)',
          }}>{k}</button>
        ))}
      </div>

      {loading && <div style={{ textAlign: 'center', color: GOLD, fontSize: 13, padding: '30px 0' }}>⏳ טוען יומן...</div>}
      {!loading && filtered.length === 0 && (
        <div style={{ textAlign: 'center', color: 'var(--text-secondary)', fontSize: 13, padding: '40px 0' }}>
          היומן ריק — כל מייל שיישלח מהמערכת מעכשיו יופיע כאן
        </div>
      )}

      {filtered.map(e => (
        <div key={e.id} className="gold-card" style={{ padding: 14, cursor: 'pointer' }}
          onClick={() => setViewing(e)}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexDirection: 'row-reverse', gap: 10 }}>
            <div style={{ flex: 1, textAlign: 'right', minWidth: 0 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)' }}>{e.subject}</div>
              <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 4 }}>
                {fmtDateTime(e.sentAt)} · {e.recipientCount} נמענים
              </div>
              {e.bodyPreview && (
                <div style={{
                  fontSize: 11, color: 'var(--text-secondary)', marginTop: 6, lineHeight: 1.5,
                  overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical',
                }}>{emailBodyText(e)}</div>
              )}
            </div>
            <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
              {!e.ok && <Chip text="נכשל" color="#e2445c" />}
              {e.category && <Chip text={e.category} color="var(--info, #579bfc)" />}
              <Chip text={e.kind || 'אוטומטי'} color={e.kind === 'ידני' ? '#a25ddc' : '#4CAF50'} />
            </div>
          </div>
        </div>
      ))}

      {viewing && <EmailViewModal entry={viewing} onClose={() => setViewing(null)} />}
    </div>
  );
}

// ─── Tab: אוטומטיים ─────────────────────────────────────────────────────────

function AutoTab() {
  const [scheduled, setScheduled] = useState<ScheduledEmail[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  // form state
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [audience, setAudience] = useState<'כולם' | 'רשומים' | 'לא רשומים'>('כולם');
  const [sendOn, setSendOn] = useState('');
  const [recurrence, setRecurrence] = useState<'חד פעמי' | 'שבועי' | 'חודשי'>('חד פעמי');
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState('');

  const reload = () => {
    fetchScheduledEmails().then(setScheduled).catch(console.error).finally(() => setLoading(false));
  };
  useEffect(reload, []);

  const save = async () => {
    if (!subject.trim() || !body.trim() || !sendOn || saving) { setErr('יש למלא נושא, תוכן ותאריך'); return; }
    setSaving(true); setErr('');
    try {
      await createScheduledEmail({ subject: subject.trim(), body: body.trim(), audience, sendOn, recurrence });
      setSubject(''); setBody(''); setSendOn(''); setShowForm(false);
      reload();
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'שמירה נכשלה');
    } finally { setSaving(false); }
  };

  const toggle = async (s: ScheduledEmail) => {
    setScheduled(prev => prev.map(x => x.id === s.id ? { ...x, active: !s.active } : x));
    try { await setScheduledEmailActive(s.id, !s.active); }
    catch { setScheduled(prev => prev.map(x => x.id === s.id ? { ...x, active: s.active } : x)); }
  };

  const inputStyle: React.CSSProperties = {
    width: '100%', boxSizing: 'border-box', background: 'var(--bg-chip)',
    border: '1px solid var(--border)', borderRadius: 10, padding: '10px 12px',
    fontSize: 13, color: 'var(--text-primary)', fontFamily: 'var(--font-ui)', direction: 'rtl',
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Built-in automations */}
      <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-secondary)', textAlign: 'right' }}>אוטומציות מובנות</div>
      <div className="gold-card" style={{ padding: 4 }}>
        {BUILT_IN_AUTOMATIONS.map((a, i) => (
          <div key={a.title} style={{
            display: 'flex', alignItems: 'center', gap: 12, flexDirection: 'row-reverse',
            padding: '12px 14px', borderBottom: i < BUILT_IN_AUTOMATIONS.length - 1 ? '1px solid var(--divider)' : 'none',
          }}>
            <div style={{ fontSize: 20, flexShrink: 0 }}>{a.icon}</div>
            <div style={{ flex: 1, textAlign: 'right' }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)' }}>{a.title}</div>
              <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 2 }}>{a.when} · {a.who}</div>
            </div>
            <Chip text="פעיל" color="#4CAF50" />
          </div>
        ))}
      </div>

      {/* Scheduled broadcasts */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexDirection: 'row-reverse' }}>
        <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-secondary)' }}>מיילים מתוזמנים שלי</span>
        <button onClick={() => setShowForm(!showForm)} style={{
          padding: '6px 14px', borderRadius: 100, border: 'none',
          background: GOLD, color: '#000', fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: 'var(--font-ui)',
        }}>{showForm ? 'סגור' : '+ מייל מתוזמן חדש'}</button>
      </div>

      {showForm && (
        <div className="gold-card" style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 10 }}>
          <input style={inputStyle} placeholder="נושא המייל" value={subject} onChange={e => setSubject(e.target.value)} />
          <textarea style={{ ...inputStyle, resize: 'vertical' }} rows={4} placeholder="תוכן ההודעה" value={body} onChange={e => setBody(e.target.value)} />
          <div style={{ display: 'flex', gap: 8, flexDirection: 'row-reverse', flexWrap: 'wrap' }}>
            <select style={{ ...inputStyle, width: 'auto', flex: 1 }} value={audience} onChange={e => setAudience(e.target.value as typeof audience)}>
              <option value="כולם">כולם</option>
              <option value="רשומים">רשומים לפורטל</option>
              <option value="לא רשומים">לא רשומים</option>
            </select>
            <select style={{ ...inputStyle, width: 'auto', flex: 1 }} value={recurrence} onChange={e => setRecurrence(e.target.value as typeof recurrence)}>
              <option value="חד פעמי">חד פעמי</option>
              <option value="שבועי">שבועי</option>
              <option value="חודשי">חודשי</option>
            </select>
            <input type="date" style={{ ...inputStyle, width: 'auto', flex: 1 }} value={sendOn} onChange={e => setSendOn(e.target.value)} />
          </div>
          {err && <div style={{ fontSize: 12, color: '#e2445c', textAlign: 'right' }}>{err}</div>}
          <button onClick={save} disabled={saving} style={{
            padding: '12px 16px', borderRadius: 12, border: 'none',
            background: `linear-gradient(135deg, ${'#C9A84C'}, #8a6a28)`, color: '#000',
            fontSize: 14, fontWeight: 700, cursor: saving ? 'wait' : 'pointer', opacity: saving ? 0.7 : 1,
            fontFamily: 'var(--font-ui)',
          }}>{saving ? 'שומר...' : 'שמור מייל מתוזמן'}</button>
          <div style={{ fontSize: 11, color: 'var(--text-secondary)', textAlign: 'right' }}>
            המייל יישלח אוטומטית בבוקר (10:15) של תאריך השליחה, ובהתאם לתדירות שנבחרה.
          </div>
        </div>
      )}

      {loading && <div style={{ textAlign: 'center', color: GOLD, fontSize: 13, padding: '20px 0' }}>⏳ טוען...</div>}
      {!loading && scheduled.length === 0 && !showForm && (
        <div style={{ textAlign: 'center', color: 'var(--text-secondary)', fontSize: 12, padding: '10px 0' }}>
          אין מיילים מתוזמנים — אפשר ליצור אחד עם הכפתור למעלה
        </div>
      )}

      {scheduled.map(s => (
        <div key={s.id} className="gold-card" style={{ padding: 14 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexDirection: 'row-reverse', gap: 10 }}>
            <div style={{ flex: 1, textAlign: 'right', minWidth: 0 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)' }}>{s.subject}</div>
              <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 3 }}>
                {s.recurrence} · {s.audience} · מ-{s.sendOn || '—'}{s.lastSent ? ` · נשלח לאחרונה ${s.lastSent}` : ''}
              </div>
            </div>
            {/* active toggle */}
            <div onClick={() => toggle(s)} style={{
              width: 44, height: 26, borderRadius: 13, cursor: 'pointer', flexShrink: 0,
              background: s.active ? GOLD : 'var(--bg-chip)', border: '1px solid var(--border)',
              position: 'relative', transition: 'background 0.2s',
            }}>
              <div style={{
                width: 20, height: 20, borderRadius: '50%', background: '#fff',
                position: 'absolute', top: 2,
                right: s.active ? 2 : undefined, left: s.active ? undefined : 2,
                boxShadow: '0 1px 3px rgba(0,0,0,0.3)', transition: 'left 0.2s, right 0.2s',
              }} />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── Tab: שליחה ─────────────────────────────────────────────────────────────

function ComposeTab() {
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [audience, setAudience] = useState<Audience>('all');
  const [customEmails, setCustomEmails] = useState('');
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState('');
  const [err, setErr] = useState('');
  const [confirming, setConfirming] = useState(false);

  const AUDIENCES: { id: Audience; label: string }[] = [
    { id: 'all', label: 'כל המשקיעים' },
    { id: 'registered', label: 'רשומים לפורטל' },
    { id: 'unregistered', label: 'לא רשומים' },
    { id: 'custom', label: 'כתובות ספציפיות' },
  ];

  const inputStyle: React.CSSProperties = {
    width: '100%', boxSizing: 'border-box', background: 'var(--bg-chip)',
    border: '1px solid var(--border)', borderRadius: 10, padding: '10px 12px',
    fontSize: 13, color: 'var(--text-primary)', fontFamily: 'var(--font-ui)', direction: 'rtl',
  };

  const send = async () => {
    if (sending) return;
    if (!subject.trim() || !message.trim()) { setErr('יש למלא נושא והודעה'); return; }
    if (!confirming) { setConfirming(true); setErr(''); return; }
    setSending(true); setErr(''); setResult('');
    try {
      const res = await sendAdminEmail({
        subject: subject.trim(),
        message: message.trim(),
        audience,
        ...(audience === 'custom' ? { customEmails: customEmails.split(/[\n,;]+/).map(s => s.trim()).filter(Boolean) } : {}),
      });
      setResult(`✓ נשלח ל-${res.sent} נמענים${res.failed ? ` · ${res.failed} נכשלו` : ''}`);
      setSubject(''); setMessage(''); setCustomEmails('');
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'השליחה נכשלה');
    } finally {
      setSending(false);
      setConfirming(false);
    }
  };

  return (
    <div className="gold-card" style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)', textAlign: 'right' }}>
        שליחת מייל למשקיעים
      </div>

      <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end', flexWrap: 'wrap' }}>
        {AUDIENCES.map(a => (
          <button key={a.id} onClick={() => { setAudience(a.id); setConfirming(false); }} style={{
            padding: '6px 12px', borderRadius: 100,
            border: audience === a.id ? 'none' : '1px solid var(--border)',
            background: audience === a.id ? GOLD : 'var(--bg-chip)',
            color: audience === a.id ? '#000' : 'var(--text-secondary)',
            fontSize: 11, fontWeight: 600, cursor: 'pointer', fontFamily: 'var(--font-ui)',
          }}>{a.label}</button>
        ))}
      </div>

      {audience === 'custom' && (
        <textarea style={{ ...inputStyle, direction: 'ltr', textAlign: 'left' }} rows={2}
          placeholder="email1@example.com, email2@example.com"
          value={customEmails} onChange={e => { setCustomEmails(e.target.value); setConfirming(false); }} />
      )}

      <input style={inputStyle} placeholder="נושא" value={subject}
        onChange={e => { setSubject(e.target.value); setConfirming(false); }} />
      <textarea style={{ ...inputStyle, resize: 'vertical' }} rows={6} placeholder="תוכן ההודעה..."
        value={message} onChange={e => { setMessage(e.target.value); setConfirming(false); }} />

      {err && <div style={{ fontSize: 12, color: '#e2445c', textAlign: 'right' }}>{err}</div>}
      {result && <div style={{ fontSize: 13, color: '#4CAF50', fontWeight: 600, textAlign: 'right' }}>{result}</div>}

      <button onClick={send} disabled={sending} style={{
        padding: '13px 16px', borderRadius: 12, border: 'none',
        background: confirming ? '#e2445c' : `linear-gradient(135deg, #C9A84C, #8a6a28)`,
        color: confirming ? '#fff' : '#000',
        fontSize: 14, fontWeight: 700, cursor: sending ? 'wait' : 'pointer', opacity: sending ? 0.7 : 1,
        fontFamily: 'var(--font-ui)', transition: 'background 0.15s',
      }}>
        {sending ? 'שולח...' : confirming ? 'לחיצה נוספת לאישור השליחה ⚠️' : 'שליחת המייל'}
      </button>
      <div style={{ fontSize: 11, color: 'var(--text-secondary)', textAlign: 'right' }}>
        המייל יעוצב אוטומטית בתבנית הממותגת של Miller Group ויירשם ביומן. משקיעים שביטלו קבלת מיילים לא יקבלו אותו.
      </div>
    </div>
  );
}

// ─── Screen ──────────────────────────────────────────────────────────────────

export function AdminEmailsScreen() {
  const [tab, setTab] = useState<Tab>('log');

  const TABS: { id: Tab; label: string }[] = [
    { id: 'log', label: 'יומן' },
    { id: 'auto', label: 'אוטומטיים' },
    { id: 'compose', label: 'שליחה' },
  ];

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: 'var(--bg-base)', overflow: 'hidden' }}>
      <div className="desktop-page-title">
        <div className="subtitle">כל המיילים שנשלחו מהמערכת · אוטומציות · שליחה ידנית</div>
        <h1>מרכז המיילים</h1>
      </div>

      <div className="screen-header" style={{ padding: '16px 20px 10px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
        <MGLogo size={36} showWordmark={false} />
        <span style={{ fontSize: 20, fontWeight: 700, color: 'var(--text-primary)' }}>מרכז המיילים</span>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 6, padding: '4px 20px 12px', justifyContent: 'flex-end', flexShrink: 0 }}>
        {TABS.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)} style={{
            padding: '8px 18px', borderRadius: 100,
            border: tab === t.id ? 'none' : '1px solid var(--border)',
            background: tab === t.id ? GOLD : 'var(--bg-chip)',
            color: tab === t.id ? '#000' : 'var(--text-secondary)',
            fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'var(--font-ui)',
          }}>{t.label}</button>
        ))}
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: '4px 20px 20px' }}>
        {tab === 'log' && <LogTab />}
        {tab === 'auto' && <AutoTab />}
        {tab === 'compose' && <ComposeTab />}
      </div>
    </div>
  );
}
