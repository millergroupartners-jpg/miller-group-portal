import { useNavigation } from '../../../context/NavigationContext';
import { useMondayData } from '../../../context/MondayDataContext';
import { StatusBadge } from '../../common/StatusBadge';
import { ProgressBar } from '../../common/ProgressBar';
import { PropPhoto } from '../../common/PropPhoto';
import { AdminTabBar } from './AdminTabBar';
import { INVESTORS, ALL_PROPERTIES } from '../../../data/investors';
import type { MondayInvestor, MondayProperty } from '../../../services/mondayApi';

const GOLD = '#C9A84C';

// ─── Unified property card (works for both Monday and static) ─────────────

function PropertyCard({ address, city, status, statusType, purchasePrice, arv, rentYield, allIn, progress, index }: {
  address: string; city: string; status: string; statusType: 'gold' | 'green' | 'blue';
  purchasePrice: string; arv: string; rentYield: string; allIn?: string;
  progress: number; index: number;
}) {
  return (
    <div className="gold-card">
      <div style={{ position: 'relative' }}>
        <PropPhoto index={index} heightRatio={38} />
        <div style={{
          position: 'absolute', bottom: 0, left: 0, right: 0,
          background: 'linear-gradient(transparent, rgba(0,0,0,0.75))',
          padding: '14px 12px 8px',
        }}>
          <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between' }}>
            <StatusBadge type={statusType}>{status}</StatusBadge>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: '#fff' }}>{address}</div>
              <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.65)' }}>{city}</div>
            </div>
          </div>
        </div>
      </div>
      <div style={{ padding: '10px 14px', display: 'flex', gap: 8 }}>
        <div style={{ background: 'var(--bg-chip)', borderRadius: 8, padding: '6px 10px', flex: 1 }}>
          <div style={{ fontSize: 9, color: 'var(--text-secondary)' }}>רכישה</div>
          <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-primary)' }}>{purchasePrice}</div>
        </div>
        <div style={{ background: 'var(--bg-chip)', borderRadius: 8, padding: '6px 10px', flex: 1 }}>
          <div style={{ fontSize: 9, color: 'var(--text-secondary)' }}>ARV</div>
          <div style={{ fontSize: 12, fontWeight: 700, color: GOLD }}>{arv}</div>
        </div>
        <div style={{ background: 'var(--bg-chip)', borderRadius: 8, padding: '6px 10px', flex: 1 }}>
          <div style={{ fontSize: 9, color: 'var(--text-secondary)' }}>תשואה</div>
          <div style={{ fontSize: 12, fontWeight: 700, color: GOLD }}>{rentYield}</div>
        </div>
      </div>
      {allIn && (
        <div style={{ padding: '0 14px 8px', display: 'flex', justifyContent: 'flex-end' }}>
          <span style={{ fontSize: 10, color: 'var(--text-secondary)' }}>
            All-in: <span style={{ color: 'var(--text-primary)', fontWeight: 600 }}>{allIn}</span>
          </span>
        </div>
      )}
      {statusType !== 'blue' && (
        <div style={{ padding: '0 14px 12px' }}>
          <ProgressBar target={progress} height={4} />
        </div>
      )}
    </div>
  );
}

// ─── Main screen ─────────────────────────────────────────────────────────

