/**
 * Monday.com GraphQL API service
 * Board: עסקאות נדל״ן (1997938102) — investor property deals
 * Investors board: משקיעים (1997938105)
 */

const MONDAY_API_URL = 'https://api.monday.com/v2';

export const PROPERTIES_BOARD_ID = 1997938102;
export const INVESTORS_BOARD_ID = 1997938105;
/** Group: "עסקאות של משקיעים" */
const INVESTOR_DEALS_GROUP = 'group_mkrzmwnf';

// Column IDs on the properties board
const COL = {
  investor:       'board_relation_mkrzrtny', // "משקיע" — board_relation, use linked_items fragment
  rentalStatus:   'color_mm1fv8p0',          // "סטטוס השכרה"
  purchaseClient: 'numeric_mkrzmmy',          // "רכישה ללקוח ($)"
  renovClient:    'numeric_mkrzk78b',         // "שיפוץ ללקוח ($)"
  closingCosts:   'numeric_mks3rebm',         // "עלויות סגירה ($)"
  // allIn is computed: purchaseClient + renovClient + closingCosts (formula col returns null)
  arv:            'numeric_mkrzjtsd',         // "ARV ($)"
  rent:           'numeric_mkrzdr4k',         // "שכ״ד חזוי ($)"
  docs:           'file_mkrzdfq3',            // "מסמכים" — Google Drive link
} as const;

// Column IDs on the investors board
const INV_COL = {
  email:    'lead_email',
  phone:    'lead_phone',
  capital:  'numeric_mks1psz6',
  since:    'date_mkrza6wh',
  password: 'text_mm2mw06h',  // "סיסמה לפורטל"
} as const;

// ─── Internal types ────────────────────────────────────────────────────────

interface RawColumnValue {
  id: string;
  text: string | null;
  value: string | null;
  // BoardRelationValue inline fragment
  linked_items?: { id: string; name: string }[];
}

interface RawItem {
  id: string;
  name: string;
  column_values: RawColumnValue[];
}

/** Normalised column map: colId → raw column value */
type ColMap = Record<string, RawColumnValue>;

// ─── Exported types ────────────────────────────────────────────────────────

export interface MondayProperty {
  mondayId: string;
  address: string;
  city: string;
  status: string;
  statusType: 'gold' | 'green' | 'blue';
  purchasePrice: string;
  renovCost: string;
  arv: string;
  rentMonthly: string;
  rentYield: string;
  allIn: number;          // raw number for calculations
  arvRaw: number;
  progress: number;
  investorMondayId: string;
  investorName: string;
  docsUrl: string;          // Google Drive folder link from "מסמכים" column
}

export interface MondayInvestor {
  mondayId: string;
  fullName: string;
  initials: string;
  email: string;
  phone: string;
  investorSince: string;
  password: string;  // from "סיסמה לפורטל" column
  properties: MondayProperty[];
  totalInvested: string;
  portfolioValue: string;
  avgYield: string;
  totalAllIn: number; // raw sum for sorting
}

// ─── GraphQL client ────────────────────────────────────────────────────────

async function mondayQuery<T>(query: string, variables?: object): Promise<T> {
  const token = import.meta.env.VITE_MONDAY_API_TOKEN as string | undefined;
  if (!token) throw new Error('VITE_MONDAY_API_TOKEN is not set in .env');

  const res = await fetch(MONDAY_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: token,
      'API-Version': '2024-01',
    },
    body: JSON.stringify({ query, variables }),
  });

  if (!res.ok) throw new Error(`Monday API HTTP ${res.status}`);
  const json = await res.json();
  if (json.errors?.length) throw new Error(json.errors[0].message);
  return json.data as T;
}

// ─── Helpers ───────────────────────────────────────────────────────────────

function toColMap(columnValues: RawColumnValue[]): ColMap {
  return Object.fromEntries(columnValues.map(cv => [cv.id, cv]));
}

function num(col: RawColumnValue | undefined): number {
  if (!col) return 0;
  const raw = col.text ?? col.value ?? '';
  const n = parseFloat(String(raw).replace(/,/g, ''));
  return isNaN(n) ? 0 : n;
}

