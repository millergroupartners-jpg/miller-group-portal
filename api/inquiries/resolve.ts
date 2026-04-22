/**
 * POST /api/inquiries/resolve
 *
 * Marks an inquiry as "Resolved" in Monday.
 *
 * Request body: { inquiryId: string }
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { mondayQuery, INQ_STATUS, INQ_COL } from '../_lib/monday';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { inquiryId } = req.body || {};
    if (!inquiryId) {
      return res.status(400).json({ error: 'Missing inquiryId' });
    }

    const mutation = `
      mutation {
        change_simple_column_value(
          item_id: ${inquiryId},
          board_id: ${Number(process.env.INQUIRIES_BOARD_ID || 5095120333)},
          column_id: "${INQ_COL.status}",
          value: "${INQ_STATUS.RESOLVED.label}"
        ) { id }
      }
    `;
    await mondayQuery(mutation);

    return res.status(200).json({ ok: true });
  } catch (err: any) {
    console.error('resolve-inquiry error:', err);
    return res.status(500).json({ error: err?.message || 'Server error' });
  }
}
