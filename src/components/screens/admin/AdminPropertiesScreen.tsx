import { useState } from 'react';
import { useNavigation } from '../../../context/NavigationContext';
import { useMondayData } from '../../../context/MondayDataContext';
import { MGLogo } from '../../common/MGLogo';
import { StatusBadge } from '../../common/StatusBadge';
import { ProgressBar } from '../../common/ProgressBar';
import { PropPhoto } from '../../common/PropPhoto';
import { useCCThumbnail } from '../../../hooks/useCCThumbnail';
import type { MondayProperty } from '../../../services/mondayApi';

const GOLD = '#C9A84C';

const STATUS_FILTERS = ['הכל', 'על חוזה', 'בשלבי הלוואה וחתימות', 'בשיפוץ', 'מעבר לניהול', 'מרקט', 'מושכר'];

function Card({ p, i }: { p: MondayProperty; i: number }) {
  const thumb = useCCThumbnail(p.address);
  const { navigate } = useNavigation();
  return (
    <div className="gold-card" style={{ cursor: 'pointer' }} onClick={() => navigate('property-detail', { propertyId: p.mondayId })}>
      <div style={{ position: 'relative' }}>
        <PropPhoto index={i} heightRatio={48} photoUrl={thumb} />
        <div style={{
          position: 'absolute', bottom: 0, left: 0, right: 0,
          background: 'linear-gradient(transparent, rgba(0,0,0,0.75))',
          padding: '18px 12px 10px',
        }}>
          <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between' }}>
            <StatusBadge type={p.statusType}>{p.status}</StatusBadge>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: '#fff', lineHeight: 1.3 }}>{p.address}</div>
              <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.65)', marginTop: 2 }}>{p.city}</div>
            </div>
          </div>
        </div>
      </div>
      <div style={{ padding: '10px 14px 16px', display: 'flex', flexDirection: 'column', gap: 8 }}>
        {p.investorName && (
          <div style={{ fontSize: 11, color: GOLD, fontWeight: 600, textAlign: 'right' }}>
            👤 {p.investorName}
          </div>
        )}
        <div style={{ display: 'flex', gap: 8 }}>
          <div style={{ background: 'var(--bg-chip)', borderRadius: 10, padding: '8px 12px', flex: 1 }}>
            <div style={{ fontSize: 10, color: 'var(--text-secondary)', marginBottom: 3 }}>מחיר קנייה</div>
            <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)' }}>{p.purchasePrice}</div>
          </div>
          <div style={{ background: 'var(--bg-chip)', borderRadius: 10, padding: '8px 12px', flex: 1 }}>
            <div style={{ fontSize: 10, color: 'var(--text-secondary)', marginBottom: 3 }}>ARV</div>
            <div style={{ fontSize: 13, fontWeight: 700, color: GOLD }}>{p.arv}</div>
          </div>
          <div style={{ background: 'var(--bg-chip)', borderRadius: 10, padding: '8px 12px', flex: 1 }}>
            <div style={{ fontSize: 10, color: 'var(--text-secondary)', marginBottom: 3 }}>Equity</div>
            <div style={{ fontSize: 13, fontWeight: 700, color: '#4CAF50' }}>
              {p.arvRaw > 0 && p.allIn > 0 ? '$' + (p.arvRaw - p.allIn).toLocaleString('en-US') : '—'}
            </div>
          </div>
        </div>
        {p.statusType !== 'blue' && (
          <div style={{ marginTop: 2 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
              <span style={{ fontSize: 10, color: GOLD, fontWeight: 600 }}>{p.progress}%</span>
              <span style={{ fontSize: 10, color: 'var(--text-secondary)' }}>התקדמות</span>
            </div>
            <ProgressBar target={p.progress} height={8} />
          </div>
        )}
      </div>
    </div>
  );
}

export function AdminPropertiesScreen() {
  const { properties, loading } = useMondayData();
  const [statusFilter, setStatusFilter] = useState('הכל');
  const [search, setSearch] = useState('');

  const filtered = properties.filter(p => {
    if (statusFilter !== 'הכל' && p.status !== statusFilter) return false;
    if (search) {
      const s = search.toLowerCase();
      return p.address.toLowerCase().includes(s) ||
             p.city.toLowerCase().includes(s) ||
             (p.investorName ?? '').toLowerCase().includes(s);
    }
    return true;
  });

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: 'var(--bg-base)', overflow: 'hidden' }}>
      <div className="desktop-page-title">
        <div className="subtitle">{properties.length} עסקאות של משקיעים</div>
        <h1>נכסים</h1>
      </div>

      <div className="screen-header" style={{ padding: '16px 20px 10px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
        <MGLogo size={36} showWordmark={false} />
        <span style={{ fontSize: 20, fontWeight: 700, color: 'var(--text-primary)' }}>נכסים</span>
      </div>

      {/* Search */}
      <div style={{ padding: '12px 20px 0', flexShrink: 0 }}>
        <input
          className="mg-input"
          placeholder="חיפוש לפי כתובת, עיר או שם משקיע..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          style={{ fontSize: 14, padding: '10px 14px' }}
        />
      </div>

      {/* Status filter chips */}
      <div style={{ padding: '12px 20px 0', display: 'flex', gap: 6, overflowX: 'auto', flexShrink: 0 }}>
        {STATUS_FILTERS.map(status => (
          <button
            key={status}
            onClick={() => setStatusFilter(status)}
            style={{
              flexShrink: 0,
              padding: '6px 12px', borderRadius: 100,
              border: statusFilter === status ? 'none' : '1px solid var(--border)',
              background: statusFilter === status ? GOLD : 'var(--bg-chip)',
              color: statusFilter === status ? '#000' : 'var(--text-secondary)',
              fontSize: 11, fontWeight: 600, cursor: 'pointer',
              fontFamily: 'var(--font-ui)',
            }}
          >
            {status}
          </button>
        ))}
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: '14px 20px 20px' }}>
        {loading && <div style={{ textAlign: 'center', color: GOLD, fontSize: 13, padding: '40px 0' }}>⏳ טוען...</div>}
        {!loading && filtered.length === 0 && (
          <div style={{ textAlign: 'center', color: 'var(--text-secondary)', fontSize: 13, padding: '40px 0' }}>
            אין נכסים בסינון זה
          </div>
        )}
        <div className="property-grid" style={{ padding: 0 }}>
          {filtered.map((p, i) => <Card key={p.mondayId} p={p} i={i} />)}
        </div>
      </div>
    </div>
  );
}
