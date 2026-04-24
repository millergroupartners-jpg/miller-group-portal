/**
 * /api/renovations/updates
 *
 * GET  — list updates (comments) on a renovation item
 *        query: ?itemId=<renovation monday item id>
 * POST — add a new update. Body: { itemId, body, author }
 *
 * Both operations are ADMIN-ONLY semantically (internal project notes).
 * The portal UI hides the controls from investors; this endpoint does not
 * enforce auth because our Vercel functions don't have user sessions.
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { mondayQuery, esc } from '../_lib/monday.js';

interface RawUpdate {
  id: string;
  body: string;
  text_body: string;
  created_at: string;
  creator?: { id: string; name: string } | null;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    if (req.method === 'GET') {
      const itemId = ((req.query.itemId as string) || '').trim();
      if (!itemId) return res.status(400).json({ error: 'Missing itemId' });

      const query = `query {
        items(ids: [${itemId}]) {
          updates { id body text_body created_at creator { id name } }
        }
      }`;
      const data = await mondayQuery<{ items: { updates: RawUpdate[] }[] }>(query);
      const raw = data.items?.[0]?.updates ?? [];
      const updates = [...raw]
        .reverse() // Monday returns newest first; reverse for chronological thread
        .map(u => ({
          id:        u.id,
          body:      u.body,
          textBody:  u.text_body,
          createdAt: u.created_at,
          author:    u.creator?.name || 'System',
        }));
      return res.status(200).json({ ok: true, updates });
    }

    if (req.method === 'POST') {
      const { itemId, body, author } = req.body || {};
      if (!itemId || !body) return res.status(400).json({ error: 'Missing itemId or body' });

      const authorName = (author || 'הנהלת Miller Group').toString();
      const escBody = esc(String(body)).replace(/\n/g, '<br>');
      const mutation = `mutation {
        create_update(
          item_id: ${itemId},
          body: "<b>${esc(authorName)}:</b><br>${escBody}"
        ) { id created_at }
      }`;
      const data = await mondayQuery<{ create_update: { id: string; created_at: string } }>(mutation);
      return res.status(200).json({ ok: true, updateId: data?.create_update?.id || '' });
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (err: any) {
    console.error('renovations-updates error:', err);
    return res.status(500).json({ error: err?.message || 'Server error' });
  }
}
