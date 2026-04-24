/**
 * GET /api/utilities/list
 *
 * Returns utility accounts from the "utilities" Monday board (5087052578).
 * Each item represents one account (water/power/gas/sewer) per property.
 *
 * Query params:
 *   propertyId (optional) — only utilities linked to this property item id
 *   investorId (optional) — only utilities linked to this investor item id
 *
 * Response:
 *   {
 *     ok: true,
 *     utilities: [{
 *       id, accountNumber,
 *       serviceCompany, serviceCompanyHex,
 *       scheduledIn, phone, website, notes,
 *       status: 'to-start' | 'scheduled' | 'active' | 'pending-payment' | 'unknown',
 *       statusHe,
 *       propertyId, propertyName,
 *       investorId, investorName,
 *     }]
 *   }
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';
import {
  mondayQuery,
  UTILITIES_BOARD_ID,
  UTIL_COL,
  utilGroupToStatus,
} from '../_lib/monday.js';

interface RawLinked { id: string; name: string }
interface RawColumnValue {
  id: string;
  text: string | null;
  value: string | null;
  linked_items?: RawLinked[];
}
interface RawItem {
  id: string;
  name: string;
  updated_at: string;
  group: { id: string; title: string };
  column_values: RawColumnValue[];
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const propertyId = ((req.query.propertyId as string) || '').trim();
    const investorId = ((req.query.investorId as string) || '').trim();

    const columnIds = Object.values(UTIL_COL).map(id => `"${id}"`).join(',');

    const query = `
      query {
        boards(ids: [${UTILITIES_BOARD_ID}]) {
          items_page(limit: 200) {
            items {
              id
              name
              updated_at
              group { id title }
              column_values(ids: [${columnIds}]) {
                id
                text
                value
                ... on BoardRelationValue { linked_items { id name } }
              }
            }
          }
        }
      }
    `;

    const data = await mondayQuery<{ boards: { items_page: { items: RawItem[] } }[] }>(query);
    const items = data?.boards?.[0]?.items_page?.items ?? [];

    const utilities = items.map(item => {
      const cols = Object.fromEntries(item.column_values.map(cv => [cv.id, cv]));
      const linkedProperty = cols[UTIL_COL.property]?.linked_items?.[0];
      const linkedInvestor = cols[UTIL_COL.investor]?.linked_items?.[0];
      const serviceRaw = cols[UTIL_COL.serviceCompany];
      // Best-effort color extraction from status value JSON
      let serviceHex = '';
      try {
        const parsed = serviceRaw?.value ? JSON.parse(serviceRaw.value) : null;
        serviceHex = parsed?.color || '';
      } catch { /* ignore */ }
      const groupStatus = utilGroupToStatus(item.group?.id || '');

      return {
        id:                item.id,
        accountNumber:     item.name,
        serviceCompany:    serviceRaw?.text || '',
        serviceCompanyHex: serviceHex,
        scheduledIn:       cols[UTIL_COL.scheduledIn]?.text || '',
        phone:             cols[UTIL_COL.phone]?.text || '',
        website:           cols[UTIL_COL.website]?.text || '',
        notes:             cols[UTIL_COL.notes]?.text || '',
        status:            groupStatus.status,
        statusHe:          groupStatus.he,
        groupTitle:        item.group?.title || '',
        propertyId:        linkedProperty?.id || '',
        propertyName:      linkedProperty?.name || '',
        investorId:        linkedInvestor?.id || '',
        investorName:      linkedInvestor?.name || '',
        updatedAt:         item.updated_at,
      };
    });

    let filtered = utilities;
    if (propertyId) filtered = filtered.filter(u => u.propertyId === propertyId);
    if (investorId) filtered = filtered.filter(u => u.investorId === investorId);

    // Sort: active first, then scheduled, then to-start, then pending; within each
    // group by scheduledIn ascending (upcoming first).
    const statusOrder: Record<string, number> = {
      'active': 0,
      'scheduled': 1,
      'to-start': 2,
      'pending-payment': 3,
      'unknown': 4,
    };
    filtered.sort((a, b) => {
      const so = (statusOrder[a.status] ?? 99) - (statusOrder[b.status] ?? 99);
      if (so !== 0) return so;
      const ad = a.scheduledIn ? new Date(a.scheduledIn).getTime() : Infinity;
      const bd = b.scheduledIn ? new Date(b.scheduledIn).getTime() : Infinity;
      return ad - bd;
    });

    return res.status(200).json({ ok: true, utilities: filtered });
  } catch (err: any) {
    console.error('utilities-list error:', err);
    return res.status(500).json({ error: err?.message || 'Server error' });
  }
}
