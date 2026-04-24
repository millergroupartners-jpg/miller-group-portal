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

async function fetchJson<T>(url: string): Promise<T> {
  const res = await fetch(url);
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`API ${res.status}: ${text}`);
  }
  return res.json() as Promise<T>;
}

export async function listRenovations(opts?: { propertyId?: string; investorId?: string }): Promise<Renovation[]> {
  const qs = new URLSearchParams();
  if (opts?.propertyId) qs.set('propertyId', opts.propertyId);
  if (opts?.investorId) qs.set('investorId', opts.investorId);
  const suffix = qs.toString() ? `?${qs.toString()}` : '';
  const data = await fetchJson<{ ok: true; renovations: Renovation[] }>(`/api/renovations/list${suffix}`);
  return data.renovations;
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
