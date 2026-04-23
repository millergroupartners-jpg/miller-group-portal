import { useState } from 'react';
import { MGLogo } from '../common/MGLogo';
import { GoldDivider } from '../common/GoldDivider';
import { FOLDERS } from '../../data/documents';
import { useUser } from '../../context/UserContext';
import { useMondayData } from '../../context/MondayDataContext';
import { MOCK_USER } from '../../data/user';

const GOLD = '#C9A84C';

export function DocumentsScreen() {
  const { currentUser } = useUser();
  const { investors: mondayInvestors, properties: allProperties, mgProperties } = useMondayData();
  const user = currentUser ?? MOCK_USER;
  const [search, setSearch] = useState('');

  const mondayInvestor = user.mondayInvestorId
    ? mondayInvestors.find(inv => inv.mondayId === user.mondayInvestorId)
    : null;

  // Admin sees ALL properties (investor-owned + Miller Group own deals).
  // Investor sees only their own linked properties.
  const isAdmin = Boolean(user.isAdmin);
  const sourceProperties = isAdmin
    ? [...allProperties, ...mgProperties]
    : (mondayInvestor?.properties ?? []);

  const mondayFolders = sourceProperties
    .filter(p => p.docsUrl)
    .filter(p => !search
      || p.address.toLowerCase().includes(search.toLowerCase())
      || p.city.toLowerCase().includes(search.toLowerCase())
    );

  const isMondayMode = isAdmin || Boolean(mondayInvestor);

  // Static folders filtered by search
  const staticFolders = FOLDERS.filter(f =>
    !search || f.name.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: 'var(--bg-base)', overflow: 'hidden' }}>
      {/* Desktop title */}
      <div className="desktop-page-title">
        <div className="subtitle">חוזים, דוחות וקבצים</div>
        <h1>מסמכים</h1>
      </div>

      {/* Header */}
      <div className="screen-header" style={{ padding: '16px 20px 12px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
        <MGLogo size={36} showWordmark={false} />
        <span style={{ fontFamily: 'var(--font-ui)', fontSize: 22, fontWeight: 700, color: 'var(--text-primary)' }}>
          מסמכים
        </span>
      </div>

      <GoldDivider />

      {/* Search */}
      <div style={{ padding: '12px 20px', flexShrink: 0 }}>
        <div style={{ position: 'relative' }}>
          <input
            className="mg-input"
            placeholder="חיפוש לפי כתובת..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            style={{ paddingRight: 42 }}
          />
          <svg
            style={{ position: 'absolute', right: 14, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }}
            width="16" height="16" viewBox="0 0 24 24" fill="none"
            stroke="var(--search-icon)" strokeWidth="2" strokeLinecap="round"
          >
            <circle cx="11" cy="11" r="8" />
            <path d="M21 21l-4.35-4.35" />
          </svg>
        </div>
      </div>

      {/* Folder list */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '0 20px 12px' }}>

        {/* Monday mode: one row per property with Drive link */}
        {isMondayMode && (
          <div className="gold-card" style={{ overflow: 'hidden' }}>
            {mondayFolders.length === 0 && (
              <div style={{ padding: '20px', textAlign: 'center', color: 'var(--text-secondary)', fontSize: 13 }}>
                אין מסמכים זמינים
              </div>
            )}
            {mondayFolders.map((p, i) => (
              <a
                key={p.mondayId}
                href={p.docsUrl}
                target="_blank"
                rel="noopener noreferrer"
                style={{ textDecoration: 'none' }}
              >
                <div
                  className="doc-row"
                  style={{ borderBottom: i < mondayFolders.length - 1 ? '1px solid var(--divider)' : 'none' }}
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" strokeWidth="2" strokeLinecap="round">
                    <path d="M9 18l-6-6 6-6" />
                  </svg>
                  <div style={{ flex: 1, textAlign: 'right' }}>
                    <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 3 }}>{p.address}</div>
                    <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>{p.city} · Google Drive</div>
                  </div>
                  <div style={{
                    width: 40, height: 40, borderRadius: 10,
                    background: 'rgba(201,168,76,0.12)',
                    border: '1px solid rgba(201,168,76,0.2)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                  }}>
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={GOLD} strokeWidth="1.8" strokeLinecap="round">
                      <path d="M22 19a2 2 0 01-2 2H4a2 2 0 01-2-2V5a2 2 0 012-2h5l2 3h9a2 2 0 012 2z" />
                    </svg>
                  </div>
                </div>
              </a>
            ))}
          </div>
        )}

        {/* Static / demo mode */}
        {!isMondayMode && (
          <div className="gold-card" style={{ overflow: 'hidden' }}>
            {staticFolders.map((f, i) => (
              <div
                key={f.id}
                className="doc-row"
                style={{ borderBottom: i < staticFolders.length - 1 ? '1px solid var(--divider)' : 'none' }}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" strokeWidth="2" strokeLinecap="round">
                  <path d="M9 18l-6-6 6-6" />
                </svg>
                <div style={{ flex: 1, textAlign: 'right' }}>
                  <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 3 }}>{f.name}</div>
                  <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>{f.count} קבצים · עודכן {f.updated}</div>
                </div>
                <div style={{
                  width: 40, height: 40, borderRadius: 10,
                  background: 'rgba(201,168,76,0.12)',
                  border: '1px solid rgba(201,168,76,0.2)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                }}>
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={GOLD} strokeWidth="1.8" strokeLinecap="round">
                    <path d="M22 19a2 2 0 01-2 2H4a2 2 0 01-2-2V5a2 2 0 012-2h5l2 3h9a2 2 0 012 2z" />
                  </svg>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

    </div>
  );
}
