/**
 * GET /api/cron/daily-alerts
 *
 * Vercel Cron: runs daily at 07:00 UTC (10:00 Israel time).
 * Fetches all properties from Monday, detects 3 categories of alerts,
 * and emails ONE summary to the admin at GMAIL_USER.
 *
 * Sections:
 *   A) Overdue & stale    — closing date passed but status still
 *                            "על חוזה" / "בשלבי הלוואה וחתימות"
 *   B) Closings this week — any property with closing date in next 7 days
 *   C) MG recent activity — MG-owned properties updated in last 24 hours
 *
 * State-free design: all checks are time-based (now vs closingDate / updated_at),
 * so running the cron daily gives a rolling view without tracking "seen" state.
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { mondayQuery, INQUIRIES_BOARD_ID, INQ_COL } from '../_lib/monday.js';
import { sendMail, wrapEmail } from '../_lib/email.js';

const PROPERTIES_BOARD_ID = 1997938102;
const INVESTOR_DEALS_GROUP = 'group_mkrzmwnf';
const MG_DEALS_GROUP       = 'group_mkw9are4';
const RENTAL_STATUS_COL    = 'color_mm1fv8p0';
const CLOSING_DATE_COL     = 'date_mkrz2xsg';
const INVESTOR_REL_COL     = 'board_relation_mkrzrtny';

const STALE_STATUSES = ['על חוזה', 'בשלבי הלוואה וחתימות'];

interface RawItem {
  id: string;
  name: string;
  updated_at: string;
  group: { id: string; title: string };
  column_values: Array<{ id: string; text: string | null; value: string | null; linked_items?: { id: string; name: string }[] }>;
}

function verifyAuth(req: VercelRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return true; // no secret configured → allow (Vercel cron only)
  const auth = req.headers.authorization || '';
  return auth === `Bearer ${secret}`;
}

function esc(s: string): string {
  return (s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function daysBetween(iso: string, now: Date): number | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (isNaN(d.getTime())) return null;
  d.setHours(0, 0, 0, 0);
  const n = new Date(now); n.setHours(0, 0, 0, 0);
  return Math.round((d.getTime() - n.getTime()) / 86400000);
}

function fmtDateHe(iso: string): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '';
  return d.toLocaleDateString('he-IL', { day: '2-digit', month: 'short', year: 'numeric' });
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (!verifyAuth(req)) return res.status(401).json({ error: 'Unauthorized' });

  try {
    // Fetch all property items (investor deals + MG deals)
    const query = `query {
      boards(ids: [${PROPERTIES_BOARD_ID}]) {
        items_page(limit: 500) {
          items {
            id
            name
            updated_at
            group { id title }
            column_values(ids: ["${RENTAL_STATUS_COL}", "${CLOSING_DATE_COL}", "${INVESTOR_REL_COL}"]) {
              id
              text
              value
              ... on BoardRelationValue {
                linked_items { id name }
              }
            }
          }
        }
      }
    }`;

    const data = await mondayQuery<{ boards: { items_page: { items: RawItem[] } }[] }>(query);
    const items = data?.boards?.[0]?.items_page?.items ?? [];

    // Also fetch open inquiries (status != Resolved)
    const inqQuery = `query {
      boards(ids: [${INQUIRIES_BOARD_ID}]) {
        items_page(limit: 200) {
          items {
            id
            name
            updated_at
            column_values(ids: ["${INQ_COL.status}", "${INQ_COL.investorName}", "${INQ_COL.direction}"]) {
              id text
            }
          }
        }
      }
    }`;
    type RawInq = { id: string; name: string; updated_at: string; column_values: { id: string; text: string | null }[] };
    const inqData = await mondayQuery<{ boards: { items_page: { items: RawInq[] } }[] }>(inqQuery);
    const allInquiries = inqData?.boards?.[0]?.items_page?.items ?? [];
    const openInquiries = allInquiries
      .map(i => {
        const c = Object.fromEntries(i.column_values.map(cv => [cv.id, cv.text || '']));
        return {
          id: i.id,
          subject: i.name,
          status: c[INQ_COL.status] || '',
          investorName: c[INQ_COL.investorName] || '',
          direction: c[INQ_COL.direction] || '',
          updatedAt: i.updated_at,
        };
      })
      .filter(i => i.status !== 'Resolved' && i.status !== '');

    const now = new Date();
    const twentyFourHoursAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);

    const overdueStale: Array<{ name: string; status: string; date: string; days: number; investorName: string }> = [];
    const upcomingClosings: Array<{ name: string; status: string; date: string; days: number; investorName: string; isMg: boolean }> = [];
    const mgRecentActivity: Array<{ name: string; status: string; updatedAt: string }> = [];

    for (const item of items) {
      const cols = Object.fromEntries(item.column_values.map(c => [c.id, c]));
      const status    = cols[RENTAL_STATUS_COL]?.text || '';
      const closing   = cols[CLOSING_DATE_COL]?.text || '';
      const linkedInv = cols[INVESTOR_REL_COL]?.linked_items?.[0]?.name || '';
      const days = daysBetween(closing, now);
      const isMg = item.group?.id === MG_DEALS_GROUP;

      // A. Overdue + stale status
      if (days !== null && days < 0 && STALE_STATUSES.includes(status)) {
        overdueStale.push({ name: item.name, status, date: closing, days, investorName: linkedInv });
      }

      // B. Upcoming closings (next 7 days)
      if (days !== null && days >= 0 && days <= 7) {
        upcomingClosings.push({ name: item.name, status, date: closing, days, investorName: linkedInv, isMg });
      }

      // C. MG recent activity (only MG items updated in last 24h)
      if (isMg && item.updated_at) {
        const updatedAt = new Date(item.updated_at);
        if (updatedAt >= twentyFourHoursAgo) {
          mgRecentActivity.push({ name: item.name, status, updatedAt: item.updated_at });
        }
      }
    }

    // Sort upcoming closings by date ascending
    upcomingClosings.sort((a, b) => a.days - b.days);
    overdueStale.sort((a, b) => b.days - a.days); // most overdue first (most negative)
    // Sort open inquiries: "New" first, then by updatedAt descending
    openInquiries.sort((a, b) => {
      if (a.status !== b.status) return a.status === 'New' ? -1 : 1;
      return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
    });

    const totalAlerts = overdueStale.length + upcomingClosings.length + mgRecentActivity.length + openInquiries.length;

    if (totalAlerts === 0) {
      return res.status(200).json({ ok: true, sent: false, reason: 'No alerts today' });
    }

    // Build HTML email
    const GOLD = '#C9A84C';
    const sections: string[] = [];

    if (overdueStale.length > 0) {
      sections.push(`
        <div style="margin-bottom:20px;">
          <div style="font-weight:700;font-size:14px;color:#ff4d4d;margin-bottom:8px;border-right:3px solid #ff4d4d;padding-right:10px;">
            🚨 נכסים שעברו תאריך סגירה ועדיין בסטטוס לא מתאים (${overdueStale.length})
          </div>
          ${overdueStale.map(x => `
            <div style="background:rgba(255,77,77,0.06);border:1px solid rgba(255,77,77,0.25);padding:10px 12px;border-radius:8px;margin-bottom:6px;">
              <b>${esc(x.name)}</b> — סטטוס: <span style="color:#ff4d4d;">${esc(x.status)}</span>
              <br><span style="font-size:12px;color:#888;">עברו ${Math.abs(x.days)} ימים · תאריך: ${fmtDateHe(x.date)}${x.investorName ? ` · ${esc(x.investorName)}` : ''}</span>
            </div>`).join('')}
        </div>`);
    }

    if (upcomingClosings.length > 0) {
      sections.push(`
        <div style="margin-bottom:20px;">
          <div style="font-weight:700;font-size:14px;color:${GOLD};margin-bottom:8px;border-right:3px solid ${GOLD};padding-right:10px;">
            📅 סגירות השבוע הקרוב (${upcomingClosings.length})
          </div>
          ${upcomingClosings.map(x => `
            <div style="background:rgba(201,168,76,0.06);border:1px solid rgba(201,168,76,0.25);padding:10px 12px;border-radius:8px;margin-bottom:6px;">
              ${x.isMg ? '<span style="background:#C9A84C;color:#000;font-size:10px;font-weight:700;padding:2px 6px;border-radius:4px;margin-left:6px;">MG</span>' : ''}
              <b>${esc(x.name)}</b> — ${esc(x.status)}
              <br><span style="font-size:12px;color:#888;">${x.days === 0 ? 'היום' : `בעוד ${x.days} ימים`} · ${fmtDateHe(x.date)}${x.investorName ? ` · ${esc(x.investorName)}` : ''}</span>
            </div>`).join('')}
        </div>`);
    }

    if (mgRecentActivity.length > 0) {
      sections.push(`
        <div style="margin-bottom:20px;">
          <div style="font-weight:700;font-size:14px;color:#4CAF50;margin-bottom:8px;border-right:3px solid #4CAF50;padding-right:10px;">
            🔄 עדכונים אחרונים בנכסי Miller Group (${mgRecentActivity.length})
          </div>
          ${mgRecentActivity.map(x => `
            <div style="background:rgba(76,175,80,0.06);border:1px solid rgba(76,175,80,0.25);padding:10px 12px;border-radius:8px;margin-bottom:6px;">
              <b>${esc(x.name)}</b> — ${esc(x.status)}
              <br><span style="font-size:12px;color:#888;">עודכן: ${fmtDateHe(x.updatedAt)}</span>
            </div>`).join('')}
        </div>`);
    }

    if (openInquiries.length > 0) {
      sections.push(`
        <div style="margin-bottom:20px;">
          <div style="font-weight:700;font-size:14px;color:#64B5F6;margin-bottom:8px;border-right:3px solid #64B5F6;padding-right:10px;">
            💬 פניות פתוחות שטרם טופלו (${openInquiries.length})
          </div>
          ${openInquiries.map(x => {
            const isNew = x.status === 'New';
            const statusHe = isNew ? 'חדש' : 'בטיפול';
            const statusColor = isNew ? '#64B5F6' : '#ff9800';
            const dirHe = x.direction === 'Management→Investor' ? 'ניהול → משקיע' : 'משקיע → ניהול';
            return `
              <div style="background:rgba(100,181,246,0.06);border:1px solid rgba(100,181,246,0.25);padding:10px 12px;border-radius:8px;margin-bottom:6px;">
                <b>${esc(x.subject)}</b>
                <span style="display:inline-block;background:${statusColor}15;color:${statusColor};font-size:10px;font-weight:700;padding:2px 8px;border-radius:100px;margin-right:6px;">${statusHe}</span>
                <br><span style="font-size:12px;color:#888;">${esc(x.investorName)} · ${dirHe} · עודכן: ${fmtDateHe(x.updatedAt)}</span>
              </div>`;
          }).join('')}
        </div>`);
    }

    const adminEmail = (process.env.GMAIL_USER || '').trim();
    await sendMail({
      to: adminEmail,
      subject: `סיכום יומי — ${totalAlerts} התראות | Miller Group`,
      html: wrapEmail({
        title: 'סיכום יומי',
        bodyHtml: `
          <p>שלום,</p>
          <p>זהו סיכום אוטומטי של הדברים שדורשים את תשומת לבך היום:</p>
          ${sections.join('')}
        `,
        cta: { label: 'פתח את הפורטל', url: process.env.PORTAL_URL || 'https://miller-group-portal.vercel.app' },
      }),
    });

    return res.status(200).json({
      ok: true,
      sent: true,
      overdueStale: overdueStale.length,
      upcomingClosings: upcomingClosings.length,
      mgRecentActivity: mgRecentActivity.length,
    });
  } catch (err: any) {
    console.error('daily-alerts cron error:', err);
    return res.status(500).json({ error: err?.message || 'Server error' });
  }
}
