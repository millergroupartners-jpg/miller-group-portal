/**
 * Server-side Monday.com GraphQL client (for Vercel serverless functions).
 * Uses MONDAY_API_TOKEN or VITE_MONDAY_API_TOKEN from Vercel env vars.
 */

const MONDAY_API_URL = 'https://api.monday.com/v2';

export const INQUIRIES_BOARD_ID = Number((process.env.INQUIRIES_BOARD_ID || '5095120333').trim());

/** Column IDs on the Inquiries board (verified via API) */
export const INQ_COL = {
  investorId:    'text_mm2ne1dc',
  property:      'text_mm2nrcm4',
  investorEmail: 'text_mm2nwycm',
  status:        'color_mm2nbchk',  // status: New / In Progress / Resolved
  direction:     'dropdown_mm2najdk',
  investorName:  'text_mm2n4txd',
  files:         'file_mm2p3maz',   // Files column (image/doc attachments)
  message:       'text_mm2pv9e5',   // Message — full conversation log (plain text)
} as const;

export const INQ_STATUS = {
  NEW:        { label: 'New' },
  IN_PROGRESS:{ label: 'In Progress' },
  RESOLVED:   { label: 'Resolved' },
} as const;

export const INQ_DIRECTION = {
  INVESTOR_TO_ADMIN: 'Investor→Management',
  ADMIN_TO_INVESTOR: 'Management→Investor',
} as const;

/** Properties board (used by several features: alerts, media, timeline, renovations, utilities) */
export const PROPERTIES_BOARD_ID = 1997938102;
export const PROP_COL = {
  rentalStatus: 'color_mm1fv8p0',
  closingDate:  'date_mkrz2xsg',
  investor:     'board_relation_mkrzrtny',
  manager:      'board_relation_mm219qy1',
} as const;

/** Renovations boards — parent item per property renovation project, subitems are individual payments */
export const RENOVATIONS_BOARD_ID = 2064106439;
export const RENOV_SUBITEMS_BOARD_ID = 2064124983;

export const RENOV_COL = {
  property:  'board_relation_mkt3p6jp', // link to Properties board
  addons:    'numeric_mm18rej0',        // "Approved addons"
  subitems:  'subtasks_mkt3kts6',
} as const;

/** Column IDs on renovation SUBITEMS (each subitem = one payment) */
export const RENOV_SUB_COL = {
  amount:    'numeric_mkwga613', // תשלום ($)
  date:      'date0',             // תאריך תשלום
  paidTo:    'status',            // למי שולם — "לנו" / "לקבלן" / "קבלן משנה"
  paidBy:    'color_mkwgjqbv',    // מי שילם — "הלקוח" / "אנחנו"
  category:  'color_mkwga4m3',    // קטגוריה — עבודה / עבודה וחומרים / חומרים / אחר
  receipt:   'file_mm1p18rb',     // אסמכתא
} as const;

/** Utilities board — one item per utility ACCOUNT per property (water / power / gas / sewer) */
export const UTILITIES_BOARD_ID = 5087052578;

export const UTIL_COL = {
  property:       'board_relation_mkxthxq9', // property address
  investor:       'board_relation_mkxtcmrf',
  serviceCompany: 'color_mkxtqat0',          // status: 11 known providers
  scheduledIn:    'date_mkxxd3w9',
  phone:          'text_mkxt1ere',
  website:        'text_mkxtp1w9',
  notes:          'text_mkxtk9s',
} as const;

/** Utility groups — effectively the lifecycle status of each account */
export const UTIL_GROUP = {
  toStart:        'group_mkxtrste',  // "utilities to start"
  scheduled:      'group_mkxxg99z',  // "utilities scheduled to start"
  active:         'topics',           // "utilities that are on"
  pendingPayment: 'group_mm0prwgj',  // "Utilities Pending Payments"
} as const;

export function utilGroupToStatus(groupId: string): { status: 'to-start' | 'scheduled' | 'active' | 'pending-payment' | 'unknown'; he: string } {
  switch (groupId) {
    case UTIL_GROUP.toStart:        return { status: 'to-start', he: 'להקמה' };
    case UTIL_GROUP.scheduled:      return { status: 'scheduled', he: 'נקבע להפעלה' };
    case UTIL_GROUP.active:         return { status: 'active', he: 'פעיל' };
    case UTIL_GROUP.pendingPayment: return { status: 'pending-payment', he: 'ממתין לתשלום' };
    default:                        return { status: 'unknown', he: '' };
  }
}

function getToken(): string {
  const token = (process.env.MONDAY_API_TOKEN || process.env.VITE_MONDAY_API_TOKEN || '').trim();
  if (!token) throw new Error('Monday API token is not configured on the server');
  return token;
}

export async function mondayQuery<T>(query: string, variables?: object): Promise<T> {
  const res = await fetch(MONDAY_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: getToken(),
      'API-Version': '2024-01',
    },
    body: JSON.stringify({ query, variables }),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`Monday API HTTP ${res.status}: ${body}`);
  }
  const json = await res.json();
  if (json.errors?.length) throw new Error(json.errors[0].message);
  return json.data as T;
}

/** Escape user-provided strings for GraphQL literal insertion */
export function esc(s: string): string {
  return (s ?? '').replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\n/g, '\\n');
}

/** JSON-safe string for column_values: escape for double-encoded GraphQL JSON */
export function jsonEsc(s: string): string {
  return JSON.stringify(s ?? '').slice(1, -1); // strip outer quotes from JSON.stringify
}

/**
 * Append a new message entry to the inquiry's "Message" text column.
 * Fetches current value, concatenates with a formatted separator, writes back.
 * Truncates oldest entries if total length exceeds ~1900 chars (Monday text column limit).
 */
export async function appendToMessageColumn(opts: {
  inquiryId: string;
  author: string;
  text: string;
}): Promise<void> {
  const { inquiryId, author, text } = opts;

  // 1. Read current value
  const readQuery = `query {
    items(ids: [${inquiryId}]) {
      column_values(ids: ["${INQ_COL.message}"]) {
        id
        text
      }
    }
  }`;
  const data = await mondayQuery<{ items: { column_values: { id: string; text: string | null }[] }[] }>(readQuery);
  const current = data?.items?.[0]?.column_values?.[0]?.text ?? '';

  // 2. Build new entry
  const now = new Date();
  const time = now.toLocaleDateString('he-IL', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
  const separator = current ? '\n\n' : '';
  const entry = `${author} · ${time}:\n${text}`;
  let combined = `${current}${separator}${entry}`;

  // 3. Cap at ~1900 chars — keep the newest content, drop oldest entries
  const MAX = 1900;
  if (combined.length > MAX) {
    const excess = combined.length - MAX + 50; // small buffer for the header
    // Find the next "\n\n" after the excess point so we truncate on a whole entry boundary
    const breakAt = combined.indexOf('\n\n', excess);
    combined = (breakAt > 0 ? combined.slice(breakAt + 2) : combined.slice(excess));
    combined = `[… הודעות ישנות נחתכו …]\n\n${combined}`;
  }

  // 4. Write back via change_simple_column_value (simple text)
  const writeMutation = `mutation {
    change_simple_column_value(
      item_id: ${inquiryId},
      board_id: ${INQUIRIES_BOARD_ID},
      column_id: "${INQ_COL.message}",
      value: ${JSON.stringify(combined)}
    ) { id }
  }`;
  await mondayQuery(writeMutation);
}
