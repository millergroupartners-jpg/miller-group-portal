/**
 * Client-side wrapper for /api/renovations/*.
 *
 * IMPORTANT: Renovation subitems contain internal payment/commission details.
 * This data is ADMIN-ONLY. Do not render subitems in investor-facing UI.
 */

export interface RenovationSubitem {
  id: string;
  name: string;
  amount: number;
  date: string;
  paidTo: string;      // "לנו" | "לקבלן" | "קבלן משנה" | ""
  paidBy: string;      // "הלקוח" | "אנחנו" | ""
  category: string;    // עבודה | עבודה וחומרים | חומרים | אחר
  receiptUrl: string;
  receiptThumb: string;
  createdAt: string;
}

export interface Renovation {
  id: string;
  name: string;
  groupId: string;
  groupTitle: string;
  propertyId: string;
  propertyName: string;
  /** Group id of the linked PROPERTY on the properties board. Used to decide
   *  investor-owned vs Miller-Group-owned: "group_mkw9are4" = MG. */
  propertyGroupId?: string;
  status: string;
  investorName: string;
  contractorName: string;
  ourCost: number;
  clientCost: number;
  approvedAddons: number;
  updatedAt: string;
  subitems: RenovationSubitem[];
  totalPaid: number;
}

/** Group id on Properties board for Miller Group own deals. Shared so screens
 *  can filter investor-owned vs MG without re-declaring the magic string. */
export const MG_PROPERTY_GROUP_ID = 'group_mkw9are4';

/**
 * Derived balance per renovation project:
 *  - How much the investor has paid so far (total, to us, to contractor)
 *  - How much the contractor has received (regardless of source)
 *  - How much is still owed by the investor, split into:
 *      · direct-to-contractor (= remaining contractor work)
 *      · to-us (= the rest; usually our margin)
 *
 * "paidTo" on a subitem is: "לנו" / "לקבלן" / "קבלן משנה"
 * "paidBy" on a subitem is: "הלקוח" / "אנחנו"
 */
export interface RenovationBalance {
  clientPaidTotal: number;         // everything the investor has contributed so far
  clientPaidToUs: number;          // investor → Miller Group
  clientPaidToContractor: number;  // investor → contractor directly (skipping us)
  contractorReceivedTotal: number; // what the contractor actually got, any source

  remainingTotal: number;        // clientCost − clientPaidTotal
  remainingToContractor: number; // of what remains, what still needs to reach the contractor
  remainingToUs: number;         // remaining − remainingToContractor
}

export function calcBalance(r: Renovation): RenovationBalance {
  const subs = r.subitems;
  const sumWhere = (pred: (s: RenovationSubitem) => boolean) =>
    subs.filter(pred).reduce((s, x) => s + (x.amount || 0), 0);

  const clientPaidTotal = sumWhere(s => s.paidBy === 'הלקוח');
  const clientPaidToUs = sumWhere(s => s.paidBy === 'הלקוח' && s.paidTo === 'לנו');
  const clientPaidToContractor = sumWhere(s =>
    s.paidBy === 'הלקוח' && (s.paidTo === 'לקבלן' || s.paidTo === 'קבלן משנה')
  );
  const contractorReceivedTotal = sumWhere(s =>
    s.paidTo === 'לקבלן' || s.paidTo === 'קבלן משנה'
  );

  // Approved addons add BOTH to what the client owes us AND to what the
  // contractor is owed — they pass through at cost. Profit stays unchanged.
  const addons = r.approvedAddons || 0;
  const effectiveClientTotal = r.clientCost + addons;
  const effectiveOurCost     = r.ourCost    + addons;

  const remainingTotal = Math.max(0, effectiveClientTotal - clientPaidTotal);
  const contractorNeedsMore = Math.max(0, effectiveOurCost - contractorReceivedTotal);
  const remainingToContractor = Math.min(remainingTotal, contractorNeedsMore);
  const remainingToUs = Math.max(0, remainingTotal - remainingToContractor);

  return {
    clientPaidTotal, clientPaidToUs, clientPaidToContractor,
    contractorReceivedTotal,
    remainingTotal, remainingToContractor, remainingToUs,
  };
}

async function fetchJson<T>(url: string): Promise<T> {
  const res = await fetch(url);
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`API ${res.status}: ${text}`);
  }
  return res.json() as Promise<T>;
}

export async function listRenovations(opts?: {
  propertyId?: string;
  investorId?: string;
  /**
   * When 'investor', the server sanitizes the payload: strips contractor name,
   * our internal cost, and payments made by us; also blanks the paidTo on each
   * remaining subitem. Default is 'admin' which returns full data.
   */
  role?: 'admin' | 'investor';
}): Promise<Renovation[]> {
  const qs = new URLSearchParams();
  if (opts?.propertyId) qs.set('propertyId', opts.propertyId);
  if (opts?.investorId) qs.set('investorId', opts.investorId);
  if (opts?.role)       qs.set('role', opts.role);
  const suffix = qs.toString() ? `?${qs.toString()}` : '';
  const data = await fetchJson<{ ok: true; renovations: Renovation[] }>(`/api/renovations/list${suffix}`);
  return data.renovations;
}

/** Updates (comments) posted on a renovation Monday item */
export interface RenovationUpdate {
  id: string;
  body: string;      // HTML
  textBody: string;  // plain
  createdAt: string;
  author: string;
}

export async function listRenovationUpdates(itemId: string): Promise<RenovationUpdate[]> {
  // Routed via ?action=updates on the renovations/list serverless function —
  // kept on the same function to stay within Vercel Hobby's 12-function cap.
  const res = await fetch(`/api/renovations/list?action=updates&itemId=${encodeURIComponent(itemId)}`);
  if (!res.ok) throw new Error(`API ${res.status}`);
  const data = await res.json();
  return data.updates as RenovationUpdate[];
}

export async function postRenovationUpdate(itemId: string, body: string, author?: string): Promise<void> {
  const res = await fetch(`/api/renovations/list?action=updates`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ itemId, body, author }),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`API ${res.status}: ${text}`);
  }
}

/** Human-readable color for the "למי שולם" chip */
export function paidToColor(paidTo: string): string {
  switch (paidTo) {
    case 'לנו':       return '#00c875';
    case 'לקבלן':     return '#225091';
    case 'קבלן משנה': return '#ffcb00';
    default:           return '#888888';
  }
}

export function paidByColor(paidBy: string): string {
  switch (paidBy) {
    case 'הלקוח': return '#00c875';
    case 'אנחנו': return '#df2f4a';
    default:       return '#888888';
  }
}
