/**
 * Monday.com GraphQL API service
 * Board: עסקאות נדל״ן (1997938102) — investor property deals
 * Investors board: משקיעים (1997938105)
 */

const MONDAY_API_URL = 'https://api.monday.com/v2';

export const PROPERTIES_BOARD_ID = 1997938102;
export const INVESTORS_BOARD_ID = 1997938105;
export const CONTACTS_BOARD_ID  = 1997938116;
/** Group: "עסקאות של משקיעים" */
const INVESTOR_DEALS_GROUP = 'group_mkrzmwnf';
/** Group: "עסקאות Miller Group" — the company's own deals */
const MG_DEALS_GROUP = 'group_mkw9are4';

// Column IDs on the properties board
const COL = {
  investor:       'board_relation_mkrzrtny', // "משקיע" — board_relation, use linked_items fragment
  rentalStatus:   'color_mm1fv8p0',          // "סטטוס השכרה"
  loanStatus:     'color_mkvj438f',           // "סטטוס הלוואה"
  closingDate:    'date_mkrz2xsg',            // "תאריך סגירה"
  purchaseClient: 'numeric_mkrzmmy',          // "רכישה ללקוח ($)"
  purchaseOur:    'numeric_mkvj3q7z',         // "רכישה שלנו ($)"  ADMIN-ONLY
  renovClient:    'numeric_mkrzk78b',         // "שיפוץ ללקוח ($)"
  renovOur:       'numeric_mkvjrbnp',         // "שיפוץ שלנו ($)"  ADMIN-ONLY
  closingCosts:   'numeric_mks3rebm',         // "עלויות סגירה ($)"
  // allIn is computed: purchaseClient + renovClient + closingCosts (formula col returns null)
  arv:            'numeric_mkrzjtsd',         // "ARV ($)"
  rent:           'numeric_mkrzdr4k',         // "שכ״ד חזוי ($)"
  docs:           'file_mkrzdfq3',            // "מסמכים" — Google Drive link
  manager:        'board_relation_mm219qy1', // "מנהל הנכס" — board_relation → contacts board
} as const;