function parseAddress(fullName: string): { address: string; city: string } {
  const comma = fullName.indexOf(', ');
  if (comma !== -1) {
    return { address: fullName.slice(0, comma), city: fullName.slice(comma + 2) };
  }
  return { address: fullName, city: '' };
}

function mapRentalStatus(text: string): { status: string; statusType: 'gold' | 'green' | 'blue' } {
  switch (text) {
    case 'מושכר':
    case 'מעבר לניהול':
      return { status: 'מושכר', statusType: 'green' };
    case 'בשיפוץ':
      return { status: 'בשיפוץ', statusType: 'gold' };
    case 'על חוזה':
    case 'בשלבי הלוואה וחתימות':
    case 'מרקט':
    case 'new construction':
    default:
      return { status: text || 'בבדיקה', statusType: 'blue' };
  }
}

function progressFromStatus(rawStatus: string): number {
  switch (rawStatus) {
    case 'על חוזה':                return 15;
    case 'בשלבי הלוואה וחתימות':   return 30;
    case 'בשיפוץ':                 return 50;
    case 'מעבר לניהול':            return 70;
    case 'מרקט':                   return 85;
    case 'מושכר':                  return 100;
    default:                       return 0;
  }
}

function fmtCurrency(n: number): string {
  if (!n) return '—';
  return '$' + n.toLocaleString('en-US');
}

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) return parts[0][0] + parts[parts.length - 1][0];
  return (name[0] ?? '?').toUpperCase();
}

function formatDate(iso: string): string {
  if (!iso) return '';
  try {
    const d = new Date(iso);
    const months = ['ינואר','פברואר','מרץ','אפריל','מאי','יוני','יולי','אוגוסט','ספטמבר','אוקטובר','נובמבר','דצמבר'];
    return `${months[d.getMonth()]} ${d.getFullYear()}`;
  } catch { return iso; }
}

// ─── Data transformation ───────────────────────────────────────────────────

function transformRawProperty(item: RawItem): MondayProperty {
  const cols = toColMap(item.column_values);
  const { address, city } = parseAddress(item.name);
  const rawStatus = cols[COL.rentalStatus]?.text ?? '';
  const { status, statusType } = mapRentalStatus(rawStatus);

  // Board relation uses linked_items inline fragment (text/value are null from API)
  const investorLinked = cols[COL.investor]?.linked_items?.[0];
  const investorMondayId = investorLinked?.id ?? '';
  const investorName = investorLinked?.name ?? '';

  // allIn is computed manually (formula column returns null from the API)
  const purchaseRaw  = num(cols[COL.purchaseClient]);
  const renovRaw     = num(cols[COL.renovClient]);
  const closingRaw   = num(cols[COL.closingCosts]);
  const allIn        = purchaseRaw + renovRaw + closingRaw;
  const arvRaw       = num(cols[COL.arv]);
  const rentRaw = num(cols[COL.rent]);
  const yieldPct = (allIn > 0 && rentRaw > 0)
    ? ((rentRaw * 12) / allIn * 100).toFixed(1) + '%'
    : '—';

  // Extract Google Drive URL from file column (stored as JSON with files array)
  let docsUrl = '';
  try {
    const docsVal = JSON.parse(cols[COL.docs]?.value ?? '{}');
    docsUrl = docsVal?.files?.[0]?.linkToFile ?? cols[COL.docs]?.text ?? '';
  } catch { docsUrl = cols[COL.docs]?.text ?? ''; }

  return {
    mondayId: item.id,
    address,
    city,
    status,
    statusType,
    purchasePrice: fmtCurrency(purchaseRaw),
    renovCost: fmtCurrency(renovRaw),
    arv: fmtCurrency(arvRaw),
    rentMonthly: rentRaw > 0 ? '$' + rentRaw.toLocaleString('en-US') + '/mo' : '—',
    rentYield: yieldPct,
    allIn,
    arvRaw,
    progress: progressFromStatus(rawStatus),
    investorMondayId,
    investorName,
    docsUrl,
  };
}

