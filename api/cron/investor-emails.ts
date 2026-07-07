/**
 * GET /api/cron/investor-emails
 *
 * Vercel Cron: runs daily at 07:15 UTC (10:15 Israel time).
 * Replaces the old investor-media photo digest (removed per business decision).
 *
 * Two state-free sections:
 *
 * A. NEW-DEAL EMAIL (every run) — MG deals whose "סטטוס השכרה" is
 *    "פתוח להשקעה" and whose "מייל חדר עסקאות נשלח" date column is empty get
 *    announced to EVERY investor with an email (registered or not), excluding
 *    blanket email opt-out and the deal-specific opt-out. After sending, the
 *    cron stamps today's date on the deal so it is never announced twice.
 *    Un-publishing and re-publishing a deal does NOT re-email (stamp remains);
 *    clear the date column on Monday to re-arm a deal.
 *
 * B. WEEKLY REGISTRATION REMINDER (Sundays only) — investors with an email
 *    but NO portal password get a "join the portal" nudge, excluding blanket
 *    opt-out and the reminder-specific opt-out. Unsubscribe is reply-based
 *    (no spare serverless function for a one-click link): admin checks the
 *    opt-out box on the investors board.
 *
 * Only client-facing deal numbers are ever emailed — never "שלנו" columns.
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { mondayQuery } from '../_lib/monday.js';
import { sendMail, wrapEmail, getAdminRecipients } from '../_lib/email.js';

const PROPERTIES_BOARD_ID = 1997938102;
const INVESTORS_BOARD_ID  = 1997938105;
const MG_DEALS_GROUP      = 'group_mkw9are4';

const OPEN_FOR_INVESTMENT_STATUS = 'פתוח להשקעה';

// Properties board columns (client-facing only)
const PROP_COL = {
  rentalStatus:   'color_mm1fv8p0',   // "סטטוס השכרה"
  purchaseClient: 'numeric_mkrzmmy',  // "רכישה ללקוח ($)"
  renovClient:    'numeric_mkrzk78b', // "שיפוץ ללקוח ($)"
  closingCosts:   'numeric_mks3rebm', // "עלויות סגירה ($)"
  arv:            'numeric_mkrzjtsd', // "ARV ($)"
  rent:           'numeric_mkrzdr4k', // "שכ״ד חזוי ($)"
  dealEmailSent:  'date_mm50nkzg',    // "מייל חדר עסקאות נשלח" — cron stamp
} as const;

// Investors board columns
const INV_COL = {
  email:            'lead_email',
  password:         'text_mm2mw06h',    // presence = registered
  blanketOptOut:    'boolean_mm2pee1j', // "Email Notifications" — checked = no emails at all
  dealOptOut:       'boolean_mm50326f', // "בטל מייל חדר עסקאות"
  reminderOptOut:   'boolean_mm507gjh', // "בטל תזכורת הרשמה"
} as const;

const GOLD = '#C9A84C';

function verifyAuth(req: VercelRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return true;
  return req.headers.authorization === `Bearer ${secret}`;
}

function esc(s: string): string {
  return (s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function isChecked(raw: string | null | undefined): boolean {
  return /"checked":"?true"?/i.test(raw || '');
}

function fmtUSD(text: string | null | undefined): string {
  const n = parseFloat(String(text ?? '').replace(/,/g, ''));
  if (!Number.isFinite(n) || n <= 0) return '—';
  return '$' + n.toLocaleString('en-US');
}

interface RawCV { id: string; text: string | null; value: string | null }
interface RawItem { id: string; name: string; column_values: RawCV[] }

function colMap(item: RawItem): Record<string, RawCV> {
  return Object.fromEntries(item.column_values.map(c => [c.id, c]));
}

interface Investor {
  id: string;
  name: string;
  email: string;
  registered: boolean;
  blanketOptOut: boolean;
  dealOptOut: boolean;
  reminderOptOut: boolean;
}

async function fetchInvestors(): Promise<Investor[]> {
  const q = `query {
    boards(ids: [${INVESTORS_BOARD_ID}]) {
      items_page(limit: 200) {
        items {
          id
          name
          column_values(ids: ["${INV_COL.email}", "${INV_COL.password}", "${INV_COL.blanketOptOut}", "${INV_COL.dealOptOut}", "${INV_COL.reminderOptOut}"]) {
            id text value
          }
        }
      }
    }
  }`;
  const data = await mondayQuery<{ boards: { items_page: { items: RawItem[] } }[] }>(q);
  const items = data?.boards?.[0]?.items_page?.items ?? [];
  return items.map(it => {
    const cols = colMap(it);
    return {
      id: it.id,
      name: it.name,
      email: (cols[INV_COL.email]?.text ?? '').trim(),
      registered: Boolean(cols[INV_COL.password]?.text?.trim()),
      blanketOptOut: isChecked(cols[INV_COL.blanketOptOut]?.value),
      dealOptOut: isChecked(cols[INV_COL.dealOptOut]?.value),
      reminderOptOut: isChecked(cols[INV_COL.reminderOptOut]?.value),
    };
  }).filter(inv => inv.email);
}

interface Deal {
  id: string;
  address: string;
  city: string;
  purchase: string;
  renov: string;
  arv: string;
  rent: string;
}

async function fetchUnannouncedDeals(): Promise<Deal[]> {
  const colIds = [PROP_COL.rentalStatus, PROP_COL.purchaseClient, PROP_COL.renovClient, PROP_COL.arv, PROP_COL.rent, PROP_COL.dealEmailSent]
    .map(id => `"${id}"`).join(', ');
  const q = `query {
    boards(ids: [${PROPERTIES_BOARD_ID}]) {
      items_page(
        limit: 100
        query_params: { rules: [{ column_id: "group", compare_value: ["${MG_DEALS_GROUP}"] }] }
      ) {
        items {
          id
          name
          column_values(ids: [${colIds}]) { id text value }
        }
      }
    }
  }`;
  const data = await mondayQuery<{ boards: { items_page: { items: RawItem[] } }[] }>(q);
  const items = data?.boards?.[0]?.items_page?.items ?? [];
  return items
    .filter(it => {
      const cols = colMap(it);
      const isOpen = (cols[PROP_COL.rentalStatus]?.text ?? '').trim() === OPEN_FOR_INVESTMENT_STATUS;
      const alreadySent = Boolean(cols[PROP_COL.dealEmailSent]?.text?.trim());
      return isOpen && !alreadySent;
    })
    .map(it => {
      const cols = colMap(it);
      const comma = it.name.indexOf(', ');
      return {
        id: it.id,
        address: comma !== -1 ? it.name.slice(0, comma) : it.name,
        city: comma !== -1 ? it.name.slice(comma + 2) : '',
        purchase: fmtUSD(cols[PROP_COL.purchaseClient]?.text),
        renov: fmtUSD(cols[PROP_COL.renovClient]?.text),
        arv: fmtUSD(cols[PROP_COL.arv]?.text),
        rent: fmtUSD(cols[PROP_COL.rent]?.text),
      };
    });
}

/** Stamp today's date on a deal's "מייל חדר עסקאות נשלח" column. */
async function stampDealAnnounced(dealId: string): Promise<void> {
  const today = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
  await mondayQuery(`mutation {
    change_simple_column_value(
      board_id: ${PROPERTIES_BOARD_ID},
      item_id: ${dealId},
      column_id: "${PROP_COL.dealEmailSent}",
      value: "${today}"
    ) { id }
  }`);
}

