/**
 * GET /api/inquiries/list
 *
 * Query params:
 *   investorId    (optional) — if present, return only inquiries for this investor.
 *                              if omitted, return ALL inquiries (admin view).
 *
 * Response: array of inquiry objects with their replies/updates.
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { mondayQuery, INQUIRIES_BOARD_ID, INQ_COL } from '../_lib/monday.js';

interface RawColumnValue {
  id: string;
  text: string | null;
  value: string | null;
}
interface RawUpdate {
  id: string;
  body: string;
  text_body: string;
  created_at: string;
  creator?: { id: string; name: string } | null;
}
interface RawItem {
  id: string;
  name: string;
  created_at: string;
  updated_at: string;
  column_values: RawColumnValue[];
  updates: RawUpdate[];
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const investorId = (req.query.investorId as string) || '';

    // Fetch all items from the board. For small boards this is fine.
    // Items are filtered client-side by investorId (text column).
    const query = `
      query {
        boards(ids: [${INQUIRIES_BOARD_ID}]) {
          items_page(limit: 100) {
            items {
              id
              name
              created_at
              updated_at
              column_values {
                id
                text
                value
              }
              updates {
                id
                body
                text_body
                created_at
                creator { id name }
              }
            }
          }
        }
      }
    `;

    const data = await mondayQuery<{
      boards: { items_page: { items: RawItem[] } }[]
    }>(query);

    const items = data.boards?.[0]?.items_page?.items ?? [];

    const inquiries = items.map(item => {
      const cols = Object.fromEntries(item.column_values.map(cv => [cv.id, cv]));
      return {
        id:              item.id,
        inquiryNumber:   `INQ-${item.id.slice(-6)}`,
        subject:         item.name,
        createdAt:       item.created_at,
        updatedAt:       item.updated_at,
        status:          cols[INQ_COL.status]?.text || 'New',
        direction:       cols[INQ_COL.direction]?.text || 'Investor→Management',
        investorId:      cols[INQ_COL.investorId]?.text || '',
        investorName:    cols[INQ_COL.investorName]?.text || '',
        investorEmail:   cols[INQ_COL.investorEmail]?.text || '',
        property:        cols[INQ_COL.property]?.text || '',
        // Updates returned newest first by Monday → reverse for chronological thread
        replies: [...item.updates].reverse().map(u => ({
          id:        u.id,
          body:      u.body,
          textBody:  u.text_body,
          createdAt: u.created_at,
          author:    u.creator?.name || 'System',
        })),
      };
    });

    // Filter by investorId if provided
    const filtered = investorId
      ? inquiries.filter(inq => inq.investorId === investorId)
      : inquiries;

    // Sort: newest first
    filtered.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());

    return res.status(200).json({ inquiries: filtered });
  } catch (err: any) {
    console.error('list-inquiries error:', err);
    return res.status(500).json({ error: err?.message || 'Server error' });
  }
}
