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

export const ADMIN_USER: User = {
  id: 'admin',
  firstNameHe: 'רון',
  lastNameHe: 'מילר',
  fullNameHe: 'רון מילר',
  initials: 'ר',
  email: 'admin@millergroup.com',
  password: 'Admin2026!',
  phone: '+972-50-111-2222',
  investorSince: 'ינואר 2020',
  isAdmin: true,
};

export const ALL_USERS: User[] = [MOCK_USER, ADMIN_USER];
