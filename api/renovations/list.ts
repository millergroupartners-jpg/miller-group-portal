/**
 * GET /api/renovations/list
 *
 * Admin-only payload. Returns renovation projects from the "שיפוצים" Monday
 * board with their subitems (individual contractor/owner payments).
 *
 * Query params:
 *   propertyId (optional) — filter to renovations linked to a specific property
 *                           item on the Properties board (1997938102).
 *   investorId (optional) — filter to renovations whose "משקיע" mirror equals this
 *                           investor's Monday item id.
 *   role       (optional) — 'admin' (default) or 'investor'. When 'investor', the
 *                           response is SANITIZED: subitems paid by us (paidBy=אנחנו)
 *                           are removed, the contractor name is stripped, ourCost
 *                           and addons are zeroed, and each remaining subitem's
 *                           paidTo is blanked so the investor only sees "their
 *                           transfers to our renovation company" with no hint
 *                           that a separate contractor exists in the middle.
 *
 * Response:
 *   {
 *     ok: true,
 *     renovations: [{
 *       id, name,
 *       groupId, groupTitle,
 *       propertyId, propertyName,
 *       investorName, contractorName, status,
 *       approvedAddons, updatedAt,
 *       subitems: [{ id, name, amount, date, paidTo, paidBy, category, receiptUrl }],
 *       totalPaid
 *     }]
 *   }
 *
 * receiptUrl/receiptThumb are returned EMPTY by the list — signed asset URLs
 * are the slowest part of the Monday query. The client hydrates them lazily
 * per renovation via GET ?action=assets&itemId=<id>[&role=investor].
 *
 * NOTE: Subitem data (individual payments) should NEVER be surfaced to investor
 * users — it contains internal commission/contractor transfers. The portal UI
 * hides the "שיפוצים" tab for non-admin users; this endpoint is not meant to be
 * called by investor clients.
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';
import {
  mondayQuery,
  esc,
  RENOVATIONS_BOARD_ID,
  PROPERTIES_BOARD_ID,
  RENOV_COL,
  RENOV_SUB_COL,
} from '../_lib/monday.js';

interface RawLinked { id: string; name: string }
interface RawColumnValue {
  id: string;
  text: string | null;
  value: string | null;
  linked_items?: RawLinked[];
  files?: { name: string; assetId?: string; url?: string; public_url?: string }[];
  /** Returned for MirrorValue columns (lookup_*). The mirrored cell's text. */
  display_value?: string | null;
}
interface RawSubitem {
  id: string;
  name: string;
  created_at: string;
  updated_at: string;
  column_values: RawColumnValue[];
}
interface RawItem {
  id: string;
  name: string;
  updated_at: string;
  group: { id: string; title: string };
  column_values: RawColumnValue[];
  subitems: RawSubitem[] | null;
}

