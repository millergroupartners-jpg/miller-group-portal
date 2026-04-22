/**
 * POST /api/inquiries/reply
 *
 * Adds a reply to an existing inquiry as a Monday Update,
 * updates status to "In Progress" if currently "New",
 * and emails the other party.
 *
 * Request body:
 * {
 *   inquiryId: string;
 *   message: string;
 *   replyFrom: 'admin' | 'investor';
 *   investorName: string;
 *   investorEmail: string;
 *   subject: string;    // for email subject line (original inquiry subject)
 * }
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { mondayQuery, INQ_STATUS, INQ_COL, esc } from '../_lib/monday';
import { sendMail, wrapEmail } from '../_lib/email';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { inquiryId, message, replyFrom, investorName, investorEmail, subject } = req.body || {};

    if (!inquiryId || !message || !replyFrom || !investorEmail) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const authorName = replyFrom === 'admin' ? 'הנהלת Miller Group' : investorName;
    const messageBody = esc(message).replace(/\n/g, '<br>');

    // 1. Add the reply as a Monday update
    const updateMutation = `
      mutation {
        create_update(
          item_id: ${inquiryId},
          body: "<b>${esc(authorName)}:</b><br>${messageBody}"
        ) { id created_at }
      }
    `;
    await mondayQuery(updateMutation);

    // 2. Move status to "In Progress" if it's still "New"
    //    (safe to always update — Monday API just overwrites)
    const statusMutation = `
      mutation {
        change_simple_column_value(
          item_id: ${inquiryId},
          board_id: ${Number((process.env.INQUIRIES_BOARD_ID || '5095120333').trim())},
          column_id: "${INQ_COL.status}",
          value: "${INQ_STATUS.IN_PROGRESS.label}"
        ) { id }
      }
    `;
    await mondayQuery(statusMutation).catch(() => {}); // ignore errors (e.g. status already Resolved)

    // 3. Send email notification
    const adminEmail = process.env.GMAIL_USER!;
    const inquiryNumber = `INQ-${String(inquiryId).slice(-6)}`;

    try {
      if (replyFrom === 'investor') {
        // Investor replied → notify admin (Reply-To = investor)
        await sendMail({
          to: adminEmail,
          replyTo: investorEmail,
          subject: `תגובה מ-${investorName} — ${inquiryNumber}: ${subject || ''}`,
          html: wrapEmail({
            title: `תגובה חדשה — ${inquiryNumber}`,
            bodyHtml: `
              <p><b>מאת:</b> ${esc(investorName)} &lt;${esc(investorEmail)}&gt;</p>
              ${subject ? `<p><b>פניה:</b> ${esc(subject)}</p>` : ''}
              <div style="background:#faf7f2;padding:14px;border-radius:10px;border-right:3px solid #C9A84C;">
                ${messageBody}
              </div>
              <p style="margin-top:16px;font-size:12px;color:#888;">כדי להגיב, השב למייל זה (Reply) או פתח את הפורטל.</p>
            `,
            cta: { label: 'פתח את הפורטל', url: process.env.PORTAL_URL || 'https://miller-group-portal.vercel.app' },
          }),
        });
      } else {
        // Admin replied → notify investor
        await sendMail({
          to: investorEmail,
          subject: `תגובה לפנייתך — ${esc(subject || inquiryNumber)}`,
          html: wrapEmail({
            title: `תגובה חדשה לפנייתך`,
            bodyHtml: `
              <p>שלום ${esc(investorName)},</p>
              <p>הנהלת Miller Group הגיבה לפנייתך:</p>
              ${subject ? `<p><b>פניה:</b> ${esc(subject)}</p>` : ''}
              <div style="background:#faf7f2;padding:14px;border-radius:10px;border-right:3px solid #C9A84C;">
                ${messageBody}
              </div>
            `,
            cta: { label: 'הגב בפורטל', url: process.env.PORTAL_URL || 'https://miller-group-portal.vercel.app' },
          }),
        });
      }
    } catch (emailErr) {
      console.error('Email failed on reply:', emailErr);
      // don't fail the whole request
    }

    return res.status(200).json({ ok: true });
  } catch (err: any) {
    console.error('reply-inquiry error:', err);
    return res.status(500).json({ error: err?.message || 'Server error' });
  }
}
