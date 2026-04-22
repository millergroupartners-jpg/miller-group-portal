import type { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(_req: VercelRequest, res: VercelResponse) {
  try {
    const token = process.env.MONDAY_API_TOKEN || process.env.VITE_MONDAY_API_TOKEN;
    if (!token) return res.status(500).json({ err: 'no token' });

    const r = await fetch('https://api.monday.com/v2', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: token.trim(),
        'API-Version': '2024-01',
      },
      body: JSON.stringify({ query: `query { me { id name email } }` }),
    });

    const json = await r.json();
    return res.status(200).json({ ok: true, status: r.status, json });
  } catch (e: any) {
    return res.status(500).json({ err: e?.message, stack: e?.stack });
  }
}
