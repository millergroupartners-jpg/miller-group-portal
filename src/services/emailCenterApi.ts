/**
 * Client-side API for the admin email center:
 *  - "יומן מיילים" board (5100220059) — audit log of every email the system sent
 *  - "מיילים מתוזמנים" board (5100220064) — admin-defined scheduled broadcasts
 *  - /api/admin/send-email — manual broadcast endpoint
 *
 * Both boards are read/written directly from the browser (same model as
 * loansApi/notificationPrefs) so no extra serverless functions are needed.
 */

import { mondayQuery } from './mondayApi';

const LOG_BOARD_ID   = 5100220059;
const SCHED_BOARD_ID = 5100220064;

const LOG_COL = {
  recipients: 'long_text_mm57hqg0',
  kind:       'color_mm57f0rb',     // אוטומטי / ידני
  category:   'text_mm57fqqp',
  body:       'long_text_mm57nrqb',
  sendStatus: 'color_mm576egg',     // נשלח / נכשל
  count:      'numeric_mm57e4gd',
  sentAt:     'date_mm57xpvq',      // מועד שליחה — allows historical (backfilled) entries
} as const;

const SCHED_COL = {
  body:       'long_text_mm578sm4',
  audience:   'color_mm579a95',     // כולם / רשומים / לא רשומים
  sendOn:     'date_mm57qxs5',
  recurrence: 'color_mm576qes',     // חד פעמי / שבועי / חודשי
  lastSent:   'date_mm57vnn2',
  active:     'boolean_mm57vk42',
} as const;

interface RawCV { id: string; text: string | null; value: string | null }
interface RawItem { id: string; name: string; created_at?: string; column_values: RawCV[] }

function colMap(item: RawItem): Record<string, RawCV> {
  return Object.fromEntries(item.column_values.map(c => [c.id, c]));
}

// ─── Email log ───────────────────────────────────────────────────────────────

export interface EmailLogEntry {
  id: string;
  subject: string;
  sentAt: string;      // ISO from item created_at
  recipients: string;  // comma-joined
  recipientCount: number;
  kind: string;        // אוטומטי / ידני
  category: string;
  bodyPreview: string;
  ok: boolean;
}

export async function fetchEmailLog(): Promise<EmailLogEntry[]> {
  const colIds = Object.values(LOG_COL).map(id => `"${id}"`).join(', ');
  const data = await mondayQuery<{ boards: { items_page: { items: RawItem[] } }[] }>(`query {
    boards(ids: [${LOG_BOARD_ID}]) {
      items_page(limit: 200) {
        items { id name created_at column_values(ids: [${colIds}]) { id text value } }
      }
    }
  }`);
  const items = data?.boards?.[0]?.items_page?.items ?? [];
  return items
    .map(it => {
      const cols = colMap(it);
      // Prefer the explicit "מועד שליחה" column (supports backfilled history);
      // fall back to the item's creation time. Normalize "YYYY-MM-DD HH:MM" → ISO.
      const explicit = (cols[LOG_COL.sentAt]?.text ?? '').trim().replace(' ', 'T');
      return {
        id: it.id,
        subject: it.name,
        sentAt: explicit || it.created_at || '',
        recipients: cols[LOG_COL.recipients]?.text ?? '',
        recipientCount: parseInt(cols[LOG_COL.count]?.text ?? '0', 10) || 0,
        kind: cols[LOG_COL.kind]?.text ?? '',
        category: cols[LOG_COL.category]?.text ?? '',
        bodyPreview: cols[LOG_COL.body]?.text ?? '',
        ok: (cols[LOG_COL.sendStatus]?.text ?? 'נשלח') !== 'נכשל',
      };
    })
    .sort((a, b) => (Date.parse(b.sentAt) || 0) - (Date.parse(a.sentAt) || 0));
}

// ─── Scheduled broadcasts ────────────────────────────────────────────────────

export interface ScheduledEmail {
  id: string;
  subject: string;
  body: string;
  audience: string;    // כולם / רשומים / לא רשומים
  sendOn: string;      // YYYY-MM-DD
  recurrence: string;  // חד פעמי / שבועי / חודשי
  lastSent: string;
  active: boolean;
}

export async function fetchScheduledEmails(): Promise<ScheduledEmail[]> {
  const colIds = Object.values(SCHED_COL).map(id => `"${id}"`).join(', ');
  const data = await mondayQuery<{ boards: { items_page: { items: RawItem[] } }[] }>(`query {
    boards(ids: [${SCHED_BOARD_ID}]) {
      items_page(limit: 100) {
        items { id name column_values(ids: [${colIds}]) { id text value } }
      }
    }
  }`);
  const items = data?.boards?.[0]?.items_page?.items ?? [];
  return items.map(it => {
    const cols = colMap(it);
    return {
      id: it.id,
      subject: it.name,
      body: cols[SCHED_COL.body]?.text ?? '',
      audience: cols[SCHED_COL.audience]?.text ?? 'כולם',
      sendOn: cols[SCHED_COL.sendOn]?.text ?? '',
      recurrence: cols[SCHED_COL.recurrence]?.text ?? 'חד פעמי',
      lastSent: cols[SCHED_COL.lastSent]?.text ?? '',
      active: /"checked":"?true"?/i.test(cols[SCHED_COL.active]?.value || ''),
    };
  });
}

export async function createScheduledEmail(opts: {
  subject: string;
  body: string;
  audience: 'כולם' | 'רשומים' | 'לא רשומים';
  sendOn: string; // YYYY-MM-DD
  recurrence: 'חד פעמי' | 'שבועי' | 'חודשי';
}): Promise<string> {
  const columnValues = {
    [SCHED_COL.body]:       opts.body,
    [SCHED_COL.audience]:   { label: opts.audience },
    [SCHED_COL.sendOn]:     { date: opts.sendOn },
    [SCHED_COL.recurrence]: { label: opts.recurrence },
    [SCHED_COL.active]:     { checked: 'true' },
  };
  const data = await mondayQuery<{ create_item: { id: string } }>(
    `mutation ($board: ID!, $name: String!, $cols: JSON!) {
      create_item(board_id: $board, item_name: $name, column_values: $cols) { id }
    }`,
    { board: String(SCHED_BOARD_ID), name: opts.subject.slice(0, 255), cols: JSON.stringify(columnValues) },
  );
  return data.create_item.id;
}

export async function setScheduledEmailActive(id: string, active: boolean): Promise<void> {
  const value = active ? '{\\"checked\\":\\"true\\"}' : '{\\"checked\\":\\"false\\"}';
  await mondayQuery(`mutation {
    change_column_value(
      board_id: ${SCHED_BOARD_ID}, item_id: ${id},
      column_id: "${SCHED_COL.active}", value: "${value}"
    ) { id }
  }`);
}

// ─── Manual broadcast ────────────────────────────────────────────────────────

export type Audience = 'all' | 'registered' | 'unregistered' | 'custom';

export async function sendAdminEmail(opts: {
  subject: string;
  message: string;
  audience: Audience;
  customEmails?: string[];
  ctaLabel?: string;
}): Promise<{ ok: true; sent: number; failed: number; failures?: string[] }> {
  const res = await fetch('/api/admin/send-email', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(opts),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`API ${res.status}: ${text.slice(0, 200)}`);
  }
  return res.json();
}
