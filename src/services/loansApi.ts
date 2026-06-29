/**
 * Client-side loader for the "הלוואות שיפוץ" (renovation-loan / construction-draw)
 * Monday board — 5096995862.
 *
 * Each item is ONE property's renovation loan: a total amount, how much has
 * already been drawn, what's left in the loan, how much is ready to draw right
 * now, an overall progress %, plus a per-category cost breakdown (demolition /
 * drywall / flooring / kitchen / …) each carrying its own draw status.
 *
 * Fetched directly from Monday in the browser — the SAME model the properties &
 * investors boards already use in mondayApi.ts — so we do NOT add a 13th
 * serverless function (the Vercel Hobby project is already at the 12-function
 * cap; see vercel.json). Nothing here needs server-side sanitization: a
 * renovation loan is the investor's own loan on their own property and carries
 * no Miller-Group internal margin to hide (unlike the renovations board).
 *
 * Linking loan → project: every loan item links to the properties board via the
 * `board_relation_mm3knvhm` column. 3 of 11 items aren't linked yet, so we fall
 * back to matching the item name (a property address) against the property.
 */

import { mondayQuery } from './mondayApi';
import { getCached, setCached } from './cache';

export const LOANS_BOARD_ID = 5096995862;
const LOANS_BOARD_URL = 'https://real-estate-usa-eden.monday.com/boards/5096995862';

/** Summary + link columns on the loans board. */
const SUM_COL = {
  total:       'numeric_mm3k38zr', // סה״כ הלוואת שיפוץ
  drawn:       'formula_mm3kvn7g',  // כבר נמשך
  remaining:   'formula_mm3k8bn8',  // נשאר בהלוואה
  readyToDraw: 'formula_mm3kmrwh',  // מוכן למשיכה עכשיו
  progressPct: 'formula_mm45fyv0',  // אחוז התקדמות שיפוץ
  property:    'board_relation_mm3knvhm', // → עסקאות נדל״ן (properties board)
} as const;

/** Categories that carry a $ budget + a draw/✓ status. */
const AMOUNT_CATEGORIES: { label: string; amount: string; status: string }[] = [
  { label: 'הריסה',      amount: 'numeric_mm3krq0w', status: 'color_mm3k94zb' },
  { label: 'גבס',        amount: 'numeric_mm3k245x', status: 'color_mm3kz0m8' },
  { label: 'ריצוף',      amount: 'numeric_mm3kzv1q', status: 'color_mm3k1dqb' },
  { label: 'צביעה',      amount: 'numeric_mm3kqjwx', status: 'color_mm3krks0' },
  { label: 'חשמל',       amount: 'numeric_mm3k52c2', status: 'color_mm3k4v5d' },
  { label: 'תאורה',      amount: 'numeric_mm3k12ey', status: 'color_mm3kyyrv' },
  { label: 'עבודות חוץ', amount: 'numeric_mm3kwtz3', status: 'color_mm3khw5r' },
  { label: 'אמבטיה',     amount: 'numeric_mm3k1433', status: 'color_mm3kw19d' },
  { label: 'מטבח',       amount: 'numeric_mm3k3e9t', status: 'color_mm3khm3c' },
];

/** Scope items tracked as text note + status (no $ amount of their own). */
const SCOPE_CATEGORIES: { label: string; text: string; status: string }[] = [
  { label: 'החלפת חלונות',  text: 'text_mm43mr9w', status: 'color_mm43pa4w' },
  { label: 'דלתות ומסגרות', text: 'text_mm44pn5k', status: 'color_mm44a9nk' },
  { label: 'אינסטלציה',     text: 'text_mm43dchg', status: 'color_mm43jkym' },
  { label: 'חיפוי חיצוני',  text: 'text_mm44nkba', status: 'color_mm44m6t1' },
  { label: 'נגרות/ארונות',  text: 'text_mm444stf', status: 'color_mm445bfb' },
  { label: 'דיקט',          text: 'text_mm442b2q', status: 'color_mm4466a6' },
  { label: 'קבלת שמאות',    text: 'text_mm431kb0', status: 'color_mm4373c1' },
];

export interface LoanCategory {
  label: string;
  amount: number;   // 0 for scope-only items
  hasAmount: boolean;
  note: string;     // text value for scope items, '' otherwise
  status: string;   // status label ('' when unset)
}

export interface LoanRecord {
  id: string;
  /** Item name on the loans board — a property address. */
  name: string;
  /** Property item ids this loan links to (board relation). */
  linkedPropertyIds: string[];
  total: number;
  drawn: number;
  remaining: number;
  readyToDraw: number;
  progressPct: number;
  /** Cost categories with a $ budget and/or a draw status. */
  categories: LoanCategory[];
  /** Extra scope items tracked as note + status. */
  scope: LoanCategory[];
  mondayUrl: string;
}

