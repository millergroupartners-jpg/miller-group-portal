import { useNavigation } from '../../context/NavigationContext';
import { useUser } from '../../context/UserContext';

/**
 * Fixed top strip shown while an admin is viewing the portal as an investor.
 * The single exit point back to the admin area — MobileTopActions' back-to-admin
 * button doesn't render during impersonation (isAdmin is false).
 */
export function ImpersonationBanner() {
  const { currentUser, impersonating, stopImpersonation } = useUser();
  const { resetTo } = useNavigation();

  if (!impersonating || !currentUser) return null;

  const exit = () => {
    const investorId = currentUser.mondayInvestorId;
    stopImpersonation();
    if (investorId) {
      resetTo('admin-investor-detail', { investorId });
    } else {
      resetTo('admin-investors');
    }
  };

  return (
    <div style={{
      position: 'fixed', top: 0, left: 0, right: 0, zIndex: 300,
      background: 'var(--gold-dim)',
      borderBottom: '1px solid var(--gold-border)',
      backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12,
      padding: '7px 12px', direction: 'rtl',
    }}>
      <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--gold-text)', display: 'flex', alignItems: 'center', gap: 7 }}>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
          <circle cx="12" cy="12" r="3" />
        </svg>
        צופה כ־{currentUser.fullNameHe}
      </span>
      <button
        onClick={exit}
        style={{
          background: 'transparent', border: '1px solid var(--gold-border)',
          color: 'var(--gold-text)', borderRadius: 100, padding: '3px 14px',
          fontSize: 11, fontWeight: 700, cursor: 'pointer', fontFamily: 'var(--font-ui)',
        }}
      >
        חזרה לאדמין
      </button>
    </div>
  );
}
