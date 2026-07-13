/**
 * Gmail SMTP mailer (via Nodemailer) for Vercel serverless functions.
 * Uses admin's Gmail + App Password (NOT regular password).
 *
 * Required env vars (set in Vercel):
 *   GMAIL_USER           — admin Gmail address (e.g. admin@millergroup.com)
 *   GMAIL_APP_PASSWORD   — 16-char App Password from Google account
 */

import nodemailer from 'nodemailer';
import { mondayQuery } from './monday.js';

let _transporter: nodemailer.Transporter | null = null;

// ─── Email log (Monday board "יומן מיילים") ────────────────────────────────
// Every sendMail() call is recorded here so the admin can audit what went out,
// when, and to whom. Logging must never break the actual send.

const EMAIL_LOG_BOARD_ID = 5100220059;
const LOG_COL = {
  recipients: 'long_text_mm57hqg0', // נמענים
  kind:       'color_mm57f0rb',     // סוג: אוטומטי / ידני
  category:   'text_mm57fqqp',      // קטגוריה (פניות / עסקאות / תזכורות / ...)
  body:       'long_text_mm57nrqb', // תוכן (טקסט נקי, קטוע)
  sendStatus: 'color_mm576egg',     // סטטוס שליחה: נשלח / נכשל
  count:      'numeric_mm57e4gd',   // מספר נמענים
} as const;

export interface EmailLogMeta {
  /** 'אוטומטי' (default) for cron/system emails, 'ידני' for admin-composed. */
  kind?: 'אוטומטי' | 'ידני';
  /** Free-text bucket shown in the admin log, e.g. 'פניות', 'חדר עסקאות'. */
  category?: string;
}

function htmlToPreview(html: string, max = 600): string {
  const text = html
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  return text.length > max ? text.slice(0, max) + '…' : text;
}

async function logEmail(
  opts: { to: string | string[]; subject: string; html: string },
  meta: EmailLogMeta,
  ok: boolean,
): Promise<void> {
  try {
    const recipients = Array.isArray(opts.to) ? opts.to : [opts.to];
    const columnValues = {
      [LOG_COL.recipients]: { text: recipients.join(', ') },
      [LOG_COL.kind]:       { label: meta.kind ?? 'אוטומטי' },
      [LOG_COL.category]:   meta.category ?? 'כללי',
      [LOG_COL.body]:       { text: htmlToPreview(opts.html) },
      [LOG_COL.sendStatus]: { label: ok ? 'נשלח' : 'נכשל' },
      [LOG_COL.count]:      String(recipients.length),
    };
    await mondayQuery(
      `mutation ($board: ID!, $name: String!, $cols: JSON!) {
        create_item(board_id: $board, item_name: $name, column_values: $cols) { id }
      }`,
      { board: String(EMAIL_LOG_BOARD_ID), name: opts.subject.slice(0, 255), cols: JSON.stringify(columnValues) },
    );
  } catch (err) {
    console.error('email log write failed (send unaffected):', err);
  }
}

function getTransporter() {
  if (_transporter) return _transporter;
  const user = (process.env.GMAIL_USER || '').trim();
  const pass = (process.env.GMAIL_APP_PASSWORD || '').trim();
  if (!user || !pass) {
    throw new Error('GMAIL_USER / GMAIL_APP_PASSWORD not configured on server');
  }
  _transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: { user, pass: pass.replace(/\s+/g, '') }, // strip spaces from App Password
  });
  return _transporter;
}

export async function sendMail(opts: {
  to: string | string[];
  subject: string;
  html: string;
  replyTo?: string;
  /** Audit-log metadata. Pass `false` to skip logging (e.g. inside a batch
   *  that logs once for all recipients). Defaults to an 'אוטומטי' log entry. */
  log?: EmailLogMeta | false;
}) {
  const user = (process.env.GMAIL_USER || '').trim();
  const to = Array.isArray(opts.to) ? opts.to.join(', ') : opts.to;
  try {
    const result = await getTransporter().sendMail({
      from: `"Miller Group" <${user}>`,
      to,
      subject: opts.subject,
      html: opts.html,
      replyTo: opts.replyTo,
    });
    if (opts.log !== false) await logEmail(opts, opts.log ?? {}, true);
    return result;
  } catch (err) {
    if (opts.log !== false) await logEmail(opts, opts.log ?? {}, false);
    throw err;
  }
}

/** Log a batch send as ONE entry (callers that loop sendMail({log:false})). */
export async function logEmailBatch(opts: {
  recipients: string[];
  subject: string;
  html: string;
  meta: EmailLogMeta;
  ok: boolean;
}): Promise<void> {
  await logEmail({ to: opts.recipients, subject: opts.subject, html: opts.html }, opts.meta, opts.ok);
}

/**
 * Returns the list of recipient emails for any "goes to management" notification
 * (daily summary, new inquiries, media alerts). Always includes GMAIL_USER, plus
 * anyone listed in the comma-separated ADMIN_EMAILS env var (e.g. backoffice),
 * plus anyone in ADMIN_EMAILS_EXTRA — a second, separately-managed list so new
 * recipients can be added without touching the existing ADMIN_EMAILS value.
 */
export function getAdminRecipients(): string[] {
  const primary = (process.env.GMAIL_USER || '').trim();
  const extras = [
    ...(process.env.ADMIN_EMAILS || '').split(','),
    ...(process.env.ADMIN_EMAILS_EXTRA || '').split(','),
  ]
    .map(s => s.trim())
    .filter(s => s && s !== primary);
  const all = [primary, ...extras].filter(Boolean);
  // de-dupe while preserving order
  return Array.from(new Set(all));
}

const PORTAL_URL = process.env.PORTAL_URL || 'https://miller-group-portal.vercel.app';
const GOLD = '#C9A84C';

/** Shared email template — RTL, gold accent, Miller Group brand */
export function wrapEmail(opts: { title: string; bodyHtml: string; cta?: { label: string; url: string } }): string {
  return `<!DOCTYPE html>
<html dir="rtl" lang="he">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:20px;background:#f5f0e8;font-family:'Heebo',Arial,sans-serif;direction:rtl;">
  <div style="max-width:560px;margin:0 auto;background:#ffffff;border-radius:16px;overflow:hidden;border:1px solid #e5dfd4;">
    <div style="background:linear-gradient(90deg,${GOLD},#f0d080,${GOLD});height:4px;"></div>
    <div style="padding:28px 28px 20px;border-bottom:1px solid #e5dfd4;">
      <div style="font-size:11px;color:#888;letter-spacing:1px;">MILLER GROUP</div>
      <h1 style="margin:6px 0 0;font-size:20px;color:#111;font-weight:700;">${opts.title}</h1>
    </div>
    <div style="padding:24px 28px;color:#333;font-size:14px;line-height:1.7;">
      ${opts.bodyHtml}
      ${opts.cta ? `
        <div style="margin-top:24px;">
          <a href="${opts.cta.url}" style="display:inline-block;background:${GOLD};color:#000;text-decoration:none;padding:12px 22px;border-radius:100px;font-weight:700;font-size:13px;">${opts.cta.label}</a>
        </div>
      ` : ''}
    </div>
    <div style="padding:14px 28px;background:#faf7f2;color:#999;font-size:11px;text-align:center;border-top:1px solid #e5dfd4;">
      Miller Group · מערכת ניהול המשקיעים · <a href="${PORTAL_URL}" style="color:${GOLD};text-decoration:none;">פורטל המשקיעים</a>
    </div>
  </div>
</body>
</html>`;
}
