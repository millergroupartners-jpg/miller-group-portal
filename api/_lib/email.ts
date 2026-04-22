/**
 * Gmail SMTP mailer (via Nodemailer) for Vercel serverless functions.
 * Uses admin's Gmail + App Password (NOT regular password).
 *
 * Required env vars (set in Vercel):
 *   GMAIL_USER           — admin Gmail address (e.g. admin@millergroup.com)
 *   GMAIL_APP_PASSWORD   — 16-char App Password from Google account
 */

import nodemailer from 'nodemailer';

let _transporter: nodemailer.Transporter | null = null;

function getTransporter() {
  if (_transporter) return _transporter;
  const user = process.env.GMAIL_USER;
  const pass = process.env.GMAIL_APP_PASSWORD;
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
  to: string;
  subject: string;
  html: string;
  replyTo?: string;
}) {
  const user = process.env.GMAIL_USER!;
  return getTransporter().sendMail({
    from: `"Miller Group" <${user}>`,
    to: opts.to,
    subject: opts.subject,
    html: opts.html,
    replyTo: opts.replyTo,
  });
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
