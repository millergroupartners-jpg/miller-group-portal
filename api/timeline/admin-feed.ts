/**
 * GET /api/timeline/admin-feed
 *
 * Admin-only global activity feed. Aggregates recent events across the entire
 * system so the admin dashboard can show "what happened lately" at a glance.
 *
 * Sources:
 *   1. Status changes on property items (Properties board activity_logs)
 *   2. New inquiries created
 *   3. Replies posted on inquiries
 *   4. Renovation payments (subitems) created
 *   5. Utilities moved to a new group (implies status change — using updated_at)
 *
 * Query params:
 *   limit (optional, default 30) — max events to return
 *
 * Response: { ok: true, events: AdminFeedEvent[] }   (desc by `at`)
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';
import {
  mondayQuery,
  PROPERTIES_BOARD_ID,
  PROP_COL,
  RENOVATIONS_BOARD_ID,
  RENOV_SUB_COL,
  INQUIRIES_BOARD_ID,
  INQ_COL,
} from '../_lib/monday.js';

interface AdminFeedEvent {
  id: string;
  kind: 'status-change' | 'inquiry-new' | 'inquiry-reply' | 'renovation-payment';
  at: string;
  title: string;
  subtitle?: string;
  icon: string;
  color: string;
  href?: string;
  propertyId?: string;
  inquiryId?: string;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const limit = Math.max(10, Math.min(100, parseInt(String(req.query.limit || '30'), 10)));
    const events: AdminFeedEvent[] = [];

    // 1. Status changes on Properties board — last 200 activity logs, filter to rentalStatus column
    try {
      const propLogsQuery = `query {
        boards(ids: [${PROPERTIES_BOARD_ID}]) {
          activity_logs(limit: 200) {
            id event data created_at entity
          }
          items_page(limit: 200) { items { id name } }
        }
      }`;
      type Log = { id: string; event: string; data: string; created_at: string; entity: string };
      const d = await mondayQuery<{ boards: { activity_logs: Log[]; items_page: { items: { id: string; name: string }[] } }[] }>(propLogsQuery);
      const logs = d.boards?.[0]?.activity_logs ?? [];
      const items = d.boards?.[0]?.items_page?.items ?? [];
      const itemMap = new Map(items.map(i => [i.id, i.name]));

      for (const log of logs) {
        try {
          const payload = JSON.parse(log.data || '{}');
          if (payload.column_id !== PROP_COL.rentalStatus) continue;
          const newLabel = payload.value?.label?.text || payload.value?.post_value?.label?.text || '';
          const oldLabel = payload.previous_value?.label?.text || payload.previous_value?.post_value?.label?.text || '';
          const itemId = String(payload.pulse_id || payload.entity_id || '');
          if (!newLabel || newLabel === oldLabel) continue;
          events.push({
            id: `status-${log.id}`,
            kind: 'status-change',
            at: log.created_at,
            title: `${itemMap.get(itemId) || 'נכס'} — סטטוס עבר ל-${newLabel}`,
            subtitle: oldLabel ? `מ-${oldLabel}` : undefined,
            icon: '🔄',
            color: '#C9A84C',
            propertyId: itemId,
          });
        } catch { /* skip malformed */ }
      }
    } catch (e) {
      console.error('admin-feed properties logs failed:', e);
    }

    // 2 + 3. Inquiries + their replies
    try {
      const inqQuery = `query {
        boards(ids: [${INQUIRIES_BOARD_ID}]) {
          items_page(limit: 50) {
            items {
              id name created_at
              column_values(ids: ["${INQ_COL.direction}", "${INQ_COL.investorName}", "${INQ_COL.property}"]) { id text }
              updates(limit: 5) { id text_body created_at creator { name } }
            }
          }
        }
      }`;
      const d = await mondayQuery<{ boards: { items_page: { items: any[] } }[] }>(inqQuery);
      const inqs = d.boards?.[0]?.items_page?.items ?? [];
      for (const inq of inqs) {
        const cols = Object.fromEntries(inq.column_values.map((c: any) => [c.id, c]));
        const dir = cols[INQ_COL.direction]?.text || '';
        const dirHe = dir === 'Management→Investor' ? 'ניהול → משקיע' : 'משקיע → ניהול';
        const investor = cols[INQ_COL.investorName]?.text || '';
        events.push({
          id: `inq-new-${inq.id}`,
          kind: 'inquiry-new',
          at: inq.created_at,
          title: `פנייה חדשה: ${inq.name}`,
          subtitle: [dirHe, investor].filter(Boolean).join(' · '),
          icon: '💬',
          color: '#64B5F6',
          inquiryId: inq.id,
        });
        for (const upd of inq.updates || []) {
          events.push({
            id: `inq-reply-${upd.id}`,
            kind: 'inquiry-reply',
            at: upd.created_at,
            title: `תגובה: ${inq.name}`,
            subtitle: (upd.text_body || '').slice(0, 80),
            icon: '↩️',
            color: '#64B5F6',
            inquiryId: inq.id,
          });
        }
      }
    } catch (e) {
      console.error('admin-feed inquiries failed:', e);
    }

    // 4. Renovation payments — fetch top-level items with subitems, take newest subitems
    try {
      const renovQuery = `query {
        boards(ids: [${RENOVATIONS_BOARD_ID}]) {
          items_page(limit: 80) {
            items {
              id name
              subitems {
                id name created_at
                column_values(ids: ["${RENOV_SUB_COL.amount}", "${RENOV_SUB_COL.date}", "${RENOV_SUB_COL.paidTo}", "${RENOV_SUB_COL.category}"]) { id text }
              }
            }
          }
        }
      }`;
      const d = await mondayQuery<{ boards: { items_page: { items: any[] } }[] }>(renovQuery);
      const items = d.boards?.[0]?.items_page?.items ?? [];
      for (const r of items) {
        for (const sub of r.subitems || []) {
          const sc = Object.fromEntries(sub.column_values.map((c: any) => [c.id, c]));
          const amount = sc[RENOV_SUB_COL.amount]?.text || '0';
          const paidTo = sc[RENOV_SUB_COL.paidTo]?.text || '';
          const category = sc[RENOV_SUB_COL.category]?.text || '';
          const date = sc[RENOV_SUB_COL.date]?.text || sub.created_at;
          events.push({
            id: `reno-${sub.id}`,
            kind: 'renovation-payment',
            at: date,
            title: `תשלום ${paidTo ? `ל${paidTo}` : ''} — $${amount}`,
            subtitle: [r.name, category].filter(Boolean).join(' · '),
            icon: '🔨',
            color: '#8d6e63',
          });
        }
      }
    } catch (e) {
      console.error('admin-feed renovations failed:', e);
    }

    // Sort desc + cap
    events.sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime());
    return res.status(200).json({ ok: true, events: events.slice(0, limit) });
  } catch (err: any) {
    console.error('admin-feed error:', err);
    return res.status(500).json({ error: err?.message || 'Server error' });
  }
}
