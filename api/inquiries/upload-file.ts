/**
 * POST /api/inquiries/upload-file?inquiryId=XXX
 *
 * Proxies a file upload from the browser to Monday's add_file_to_column mutation,
 * attaching the file to the inquiry item's "Files" column.
 * Monday's /v2/file endpoint blocks CORS from browsers, so we upload server-side.
 *
 * Client sends:
 *   - query param: inquiryId   (the Monday item ID)
 *   - header X-Filename: URL-encoded filename (supports Hebrew)
 *   - header Content-Type: the file's MIME type
 *   - body: raw file bytes
 *
 * Response: { id } on success, { error } on failure.
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { INQ_COL } from '../_lib/monday.js';

export const config = {
  api: {
    bodyParser: false, // we read the raw body ourselves
  },
};

function getToken(): string {
  const token = (process.env.MONDAY_API_TOKEN || process.env.VITE_MONDAY_API_TOKEN || '').trim();
  if (!token) throw new Error('Monday API token is not configured on the server');
  return token;
}

async function readBody(req: VercelRequest): Promise<Buffer> {
  const chunks: Buffer[] = [];
  for await (const chunk of req as any) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  return Buffer.concat(chunks);
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const inquiryId = (req.query.inquiryId as string) || '';
    if (!inquiryId) return res.status(400).json({ error: 'Missing inquiryId' });

    const rawFilename = (req.headers['x-filename'] as string) || 'file';
    const filename = (() => {
      try { return decodeURIComponent(rawFilename); } catch { return rawFilename; }
    })();
    const contentType = (req.headers['content-type'] as string) || 'application/octet-stream';

    const body = await readBody(req);
    if (body.length === 0) {
      return res.status(400).json({ error: 'Empty body' });
    }

    // Build multipart form for Monday — attach to the inquiry item's "Files" column
    const form = new FormData();
    const query = `mutation add_file($file: File!) {
      add_file_to_column(item_id: ${Number(inquiryId)}, column_id: "${INQ_COL.files}", file: $file) {
        id
      }
    }`;
    form.append('query', query);
    // Node 18+ has global File/Blob. Wrap the Buffer in a Uint8Array view so
    // TS 5.9 accepts it as a BlobPart (Buffer<ArrayBufferLike> isn't directly).
    const blob = new Blob([new Uint8Array(body.buffer, body.byteOffset, body.byteLength)], { type: contentType });
    form.append('variables[file]', blob, filename);

    const mondayRes = await fetch('https://api.monday.com/v2/file', {
      method: 'POST',
      headers: { Authorization: getToken() },
      body: form,
    });

    const json: any = await mondayRes.json().catch(() => null);
    if (!mondayRes.ok || !json) {
      return res.status(500).json({ error: `Monday HTTP ${mondayRes.status}`, body: json });
    }
    if (json.errors?.length) {
      return res.status(500).json({ error: json.errors[0].message, details: json.errors });
    }

    return res.status(200).json(json.data?.add_file_to_column ?? { ok: true });
  } catch (err: any) {
    console.error('upload-file error:', err);
    return res.status(500).json({ error: err?.message || 'Server error' });
  }
}
