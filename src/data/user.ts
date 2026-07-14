export interface User {
  id: string;
  firstNameHe: string;
  lastNameHe: string;
  fullNameHe: string;
  initials: string;
  email: string;
  password: string;
  phone: string;
  investorSince: string;
  isAdmin: boolean;
  /** Set when logged in via Monday investor email+password */
  mondayInvestorId?: string;
}

export const MOCK_USER: User = {
  id: 'u1',
  firstNameHe: 'דוד',
  lastNameHe: 'לוי',
  fullNameHe: 'דוד לוי',
  initials: 'ד',
  email: 'david.levi@example.com',
  password: 'Miller2026!',
  phone: '+972-54-000-0000',
  investorSince: 'ינואר 2022',
  isAdmin: false,
};

// Admin credentials come from Vercel env vars (VITE_ADMIN_EMAIL / VITE_ADMIN_PASSWORD),
// not hardcoded. Note: VITE_ vars are still bundled into the client JS, so this keeps the
// password out of git and lets it be rotated without a redeploy — it does not truly hide it.
const ADMIN_EMAIL = (import.meta.env.VITE_ADMIN_EMAIL as string | undefined)?.trim() ?? '';
const ADMIN_PASSWORD = (import.meta.env.VITE_ADMIN_PASSWORD as string | undefined) ?? '';

export const ADMIN_USER: User = {
  id: 'admin',
  firstNameHe: 'הנהלת',
  lastNameHe: 'מילר גרופ',
  fullNameHe: 'הנהלת מילר גרופ',
  initials: 'מג',
  email: ADMIN_EMAIL,
  password: ADMIN_PASSWORD,
  phone: '+972-50-111-2222',
  investorSince: 'ינואר 2020',
  isAdmin: true,
};

// Only expose the admin login when both env vars are configured — otherwise an
// unset password would collapse to '' and match an empty password field.
export const ALL_USERS: User[] = [
  MOCK_USER,
  ...(ADMIN_EMAIL && ADMIN_PASSWORD ? [ADMIN_USER] : []),
];
