import type { VercelRequest, VercelResponse } from '@vercel/node';

export default function handler(_req: VercelRequest, res: VercelResponse) {
  res.status(200).json({
    ok: true,
    hasMondayToken: Boolean(process.env.MONDAY_API_TOKEN || process.env.VITE_MONDAY_API_TOKEN),
    hasGmailUser: Boolean(process.env.GMAIL_USER),
    hasGmailPass: Boolean(process.env.GMAIL_APP_PASSWORD),
    boardId: process.env.INQUIRIES_BOARD_ID || '(not set)',
    node: process.version,
  });
}
