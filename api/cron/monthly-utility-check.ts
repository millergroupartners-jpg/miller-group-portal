/**
 * GET /api/cron/monthly-utility-check
 *
 * Vercel Cron: runs on the 1st of each month at 07:30 UTC (10:30 Israel).
 *
 * For every property that is NOT in "מושכר" status, look at utilities linked to
 * it on the Monday utilities board. If any linked utility account was created
 * more than 30 days ago (i.e. could have an outstanding bill this month),
 * email a reminder to the investor to check / pay their utilities.
 *
 * Properties in the MG deals group (company's own) route the reminder to the
 * admin recipients (GMAIL_USER + ADMIN_EMAILS — which includes Lior).
 *
 * Investors can opt out via the "Utility Reminders Off" checkbox on the
 * investors board (column id boolean_mm2qp6qn). When checked = opted out.
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';
import {
  mondayQuery,
  PROPERTIES_BOARD_ID,
  PROP_COL,
  UTILITIES_BOARD_ID,
  UTIL_COL,
} from '../_lib/monday.js';
import { sendMail, wrapEmail, getAdminRecipients } from '../_lib/email.js';

const INVESTORS_BOARD_ID = 1997938105;
const INV_COL_EMAIL       = 'lead_email';
const INV_COL_PASSWORD    = 'text_mm2mw06h';
const INV_COL_NOTIF_OPTOUT = 'boolean_mm2pee1j';     // blanket email opt-out
const INV_COL_UTIL_OPTOUT  = 'boolean_mm2qp6qn';     // utility-reminder-specific opt-out
const MG_DEALS_GROUP = 'group_mkw9are4';

function verifyAuth(req: VercelRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return true;
  return req.headers.authorization === `Bearer ${secret}`;
}

function esc(s: string): string {
  return (s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function fmtDate(iso: string): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  return d.toLocaleDateString('he-IL', { day: '2-digit', month: 'short', year: 'numeric' });
}

function iconFor(service: string): string {
  const s = (service || '').toLowerCase();
  if (s.includes('water') || s.includes('sewer')) return '💧';
  if (s.includes('power') || s.includes('energy') || s.includes('electric')) return '⚡';
  if (s.includes('gas') || s.includes('nipsco') || s.includes('centerpoint')) return '🔥';
  if (s.includes('trash')) return '🗑️';
  return '🔌';
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (!verifyAuth(req)) return res.status(401).json({ error: 'Unauthorized' });

  try {
    const now = Date.now();
    const THIRTY_DAYS = 30 * 86400000;

    // 1. Fetch all properties (we'll filter out "מושכר" in code)
    const propsQuery = `query {
      boards(ids: [${PROPERTIES_BOARD_ID}]) {
        items_page(limit: 500) {
          items {
            id name
            group { id title }
            column_values(ids: ["${PROP_COL.rentalStatus}", "${PROP_COL.investor}"]) {
              id text
              ... on BoardRelationValue { linked_items { id name } }
            }
          }
        }
      }
    }`;
    type RawProp = {
      id: string; name: string;
      group: { id: string; title: string };
      column_values: { id: string; text: string | null; linked_items?: { id: string; name: string }[] }[];
    };
    const propData = await mondayQuery<{ boards: { items_page: { items: RawProp[] } }[] }>(propsQuery);
    const allProps = propData.boards?.[0]?.items_page?.items ?? [];

    // Exclude rented properties — they already have utilities being paid by tenant.
    const unrented = allProps.filter(p => {
      const cols = Object.fromEntries(p.column_values.map(c => [c.id, c]));
      const status = cols[PROP_COL.rentalStatus]?.text || '';
      return status !== 'מושכר';
    });

    // Build propertyId → { name, investorId, isMg }
    const propMeta = new Map<string, { name: string; investorId: string; investorName: string; isMg: boolean }>();
    for (const p of unrented) {
      const cols = Object.fromEntries(p.column_values.map(c => [c.id, c]));
      const linked = cols[PROP_COL.investor]?.linked_items?.[0];
      propMeta.set(p.id, {
        name: p.name,
        investorId: linked?.id || '',
        investorName: linked?.name || '',
        isMg: p.group?.id === MG_DEALS_GROUP,
      });
    }

    // 2. Fetch all utilities — we care about: linked property, service company,
    //    and when the item was CREATED on the utilities board (so we can assume
    //    a bill cycle has elapsed).
    const utilsQuery = `query {
      boards(ids: [${UTILITIES_BOARD_ID}]) {
        items_page(limit: 500) {
          items {
            id name created_at
            group { id title }
            column_values(ids: ["${UTIL_COL.property}", "${UTIL_COL.serviceCompany}", "${UTIL_COL.phone}", "${UTIL_COL.website}"]) {
              id text
              ... on BoardRelationValue { linked_items { id name } }
            }
          }
        }
      }
    }`;
    type RawUtil = {
      id: string; name: string; created_at: string;
      group: { id: string; title: string };
      column_values: { id: string; text: string | null; linked_items?: { id: string; name: string }[] }[];
    };
    const uData = await mondayQuery<{ boards: { items_page: { items: RawUtil[] } }[] }>(utilsQuery);
    const utils = uData.boards?.[0]?.items_page?.items ?? [];

    // Keep only utilities that:
    //   · are linked to an unrented property we care about
    //   · were created more than 30 days ago (at least one bill cycle likely)
    interface Reminder { propertyId: string; propertyName: string; investorId: string; investorName: string; isMg: boolean; accountNumber: string; serviceCompany: string; phone: string; website: string; scheduledSince: string; }
    const reminders: Reminder[] = [];
    for (const u of utils) {
      const cols = Object.fromEntries(u.column_values.map(c => [c.id, c]));
      const propId = cols[UTIL_COL.property]?.linked_items?.[0]?.id || '';
      if (!propId || !propMeta.has(propId)) continue;
      const createdAt = u.created_at ? new Date(u.created_at).getTime() : 0;
      if (!createdAt || now - createdAt < THIRTY_DAYS) continue;
      const meta = propMeta.get(propId)!;
      reminders.push({
        propertyId: propId,
        propertyName: meta.name,
        investorId: meta.investorId,
        investorName: meta.investorName,
        isMg: meta.isMg,
        accountNumber: u.name,
        serviceCompany: cols[UTIL_COL.serviceCompany]?.text || 'Utility',
        phone: cols[UTIL_COL.phone]?.text || '',
        website: cols[UTIL_COL.website]?.text || '',
        scheduledSince: u.created_at,
      });
    }

    if (reminders.length === 0) {
      return res.status(200).json({ ok: true, sent: false, reason: 'No utilities matched the window' });
    }

    // 3. Fetch opt-out flags + emails for each distinct investor
    const investorIds = Array.from(new Set(reminders.filter(r => !r.isMg).map(r => r.investorId).filter(Boolean)));
    type OptMap = Record<string, { email: string; optedOutAll: boolean; optedOutUtility: boolean; hasPassword: boolean }>;
    const investors: OptMap = {};
    if (investorIds.length > 0) {
      const invQuery = `query {
        items(ids: [${investorIds.join(',')}]) {
          id
          column_values(ids: ["${INV_COL_EMAIL}", "${INV_COL_PASSWORD}", "${INV_COL_NOTIF_OPTOUT}", "${INV_COL_UTIL_OPTOUT}"]) {
            id text value
          }
        }
      }`;
      type Inv = { id: string; column_values: { id: string; text: string | null; value: string | null }[] };
      try {
        const invData = await mondayQuery<{ items: Inv[] }>(invQuery);
        for (const inv of invData.items ?? []) {
          const map = Object.fromEntries(inv.column_values.map(cv => [cv.id, cv]));
          const optAll = /"checked":"?true"?/i.test(map[INV_COL_NOTIF_OPTOUT]?.value || '');
          const optUtil = /"checked":"?true"?/i.test(map[INV_COL_UTIL_OPTOUT]?.value || '');
          investors[inv.id] = {
            email: map[INV_COL_EMAIL]?.text?.trim() || '',
            optedOutAll: optAll,
            optedOutUtility: optUtil,
            hasPassword: Boolean(map[INV_COL_PASSWORD]?.text?.trim()),
          };
        }
      } catch (e) {
        console.error('utility-check investor fetch failed:', e);
      }
    }

    // 4. Group reminders by target email
    const grouped = new Map<string, { displayName: string; items: Reminder[] }>();
    const ADMIN_KEY = '__admin__';
    for (const r of reminders) {
      if (r.isMg || !r.investorId) {
        // MG deals → admin (includes Lior via ADMIN_EMAILS)
        if (!grouped.has(ADMIN_KEY)) grouped.set(ADMIN_KEY, { displayName: 'הנהלת Miller Group', items: [] });
        grouped.get(ADMIN_KEY)!.items.push(r);
        continue;
      }
      const inv = investors[r.investorId];
      if (!inv || !inv.email) continue;
      if (!inv.hasPassword) continue;              // never email unregistered investors
      if (inv.optedOutAll || inv.optedOutUtility) continue;
      if (!grouped.has(inv.email)) grouped.set(inv.email, { displayName: r.investorName || inv.email, items: [] });
      grouped.get(inv.email)!.items.push(r);
    }

    if (grouped.size === 0) {
      return res.status(200).json({ ok: true, sent: false, reason: 'All potential recipients opted out or unreachable' });
    }

    const GOLD = '#C9A84C';
    const portalUrl = process.env.PORTAL_URL || 'https://miller-group-portal.vercel.app';

    // 5. Send one digest per recipient
    let sent = 0;
    for (const [key, bundle] of grouped) {
      const toAdmin = key === ADMIN_KEY;
      const byProperty = new Map<string, Reminder[]>();
      for (const r of bundle.items) {
        if (!byProperty.has(r.propertyId)) byProperty.set(r.propertyId, []);
        byProperty.get(r.propertyId)!.push(r);
      }

      const propertyBlocks = Array.from(byProperty.entries()).map(([, list]) => `
        <div style="background:#faf7f2;border:1px solid #e5dfd4;border-radius:10px;padding:12px;margin-bottom:10px;">
          <div style="font-weight:700;color:#111;margin-bottom:6px;">📍 ${esc(list[0].propertyName)}</div>
          <div style="display:flex;flex-direction:column;gap:6px;">
            ${list.map(r => `
              <div style="display:flex;align-items:center;flex-direction:row-reverse;gap:8px;padding:6px 8px;background:#fff;border-radius:8px;border:1px solid #eee;">
                <span style="font-size:20px;">${iconFor(r.serviceCompany)}</span>
                <div style="flex:1;text-align:right;">
                  <div style="font-weight:600;color:#111;font-size:13px;">${esc(r.serviceCompany)}</div>
                  <div style="color:#888;font-size:11px;direction:ltr;text-align:right;">Account: ${esc(r.accountNumber)}</div>
                  ${r.phone ? `<div style="color:#888;font-size:11px;direction:ltr;text-align:right;">📞 ${esc(r.phone)}</div>` : ''}
                  ${r.website ? `<div style="color:${GOLD};font-size:11px;"><a href="${esc(r.website.startsWith('http') ? r.website : 'https://' + r.website)}" style="color:${GOLD};">אתר החברה ↗</a></div>` : ''}
                </div>
              </div>`).join('')}
          </div>
        </div>
      `).join('');

      const bodyHtml = toAdmin ? `
        <p>שלום,</p>
        <p>תזכורת חודשית לבדוק תשלום utilities בנכסי Miller Group שטרם הושכרו. לכל חשבון המופיע כאן יתכן שיש חשבונית פתוחה או ממתינה לתשלום.</p>
        ${propertyBlocks}
        <p style="color:#888;font-size:11px;">תזכורת זו נשלחת אוטומטית ב-1 בכל חודש עבור נכסים שאינם מושכרים ויש להם חשבונות utility במערכת.</p>
      ` : `
        <p>שלום ${esc(bundle.displayName)},</p>
        <p>זוהי תזכורת חודשית לבדוק את תשלומי ה-utilities בנכס/ים שלך שטרם הושכרו. מומלץ להיכנס לחשבונות המופיעים כאן ולוודא שהחשבוניות החודשיות שולמו.</p>
        ${propertyBlocks}
        <p style="margin-top:14px;padding:10px;background:#fff8e1;border-right:3px solid #ff9800;border-radius:8px;font-size:12px;color:#8a6a28;">
          💡 <b>טיפ:</b> אם ברצונך להפסיק לקבל תזכורות אלו, ניתן לכבות זאת בהגדרות הפורטל.
        </p>
      `;

      const recipients = toAdmin ? getAdminRecipients() : key;
      try {
        await sendMail({
          to: recipients,
          subject: `תזכורת חודשית · תשלומי utilities · ${bundle.items.length} חשבונות`,
          html: wrapEmail({
            title: 'תזכורת תשלומי utilities',
            bodyHtml,
            cta: { label: 'פתח את הפורטל', url: portalUrl },
          }),
        });
        sent++;
      } catch (e) {
        console.error('utility-check email failed for', key, e);
      }
    }

    return res.status(200).json({
      ok: true,
      sent: true,
      emailsSent: sent,
      remindersTotal: reminders.length,
      recipients: grouped.size,
    });
  } catch (err: any) {
    console.error('monthly-utility-check error:', err);
    return res.status(500).json({ error: err?.message || 'Server error' });
  }
}
