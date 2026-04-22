/**
 * Client-side wrapper for the /api/inquiries/* serverless endpoints.
 */

export interface InquiryReply {
  id: string;
  body: string;      // HTML from Monday update
  textBody: string;  // plain text
  createdAt: string;
  author: string;
}

export interface Inquiry {
  id: string;
  inquiryNumber: string;   // e.g. "INQ-012345"
  subject: string;
  createdAt: string;
  updatedAt: string;
  status: 'New' | 'In Progress' | 'Resolved' | string;
  direction: 'Investor→Management' | 'Management→Investor' | string;
  investorId: string;
  investorName: string;
  investorEmail: string;
  property: string;
  replies: InquiryReply[];
}

async function fetchJson<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(init?.headers || {}),
    },
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`API ${res.status}: ${text}`);
  }
  return res.json() as Promise<T>;
}

export async function listInquiries(investorId?: string): Promise<Inquiry[]> {
  const qs = investorId ? `?investorId=${encodeURIComponent(investorId)}` : '';
  const data = await fetchJson<{ inquiries: Inquiry[] }>(`/api/inquiries/list${qs}`);
  return data.inquiries;
}

export async function createInquiry(opts: {
  subject: string;
  message: string;
  investorId: string;
  investorName: string;
  investorEmail: string;
  property?: string;
  direction: 'investor-to-admin' | 'admin-to-investor';
}): Promise<{ inquiryId: string; inquiryNumber: string }> {
  return fetchJson('/api/inquiries/create', {
    method: 'POST',
    body: JSON.stringify(opts),
  });
}

export async function replyToInquiry(opts: {
  inquiryId: string;
  message: string;
  replyFrom: 'admin' | 'investor';
  investorName: string;
  investorEmail: string;
  subject: string;
}): Promise<{ ok: true }> {
  return fetchJson('/api/inquiries/reply', {
    method: 'POST',
    body: JSON.stringify(opts),
  });
}

export async function resolveInquiry(inquiryId: string): Promise<{ ok: true }> {
  return fetchJson('/api/inquiries/resolve', {
    method: 'POST',
    body: JSON.stringify({ inquiryId }),
  });
}