function buildInvestorFromProperties(
  mondayId: string,
  rawName: string,
  properties: MondayProperty[],
  extraInfo?: { name?: string; email: string; phone: string; investorSince: string; password: string },
): MondayInvestor {
  const totalAllIn = properties.reduce((s, p) => s + p.allIn, 0);
  const totalArv   = properties.reduce((s, p) => s + p.arvRaw, 0);
  const avgYield   = (() => {
    const yields = properties.filter(p => p.rentYield !== '—').map(p => parseFloat(p.rentYield));
    if (!yields.length) return '—';
    return (yields.reduce((a, b) => a + b, 0) / yields.length).toFixed(1) + '%';
  })();

  return {
    mondayId,
    fullName: rawName,
    initials: getInitials(rawName),
    email: extraInfo?.email ?? '',
    phone: extraInfo?.phone ?? '',
    investorSince: extraInfo?.investorSince ?? '',
    password: extraInfo?.password ?? '',
    properties,
    totalInvested: fmtCurrency(totalAllIn),
    portfolioValue: fmtCurrency(totalArv),
    avgYield,
    totalAllIn,
  };
}

// ─── API queries ───────────────────────────────────────────────────────────

const PROPERTY_COLUMN_IDS = [
  COL.investor, COL.rentalStatus, COL.purchaseClient, COL.renovClient,
  COL.closingCosts, COL.arv, COL.rent, COL.docs,
].map(id => `"${id}"`).join(', ');

const INVESTOR_COLUMN_IDS = [
  INV_COL.email, INV_COL.phone, INV_COL.capital, INV_COL.since, INV_COL.password,
].map(id => `"${id}"`).join(', ');

type PageResult = { boards: [{ items_page: { cursor: string | null; items: RawItem[] } }] };