export function InvestorDetailScreen({ investorId }: { investorId: string }) {
  const { goBack, navigate } = useNavigation();
  const { investors: mondayInvestors, hasToken } = useMondayData();

  // Try to find a Monday investor first, then fall back to static
  const mondayInv: MondayInvestor | undefined = mondayInvestors.find(i => i.mondayId === investorId);
  const staticInv = INVESTORS.find(i => i.id === investorId);

  if (!mondayInv && !staticInv) return null;

  const isMonday = Boolean(mondayInv);

  // Unified fields
  const name           = isMonday ? mondayInv!.fullName : staticInv!.fullNameHe;
  const initials       = isMonday ? mondayInv!.initials : staticInv!.initials;
  const email          = isMonday ? mondayInv!.email : staticInv!.email;
  const phone          = isMonday ? mondayInv!.phone : staticInv!.phone;
  const investorSince  = isMonday ? mondayInv!.investorSince : staticInv!.investorSince;
  const totalInvested  = isMonday ? mondayInv!.totalInvested : staticInv!.totalInvested;
  const portfolioValue = isMonday ? mondayInv!.portfolioValue : staticInv!.portfolioValue;
  const avgYield       = isMonday ? mondayInv!.avgYield : staticInv!.avgYield;

  // Properties
  const mondayProps: MondayProperty[] = isMonday ? mondayInv!.properties : [];
  const staticProps = !isMonday ? ALL_PROPERTIES.filter(p => staticInv!.propertyIds.includes(p.id)) : [];

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: 'var(--bg-base)', overflow: 'hidden' }}>
      {/* Header */}
      <div style={{ padding: '16px 20px 12px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
        <button onClick={goBack} style={{ background: 'var(--bg-chip)', border: 'none', borderRadius: 10, padding: '8px 12px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, color: 'var(--text-primary)' }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
            <path d="M15 18l-6-6 6-6" />
          </svg>
          <span style={{ fontSize: 13 }}>חזרה</span>
        </button>
        <span style={{ fontFamily: 'var(--font-ui)', fontSize: 18, fontWeight: 700, color: 'var(--text-primary)' }}>פרופיל משקיע</span>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: '0 20px 16px' }}>

        {/* Investor profile card */}
        <div className="gold-card" style={{ padding: '18px', marginBottom: 14 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14, flexDirection: 'row-reverse', marginBottom: 14 }}>
            <div style={{
              width: 56, height: 56, borderRadius: '50%',
              background: 'linear-gradient(135deg, #C9A84C, #8a6a28)',
              display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
            }}>
              <span style={{ fontSize: 22, fontWeight: 700, color: '#000' }}>{initials}</span>
            </div>
            <div style={{ flex: 1, textAlign: 'right' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, justifyContent: 'flex-end' }}>
                <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--text-primary)' }}>{name}</div>
                {isMonday && (
                  <span style={{ fontSize: 9, background: 'rgba(201,168,76,0.2)', color: GOLD, borderRadius: 4, padding: '2px 6px', fontWeight: 700 }}>Monday</span>
                )}
              </div>
              {email && <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 2, direction: 'ltr', textAlign: 'right' }}>{email}</div>}
              {phone && <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 1 }}>{phone}</div>}
              {investorSince && <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 1 }}>משקיע מאז {investorSince}</div>}
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
            {[
              { label: 'השקעה כוללת',  value: totalInvested },
              { label: 'שווי תיק',     value: portfolioValue, gold: true },
              { label: 'תשואה ממוצעת', value: avgYield,       gold: true },
            ].map(s => (
              <div key={s.label} style={{ background: 'var(--bg-chip)', borderRadius: 10, padding: '10px 8px', textAlign: 'center' }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: s.gold ? GOLD : 'var(--text-primary)' }}>{s.value}</div>
                <div style={{ fontSize: 9, color: 'var(--text-secondary)', marginTop: 3 }}>{s.label}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Contact actions */}
        {(email || phone) && (
          <div style={{ display: 'flex', gap: 10, marginBottom: 14 }}>
            {[
              { icon: '📧', label: 'אימייל',  href: email ? `mailto:${email}` : undefined },
              { icon: '📱', label: 'שיחה',    href: phone ? `tel:${phone}` : undefined },
              { icon: '💬', label: 'הודעה',   href: phone ? `https://wa.me/${phone.replace(/\D/g,'')}` : undefined },
            ].map(a => (
              <a key={a.label} href={a.href} style={{
                flex: 1, background: 'var(--bg-chip)', border: '1px solid var(--border)',
                borderRadius: 12, padding: '10px 6px', cursor: 'pointer',
                display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4,
                textDecoration: 'none',
              }}>
                <span style={{ fontSize: 18 }}>{a.icon}</span>
                <span style={{ fontSize: 11, color: 'var(--text-secondary)', fontFamily: 'var(--font-ui)' }}>{a.label}</span>
              </a>
            ))}
          </div>
        )}

        {/* Properties header */}
        <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-secondary)', textAlign: 'right', marginBottom: 8 }}>
          נכסים ({isMonday ? mondayProps.length : staticProps.length})
        </div>

        {/* Monday properties */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {isMonday
            ? mondayProps.map((p, i) => (
                <PropertyCard
                  key={p.mondayId}
                  index={i}
                  address={p.address}
                  city={p.city}
                  status={p.status}
                  statusType={p.statusType}
                  purchasePrice={p.purchasePrice}
                  arv={p.arv}
                  rentYield={p.rentMonthly}
                  allIn={p.purchasePrice !== '—' ? '$' + p.allIn.toLocaleString('en-US') : undefined}
                  progress={p.progress}
                />
              ))
            : staticProps.map((p, i) => (
                <div
                  key={p.id}
                  onClick={() => navigate('property-detail', { propertyId: p.id })}
                  style={{ cursor: 'pointer' }}
                >
                  <PropertyCard
                    index={i}
                    address={p.address}
                    city={p.city}
                    status={p.status}
                    statusType={p.statusType}
                    purchasePrice={p.purchasePrice}
                    arv={p.arv}
                    rentYield={p.rentYield}
                    progress={p.progress}
                  />
                </div>
              ))
          }
        </div>

        {/* Add property to this investor */}
        <div style={{ marginTop: 14 }}>
          <button
            className="mg-btn"
            onClick={() => navigate('admin-add-property')}
            style={{ opacity: 0.85 }}
          >
            + הוסף נכס למשקיע זה
          </button>
        </div>

      </div>

      <AdminTabBar active="admin-investors" />
    </div>
  );
}
