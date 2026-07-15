/**
 * GET /api/timeline/admin-feed
 *
 * Aggregates recent events across the system so a dashboard can show
 * "what happened lately" at a glance.
 *
 * Sources:
 *   1. Status changes on property items (Properties board activity_logs)
 *   2. New inquiries created
 *   3. Replies posted on inquiries
 *   4. Renovation payments (subitems) — investors see only their own transfers
 *      to us (paidBy=הלקוח) as a neutral "העברה לשיפוץ" (no recipient); admin
 *      sees every transfer with full detail
 *   5. Utility milestones
 *   6. Renovation-loan updates (loans board activity_logs)
 *
 * Query params:
 *   limit      (optional, default 30) — max events to return
 *   role       (optional, 'admin' | 'investor') — default 'admin'. Controls the
 *              renovation-payment presentation (see above).
 *   investorId (optional) — when provided, only events related to the given
 *              investor's properties are returned (status changes on their
 *              properties + their inquiries). Required with role='investor'.
 *
 * Response: { ok: true, events: AdminFeedEvent[] }   (desc by `at`)
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';
import {
  mondayQuery,
  mondayDateToISO,
  addressLooseMatch,
  PROPERTIES_BOARD_ID,
  PROP_COL,
  RENOVATIONS_BOARD_ID,
  RENOV_COL,
  RENOV_SUB_COL,
  LOANS_BOARD_ID,
  LOAN_COL,
  LOAN_STATUS_LABELS,
  INQUIRIES_BOARD_ID,
  INQ_COL,
  UTILITIES_BOARD_ID,
  UTIL_COL,
} from '../_lib/monday.js';

interface AdminFeedEvent {
  id: string;
  kind:
    | 'status-change'
    | 'inquiry-new'
    | 'inquiry-reply'
    | 'renovation-payment'
    | 'loan-update'
    | 'utility-activated'
    | 'utility-scheduled';
  at: string;
  title: string;
  subtitle?: string;
  icon: string;
  color: string;
  href?: string;
  propertyId?: string;
  propertyName?: string;   // so the UI can tag each event with its property
  inquiryId?: string;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const limit = Math.max(10, Math.min(100, parseInt(String(req.query.limit || '30'), 10)));
    const role = ((req.query.role as string) || 'admin').trim();
    const investorId = ((req.query.investorId as string) || '').trim();
    const isAdmin = role === 'admin';
    const events: AdminFeedEvent[] = [];

    // Property id → name, filled by section 1. Also serves the loans section's
    // address-fallback matching for loan items not yet linked on Monday.
    const propertyNameById = new Map<string, string>();

    // When filtering by investor, first resolve the set of property ids that
    // belong to them. Items on the Properties board have a "משקיע" board-relation.
    let investorPropertyIds: Set<string> | null = null;
    if (investorId) {
      try {
        const propQuery = `query {
          boards(ids: [${PROPERTIES_BOARD_ID}]) {
            items_page(limit: 500) {
              items {
                id
                column_values(ids: ["${PROP_COL.investor}"]) {
                  id
                  ... on BoardRelationValue { linked_items { id } }
                }
              }
            }
          }
        }`;
        type PropRow = { id: string; column_values: { id: string; linked_items?: { id: string }[] }[] };
        const d = await mondayQuery<{ boards: { items_page: { items: PropRow[] } }[] }>(propQuery);
        const rows = d.boards?.[0]?.items_page?.items ?? [];
        investorPropertyIds = new Set(
          rows.filter(r => r.column_values?.[0]?.linked_items?.some(li => li.id === investorId)).map(r => r.id)
        );
      } catch (e) {
        console.error('admin-feed property→investor map failed:', e);
      }
    }

    // 1. Status changes on Properties board. When filtered by investor we scope
    // activity_logs to only their property item ids (so we don't lose events to
    // the global 200-log tail). In admin/global mode we still pull the last 500.
    try {
      const scopedItemIds = investorPropertyIds ? Array.from(investorPropertyIds) : null;
      const itemIdsArg = scopedItemIds && scopedItemIds.length > 0
        ? `, item_ids: [${scopedItemIds.join(',')}]`
        : '';
      const logLimit = scopedItemIds ? 200 : 500;
      const propLogsQuery = `query {
        boards(ids: [${PROPERTIES_BOARD_ID}]) {
          activity_logs(limit: ${logLimit}${itemIdsArg}) {
            id event data created_at entity
          }
          items_page(limit: 500) { items { id name } }
        }
      }`;
      type Log = { id: string; event: string; data: string; created_at: string; entity: string };
      const d = await mondayQuery<{ boards: { activity_logs: Log[]; items_page: { items: { id: string; name: string }[] } }[] }>(propLogsQuery);
      const logs = d.boards?.[0]?.activity_logs ?? [];
      const items = d.boards?.[0]?.items_page?.items ?? [];
      const itemMap = new Map(items.map(i => [i.id, i.name]));
      for (const [id, name] of itemMap) propertyNameById.set(id, name);

      for (const log of logs) {
        try {
          const payload = JSON.parse(log.data || '{}');
          if (payload.column_id !== PROP_COL.rentalStatus) continue;
          const newLabel = payload.value?.label?.text || payload.value?.post_value?.label?.text || '';
          const oldLabel = payload.previous_value?.label?.text || payload.previous_value?.post_value?.label?.text || '';
          const itemId = String(payload.pulse_id || payload.entity_id || '');
          if (!newLabel || newLabel === oldLabel) continue;
          // Per-investor filter
          if (investorPropertyIds && !investorPropertyIds.has(itemId)) continue;
          const propName = itemMap.get(itemId) || '';
          events.push({
            id: `status-${log.id}`,
            kind: 'status-change',
            at: mondayDateToISO(log.created_at),
            title: `סטטוס עבר ל-${newLabel}`,
            subtitle: oldLabel ? `מ-${oldLabel}` : undefined,
            icon: '🔄',
            color: '#C9A84C',
            propertyId: itemId,
            propertyName: propName,
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
              column_values(ids: ["${INQ_COL.direction}", "${INQ_COL.investorName}", "${INQ_COL.investorId}", "${INQ_COL.property}"]) { id text }
              updates(limit: 5) { id text_body created_at creator { name } }
            }
          }
        }
      }`;
      const d = await mondayQuery<{ boards: { items_page: { items: any[] } }[] }>(inqQuery);
      const inqs = d.boards?.[0]?.items_page?.items ?? [];
      for (const inq of inqs) {
        const cols = Object.fromEntries(inq.column_values.map((c: any) => [c.id, c]));
        // Per-investor filter
        if (investorId && (cols[INQ_COL.investorId]?.text || '') !== investorId) continue;
        const dir = cols[INQ_COL.direction]?.text || '';
        const dirHe = dir === 'Management→Investor' ? 'ניהול → משקיע' : 'משקיע → ניהול';
        const investor = cols[INQ_COL.investorName]?.text || '';
        const propName = cols[INQ_COL.property]?.text || '';
        events.push({
          id: `inq-new-${inq.id}`,
          kind: 'inquiry-new',
          at: inq.created_at,
          title: `פנייה חדשה: ${inq.name}`,
          subtitle: [dirHe, investor].filter(Boolean).join(' · '),
          icon: '💬',
          color: '#64B5F6',
          inquiryId: inq.id,
          propertyName: propName,
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
            propertyName: propName,
          });
        }
      }
    } catch (e) {
      console.error('admin-feed inquiries failed:', e);
    }

    // 4. Renovation payments (transfers). Admin sees every transfer; investors
    //    see ONLY their own transfers to us (paidBy=הלקוח, same rule as
    //    api/renovations/list.ts) — our internal payments to contractors never
    //    reach them, nor does the recipient (למי שולם).
    try {
      const renovQuery = `query {
        boards(ids: [${RENOVATIONS_BOARD_ID}]) {
          items_page(limit: 80) {
            items {
              id name
              column_values(ids: ["${RENOV_COL.property}"]) {
                id
                ... on BoardRelationValue { linked_items { id name } }
              }
              subitems {
                id name created_at
                column_values(ids: ["${RENOV_SUB_COL.amount}", "${RENOV_SUB_COL.date}", "${RENOV_SUB_COL.paidTo}", "${RENOV_SUB_COL.paidBy}", "${RENOV_SUB_COL.category}"]) { id text }
              }
            }
          }
        }
      }`;
      const d = await mondayQuery<{ boards: { items_page: { items: any[] } }[] }>(renovQuery);
      const items = d.boards?.[0]?.items_page?.items ?? [];
      for (const r of items) {
        const linkedProp = r.column_values?.[0]?.linked_items?.[0];
        const propId = linkedProp?.id || '';
        // Per-investor filter — unlinked renovation projects stay admin-only
        // because we can't prove they belong to this investor.
        if (investorPropertyIds && (!propId || !investorPropertyIds.has(propId))) continue;
        for (const sub of r.subitems || []) {
          const sc = Object.fromEntries(sub.column_values.map((c: any) => [c.id, c]));
          const paidBy = sc[RENOV_SUB_COL.paidBy]?.text || '';
          if (!isAdmin && paidBy !== 'הלקוח') continue;
          const amount = sc[RENOV_SUB_COL.amount]?.text || '0';
          const paidTo = sc[RENOV_SUB_COL.paidTo]?.text || '';
          const category = sc[RENOV_SUB_COL.category]?.text || '';
          const date = sc[RENOV_SUB_COL.date]?.text || sub.created_at;
          events.push({
            id: `reno-${sub.id}`,
            kind: 'renovation-payment',
            at: date,
            // paidTo labels already start with ל ("לנו"/"לקבלן") except "קבלן משנה"
            title: isAdmin
              ? `תשלום ${paidTo ? (paidTo.startsWith('ל') ? paidTo : `ל${paidTo}`) : ''} — $${amount}`
              : `העברה לשיפוץ — $${amount}`,
            subtitle: category,
            icon: '🔨',
            color: '#8d6e63',
            propertyId: propId || undefined,
            propertyName: linkedProp?.name || r.name,
          });
        }
      }
    } catch (e) {
      console.error('admin-feed renovations failed:', e);
    }

    // 5. Utility milestones — scheduled-in dates and "activated" (group="topics")
    //    transitions proxied via updated_at. Scoped to investor's properties if given.
    try {
      const utilsQuery = `query {
        boards(ids: [${UTILITIES_BOARD_ID}]) {
          items_page(limit: 300) {
            items {
              id name updated_at
              group { id title }
              column_values(ids: ["${UTIL_COL.property}", "${UTIL_COL.serviceCompany}", "${UTIL_COL.scheduledIn}"]) {
                id text
                ... on BoardRelationValue { linked_items { id name } }
              }
            }
          }
        }
      }`;
      const ud = await mondayQuery<{ boards: { items_page: { items: any[] } }[] }>(utilsQuery);
      const utils = ud.boards?.[0]?.items_page?.items ?? [];
      for (const u of utils) {
        const cols = Object.fromEntries(u.column_values.map((c: any) => [c.id, c]));
        const linked = cols[UTIL_COL.property]?.linked_items?.[0];
        const propId = linked?.id || '';
        if (!propId) continue;
        // Per-investor filter
        if (investorPropertyIds && !investorPropertyIds.has(propId)) continue;

        const service = cols[UTIL_COL.serviceCompany]?.text || 'Utility';
        const scheduledIn = cols[UTIL_COL.scheduledIn]?.text || '';
        const propName = linked?.name || '';

        if (scheduledIn) {
          events.push({
            id: `util-sched-${u.id}`,
            kind: 'utility-scheduled',
            at: scheduledIn,
            title: `${service} — מתוכנן להפעלה`,
            subtitle: u.name ? `חשבון ${u.name}` : undefined,
            icon: '📅',
            color: '#4eccc6',
            propertyId: propId,
            propertyName: propName,
          });
        }
        if (u.group?.id === 'topics' && u.updated_at) {
          events.push({
            id: `util-active-${u.id}`,
            kind: 'utility-activated',
            at: u.updated_at,
            title: `${service} — הופעל`,
            subtitle: u.name ? `חשבון ${u.name}` : undefined,
            icon: '✅',
            color: '#00c875',
            propertyId: propId,
            propertyName: propName,
          });
        }
      }
    } catch (e) {
      console.error('admin-feed utilities failed:', e);
    }

    // 6. Renovation-loan updates — loan opened, per-category draw-status
    //    changes, and total-amount updates, all from the loans board
    //    activity_logs. A loan attaches to a property via its board relation,
    //    falling back to address matching for items not linked yet.
    try {
      const loansQuery = `query {
        boards(ids: [${LOANS_BOARD_ID}]) {
          activity_logs(limit: 200) { id event data created_at }
          items_page(limit: 200) {
            items {
              id name
              column_values(ids: ["${LOAN_COL.property}"]) {
                id
                ... on BoardRelationValue { linked_items { id name } }
              }
            }
          }
        }
      }`;
      type LoanLog = { id: string; event: string; data: string; created_at: string };
      const d = await mondayQuery<{ boards: { activity_logs: LoanLog[]; items_page: { items: any[] } }[] }>(loansQuery);
      const loanItems = d.boards?.[0]?.items_page?.items ?? [];

      // Loan item id → its property (relation first, address fallback).
      const loanById = new Map<string, { name: string; propId: string }>();
      for (const li of loanItems) {
        let propId = li.column_values?.[0]?.linked_items?.[0]?.id || '';
        if (!propId) {
          for (const [pid, pname] of propertyNameById) {
            if (addressLooseMatch(li.name, pname)) { propId = pid; break; }
          }
        }
        if (investorPropertyIds && (!propId || !investorPropertyIds.has(propId))) continue;
        loanById.set(String(li.id), { name: li.name, propId });
      }

      for (const log of d.boards?.[0]?.activity_logs ?? []) {
        try {
          const payload = JSON.parse(log.data || '{}');
          const loan = loanById.get(String(payload.pulse_id || payload.entity_id || ''));
          if (!loan) continue;
          const base = {
            kind: 'loan-update' as const,
            at: mondayDateToISO(log.created_at),
            icon: '🏦',
            color: '#B085F5',
            propertyId: loan.propId || undefined,
            propertyName: loan.name,
          };
          if (log.event === 'create_pulse') {
            events.push({ ...base, id: `loan-new-${log.id}`, title: 'נפתחה הלוואת שיפוץ' });
            continue;
          }
          if (payload.column_id === LOAN_COL.total) {
            const raw = payload.value?.value ?? payload.textual_value ?? '';
            const n = Number(String(raw).replace(/[^0-9.\-]/g, ''));
            events.push({
              ...base,
              id: `loan-total-${log.id}`,
              title: 'עודכן סכום הלוואת השיפוץ',
              subtitle: Number.isFinite(n) && n > 0 ? `$${n.toLocaleString('en-US')}` : undefined,
            });
            continue;
          }
          const category = LOAN_STATUS_LABELS[payload.column_id];
          if (category) {
            const newLabel = payload.value?.label?.text || payload.value?.post_value?.label?.text || '';
            const oldLabel = payload.previous_value?.label?.text || payload.previous_value?.post_value?.label?.text || '';
            if (!newLabel || newLabel === oldLabel) continue;
            // Board-setup noise: marking a category as not-applicable isn't news
            if (newLabel === 'לא רלוונטי') continue;
            events.push({
              ...base,
              id: `loan-status-${log.id}`,
              title: `הלוואת שיפוץ: ${category} — ${newLabel}`,
              subtitle: oldLabel ? `מ-${oldLabel}` : undefined,
            });
          }
        } catch { /* skip malformed */ }
      }
    } catch (e) {
      console.error('admin-feed loans failed:', e);
    }

    // Sort desc + cap
    events.sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime());
    return res.status(200).json({ ok: true, events: events.slice(0, limit) });
  } catch (err: any) {
    console.error('admin-feed error:', err);
    return res.status(500).json({ error: err?.message || 'Server error' });
  }
}