function dealCardHtml(d: Deal): string {
  const row = (label: string, value: string, color = '#111') =>
    `<td style="padding:6px 10px;text-align:center;">
       <div style="font-size:11px;color:#888;">${label}</div>
       <div style="font-weight:700;color:${color};font-size:14px;">${value}</div>
     </td>`;
  return `
    <div style="background:rgba(201,168,76,0.06);border:1px solid rgba(201,168,76,0.3);border-radius:12px;padding:14px;margin-bottom:10px;">
      <div style="font-weight:700;color:#111;font-size:15px;text-align:right;">📍 ${esc(d.address)}${d.city ? `, ${esc(d.city)}` : ''}</div>
      <table dir="rtl" style="width:100%;margin-top:8px;border-collapse:collapse;">
        <tr>
          ${row('מחיר קנייה', d.purchase)}
          ${row('שיפוץ', d.renov)}
          ${row('ARV', d.arv, GOLD)}
          ${row('שכירות חזויה', d.rent, '#2e7d32')}
        </tr>
      </table>
    </div>`;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (!verifyAuth(req)) return res.status(401).json({ error: 'Unauthorized' });

  try {
    const portalUrl = process.env.PORTAL_URL || 'https://miller-group-portal.vercel.app';
    const investors = await fetchInvestors();
    const result: Record<string, unknown> = { ok: true };

    // ── A. New-deal announcement ──────────────────────────────────────────
    const deals = await fetchUnannouncedDeals();
    if (deals.length > 0) {
      const recipients = investors.filter(inv => !inv.blanketOptOut && !inv.dealOptOut);
      let sent = 0;
      const failures: string[] = [];

      const bodyHtml = (name: string) => `
        <p>שלום ${esc(name)},</p>
        <p>${deals.length === 1 ? 'עסקה חדשה נפתחה להשקעה' : `${deals.length} עסקאות חדשות נפתחו להשקעה`} בחדר העסקאות של Miller Group:</p>
        <div style="margin:14px 0;">${deals.map(dealCardHtml).join('')}</div>
        <p style="font-size:12px;color:#888;">המספרים הם צפי ואינם מהווים התחייבות. לפרטים ולהבעת עניין — היכנסו לחדר העסקאות בפורטל.</p>
        <p style="font-size:11px;color:#aaa;">לא מעוניינים במיילים על עסקאות חדשות? אפשר לבטל במסך ההגדרות בפורטל, או להשיב למייל זה.</p>
      `;

      for (const inv of recipients) {
        try {
          await sendMail({
            to: inv.email,
            subject: deals.length === 1
              ? `עסקה חדשה נפתחה להשקעה — ${deals[0].address}`
              : `${deals.length} עסקאות חדשות נפתחו להשקעה`,
            html: wrapEmail({
              title: 'עסקה חדשה בחדר העסקאות',
              bodyHtml: bodyHtml(inv.name),
              cta: { label: 'לצפייה בחדר העסקאות', url: portalUrl },
            }),
          });
          sent++;
        } catch (err) {
          console.error('deal email failed for', inv.email, err);
          failures.push(inv.email);
        }
      }

      // Stamp each announced deal (only if at least one email went out)
      const stampFailures: string[] = [];
      if (sent > 0) {
        for (const d of deals) {
          try { await stampDealAnnounced(d.id); }
          catch (err) {
            console.error('stamp failed for deal', d.id, err);
            stampFailures.push(d.address);
          }
        }
      }

      // Admin summary
      await sendMail({
        to: getAdminRecipients(),
        subject: `מייל עסקאות נשלח: ${deals.length} עסקאות → ${sent} משקיעים`,
        html: wrapEmail({
          title: 'סיכום מייל חדר עסקאות',
          bodyHtml: `
            <p>העסקאות הבאות הוכרזו למשקיעים:</p>
            <div style="margin:14px 0;">${deals.map(dealCardHtml).join('')}</div>
            <p>נשלח בהצלחה ל-<b>${sent}</b> משקיעים (מתוך ${recipients.length} נמענים).</p>
            ${failures.length ? `<p style="color:#c62828;">כשלונות שליחה: ${failures.map(esc).join(', ')}</p>` : ''}
            ${stampFailures.length ? `<p style="color:#c62828;">⚠️ סימון "מייל נשלח" נכשל עבור: ${stampFailures.map(esc).join(', ')} — עלול להישלח שוב מחר, סמנו ידנית ב-Monday.</p>` : ''}
          `,
          cta: { label: 'פתח את הפורטל', url: portalUrl },
        }),
      }).catch(err => console.error('admin deal summary failed:', err));

      result.dealsAnnounced = deals.length;
      result.dealEmailsSent = sent;
    } else {
      result.dealsAnnounced = 0;
    }

    // ── B. Weekly registration reminder (Sundays) ─────────────────────────
    const isSunday = new Date().getUTCDay() === 0;
    if (isSunday || req.query.forceReminder === '1') {
      const unregistered = investors.filter(inv =>
        !inv.registered && !inv.blanketOptOut && !inv.reminderOptOut,
      );
      let reminded = 0;
      for (const inv of unregistered) {
        try {
          await sendMail({
            to: inv.email,
            subject: 'הפורטל האישי שלך ב-Miller Group מחכה לך',
            html: wrapEmail({
              title: 'הצטרף לפורטל המשקיעים',
              bodyHtml: `
                <p>שלום ${esc(inv.name)},</p>
                <p>הפורטל האישי שלך ב-Miller Group כבר מוכן — ועדיין לא נכנסת אליו.</p>
                <p>מה מחכה לך בפנים:</p>
                <ul style="text-align:right;padding-right:18px;line-height:2;">
                  <li>תמונות עדכניות מהשטח מכל נכס</li>
                  <li>מעקב שיפוצים, הלוואות ותשלומים</li>
                  <li>חדר עסקאות עם הזדמנויות השקעה חדשות</li>
                  <li>פנייה ישירה להנהלה מתוך הפורטל</li>
                </ul>
                <p>הכניסה הראשונה פשוטה: מזינים את כתובת המייל הזו, והמערכת תנחה אותך לקבוע סיסמה.</p>
                <p style="font-size:11px;color:#aaa;">לא מעוניין בתזכורת זו? השב למייל ונסיר אותך מרשימת התפוצה.</p>
              `,
              cta: { label: 'כניסה לפורטל', url: portalUrl },
            }),
          });
          reminded++;
        } catch (err) {
          console.error('registration reminder failed for', inv.email, err);
        }
      }

      if (reminded > 0) {
        await sendMail({
          to: getAdminRecipients(),
          subject: `תזכורת הרשמה שבועית נשלחה ל-${reminded} משקיעים`,
          html: wrapEmail({
            title: 'סיכום תזכורות הרשמה',
            bodyHtml: `
              <p>המשקיעים הבאים קיבלו תזכורת להירשם לפורטל:</p>
              ${unregistered.map(inv => `<div style="padding:6px 0;border-bottom:1px solid #eee;"><b>${esc(inv.name)}</b> · <span style="color:#888;">${esc(inv.email)}</span></div>`).join('')}
            `,
          }),
        }).catch(err => console.error('admin reminder summary failed:', err));
      }
      result.registrationRemindersSent = reminded;
    }

    return res.status(200).json(result);
  } catch (err: any) {
    console.error('investor-emails cron error:', err);
    return res.status(500).json({ error: err?.message || 'Server error' });
  }
}
