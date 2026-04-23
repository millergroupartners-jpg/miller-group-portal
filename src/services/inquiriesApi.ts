/**
 * Client-side wrapper for the /api/inquiries/* serverless endpoints.
 */

export interface InquiryReply {
  id: string;
  body: string;      // HTML from Monday update
  textBody: string;  // plain text
  createdAt: string;
  author: string;   // Monday creator name — NOT the functional author! Always use parseReplyAuthor()
}

/**
 * Monday's `creator` on an update is the Monday user account that pushed it via
 * the API (always the same for our single-token setup). The FUNCTIONAL author
 * (who actually wrote the message in the portal) is embedded as a bold prefix
 * in the body: `<b>Name:</b><br>message`. This helper reconstructs it.
 */
export function parseReplyAuthor(reply: InquiryReply): { name: string; isAdmin: boolean } {
  const match = reply.body?.match(/<b>([^:<]+):<\/b>/);
  const name = match ? match[1].trim() : (reply.author || '');
  const isAdmin = /miller|הנהלת/i.test(name);
  return { name, isAdmin };
}

export interface InquiryFile {
  id: string;
  name: string;
  url: string;       // public download URL
  thumbUrl: string;  // thumbnail URL (for images)
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
  files: InquiryFile[];
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
  fileCount?: number;
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
 * Upload a file (image/pdf/doc) as an attachment to an inquiry's Files column.
 * Monday's /v2/file endpoint blocks browser CORS, so we proxy the upload
 * through our own Vercel serverless function.
 */
export async function uploadFileToInquiry(inquiryId: string, file: File): Promise<void> {
  if (!inquiryId) throw new Error('No inquiryId — cannot attach file');

  const res = await fetch(`/api/inquiries/upload-file?inquiryId=${encodeURIComponent(inquiryId)}`, {
    method: 'POST',
    headers: {
      'Content-Type': file.type || 'application/octet-stream',
      'X-Filename': encodeURIComponent(file.name),
    },
    body: file,
  });

  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`File upload failed (${res.status}): ${body.slice(0, 200)}`);
  }
}

export async function uploadFilesToInquiry(inquiryId: string, files: File[]): Promise<void> {
  // Sequential to avoid rate-limiting Monday's API
  for (const f of files) {
    await uploadFileToInquiry(inquiryId, f);
  }
}

export async function resolveInquiry(inquiryId: string): Promise<{ ok: true }> {
  return fetchJson('/api/inquiries/resolve', {
    method: 'POST',
    body: JSON.stringify({ inquiryId }),
  });
}
