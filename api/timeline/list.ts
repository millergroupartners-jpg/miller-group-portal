/**
 * GET /api/timeline/list
 *
 * Aggregates a unified chronological timeline for one property from 6 sources:
 *   1. CompanyCam photos captured for the matching project
 *   2. Renovation subitems (payments) — investors see only their own transfers
 *      to us (paidBy=הלקוח) as a neutral "העברה לשיפוץ" (no recipient); admin
 *      sees every transfer with full detail
 *   3. Status changes on the property (from Monday activity_logs)
 *   4. Inquiries linked to the property (+ each inquiry update)
 *   5. Utility milestones (scheduled-in dates + activations)
 *   6. Renovation-loan updates (loans board activity_logs)
 *
 * Query params:
 *   propertyId (required)   — Monday item id of the property
 *   role       (optional)   — 'admin' | 'investor' (default: investor).
 *                             Controls the renovation-payment presentation: the
 *                             recipient (למי שולם) is internal and admin-only.
 *
 * Response:
 *   { ok: true, events: TimelineEvent[] }    (desc by `at`, max 150)
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

const CC_API = 'https://api.companycam.com/v2';

type EventKind =
  | 'photo'
  | 'renovation-payment'
  | 'loan-update'
  | 'status-change'
  | 'inquiry-new'
  | 'inquiry-reply'
  | 'utility-scheduled'
  | 'utility-activated';

interface TimelineEvent {
  id: string;
  kind: EventKind;
  at: string;
  title: string;
  subtitle?: string;
  icon: string;
  color: string;
  thumbnailUrl?: string;
  href?: string;
  meta?: Record<string, any>;
}

interface CCProject { id: string; name: string; address?: { street_address_1?: string } }
interface CCPhoto { id: string; photo_url?: string; uris?: { uri: string; type: string }[]; captured_at?: string }

function getCCToken(): string {
  const t = (process.env.COMPANYCAM_TOKEN || process.env.VITE_COMPANYCAM_TOKEN || '').trim();
  if (!t) throw new Error('CompanyCam token missing');
  return t;
}
async function ccFetch<T>(path: string): Promise<T> {
  const res = await fetch(`${CC_API}${path}`, { headers: { Authorization: `Bearer ${getCCToken()}` } });
  if (!res.ok) throw new Error(`CompanyCam HTTP ${res.status}`);
  return res.json();
}
function norm(s: string): string {
  return (s ?? '').toLowerCase().replace(/[.,]/g, '').replace(/\s+/g, ' ').trim();
}
function addressMatches(propAddr: string, project: CCProject): boolean {
  const a = norm(propAddr);
  if (!a) return false;
  const candidates = [project.name, project.address?.street_address_1].filter(Boolean).map(x => norm(x!));
  return candidates.some(c => c.includes(a) || a.includes(c));
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const propertyId = ((req.query.propertyId as string) || '').trim();
  const role = ((req.query.role as string) || 'investor').trim();
  const isAdmin = role === 'admin';

  if (!propertyId) {
    return res.status(400).json({ error: 'Missing propertyId' });
  }

  try {
    // 1. Fetch the property itself (name = address) + activity_logs for status changes
    //    and enrichment for CompanyCam matching.
    const propertyQuery = `query {
      items(ids: [${propertyId}]) {
        id
        name
        updated_at
        column_values(ids: ["${PROP_COL.rentalStatus}"]) { id text value }
      }
      boards(ids: [${PROPERTIES_BOARD_ID}]) {
        activity_logs(item_ids: [${propertyId}], limit: 100) {
          id
          event
          data
          created_at
        }
      }
    }`;

    type PropData = {
      items: { id: string; name: string; updated_at: string; column_values: { id: string; text: string | null }[] }[];
      boards: { activity_logs: { id: string; event: string; data: string; created_at: string }[] }[];
    };
    const propData = await mondayQuery<PropData>(propertyQuery);
    const propItem = propData?.items?.[0];
    if (!propItem) {
      return res.status(404).json({ error: 'Property not found' });
    }
    const propertyAddress = (propItem.name || '').split(',')[0].trim();
    const activityLogs = propData?.boards?.[0]?.activity_logs ?? [];

    const events: TimelineEvent[] = [];

    // 2. Status-change events from activity_logs
    for (const log of activityLogs) {
      try {
        const data = JSON.parse(log.data || '{}');
        if (data.column_id === PROP_COL.rentalStatus && data.value) {
          const newLabel = data.value?.label?.text || data.value?.post_value?.label?.text || '';
          const oldLabel = data.previous_value?.label?.text || data.previous_value?.post_value?.label?.text || '';
          if (newLabel && newLabel !== oldLabel) {
            events.push({
              id: `status-${log.id}`,
              kind: 'status-change',
              at: mondayDateToISO(log.created_at),
              title: `סטטוס הנכס שונה ל-${newLabel}`,
              subtitle: oldLabel ? `מ-${oldLabel}` : undefined,
              icon: '🔄',
              color: '#C9A84C',
            });
          }
        }
      } catch { /* skip malformed log */ }
    }

    // 3. Inquiries related to the property + their updates
    //    The inquiry.property column is a free-text field; we match by address substring.
    const inquiriesQuery = `query {
      boards(ids: [${INQUIRIES_BOARD_ID}]) {
        items_page(limit: 100) {
          items {
            id
            name
            created_at
            column_values(ids: ["${INQ_COL.property}", "${INQ_COL.direction}", "${INQ_COL.investorName}"]) {
              id text
            }
            updates {
              id
              text_body
              created_at
              creator { name }
            }
          }
        }
      }
    }`;
    type InqData = { boards: { items_page: { items: any[] } }[] };
    const inqData = await mondayQuery<InqData>(inquiriesQuery);
    const inquiries = inqData?.boards?.[0]?.items_page?.items ?? [];
    const propertyKey = norm(propertyAddress);

    for (const inq of inquiries) {
      const cols = Object.fromEntries(inq.column_values.map((c: any) => [c.id, c]));
      const inqProperty = norm(cols[INQ_COL.property]?.text || '');
      if (!inqProperty || !propertyKey) continue;
      if (!inqProperty.includes(propertyKey) && !propertyKey.includes(inqProperty)) continue;

      const direction = cols[INQ_COL.direction]?.text || '';
      const dirHe = direction === 'Management→Investor' ? 'ניהול → משקיע' : 'משקיע → ניהול';
      events.push({
        id: `inq-new-${inq.id}`,
        kind: 'inquiry-new',
        at: inq.created_at,
        title: `פנייה חדשה: ${inq.name}`,
        subtitle: `${dirHe} · ${cols[INQ_COL.investorName]?.text || ''}`,
        icon: '💬',
        color: '#64B5F6',
        href: `#inquiry-${inq.id}`,
        meta: { inquiryId: inq.id },
      });

      // Each update (Monday comment) → one reply event
      for (const upd of inq.updates || []) {
        events.push({
          id: `inq-reply-${upd.id}`,
          kind: 'inquiry-reply',
          at: upd.created_at,
          title: `תגובה בפנייה: ${inq.name}`,
          subtitle: (upd.text_body || '').slice(0, 120),
          icon: '↩️',
          color: '#64B5F6',
          href: `#inquiry-${inq.id}`,
          meta: { inquiryId: inq.id, author: upd.creator?.name || '' },
        });
      }
    }

    // 4. Renovation subitems (payments). Investors see ONLY their own transfers
    //    to us (paidBy=הלקוח, same rule as api/renovations/list.ts) — our
    //    internal payments to contractors are admin-only, as is the recipient
    //    (למי שולם).
    {
      const renovQuery = `query {
        boards(ids: [${RENOVATIONS_BOARD_ID}]) {
          items_page(limit: 200) {
            items {
              id name
              column_values(ids: ["${RENOV_COL.property}"]) {
                id
                ... on BoardRelationValue { linked_items { id name } }
              }
              subitems {
                id name created_at
                column_values(ids: ["${RENOV_SUB_COL.amount}", "${RENOV_SUB_COL.date}", "${RENOV_SUB_COL.paidTo}", "${RENOV_SUB_COL.paidBy}", "${RENOV_SUB_COL.category}"]) {
                  id text
                }
              }
            }
          }
        }
      }`;
      const renovData = await mondayQuery<{ boards: { items_page: { items: any[] } }[] }>(renovQuery);
      const renovItems = renovData?.boards?.[0]?.items_page?.items ?? [];
      for (const r of renovItems) {
        const propCV = r.column_values?.[0];
        const linked = propCV?.linked_items?.[0]?.id || '';
        if (linked !== propertyId) continue;
        for (const sub of r.subitems || []) {
          const sc = Object.fromEntries(sub.column_values.map((c: any) => [c.id, c]));
          const paidBy = sc[RENOV_SUB_COL.paidBy]?.text || '';
          if (!isAdmin && paidBy !== 'הלקוח') continue;
          const amountText = sc[RENOV_SUB_COL.amount]?.text || '0';
          const date = sc[RENOV_SUB_COL.date]?.text || sub.created_at;
          const paidTo = sc[RENOV_SUB_COL.paidTo]?.text || '';
          const category = sc[RENOV_SUB_COL.category]?.text || '';
          events.push({
            id: `reno-${sub.id}`,
            kind: 'renovation-payment',
            at: date,
            // paidTo labels already start with ל ("לנו"/"לקבלן") except "קבלן משנה"
            title: isAdmin
              ? `תשלום ${paidTo ? (paidTo.startsWith('ל') ? paidTo : `ל${paidTo}`) : ''} — $${amountText}`
              : `העברה לשיפוץ — $${amountText}`,
            subtitle: isAdmin ? [r.name, category].filter(Boolean).join(' · ') : category,
            icon: '🔨',
            color: '#8d6e63',
          });
        }
      }
    }

    // 5. Utility milestones
    const utilsQuery = `query {
      boards(ids: [${UTILITIES_BOARD_ID}]) {
        items_page(limit: 200) {
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
    const utilsData = await mondayQuery<{ boards: { items_page: { items: any[] } }[] }>(utilsQuery);
    const utils = utilsData?.boards?.[0]?.items_page?.items ?? [];
    for (const u of utils) {
      const cols = Object.fromEntries(u.column_values.map((c: any) => [c.id, c]));
      const linked = cols[UTIL_COL.property]?.linked_items?.[0]?.id || '';
      if (linked !== propertyId) continue;
      const service = cols[UTIL_COL.serviceCompany]?.text || 'Utility';
      const scheduledIn = cols[UTIL_COL.scheduledIn]?.text || '';
      if (scheduledIn) {
        events.push({
          id: `util-sched-${u.id}`,
          kind: 'utility-scheduled',
          at: scheduledIn,
          title: `${service} — מתוכנן להפעלה`,
          subtitle: u.name ? `חשבון ${u.name}` : undefined,
          icon: '📅',
          color: '#4eccc6',
        });
      }
      // Active group → mark as activated using updated_at as proxy
      if (u.group?.id === 'topics' && u.updated_at) {
        events.push({
          id: `util-active-${u.id}`,
          kind: 'utility-activated',
          at: u.updated_at,
          title: `${service} — הופעל`,
          subtitle: u.name ? `חשבון ${u.name}` : undefined,
          icon: '✅',
          color: '#00c875',
        });
      }
    }

    // 6. Renovation-loan updates for this property — loan opened, category
    //    draw-status changes, total-amount updates. Loan → property via board
    //    relation, address fallback for items not linked yet.
    try {
      const loansQuery = `query {
        boards(ids: [${LOANS_BOARD_ID}]) {
          activity_logs(limit: 200) { id event data created_at }
          items_page(limit: 200) {
            items {
              id name
              column_values(ids: ["${LOAN_COL.property}"]) {
                id
                ... on BoardRelationValue { linked_items { id } }
              }
            }
          }
        }
      }`;
      type LoanLog = { id: string; event: string; data: string; created_at: string };
      const d = await mondayQuery<{ boards: { activity_logs: LoanLog[]; items_page: { items: any[] } }[] }>(loansQuery);
      const loanItems = d.boards?.[0]?.items_page?.items ?? [];
      const matchingLoanIds = new Set(
        loanItems
          .filter((li: any) =>
            (li.column_values?.[0]?.linked_items ?? []).some((l: any) => String(l.id) === propertyId)
            || addressLooseMatch(li.name, propertyAddress),
          )
          .map((li: any) => String(li.id)),
      );

      for (const log of d.boards?.[0]?.activity_logs ?? []) {
        try {
          const payload = JSON.parse(log.data || '{}');
          if (!matchingLoanIds.has(String(payload.pulse_id || payload.entity_id || ''))) continue;
          const base = {
            kind: 'loan-update' as const,
            at: mondayDateToISO(log.created_at),
            icon: '🏦',
            color: '#B085F5',
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
        } catch { /* skip malformed log */ }
      }
    } catch (loanErr) {
      console.error('timeline loans fetch failed:', loanErr);
    }

    // 7. CompanyCam photos (for matching project). Failure is non-fatal.
    try {
      const projects = await ccFetch<CCProject[]>('/projects?per_page=200');
      const match = projects.find(p => addressMatches(propertyAddress, p));
      if (match) {
        const photos = await ccFetch<CCPhoto[]>(`/projects/${match.id}/photos?per_page=50`);
        for (const ph of photos) {
          if (!ph.captured_at) continue;
          const thumb = ph.photo_url
            || ph.uris?.find(u => u.type === 'thumbnail')?.uri
            || ph.uris?.find(u => u.type === 'web')?.uri
            || ph.uris?.[0]?.uri;
          events.push({
            id: `photo-${ph.id}`,
            kind: 'photo',
            at: ph.captured_at,
            title: 'תמונה חדשה',
            icon: '📸',
            color: '#C9A84C',
            thumbnailUrl: thumb,
          });
        }
      }
    } catch (ccErr) {
      console.error('timeline CC fetch failed:', ccErr);
    }

    // Sort desc by date, cap 150
    events.sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime());
    const capped = events.slice(0, 150);

    return res.status(200).json({ ok: true, events: capped });
  } catch (err: any) {
    console.error('timeline-list error:', err);
    return res.status(500).json({ error: err?.message || 'Server error' });
  }
}
