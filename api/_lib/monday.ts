/**
 * Server-side Monday.com GraphQL client (for Vercel serverless functions).
 * Uses MONDAY_API_TOKEN or VITE_MONDAY_API_TOKEN from Vercel env vars.
 */

const MONDAY_API_URL = 'https://api.monday.com/v2';

export const INQUIRIES_BOARD_ID = Number((process.env.INQUIRIES_BOARD_ID || '5095120333').trim());

/** Column IDs on the Inquiries board (verified via API) */
export const INQ_COL = {
  investorId:    'text_mm2ne1dc',
  property:      'text_mm2nrcm4',
  investorEmail: 'text_mm2nwycm',
  status:        'color_mm2nbchk',  // status: New / In Progress / Resolved
  direction:     'dropdown_mm2najdk',
  investorName:  'text_mm2n4txd',
} as const;

export const INQ_STATUS = {
  NEW:        { label: 'New' },
  IN_PROGRESS:{ label: 'In Progress' },
  RESOLVED:   { label: 'Resolved' },
} as const;

export const INQ_DIRECTION = {
  INVESTOR_TO_ADMIN: 'Investor→Management',
  ADMIN_TO_INVESTOR: 'Management→Investor',
} as const;

function getToken(): string {
  const token = (process.env.MONDAY_API_TOKEN || process.env.VITE_MONDAY_API_TOKEN || '').trim();
  if (!token) throw new Error('Monday API token is not configured on the server');
  return token;
}

export async function mondayQuery<T>(query: string, variables?: object): Promise<T> {
  const res = await fetch(MONDAY_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: getToken(),
      'API-Version': '2024-01',
    },
    body: JSON.stringify({ query, variables }),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`Monday API HTTP ${res.status}: ${body}`);
  }
  const json = await res.json();
  if (json.errors?.length) throw new Error(json.errors[0].message);
  return json.data as T;
}

/** Escape user-provided strings for GraphQL literal insertion */
export function esc(s: string): string {
  return (s ?? '').replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\n/g, '\\n');
}

/** JSON-safe string for column_values: escape for double-encoded GraphQL JSON */
export function jsonEsc(s: string): string {
  return JSON.stringify(s ?? '').slice(1, -1); // strip outer quotes from JSON.stringify
}
