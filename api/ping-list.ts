import type { VercelRequest, VercelResponse } from '@vercel/node';
import { mondayQuery, INQUIRIES_BOARD_ID } from './_lib/monday';

export default async function handler(_req: VercelRequest, res: VercelResponse) {
  try {
    const data: any = await mondayQuery(`query {
      boards(ids: [${INQUIRIES_BOARD_ID}]) {
        items_page(limit: 3) { items { id name } }
      }
    }`);
    return res.status(200).json({ ok: true, boardId: INQUIRIES_BOARD_ID, data });
  } catch (e: any) {
    return res.status(500).json({
      err: e?.message,
      stack: String(e?.stack || '').slice(0, 2000),
    });
  }
}
