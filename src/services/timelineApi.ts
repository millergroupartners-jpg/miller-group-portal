/**
 * Client-side wrapper for /api/timeline/list.
 * Returns a unified chronological timeline for one property.
 *
 * IMPORTANT: Pass role='admin' ONLY for admin users. The server filters out
 * renovation-payment events for non-admin calls so investors never see internal
 * contractor/commission transfers.
 */

export type TimelineEventKind =
  | 'photo'
  | 'renovation-payment'
  | 'status-change'
  | 'inquiry-new'
  | 'inquiry-reply'
  | 'utility-scheduled'
  | 'utility-activated';

export interface TimelineEvent {
  id: string;
  kind: TimelineEventKind;
  at: string;
  title: string;
  subtitle?: string;
  icon: string;
  color: string;
  thumbnailUrl?: string;
  href?: string;
  meta?: Record<string, any>;
}

async function fetchJson<T>(url: string): Promise<T> {
  const res = await fetch(url);
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`API ${res.status}: ${text}`);
  }
  return res.json() as Promise<T>;
}

export async function fetchPropertyTimeline(
  propertyId: string,
  role: 'admin' | 'investor' = 'investor'
): Promise<TimelineEvent[]> {
  const qs = new URLSearchParams({ propertyId, role });
  const data = await fetchJson<{ ok: true; events: TimelineEvent[] }>(`/api/timeline/list?${qs.toString()}`);
  return data.events;
}

/** Admin-only global activity feed for the admin dashboard. */
export interface AdminFeedEvent {
  id: string;
  kind: 'status-change' | 'inquiry-new' | 'inquiry-reply' | 'renovation-payment';
  at: string;
  title: string;
  subtitle?: string;
  icon: string;
  color: string;
  propertyId?: string;
  propertyName?: string;
  inquiryId?: string;
}

export async function fetchAdminFeed(limit: number = 30): Promise<AdminFeedEvent[]> {
  const data = await fetchJson<{ ok: true; events: AdminFeedEvent[] }>(`/api/timeline/admin-feed?limit=${limit}&role=admin`);
  return data.events;
}

/**
 * Investor-facing activity feed scoped to a single investor's properties.
 * Renovation-payment events are stripped server-side so internal transfers
 * never leak to the investor.
 */
export async function fetchInvestorFeed(investorId: string, limit: number = 25): Promise<AdminFeedEvent[]> {
  const qs = new URLSearchParams({ investorId, limit: String(limit), role: 'investor' });
  const data = await fetchJson<{ ok: true; events: AdminFeedEvent[] }>(`/api/timeline/admin-feed?${qs.toString()}`);
  return data.events;
}

/** Friendly relative time in Hebrew: "לפני 3 ימים" / "לפני שעה" */
export function relativeTimeHe(iso: string): string {
  if (!iso) return '';
  const then = new Date(iso).getTime();
  if (!Number.isFinite(then)) return '';
  const diff = Date.now() - then;
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'הרגע';
  if (mins < 60) return `לפני ${mins} ${mins === 1 ? 'דקה' : 'דקות'}`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `לפני ${hours} ${hours === 1 ? 'שעה' : 'שעות'}`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `לפני ${days} ${days === 1 ? 'יום' : 'ימים'}`;
  if (days < 30) return `לפני ${Math.floor(days / 7)} שבועות`;
  if (days < 365) return `לפני ${Math.floor(days / 30)} חודשים`;
  return `לפני ${Math.floor(days / 365)} שנים`;
}
