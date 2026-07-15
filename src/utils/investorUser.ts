import type { User } from '../data/user';
import type { MondayInvestor } from '../services/mondayApi';

/** The subset of MondayInvestor needed to build a session User — the live
 *  email lookup returns this lighter shape, the full board fetch a superset. */
export type InvestorIdentity = Pick<MondayInvestor, 'mondayId' | 'fullName' | 'initials' | 'email' | 'phone' | 'investorSince'>;

/**
 * Builds the investor-shaped User used both by real investor logins
 * (LoginScreen) and by admin "view as investor" impersonation — the two must
 * stay identical so impersonation behaves exactly like a real session.
 */
export function mondayInvestorToUser(inv: InvestorIdentity): User {
  const nameParts = inv.fullName.trim().split(/\s+/);
  return {
    id: inv.mondayId,
    firstNameHe: nameParts[0] ?? inv.fullName,
    lastNameHe: nameParts.slice(1).join(' '),
    fullNameHe: inv.fullName,
    initials: inv.initials,
    email: inv.email,
    password: '',
    phone: inv.phone,
    investorSince: inv.investorSince,
    isAdmin: false,
    mondayInvestorId: inv.mondayId,
  };
}
