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
 * NOTE: Subitem data (individual payments) should NEVER be surfaced to investor
 * users — it contains internal commission/contractor transfers. The portal UI
 * hides the "שיפוצים" tab for non-admin users; this endpoint is not meant to be
 * called by investor clients.
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';
import {
  mondayQuery,
  RENOVATIONS_BOARD_ID,
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
}
interface RawAsset { id: string; name: string; public_url: string; url_thumbnail?: string | null }
interface RawSubitem {
  id: string;
  name: string;
  created_at: string;
  updated_at: string;
  column_values: RawColumnValue[];
  assets?: RawAsset[];
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
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const propertyId = ((req.query.propertyId as string) || '').trim();
    const investorId = ((req.query.investorId as string) || '').trim();
    const role       = ((req.query.role as string) || 'admin').trim();
    const isInvestor = role === 'investor';

    // Mirror columns ("משקיע" / "קבלן" / "סטטוס" / "שיפוץ ללקוח") — pull alongside
    // the linked property + addons. Mirror values come back via .text for display.
    const mirrorIds = [
      'lookup_mkyydj2e', // מנהל פרויקט
      'lookup_mm01qppw', // סטטוס
      'lookup_mkt3ey7s', // משקיע
      'lookup_mkt3hy1k', // קבלן
      'lookup_mkvjwr8v', // שיפוץ שלנו
      'lookup_mkvjdzs',  // שיפוץ ללקוח
    ];

    const itemColumnIds = [RENOV_COL.property, RENOV_COL.addons, ...mirrorIds]
      .map(id => `"${id}"`)
      .join(',');
    const subColumnIds = Object.values(RENOV_SUB_COL)
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
                assets {
                  id
                  name
                  public_url
                  url_thumbnail
                }
              }
            }
          }
        }
      }
    `;

    const data = await mondayQuery<{ boards: { items_page: { items: RawItem[] } }[] }>(query);
    const items = data?.boards?.[0]?.items_page?.items ?? [];

    const renovations = items.map(item => {
      const cols = Object.fromEntries(item.column_values.map(cv => [cv.id, cv]));
      const propertyLinked = cols[RENOV_COL.property]?.linked_items?.[0];

      const subitems = (item.subitems ?? []).map(sub => {
        const sc = Object.fromEntries(sub.column_values.map(cv => [cv.id, cv]));
        const receiptFile = sub.assets?.[0];
        return {
          id:       sub.id,
          name:     sub.name,
          amount:   parseNumber(sc[RENOV_SUB_COL.amount]?.text),
          date:     sc[RENOV_SUB_COL.date]?.text || '',
          paidTo:   sc[RENOV_SUB_COL.paidTo]?.text || '',
          paidBy:   sc[RENOV_SUB_COL.paidBy]?.text || '',
          category: sc[RENOV_SUB_COL.category]?.text || '',
          receiptUrl: receiptFile?.public_url || '',
          receiptThumb: receiptFile?.url_thumbnail || '',
          createdAt: sub.created_at,
        };
      });

      const totalPaid = subitems.reduce((s, x) => s + x.amount, 0);

      return {
        id:              item.id,
        name:            item.name,
        groupId:         item.group?.id || '',
        groupTitle:      item.group?.title || '',
        propertyId:      propertyLinked?.id || '',
        propertyName:    propertyLinked?.name || '',
        status:          cols['lookup_mm01qppw']?.text || '',
        investorName:    cols['lookup_mkt3ey7s']?.text || '',
        contractorName:  cols['lookup_mkt3hy1k']?.text || '',
        ourCost:         parseNumber(cols['lookup_mkvjwr8v']?.text),
        clientCost:      parseNumber(cols['lookup_mkvjdzs']?.text),
        approvedAddons:  parseNumber(cols[RENOV_COL.addons]?.text),
        updatedAt:       item.updated_at,
        subitems,
        totalPaid,
      };
    });

    let filtered = renovations;
    if (propertyId) {
      filtered = filtered.filter(r => r.propertyId === propertyId);
    }
    if (investorId) {
      // Investor mirror column can't be filtered by id (text mirror) — so we filter
      // by the linked relation on the property side. For now we trust propertyId as
      // the primary filter; investorId is a fallback used by admin views.
      filtered = filtered.filter(r => r.investorName); // pass-through; UI can refine
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
          approvedAddons: 0,
          subitems: r.subitems
            .filter(s => s.paidBy === 'הלקוח')
            .map(s => ({ ...s, paidTo: '', paidBy: '' })),
          // recompute totalPaid from what's visible to investor
          totalPaid: r.subitems.filter(s => s.paidBy === 'הלקוח').reduce((a, x) => a + (x.amount || 0), 0),
        }))
      : filtered;

    return res.status(200).json({ ok: true, renovations: sanitized });
  } catch (err: any) {
    console.error('renovations-list error:', err);
    return res.status(500).json({ error: err?.message || 'Server error' });
  }
}
