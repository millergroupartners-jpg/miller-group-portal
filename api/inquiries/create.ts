/**
 * POST /api/inquiries/create
 *
 * Creates a new inquiry on the Monday "Inquiries" board and emails the
 * appropriate recipient:
 *
 *   - direction 'investor-to-admin': email admin (Reply-To = investor email)
 *   - direction 'admin-to-investor': email investor directly
 *
 * Request body:
 * {
 *   subject: string;
 *   message: string;
 *   investorId: string;
 *   investorName: string;
 *   investorEmail: string;
 *   property?: string;
 *   direction: 'investor-to-admin' | 'admin-to-investor';
 * }
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { mondayQuery, INQUIRIES_BOARD_ID, INQ_COL, INQ_STATUS, INQ_DIRECTION, esc, jsonEsc, appendToMessageColumn } from '../_lib/monday.js';
import { sendMail, wrapEmail } from '../_lib/email.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { subject, message, investorId, investorName, investorEmail, property, direction } = req.body || {};

    if (!subject || !message || !investorName || !investorEmail || !direction) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const dirLabel = direction === 'admin-to-investor'
      ? INQ_DIRECTION.ADMIN_TO_INVESTOR
      : INQ_DIRECTION.INVESTOR_TO_ADMIN;

    // Build column values JSON for Monday create_item mutation
    const columnValues: Record<string, any> = {
      [INQ_COL.status]:        { label: INQ_STATUS.NEW.label },
      [INQ_COL.direction]:     { labels: [dirLabel] },
      [INQ_COL.investorName]:  investorName,
      [INQ_COL.investorEmail]: investorEmail,
      [INQ_COL.investorId]:    investorId || '',
      [INQ_COL.property]:      property || '',
    };
    const columnValuesJson = jsonEsc(JSON.stringify(columnValues));

    const itemName = esc(subject);
    const mutation = `
      mutation {
        create_item(
          board_id: ${INQUIRIES_BOARD_ID},
          item_name: "${itemName}",
          column_values: "${columnValuesJson}"
        ) { id name }
      }
    `;
    const created = await mondayQuery<{ create_item: { id: string; name: string } }>(mutation);
    const inquiryId = created.create_item.id;

    // Add the initial message as the first Update (comment) on the item
    const messageBody = esc(message).replace(/\n/g, '<br>');
    const initialAuthor = direction === 'admin-to-investor' ? 'הנהלת Miller Group' : investorName;
    const updateMutation = `
      mutation {
        create_update(
          item_id: ${inquiryId},
          body: "<b>${esc(initialAuthor)}:</b><br>${messageBody}"
        ) { id }
      }
    `;
    let updateId = '';
    try {
      const updRes = await mondayQuery<{ create_update: { id: string } }>(updateMutation);
      updateId = updRes?.create_update?.id ?? '';
    } catch {}

    // Log the first message to the Message column (full conversation log)
    try {
      await appendToMessageColumn({
        inquiryId,
        author: initialAuthor,
        text: message,
      });
    } catch (logErr) {
      console.error('Failed to log first message to Message column:', logErr);
    }

    // Send email notification
    const adminEmail = process.env.GMAIL_USER!;
    const inquiryNumber = `INQ-${inquiryId.slice(-6)}`;

    try {
      if (direction === 'investor-to-admin') {
        await sendMail({
          to: adminEmail,
          subject: `פנייה חדשה מאת ${investorName} — ${inquiryNumber}`,
          html: wrapEmail({
            title: `פנייה חדשה — ${inquiryNumber}`,
            bodyHtml: `
              <p><b>מאת:</b> ${esc(investorName)} &lt;${esc(investorEmail)}&gt;</p>
              ${property ? `<p><b>נכס:</b> ${esc(property)}</p>` : ''}
              <p><b>נושא:</b> ${esc(subject)}</p>
              <div style="background:#faf7f2;padding:14px;border-radius:10px;border-right:3px solid ${'#C9A84C'};">
                ${messageBody}
              </div>
              <p style="margin-top:20px;padding:12px;background:#fff8e1;border-right:3px solid #ff9800;border-radius:8px;font-size:12px;color:#8a6a28;">
                ⚠️ <b>חשוב:</b> אנא השב רק דרך הפורטל — תגובה למייל זה לא תסתנכרן למערכת.
              </p>
            `,
            cta: { label: 'הגב בפורטל', url: `${process.env.PORTAL_URL || 'https://miller-group-portal.vercel.app'}` },
          }),
        });
      } else {
        await sendMail({
          to: investorEmail,
          subject: `פנייה חדשה מהנהלת Miller Group — ${esc(subject)}`,
          html: wrapEmail({
            title: `פנייה חדשה — ${inquiryNumber}`,
            bodyHtml: `
              <p>שלום ${esc(investorName)},</p>
              <p>קיבלת פנייה חדשה מהנהלת Miller Group:</p>
              ${property ? `<p><b>נכס:</b> ${esc(property)}</p>` : ''}
              <p><b>נושא:</b> ${esc(subject)}</p>
              <div style="background:#faf7f2;padding:14px;border-radius:10px;border-right:3px solid #C9A84C;">
                ${messageBody}
              </div>
              <p style="margin-top:20px;padding:12px;background:#fff8e1;border-right:3px solid #ff9800;border-radius:8px;font-size:12px;color:#8a6a28;">
                ⚠️ <b>חשוב:</b> כדי להגיב, היכנס לפורטל. תגובה למייל זה לא תסתנכרן למערכת.
              </p>
            `,
            cta: { label: 'הגב בפורטל', url: `${process.env.PORTAL_URL || 'https://miller-group-portal.vercel.app'}` },
          }),
        });
      }
    } catch (emailErr) {
      console.error('Email failed but inquiry created:', emailErr);
      // Don't fail the whole request if email fails — inquiry is still created
    }

    return res.status(200).json({
      ok: true,
      inquiryId,
      inquiryNumber,
      updateId,
    });
  } catch (err: any) {
    console.error('create-inquiry error:', err);
    return res.status(500).json({ error: err?.message || 'Server error' });
  }
}
