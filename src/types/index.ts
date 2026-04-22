export type Theme = 'dark' | 'light';

export type Screen =
  | 'login'
  | 'dashboard'
  | 'property-detail'
  | 'documents'
  | 'media'
  | 'settings'
  | 'admin-dashboard'
  | 'admin-investors'
  | 'admin-investor-detail'
  | 'admin-properties'
  | 'admin-mg-deals'
  | 'admin-closings'
  | 'set-password';

export type BadgeType = 'gold' | 'green' | 'blue';

export interface PropertyUpdate {
  date: string;
  text: string;
  done: boolean;
}

export interface Property {
  id: string;
  address: string;
  city: string;
  status: string;
  statusType: BadgeType;
  purchasePrice: string;
  arv: string;
  progress: number;
  rentYield: string;
  renovCost: string;
  updates: PropertyUpdate[];
}

export interface DocumentFolder {
  id: string;
  name: string;
  count: number;
  updated: string;
}

export interface NavState {
  screen: Screen;
  selectedPropertyId: string | null;
  selectedInvestorId: string | null;
  investorName?: string;
  direction: 'forward' | 'back';
  /** When navigating to admin-closings from an alert, highlight these entries */
  highlightClosingMode?: 'week' | 'overdue';
}

export interface Investor {
  id: string;
  firstNameHe: string;
  lastNameHe: string;
  fullNameHe: string;
  initials: string;
  email: string;
  phone: string;
  investorSince: string;
  isAdmin: boolean;
  propertyIds: string[];
  totalInvested: string;
  portfolioValue: string;
  avgYield: string;
}
