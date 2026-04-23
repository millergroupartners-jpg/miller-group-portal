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
}): Promise<{ inquiryId: string; inquiryNumber: string; updateId: string }> {
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
}): Promise<{ ok: true; updateId: string }> {
  return fetchJson('/api/inquiries/reply', {
    method: 'POST',
    body: JSON.stringify(opts),
  });
}

/**
 * Upload a file (image/pdf/doc) as an attachment to a Monday update.
 * Uses the VITE_MONDAY_API_TOKEN directly from the client (same token already
 * exposed to the portal). Returns the public asset URL from Monday.
 */
export async function uploadFileToUpdate(updateId: string, file: File): Promise<string> {
  const token = import.meta.env.VITE_MONDAY_API_TOKEN as string;
  if (!token) throw new Error('Monday token missing on client');
  if (!updateId) throw new Error('No updateId — cannot attach file');

  const query = `mutation add_file($file: File!) {
    add_file_to_update(update_id: ${updateId}, file: $file) {
      id
      url
      asset_id
    }
  }`;

  const form = new FormData();
  form.append('query', query);
  form.append('variables[file]', file, file.name);

  const res = await fetch('https://api.monday.com/v2/file', {
    method: 'POST',
    headers: { Authorization: token },
    body: form,
  });
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`Monday file upload HTTP ${res.status}: ${body}`);
  }
  const json = await res.json();
  if (json.errors?.length) throw new Error(json.errors[0].message);
  return json?.data?.add_file_to_update?.url ?? '';
}

export async function uploadFilesToUpdate(updateId: string, files: File[]): Promise<void> {
  // Sequential to avoid rate-limiting Monday's API
  for (const f of files) {
    await uploadFileToUpdate(updateId, f);
  }
}

export async function resolveInquiry(inquiryId: string): Promise<{ ok: true }> {
  return fetchJson('/api/inquiries/resolve', {
    method: 'POST',
    body: JSON.stringify({ inquiryId }),
  });
}
