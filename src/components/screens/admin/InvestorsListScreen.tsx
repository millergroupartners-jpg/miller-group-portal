import { useNavigation } from '../../../context/NavigationContext';
import { useMondayData } from '../../../context/MondayDataContext';
import { MGLogo } from '../../common/MGLogo';
import { GoldDivider } from '../../common/GoldDivider';
import { AdminTabBar } from './AdminTabBar';
import { INVESTORS } from '../../../data/investors'; // fallback
import { useState } from 'react';

const GOLD = '#C9A84C';

export function InvestorsListScreen() {
  const { navigate } = useNavigation();
  const { investors: mondayInvestors, loading, error, hasToken } = useMondayData();
  const [search, setSearch] = useState('');

  // Choose data source
  const liveMode = hasToken && (mondayInvestors.length > 0 || loading);

  // Unified investor shape for rendering
  const displayInvestors = liveMode
    ? mondayInvestors.map(inv => ({
        id: inv.mondayId,
        name: inv.fullName,
        initials: inv.initials,
        email: inv.email,
        propCount: inv.properties.length,
        portfolioValue: inv.portfolioValue,
        avgYield: inv.avgYield,
      }))
    : INVESTORS.map(inv => ({
        id: inv.id,
        name: inv.fullNameHe,
        initials: inv.initials,
        email: inv.email,
        propCount: inv.propertyIds.length,
        portfolioValue: inv.portfolioValue,
        avgYield: inv.avgYield,
      }));

  const filtered = displayInvestors.filter(inv =>
    inv.name.toLowerCase().includes(search.toLowerCase()) ||
    inv.email.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: 'var(--bg-base)', overflow: 'hidden' }}>
      {/* Header */}
      <div style={{ padding: '16px 20px 12px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <MGLogo size={36} showWordmark={false} />
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontFamily: 'var(--font-ui)', fontSize: 22, fontWeight: 700, color: 'var(--text-primary)' }}>משקיעים</span>
          <div style={{ background: 'var(--bg-chip)', borderRadius: 100, padding: '2px 10px', display: 'flex', alignItems: 'center', gap: 4 }}>
            <span style={{ fontSize: 12, fontWeight: 700, color: GOLD }}>{displayInvestors.length}</span>
            {liveMode && <span style={{ fontSize: 9, color: GOLD }}>●</span>}
          </div>
        </div>
      </div>
      <GoldDivider />

      {/* Loading / error */}
      {loading && (
        <div style={{ textAlign: 'center', padding: '8px 20px', color: 'var(--text-secondary)', fontSize: 12, flexShrink: 0 }}>
          ⏳ טוען נתוני Monday...
        </div>
      )}
      {error && (
        <div style={{ padding: '6px 20px', fontSize: 12, color: '#ff3b30', textAlign: 'right', flexShrink: 0 }}>{error}</div>
      )}

      {/* Search */}
      <div style={{ padding: '12px 20px', flexShrink: 0 }}>
        <div style={{ position: 'relative' }}>
          <input
            className="mg-input"
            placeholder="חיפוש לפי שם..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            style={{ paddingRight: 42 }}
          />
          <svg style={{ position: 'absolute', right: 14, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }}
            width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--search-icon)" strokeWidth="2" strokeLinecap="round">
            <circle cx="11" cy="11" r="8" /><path d="M21 21l-4.35-4.35" />
          </svg>
        </div>
      </div>

      {/* Add investor button */}
      <div style={{ padding: '0 20px 12px', flexShrink: 0 }}>
        <button
          className="mg-btn"
          onClick={() => navigate('admin-add-investor')}
          style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#000" strokeWidth="2.5" strokeLinecap="round">
            <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
          </svg>
          הוסף משקיע חדש
        </button>
      </div>

      {/* Investor list */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '0 20px 12px' }}>
        {filtered.length === 0 ? (
          <div style={{ textAlign: 'center', color: 'var(--text-muted)', paddingTop: 40, fontSize: 14 }}>
            {loading ? '' : 'לא נמצאו תוצאות'}
          </div>
        ) : (
          <div className="gold-card" style={{ overflow: 'hidden' }}>
            {filtered.map((inv, i) => (
              <div
                key={inv.id}
                onClick={() => navigate('admin-investor-detail', { investorId: inv.id })}
                style={{
                  display: 'flex', alignItems: 'center', gap: 12, padding: '14px 16px',
                  borderBottom: i < filtered.length - 1 ? '1px solid var(--divider)' : 'none',
                  cursor: 'pointer', flexDirection: 'row-reverse',
                }}
                onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.background = 'var(--bg-surface-hover)'; }}
                onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.background = 'transparent'; }}
              >
                <div style={{
                  width: 44, height: 44, borderRadius: '50%',
                  background: 'linear-gradient(135deg, #C9A84C, #8a6a28)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                }}>
                  <span style={{ fontSize: 17, fontWeight: 700, color: '#000' }}>{inv.initials}</span>
                </div>
                <div style={{ flex: 1, textAlign: 'right' }}>
                  <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>{inv.name}</div>
                  {inv.email && (
                    <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 2, direction: 'ltr', textAlign: 'right' }}>{inv.email}</div>
                  )}
                  <div style={{ display: 'flex', gap: 8, marginTop: 5, justifyContent: 'flex-end' }}>
                    <span style={{ fontSize: 10, background: 'var(--bg-chip)', borderRadius: 6, padding: '2px 8px', color: 'var(--text-secondary)' }}>
                      {inv.propCount} נכסים
                    </span>
                    <span style={{ fontSize: 10, background: 'rgba(201,168,76,0.12)', borderRadius: 6, padding: '2px 8px', color: GOLD, fontWeight: 600 }}>
                      {inv.portfolioValue}
                    </span>
                    {inv.avgYield !== '—' && (
                      <span style={{ fontSize: 10, background: 'rgba(52,199,89,0.1)', borderRadius: 6, padding: '2px 8px', color: '#34c759', fontWeight: 600 }}>
                        {inv.avgYield}
                      </span>
                    )}
                  </div>
                </div>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" strokeWidth="2" strokeLinecap="round">
                  <path d="M9 18l-6-6 6-6" />
                </svg>
              </div>
            ))}
          </div>
        )}
      </div>

      <AdminTabBar active="admin-investors" />
    </div>
  );
}
