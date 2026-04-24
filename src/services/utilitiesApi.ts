/**
 * Client-side wrapper for /api/utilities/*.
 * Returns utility accounts (water/power/gas/sewer) linked to a property or investor.
 */

export type UtilityStatus = 'to-start' | 'scheduled' | 'active' | 'pending-payment' | 'unknown';

export interface Utility {
  id: string;
  accountNumber: string;
  serviceCompany: string;
  serviceCompanyHex: string;
  scheduledIn: string;
  phone: string;
  website: string;
  notes: string;
  status: UtilityStatus;
  statusHe: string;
  groupTitle: string;
  propertyId: string;
  propertyName: string;
  investorId: string;
  investorName: string;
  createdAt: string;
  updatedAt: string;
}

async function fetchJson<T>(url: string): Promise<T> {
  const res = await fetch(url);
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`API ${res.status}: ${text}`);
  }
  return res.json() as Promise<T>;
}

export async function listUtilities(opts?: { propertyId?: string; investorId?: string }): Promise<Utility[]> {
  const qs = new URLSearchParams();
  if (opts?.propertyId) qs.set('propertyId', opts.propertyId);
  if (opts?.investorId) qs.set('investorId', opts.investorId);
  const suffix = qs.toString() ? `?${qs.toString()}` : '';
  const data = await fetchJson<{ ok: true; utilities: Utility[] }>(`/api/utilities/list${suffix}`);
  return data.utilities;
}

/** Emoji icon inferred from the service company label (falls back to plug) */
export function utilityIcon(serviceCompany: string): string {
  const s = (serviceCompany || '').toLowerCase();
  if (s.includes('water') || s.includes('sewer')) return '💧';
  if (s.includes('power') || s.includes('energy') || s.includes('electric')) return '⚡';
  if (s.includes('gas') || s.includes('nipsco') || s.includes('centerpoint')) return '🔥';
  if (s.includes('trash')) return '🗑️';
  return '🔌';
}

export function statusColor(status: UtilityStatus): string {
  switch (status) {
    case 'active':          return '#00c875';
    case 'scheduled':       return '#4eccc6';
    case 'to-start':        return '#fdab3d';
    case 'pending-payment': return '#df2f4a';
    default:                 return '#888888';
  }
}