// Column IDs on the contacts board (1997938116)
const CONTACT_COL = {
  phone:   'contact_phone',    // "טלפון"
  email:   'contact_email',    // "אימייל"
  company: 'text_mks14ygk',    // "שם החברה"
  role:    'title5',           // "תפקיד בחברה" (dropdown)
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
  loanStatus: string;       // "סטטוס הלוואה" raw label
  closingDate: string;      // ISO "YYYY-MM-DD" or ''
  investorMondayId: string;
  investorName: string;
  docsUrl: string;          // Google Drive folder link from "מסמכים" column

  // ── Property management (from linked contact on contacts board 1997938116) ──
  /** Internal: Monday item id of the linked manager contact (used to enrich below) */
  managerContactId: string;
  /** Contact name (item name on contacts board) */
  managerContactName: string;
  /** Contact role / title at the management company */
  managerRole: string;
  /** Contact phone */
  managerPhone: string;
  /** Contact email */
  managerEmail: string;
  /** Management company name */
  managerCompanyName: string;
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
      return { status: 'מושכר', statusType: 'green' };
    case 'מעבר לניהול':
      return { status: 'מעבר לניהול', statusType: 'green' };
    case 'בשיפוץ':
      return { status: 'בשיפוץ', statusType: 'gold' };
    case 'מרקט':
      return { status: 'מרקט', statusType: 'gold' };
    case 'על חוזה':
    case 'בשלבי הלוואה וחתימות':
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

  // "מנהל הנכס" — linked contact on contacts board (fields enriched in a batch below)
  const managerLinked = cols[COL.manager]?.linked_items?.[0];
  const managerContactId   = managerLinked?.id   ?? '';
  const managerContactName = managerLinked?.name ?? '';

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
    loanStatus: cols[COL.loanStatus]?.text ?? '',
    closingDate: cols[COL.closingDate]?.text ?? '',
    investorMondayId,
    investorName,
    docsUrl,
    // Property management (role/phone/email/company filled later by enrichPropertiesWithManagers)
    managerContactId,
    managerContactName,
    managerRole:        '',
    managerPhone:       '',
    managerEmail:       '',
    managerCompanyName: '',
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
  COL.investor, COL.rentalStatus, COL.loanStatus, COL.closingDate,
  COL.purchaseClient, COL.renovClient,
  COL.closingCosts, COL.arv, COL.rent, COL.docs,
  COL.manager,
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

/**
 * Batch-fetch contact details from the contacts board (1997938116) by item IDs.
 * Returns a map: contactId → { name, phone, email, company, role }.
 * Used to enrich each property with its manager contact details in a single query.
 */
interface ContactInfo {
  name: string;
  phone: string;
  email: string;
  company: string;
  role: string;
}
async function fetchContactsByIds(ids: string[]): Promise<Record<string, ContactInfo>> {
  if (ids.length === 0) return {};
  const uniqueIds = Array.from(new Set(ids));
  const query: string = `
    query {
      items(ids: [${uniqueIds.join(',')}]) {
        id
        name
        column_values(ids: ["${CONTACT_COL.phone}", "${CONTACT_COL.email}", "${CONTACT_COL.company}", "${CONTACT_COL.role}"]) {
          id
          text
        }
      }
    }
  `;
  try {
    const data = await mondayQuery<{ items: RawItem[] }>(query);
    const map: Record<string, ContactInfo> = {};
    for (const item of data.items ?? []) {
      const cols = toColMap(item.column_values);
      map[item.id] = {
        name:    item.name,
        phone:   cols[CONTACT_COL.phone]?.text   ?? '',
        email:   cols[CONTACT_COL.email]?.text   ?? '',
        company: cols[CONTACT_COL.company]?.text ?? '',
        role:    cols[CONTACT_COL.role]?.text    ?? '',
      };
    }
    return map;
  } catch {
    // If the contacts board is inaccessible (private perms / token scope), skip enrichment
    return {};
  }
}

/**
 * Enriches an array of properties with their manager contact details.
 * Mutates each property in place — fields on `MondayProperty` are writable.
 * Runs a single batched query for all unique manager IDs.
 */
async function enrichPropertiesWithManagers(properties: MondayProperty[]): Promise<MondayProperty[]> {
  const ids = properties.map(p => p.managerContactId).filter((id): id is string => Boolean(id));
  if (ids.length === 0) return properties;
  const contacts = await fetchContactsByIds(ids);
  for (const p of properties) {
    const c = p.managerContactId ? contacts[p.managerContactId] : null;
    if (c) {
      // Prefer canonical name from contacts board; fall back to the linked_items fragment name
      p.managerContactName = c.name || p.managerContactName;
      p.managerPhone       = c.phone;
      p.managerEmail       = c.email;
      p.managerCompanyName = c.company;
      p.managerRole        = c.role;
    }
  }
  return properties;
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

  // Enrich each property with its linked manager contact's details (company, phone, email, role)
  await enrichPropertiesWithManagers(properties);

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

/** Fetch Miller Group's own deals (group "עסקאות Miller Group") */
export async function fetchMillerGroupProperties(): Promise<MondayProperty[]> {
  const raw = await fetchAllItemsFromGroup(PROPERTIES_BOARD_ID, MG_DEALS_GROUP, PROPERTY_COLUMN_IDS);
  const properties = raw.map(transformRawProperty);
  await enrichPropertiesWithManagers(properties);
  return properties;
}

/**
 * Fetch per-property profit margin data (purchase profit, renovation profit, total).
 *
 * ADMIN-ONLY. Call this only from admin surfaces (AdminClosingsScreen,
 * AdminRenovationsScreen, etc). Never render the returned values in any view
 * the investor could reach — they reveal our internal margins on purchases and
 * renovations, which must stay hidden per business policy.
 *
 * Returns a map keyed by property Monday item id.
 */
export interface PropertyProfit {
  purchaseClient: number;  // רכישה ללקוח
  purchaseOur:    number;  // רכישה שלנו   (admin-only)
  renovClient:    number;  // שיפוץ ללקוח
  renovOur:       number;  // שיפוץ שלנו   (admin-only)
  purchaseProfit: number;  // clientCost - ourCost
  renovProfit:    number;
  totalProfit:    number;
}

export async function fetchPropertyProfits(propertyIds: string[]): Promise<Record<string, PropertyProfit>> {
  if (propertyIds.length === 0) return {};

  // Monday accepts up to ~100 ids per items() query — chunk defensively.
  const CHUNK = 80;
  const chunks: string[][] = [];
  for (let i = 0; i < propertyIds.length; i += CHUNK) chunks.push(propertyIds.slice(i, i + CHUNK));

  const colIds = [COL.purchaseClient, COL.purchaseOur, COL.renovClient, COL.renovOur]
    .map(id => `"${id}"`).join(',');

  const out: Record<string, PropertyProfit> = {};

  for (const chunk of chunks) {
    const idList = chunk.join(',');
    const query = `query {
      items(ids: [${idList}]) {
        id
        column_values(ids: [${colIds}]) { id text value }
      }
    }`;
    try {
      const data = await mondayQuery<{ items: { id: string; column_values: RawColumnValue[] }[] }>(query);
      for (const it of data.items ?? []) {
        const map = toColMap(it.column_values);
        const purchaseClient = num(map[COL.purchaseClient]);
        const purchaseOur    = num(map[COL.purchaseOur]);
        const renovClient    = num(map[COL.renovClient]);
        const renovOur       = num(map[COL.renovOur]);
        const purchaseProfit = purchaseClient - purchaseOur;
        const renovProfit    = renovClient    - renovOur;
        out[it.id] = {
          purchaseClient, purchaseOur, renovClient, renovOur,
          purchaseProfit, renovProfit,
          totalProfit: purchaseProfit + renovProfit,
        };
      }
    } catch (err) {
      console.error('fetchPropertyProfits chunk failed:', err);
    }
  }

  return out;
}
