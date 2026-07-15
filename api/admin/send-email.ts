/**
 * POST /api/admin/send-email
 *
 * Admin-composed email broadcast from the portal's email center.
 *
 * Request body:
 * {
 *   subject: string;
 *   message: string;                 // plain text, newlines preserved
 *   audience: 'all' | 'registered' | 'unregistered' | 'custom';
 *   customEmails?: string[];         // required when audience = 'custom'
 *   ctaLabel?: string;               // optional CTA button
 * }
 *
 * Recipients are resolved from the investors board. The blanket email opt-out
 * (boolean_mm2pee1j) is always respected for broadcast audiences; 'custom'
 * sends to the given addresses as-is (admin's explicit choice).
 *
 * Every broadcast is logged ONCE to the "יומן מיילים" board as kind 'ידני'.
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { mondayQuery } from '../_lib/monday.js';
import { sendMail, wrapEmail, getAdminRecipients, logEmailBatch } from '../_lib/email.js';

const INVESTORS_BOARD_ID = 1997938105;
const INV_COL = {
  email:         'lead_email',
  password:      'text_mm2mw06h',    // presence = registered
  blanketOptOut: 'boolean_mm2pee1j', // checked = no emails at all
} as const;

const MAX_RECIPIENTS = 300; // sanity ceiling — the investors board is ~200 rows

function esc(s: string): string {
  return (s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

interface Recipient { name: string; email: string }

async function resolveAudience(audience: string): Promise<Recipient[]> {
  const q = `query {
    boards(ids: [${INVESTORS_BOARD_ID}]) {
      items_page(limit: 500) {
        items {
          id name
          column_values(ids: ["${INV_COL.email}", "${INV_COL.password}", "${INV_COL.blanketOptOut}"]) {
            id text value
          }
        }
      }
    }
  }`;
  type RawInv = { id: string; name: string; column_values: { id: string; text: string | null; value: string | null }[] };
  const data = await mondayQuery<{ boards: { items_page: { items: RawInv[] } }[] }>(q);
  const items = data?.boards?.[0]?.items_page?.items ?? [];

  const seen = new Set<string>();
  const out: Recipient[] = [];
  for (const it of items) {
    const cols = Object.fromEntries(it.column_values.map(c => [c.id, c]));
    const email = (cols[INV_COL.email]?.text ?? '').trim().toLowerCase();
    if (!email || seen.has(email)) continue;
    const registered = Boolean(cols[INV_COL.password]?.text?.trim());
    const optedOut = /"checked":"?true"?/i.test(cols[INV_COL.blanketOptOut]?.value || '');
    if (optedOut) continue;
    if (audience === 'registered' && !registered) continue;
    if (audience === 'unregistered' && registered) continue;
    seen.add(email);
    out.push({ name: it.name, email });
  }
  return out;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const { subject, message, audience, customEmails, ctaLabel } = req.body || {};
    if (!subject?.trim() || !message?.trim()) {
      return res.status(400).json({ error: 'Missing subject or message' });
    }
    if (!['all', 'registered', 'unregistered', 'custom', 'test'].includes(audience)) {
      return res.status(400).json({ error: 'Invalid audience' });
    }

    let recipients: Recipient[];
    if (audience === 'test') {
      // "Send test to me" — deliver only to the server-side admin inboxes
      // (GMAIL_USER + ADMIN_EMAILS), which are the mailboxes staff actually
      // read. Being admin-only also skips the confirmation email below.
      recipients = getAdminRecipients().map(email => ({ name: '', email: email.toLowerCase() }));
    } else if (audience === 'custom') {
      const emails: string[] = Array.isArray(customEmails) ? customEmails : [];
      const cleaned = Array.from(new Set(
        emails.map(e => String(e).trim().toLowerCase()).filter(e => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e)),
      ));
      if (cleaned.length === 0) return res.status(400).json({ error: 'No valid custom emails' });
      recipients = cleaned.map(email => ({ name: '', email }));
    } else {
      recipients = await resolveAudience(audience);
    }

    if (recipients.length === 0) {
      return res.status(200).json({ ok: true, sent: 0, failed: 0, reason: 'No matching recipients' });
    }
    if (recipients.length > MAX_RECIPIENTS) {
      return res.status(400).json({ error: `Too many recipients (${recipients.length} > ${MAX_RECIPIENTS})` });
    }

    const portalUrl = process.env.PORTAL_URL || 'https://miller-group-portal.vercel.app';
    const bodyHtml = (name: string) => `
      ${name ? `<p>שלום ${esc(name)},</p>` : ''}
      <div>${esc(message).replace(/\n/g, '<br>')}</div>
    `;

    let sent = 0;
    const failures: string[] = [];
    for (const r of recipients) {
      try {
        await sendMail({
          to: r.email,
          subject,
          html: wrapEmail({
            title: subject,
            bodyHtml: bodyHtml(r.name),
            ...(ctaLabel ? { cta: { label: String(ctaLabel), url: portalUrl } } : {}),
          }),
          log: false, // logged once as a batch below
        });
        sent++;
      } catch (err) {
        console.error('admin broadcast failed for', r.email, err);
        failures.push(r.email);
      }
    }

    await logEmailBatch({
      recipients: recipients.map(r => r.email),
      subject,
      html: bodyHtml(''),
      meta: { kind: 'ידני', category: 'שליחה מהאדמין' },
      ok: failures.length === 0,
    });

    // Notify admins a broadcast happened (skip when the admin is the only recipient)
    const adminSet = new Set(getAdminRecipients().map(a => a.toLowerCase()));
    const externalCount = recipients.filter(r => !adminSet.has(r.email)).length;
    if (externalCount > 0) {
      await sendMail({
        to: getAdminRecipients(),
        log: false,
        subject: `מייל ידני נשלח ל-${sent} נמענים: ${subject}`,
        html: wrapEmail({
          title: 'אישור שליחת מייל מהפורטל',
          bodyHtml: `
            <p>נשלח מייל ידני מהפורטל:</p>
            <p><b>נושא:</b> ${esc(subject)}<br><b>קהל:</b> ${esc(audience)} · ${sent} נמענים</p>
            ${failures.length ? `<p style="color:#c62828;">כשלונות: ${failures.map(esc).join(', ')}</p>` : ''}
          `,
        }),
      }).catch(err => console.error('broadcast confirmation email failed:', err));
    }

    return res.status(200).json({ ok: true, sent, failed: failures.length, failures });
  } catch (err: any) {
    console.error('admin send-email error:', err);
    return res.status(500).json({ error: err?.message || 'Server error' });
  }
}