async function fetchAllItemsFromGroup(
  boardId: number,
  groupId: string,
  columnIds: string,
): Promise<RawItem[]> {
  const items: RawItem[] = [];
  let cursor: string | null = null;

  do {
    const cursorArg: string = cursor ? `, cursor: "${cursor}"` : '';
    const query: string = `
      query {
        boards(ids: [${boardId}]) {
          items_page(
            limit: 100
            ${cursorArg}
            query_params: { rules: [{ column_id: "group", compare_value: ["${groupId}"] }] }
          ) {
            cursor
            items {
              id
              name
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
    const data: PageResult = await mondayQuery<PageResult>(query);
    const page = data.boards[0].items_page;
    items.push(...page.items);
    cursor = page.cursor ?? null;
  } while (cursor);

  return items;
}

async function fetchInvestorDetails(): Promise<Record<string, { name: string; email: string; phone: string; investorSince: string; password: string }>> {
  const items: RawItem[] = [];
  let cursor: string | null = null;

  do {
    const cursorArg: string = cursor ? `, cursor: "${cursor}"` : '';
    const query: string = `
      query {
        boards(ids: [${INVESTORS_BOARD_ID}]) {
          items_page(limit: 100 ${cursorArg}) {
            cursor
            items {
              id
              name
              column_values(ids: [${INVESTOR_COLUMN_IDS}]) { id text value }
            }
          }
        }
      }
    `;
    const data: PageResult = await mondayQuery<PageResult>(query);
    const page = data.boards[0].items_page;
    items.push(...page.items);
    cursor = page.cursor ?? null;
  } while (cursor);

  return Object.fromEntries(
    items.map(item => {
      const cols = toColMap(item.column_values);
      let sinceStr = '';
      try {
        const val = JSON.parse(cols[INV_COL.since]?.value ?? '{}');
        if (val?.date) sinceStr = formatDate(val.date);
      } catch { /* ignore */ }
      return [
        item.id,
        {
          name: item.name,
          email: cols[INV_COL.email]?.text ?? '',
          phone: cols[INV_COL.phone]?.text ?? '',
          investorSince: sinceStr,
          password: cols[INV_COL.password]?.text ?? '',
        },
      ];
    }),
  );
}

/** Live lookup: query Monday directly at login time — always fresh, never cached */
export async function findInvestorByEmailLive(email: string): Promise<{
  mondayId: string;
  fullName: string;
  initials: string;
  email: string;
  phone: string;
  investorSince: string;
  password: string;
} | null> {
  // Search all items in investors board, filter by email client-side
  // (Monday search API doesn't support searching inside lead_email column directly)
  let cursor: string | null = null;
  do {
    const cursorArg: string = cursor ? `, cursor: "${cursor}"` : '';
    const query: string = `
      query {
        boards(ids: [${INVESTORS_BOARD_ID}]) {
          items_page(limit: 100 ${cursorArg}) {
            cursor
            items {
              id
              name
              column_values(ids: [${INVESTOR_COLUMN_IDS}]) { id text value }
            }
          }
        }
      }
    `;
    const data: PageResult = await mondayQuery<PageResult>(query);
    const page = data.boards[0].items_page;
    for (const item of page.items) {
      const cols = toColMap(item.column_values);
      const itemEmail = cols[INV_COL.email]?.text ?? '';
      // lead_email may contain multiple emails separated by " - ", trim each
      const emailMatches = itemEmail.split(' - ').map((e: string) => e.trim().toLowerCase());
      if (emailMatches.includes(email.toLowerCase())) {
        let sinceStr = '';
        try {
          const val = JSON.parse(cols[INV_COL.since]?.value ?? '{}');
          if (val?.date) sinceStr = formatDate(val.date);
        } catch { /* ignore */ }
        return {
          mondayId: item.id,
          fullName: item.name,
          initials: getInitials(item.name),
          email: itemEmail,
          phone: cols[INV_COL.phone]?.text ?? '',
          investorSince: sinceStr,
          password: cols[INV_COL.password]?.text ?? '',
        };
      }
    }
    cursor = page.cursor ?? null;
  } while (cursor);
  return null;
}

export async function setInvestorPassword(itemId: string, password: string): Promise<void> {
  await mondayQuery<unknown>(`
    mutation {
      change_simple_column_value(
        board_id: ${INVESTORS_BOARD_ID},
        item_id: ${itemId},
        column_id: "${INV_COL.password}",
        value: "${password.replace(/"/g, '\\"')}"
      ) { id }
    }
  `);
}

// ─── Public API ────────────────────────────────────────────────────────────

export interface MondayBoardData {
  properties: MondayProperty[];
  investors: MondayInvestor[];
}

export async function fetchMondayData(): Promise<MondayBoardData> {
  // Fetch raw items from "עסקאות של משקיעים" group + investor details in parallel
  const [rawItems, investorDetails] = await Promise.all([
    fetchAllItemsFromGroup(PROPERTIES_BOARD_ID, INVESTOR_DEALS_GROUP, PROPERTY_COLUMN_IDS),
    fetchInvestorDetails().catch(() => ({} as ReturnType<typeof fetchInvestorDetails> extends Promise<infer T> ? T : never)),
  ]);

  const properties = rawItems.map(transformRawProperty);

  // Group properties by investorMondayId
  const investorMap = new Map<string, { name: string; props: MondayProperty[] }>();
  for (const prop of properties) {
    if (!prop.investorMondayId) continue;
    if (!investorMap.has(prop.investorMondayId)) {
      investorMap.set(prop.investorMondayId, { name: prop.investorName, props: [] });
    }
    investorMap.get(prop.investorMondayId)!.props.push(prop);
  }

  type InvDetails = Record<string, {name:string;email:string;phone:string;investorSince:string;password:string}>;
  const inv = await investorDetails as InvDetails;

  // Build investors from those who have properties
  const investors: MondayInvestor[] = Array.from(investorMap.entries()).map(([id, { name, props }]) =>
    buildInvestorFromProperties(id, name, props, inv[id]),
  );

  // Also add investors from the investors board who have no properties yet
  // (so they can still log in with email + password)
  const investorsWithProps = new Set(investorMap.keys());
  for (const [id, details] of Object.entries(inv)) {
    if (!investorsWithProps.has(id) && details.email) {
      investors.push(buildInvestorFromProperties(id, details.name || details.email, [], details));
    }
  }

  // Sort investors by total invested (descending)
  investors.sort((a, b) => b.totalAllIn - a.totalAllIn);

  return { properties, investors };
}
