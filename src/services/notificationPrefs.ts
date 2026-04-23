/**
 * Read/write the investor's email-notification opt-out preference on Monday.
 * Column: "Email Notifications" (boolean_mm2pee1j) on investors board 1997938105.
 * Semantics: checked = OPTED OUT (no emails). Unchecked / empty = enabled (default).
 */

const INVESTORS_BOARD_ID = 1997938105;
const OPTOUT_COLUMN_ID   = 'boolean_mm2pee1j';

async function mondayQuery<T>(query: string): Promise<T> {
  const token = import.meta.env.VITE_MONDAY_API_TOKEN as string;
  if (!token) throw new Error('Monday token missing');
  const res = await fetch('https://api.monday.com/v2', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: token, 'API-Version': '2024-01' },
    body: JSON.stringify({ query }),
  });
  if (!res.ok) throw new Error(`Monday HTTP ${res.status}`);
  const json = await res.json();
  if (json.errors?.length) throw new Error(json.errors[0].message);
  return json.data as T;
}

/** Returns true if the investor is OPTED OUT of email notifications. */
export async function getEmailOptOut(investorId: string): Promise<boolean> {
  if (!investorId) return false;
  const data = await mondayQuery<{ items: { column_values: { id: string; value: string | null }[] }[] }>(
    `query {
      items(ids: [${investorId}]) {
        column_values(ids: ["${OPTOUT_COLUMN_ID}"]) { id value }
      }
    }`,
  );
  const raw = data?.items?.[0]?.column_values?.[0]?.value ?? '';
  return /"checked":"?true"?/i.test(raw);
}

/** Set opt-out state (true = no emails, false = emails enabled). */
export async function setEmailOptOut(investorId: string, optedOut: boolean): Promise<void> {
  if (!investorId) throw new Error('Missing investorId');
  // Checkbox value format: {"checked":"true"} / {"checked":"false"}
  const value = optedOut ? '{\\"checked\\":\\"true\\"}' : '{\\"checked\\":\\"false\\"}';
  await mondayQuery(
    `mutation {
      change_column_value(
        board_id: ${INVESTORS_BOARD_ID},
        item_id: ${investorId},
        column_id: "${OPTOUT_COLUMN_ID}",
        value: "${value}"
      ) { id }
    }`,
  );
}