// ─── GraphQL ─────────────────────────────────────────────────────────────────

interface RawCV {
  id: string;
  text: string | null;
  display_value?: string | null;
  linked_item_ids?: (string | number)[];
}
interface RawItem { id: string; name: string; column_values: RawCV[] }

const QUERY = `query {
  boards(ids: [${LOANS_BOARD_ID}]) {
    items_page(limit: 200) {
      items {
        id
        name
        column_values {
          id
          text
          ... on BoardRelationValue { linked_item_ids }
          ... on FormulaValue { display_value }
          ... on MirrorValue { display_value }
        }
      }
    }
  }
}`;

function parseNum(s: string | null | undefined): number {
  if (!s) return 0;
  const n = Number(String(s).replace(/[^0-9.\-]/g, ''));
  return Number.isFinite(n) ? n : 0;
}

function mapItem(it: RawItem): LoanRecord {
  const cv: Record<string, RawCV> = Object.fromEntries(it.column_values.map(c => [c.id, c]));
  const val = (id: string) => cv[id]?.display_value ?? cv[id]?.text ?? '';

  const categories = AMOUNT_CATEGORIES
    .map(c => ({
      label: c.label,
      amount: parseNum(cv[c.amount]?.text),
      hasAmount: true,
      note: '',
      status: (cv[c.status]?.text ?? '').trim(),
    }))
    .filter(c => c.amount > 0 || c.status);

  const scope = SCOPE_CATEGORIES
    .map(c => ({
      label: c.label,
      amount: 0,
      hasAmount: false,
      note: (cv[c.text]?.text ?? '').trim(),
      status: (cv[c.status]?.text ?? '').trim(),
    }))
    .filter(c => c.note || c.status);

  return {
    id: it.id,
    name: it.name,
    linkedPropertyIds: (cv[SUM_COL.property]?.linked_item_ids ?? []).map(String),
    total:       parseNum(val(SUM_COL.total)),
    drawn:       parseNum(val(SUM_COL.drawn)),
    remaining:   parseNum(val(SUM_COL.remaining)),
    readyToDraw: parseNum(val(SUM_COL.readyToDraw)),
    progressPct: Math.round(parseNum(val(SUM_COL.progressPct))),
    categories,
    scope,
    mondayUrl: `${LOANS_BOARD_URL}/pulses/${it.id}`,
  };
}

// ─── Public API ──────────────────────────────────────────────────────────────

const CACHE_KEY = 'loans';
const TTL = 5 * 60 * 1000; // 5 min — same spirit as the other Monday caches

/**
 * All renovation loans. Cached in localStorage for 5 min (stale-while-revalidate
 * style): a fresh cache is returned instantly, otherwise we hit Monday and
 * refresh the cache. Pass `{ force: true }` to bypass the cache.
 */
export async function listLoans(opts?: { force?: boolean }): Promise<LoanRecord[]> {
  if (!opts?.force) {
    const cached = getCached<LoanRecord[]>(CACHE_KEY, TTL);
    if (cached && !cached.isStale) return cached.data;
  }
  const data = await mondayQuery<{ boards: { items_page: { items: RawItem[] } }[] }>(QUERY);
  const items = data.boards?.[0]?.items_page?.items ?? [];
  const loans = items.map(mapItem);
  setCached(CACHE_KEY, loans);
  return loans;
}

function normAddr(s: string): string {
  return (s || '').toLowerCase().replace(/[.,#]/g, ' ').replace(/\s+/g, ' ').trim();
}

/** Does this loan belong to the given property? Match by board relation first,
 *  then fall back to a normalized address comparison (for items not yet linked
 *  on Monday). */
export function loanMatchesProperty(loan: LoanRecord, propertyId: string, propertyAddress?: string): boolean {
  if (propertyId && loan.linkedPropertyIds.includes(String(propertyId))) return true;
  if (propertyAddress) {
    const a = normAddr(loan.name);
    const b = normAddr(propertyAddress);
    if (b.length >= 5 && (a.includes(b) || b.includes(a))) return true;
  }
  return false;
}

export function getLoanForProperty(loans: LoanRecord[], propertyId: string, propertyAddress?: string): LoanRecord | null {
  return loans.find(l => loanMatchesProperty(l, propertyId, propertyAddress)) ?? null;
}

/** Heuristic color for a category draw-status chip. The label itself is the
 *  source of truth; this only tints it. Falls back to neutral grey. */
export function loanStatusColor(status: string): string {
  const s = (status || '').toLowerCase();
  if (/(נמשך|drawn|הושלם|done|בוצע|הסתיים|complete|✓|paid|שולם)/.test(s)) return '#00c875';
  if (/(מוכן|ready|אושר|approved)/.test(s)) return '#fdab3d';
  if (/(בעבודה|בתהליך|progress|wip|started)/.test(s)) return '#579bfc';
  return '#9aa0a6';
}