function parseNumber(text: string | null | undefined): number {
  if (!text) return 0;
  const n = Number(String(text).replace(/[^0-9.\-]/g, ''));
  return Number.isFinite(n) ? n : 0;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Sub-endpoint: renovation item UPDATES (admin-only internal notes). Routed
  // via `?action=updates` so we don't need a separate serverless function file
  // (Vercel Hobby caps at 12 functions).
  const action = (req.query.action as string) || '';
  if (action === 'updates') {
    try {
      if (req.method === 'GET') {
        const itemId = ((req.query.itemId as string) || '').trim();
        if (!itemId) return res.status(400).json({ error: 'Missing itemId' });
        const q = `query {
          items(ids: [${itemId}]) {
            updates { id body text_body created_at creator { id name } }
          }
        }`;
        type Upd = { id: string; body: string; text_body: string; created_at: string; creator?: { id: string; name: string } | null };
        const data = await mondayQuery<{ items: { updates: Upd[] }[] }>(q);
        const raw = data.items?.[0]?.updates ?? [];
        const updates = [...raw].reverse().map(u => ({
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
        const data = await mondayQuery<{ create_update: { id: string } }>(mutation);
        return res.status(200).json({ ok: true, updateId: data?.create_update?.id || '' });
      }
      return res.status(405).json({ error: 'Method not allowed' });
    } catch (err: any) {
      console.error('renovations updates error:', err);
      return res.status(500).json({ error: err?.message || 'Server error' });
    }
  }

  // Sub-endpoint: receipt file URLs for one renovation's subitems, loaded
  // lazily when a card is expanded. Asset `public_url` signing is the single
  // slowest part of the Monday query (~4s for the whole board), so the main
  // list intentionally skips assets and the client calls this on demand.
  if (action === 'assets') {
    try {
      if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });
      const itemId = ((req.query.itemId as string) || '').trim();
      const role   = ((req.query.role as string) || 'admin').trim();
      if (!/^\d+$/.test(itemId)) return res.status(400).json({ error: 'Missing itemId' });
      const q = `query {
        items(ids: [${itemId}], limit: 1) {
          subitems {
            id
            column_values(ids: ["${RENOV_SUB_COL.paidBy}"]) { id text }
            assets { id public_url url_thumbnail }
          }
        }
      }`;
      type Sub = {
        id: string;
        column_values: { id: string; text: string | null }[];
        assets?: { public_url: string; url_thumbnail?: string | null }[];
      };
      const data = await mondayQuery<{ items: { subitems: Sub[] | null }[] }>(q);
      const subs = data?.items?.[0]?.subitems ?? [];
      const receipts: Record<string, { url: string; thumb: string }> = {};
      for (const sub of subs) {
        // Investor must never see receipts of payments we made internally.
        const paidBy = sub.column_values?.[0]?.text || '';
        if (role === 'investor' && paidBy !== 'הלקוח') continue;
        const file = sub.assets?.[0];
        if (file?.public_url) {
          receipts[sub.id] = { url: file.public_url, thumb: file.url_thumbnail || '' };
        }
      }
      return res.status(200).json({ ok: true, receipts });
    } catch (err: any) {
      console.error('renovations assets error:', err);
      return res.status(500).json({ error: err?.message || 'Server error' });
    }
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const propertyId = ((req.query.propertyId as string) || '').trim();
    const investorId = ((req.query.investorId as string) || '').trim();
    const role       = ((req.query.role as string) || 'admin').trim();
    const isInvestor = role === 'investor';

    // The only mirror column still read is "קבלן" — everything else that used
    // to be mirrored (סטטוס / משקיע / costs) comes from the Properties board
    // fetch below, which is authoritative. Each extra mirror column costs
    // Monday a cross-board resolve (~2s total for the old set of six).
    const CONTRACTOR_MIRROR = 'lookup_mkt3hy1k';

    const itemColumnIds = [RENOV_COL.property, RENOV_COL.addons, CONTRACTOR_MIRROR]
      .map(id => `"${id}"`)
      .join(',');
    // Receipt files come from `assets` (fetched lazily via ?action=assets),
    // not from the file column's text — no point paying for it here.
    const subColumnIds = Object.values(RENOV_SUB_COL)
      .filter(id => id !== RENOV_SUB_COL.receipt)
      .map(id => `"${id}"`)
      .join(',');

    const query = `
      query {
        boards(ids: [${RENOVATIONS_BOARD_ID}]) {
          items_page(limit: 200) {
            items {
              id
              name
              updated_at
              group { id title }
              column_values(ids: [${itemColumnIds}]) {
                id
                text
                value
                ... on BoardRelationValue { linked_items { id name } }
                ... on MirrorValue { display_value }
              }
              subitems {
                id
                name
                created_at
                updated_at
                column_values(ids: [${subColumnIds}]) {
                  id
                  text
                  value
                }
              }
            }
          }
        }
      }
    `;

    // Authoritative values for שיפוץ ללקוח / שיפוץ שלנו / סטטוס / משקיע live on
    // the Properties board. Fetching the whole board (one page, well under the
    // 500-item cap) lets this run IN PARALLEL with the renovations query —
    // previously it ran serialized on the linked ids and added ~2s.
    const propsQuery = `query {
      boards(ids: [${PROPERTIES_BOARD_ID}]) {
        items_page(limit: 500) {
          items {
            id
            group { id }
            column_values(ids: ["numeric_mkrzk78b", "numeric_mkvjrbnp", "color_mm1fv8p0", "board_relation_mkrzrtny"]) {
              id text
              ... on BoardRelationValue { linked_items { id name } }
            }
          }
        }
      }
    }`;
    type PropRow = {
      id: string;
      group: { id: string };
      column_values: { id: string; text: string | null; linked_items?: { id: string; name: string }[] }[];
    };

    const [data, propsData] = await Promise.all([
      mondayQuery<{ boards: { items_page: { items: RawItem[] } }[] }>(query),
      mondayQuery<{ boards: { items_page: { items: PropRow[] } }[] }>(propsQuery)
        .catch(e => { console.error('renovations-list property cost fetch failed:', e); return null; }),
    ]);
    const items = data?.boards?.[0]?.items_page?.items ?? [];

    const propertyCosts = new Map<string, { clientCost: number; ourCost: number; status: string; investorName: string; investorId: string; groupId: string }>();
    for (const it of propsData?.boards?.[0]?.items_page?.items ?? []) {
      const map = Object.fromEntries(it.column_values.map(cv => [cv.id, cv]));
      propertyCosts.set(it.id, {
        clientCost:   parseNumber(map['numeric_mkrzk78b']?.text),
        ourCost:      parseNumber(map['numeric_mkvjrbnp']?.text),
        status:       map['color_mm1fv8p0']?.text || '',
        investorName: map['board_relation_mkrzrtny']?.linked_items?.[0]?.name || '',
        investorId:   map['board_relation_mkrzrtny']?.linked_items?.[0]?.id || '',
        groupId:      it.group?.id || '',
      });
    }

    const renovations = items.map(item => {
      const cols = Object.fromEntries(item.column_values.map(cv => [cv.id, cv]));
      const propertyLinked = cols[RENOV_COL.property]?.linked_items?.[0];

      const subitems = (item.subitems ?? []).map(sub => {
        const sc = Object.fromEntries(sub.column_values.map(cv => [cv.id, cv]));
        return {
          id:       sub.id,
          name:     sub.name,
          amount:   parseNumber(sc[RENOV_SUB_COL.amount]?.text),
          date:     sc[RENOV_SUB_COL.date]?.text || '',
          paidTo:   sc[RENOV_SUB_COL.paidTo]?.text || '',
          paidBy:   sc[RENOV_SUB_COL.paidBy]?.text || '',
          category: sc[RENOV_SUB_COL.category]?.text || '',
          // Receipt URLs are signed per-request and slow to generate — the
          // client hydrates them on demand via ?action=assets&itemId=.
          receiptUrl: '',
          receiptThumb: '',
          createdAt: sub.created_at,
        };
      });

      // For investor-owned renovations, "שולם" = how much the INVESTOR transferred
      // (paidBy=הלקוח); subitems with paidBy=אנחנו are money we advanced and shouldn't
      // inflate the client-paid figure. For Miller Group's own deals there's no
      // investor in the middle, so the relevant "שולם" is the sum of EVERY subitem
      // — that's what the admin needs to see what's left to pay overall.
      const totalPaid = subitems
        .filter(s => s.paidBy === 'הלקוח')
        .reduce((s, x) => s + x.amount, 0);
      const totalPaidAll = subitems.reduce((s, x) => s + x.amount, 0);

      // Status / costs / investor come from the Properties-board fetch — it is
      // authoritative (the renovations board only mirrors it) and now runs in
      // parallel with the main query instead of pulling six mirror columns.
      const fromProp = propertyCosts.get(propertyLinked?.id || '') || { clientCost: 0, ourCost: 0, status: '', investorName: '', investorId: '', groupId: '' };

      const clientCost   = fromProp.clientCost;
      const ourCost      = fromProp.ourCost;
      const status       = fromProp.status;
      const investorName = fromProp.investorName;

      return {
        id:              item.id,
        name:            item.name,
        groupId:         item.group?.id || '',
        groupTitle:      item.group?.title || '',
        propertyId:      propertyLinked?.id || '',
        propertyName:    propertyLinked?.name || '',
        propertyGroupId: fromProp.groupId,   // "group_mkw9are4" = Miller Group, else = investors
        status,
        investorName,
        contractorName:  cols[CONTRACTOR_MIRROR]?.display_value || cols[CONTRACTOR_MIRROR]?.text || '',
        ourCost,
        clientCost,
        approvedAddons:  parseNumber(cols[RENOV_COL.addons]?.text),
        updatedAt:       item.updated_at,
        subitems,
        totalPaid,
        totalPaidAll,
      };
    });

    let filtered = renovations;
    if (propertyId) {
      filtered = filtered.filter(r => r.propertyId === propertyId);
    }
    if (investorId) {
      // Match renovations whose linked property points at this investor.
      filtered = filtered.filter(r => {
        const fp = propertyCosts.get(r.propertyId);
        return fp?.investorId === investorId;
      });
    }

    filtered.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());

    // INVESTOR sanitization — strip every hint of internal contractor / commission:
    //   · Drop subitems paid by us (paidBy=אנחנו) — investor only sees their own transfers
    //   · Zero contractor identity + our internal cost / addon totals
    //   · Blank the paidTo on each remaining subitem so investor doesn't see
    //     "לקבלן / קבלן משנה" labels. From their perspective, every transfer went
    //     to our company ("חברת השיפוצים שלנו").
    const sanitized = isInvestor
      ? filtered.map(r => ({
          ...r,
          contractorName: '',
          ourCost:        0,
          // approvedAddons STAYS visible — investor is shown it as a small "+$X"
          // badge next to the base renovation price and remaining balance so
          // they understand why the expected total may be higher than the
          // original quote. This is approved work, not internal margin.
          subitems: r.subitems
            .filter(s => s.paidBy === 'הלקוח')
            .map(s => ({ ...s, paidTo: '', paidBy: '' })),
          // recompute totalPaid from what's visible to investor
          totalPaid: r.subitems.filter(s => s.paidBy === 'הלקוח').reduce((a, x) => a + (x.amount || 0), 0),
        }))
      : filtered;

    // Let Vercel's CDN serve repeat loads instantly: fresh for 2 minutes,
    // then served stale (while revalidating in the background) up to 10 more.
    // Cache key includes the query string, so admin/investor/property variants
    // are cached separately.
    res.setHeader('Cache-Control', 'public, s-maxage=120, stale-while-revalidate=600');
    return res.status(200).json({ ok: true, renovations: sanitized });
  } catch (err: any) {
    console.error('renovations-list error:', err);
    return res.status(500).json({ error: err?.message || 'Server error' });
  }
}
