// Shared invite-message builders — used by InvestorDetailScreen and the
// quick actions on the investors list. Keep the wording in sync with what
// investors actually receive.

interface InviteInvestor {
  fullName: string;
  email: string;
  password: string;
  phone?: string;
}

export function buildInviteUrl(email: string): string {
  const origin = typeof window !== 'undefined' ? window.location.origin : 'https://miller-group-portal.vercel.app';
  return `${origin}/?email=${encodeURIComponent(email)}`;
}

export function buildInviteMessage(inv: InviteInvestor): string {
  return `שלום ${inv.fullName},\n\nברוך הבא לפורטל המשקיעים של Miller Group.\nכנס לקישור: ${buildInviteUrl(inv.email)}\nסיסמה: ${inv.password || '(יוגדר ע״י המנהל)'}`;
}

function whatsappBody(inv: InviteInvestor): string {
  return encodeURIComponent(`שלום ${inv.fullName},\nברוך הבא לפורטל המשקיעים של Miller Group 👋\n\n🔗 ${buildInviteUrl(inv.email)}\n🔑 סיסמה: ${inv.password || '(צור קשר)'}`);
}

/** Empty string when the investor has no usable phone. */
export function buildWhatsAppInviteUrl(inv: InviteInvestor): string {
  const phoneClean = (inv.phone ?? '').replace(/[^0-9+]/g, '');
  return phoneClean ? `https://wa.me/${phoneClean.replace(/^\+/, '')}?text=${whatsappBody(inv)}` : '';
}

/** Empty string when the investor has no email. */
export function buildMailtoInviteUrl(inv: InviteInvestor): string {
  return inv.email
    ? `mailto:${inv.email}?subject=${encodeURIComponent('פורטל המשקיעים - Miller Group')}&body=${whatsappBody(inv)}`
    : '';
}
