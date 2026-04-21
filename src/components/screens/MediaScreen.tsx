import { useState, useEffect } from 'react';
import { MGLogo } from '../common/MGLogo';
import { GoldDivider } from '../common/GoldDivider';
import { BottomTabBar } from '../common/BottomTabBar';
import { useUser } from '../../context/UserContext';
import { useMondayData } from '../../context/MondayDataContext';
import { MOCK_USER } from '../../data/user';
import {
  fetchAllCCProjects,
  fetchCCPhotos,
  addressMatchesProject,
  type CCProject,
  type CCPhoto,
} from '../../services/companyCamApi';

const GOLD = '#C9A84C';

interface PropertyMedia {
  address: string;
  city: string;
  project: CCProject;
  photos: CCPhoto[];
}

function formatDate(ts: number): string {
  const d = new Date(ts * 1000);
  const months = ['ינואר','פברואר','מרץ','אפריל','מאי','יוני','יולי','אוגוסט','ספטמבר','אוקטובר','נובמבר','דצמבר'];
  return `${d.getDate()} ${months[d.getMonth()]} ${d.getFullYear()}`;
}

export function MediaScreen() {
  const { currentUser } = useUser();
  const { investors: mondayInvestors } = useMondayData();
  const user = currentUser ?? MOCK_USER;

  const mondayInvestor = user.mondayInvestorId
    ? mondayInvestors.find(inv => inv.mondayId === user.mondayInvestorId)
    : null;

  const [mediaList, setMediaList] = useState<PropertyMedia[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [lightbox, setLightbox] = useState<{ photo: CCPhoto; address: string } | null>(null);
  const [selectedProperty, setSelectedProperty] = useState<string | null>(null);

  useEffect(() => {
    if (!mondayInvestor) return;

    setLoading(true);
    setError('');

    (async () => {
      try {
        console.log('[MediaScreen] investor properties:', mondayInvestor.properties);
        console.log('[MediaScreen] CC token available:', Boolean(import.meta.env.VITE_COMPANYCAM_TOKEN));

        if (mondayInvestor.properties.length === 0) {
          setError('לא נמצאו נכסים מקושרים למשקיע זה');
          setLoading(false);
          return;
        }

        const allProjects = await fetchAllCCProjects();
        console.log('[MediaScreen] total CC projects fetched:', allProjects.length);

        // Match each property to a project
        const matched: PropertyMedia[] = [];
        for (const prop of mondayInvestor.properties) {
          console.log('[MediaScreen] trying to match:', prop.address);
          const project = allProjects.find(p => addressMatchesProject(prop.address, p));
          console.log('[MediaScreen] matched project:', project?.name ?? 'NONE');
          if (!project) continue;
          const photos = await fetchCCPhotos(project.id, 50);
          console.log('[MediaScreen] photos for', prop.address, ':', photos.length);
          matched.push({ address: prop.address, city: prop.city, project, photos });
        }
        setMediaList(matched);
        if (matched.length > 0) setSelectedProperty(matched[0].address);
      } catch (e: any) {
        console.error('[MediaScreen] error:', e);
        setError(`שגיאה בטעינת תמונות: ${e?.message ?? e}`);
      } finally {
        setLoading(false);
      }
    })();
  }, [mondayInvestor?.mondayId]);

  const activeMedia = mediaList.find(m => m.address === selectedProperty) ?? mediaList[0];

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: 'var(--bg-base)', overflow: 'hidden', position: 'relative' }}>
      {/* Header */}
      <div className="screen-header" style={{ padding: '16px 20px 12px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
        <MGLogo size={36} showWordmark={false} />
        <span style={{ fontFamily: 'var(--font-ui)', fontSize: 22, fontWeight: 700, color: 'var(--text-primary)' }}>
          עדכוני התקדמות
        </span>
      </div>

      <GoldDivider />

      {/* Property selector tabs */}
      {mediaList.length > 1 && (
        <div style={{ display: 'flex', gap: 8, padding: '10px 20px 0', overflowX: 'auto', flexShrink: 0 }}>
          {mediaList.map(m => (
            <button
              key={m.address}
              onClick={() => setSelectedProperty(m.address)}
              style={{
                flexShrink: 0,
                padding: '6px 14px',
                borderRadius: 20,
                border: selectedProperty === m.address ? 'none' : '1px solid var(--border)',
                background: selectedProperty === m.address ? GOLD : 'var(--bg-chip)',
                color: selectedProperty === m.address ? '#000' : 'var(--text-secondary)',
                fontSize: 11, fontWeight: 600, cursor: 'pointer',
                fontFamily: 'var(--font-ui)',
              }}
            >
              {m.address.split(',')[0]}
            </button>
          ))}
        </div>
      )}

      {/* Content */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '12px 20px' }}>

        {loading && (
          <div style={{ textAlign: 'center', paddingTop: 60, color: GOLD, fontSize: 13 }}>
            ⏳ טוען תמונות מ-CompanyCam...
          </div>
        )}

        {error && (
          <div style={{ textAlign: 'center', paddingTop: 60, color: '#ff4d4d', fontSize: 13 }}>
            {error}
          </div>
        )}

        {!loading && !error && !mondayInvestor && (
          <div style={{ textAlign: 'center', paddingTop: 60, color: 'var(--text-secondary)', fontSize: 13 }}>
            היכנס כמשקיע לצפות בתמונות
          </div>
        )}

        {!loading && !error && mondayInvestor && mediaList.length === 0 && (
          <div style={{ textAlign: 'center', paddingTop: 60, color: 'var(--text-secondary)', fontSize: 13 }}>
            לא נמצאו תמונות בCompanyCam עבור הנכסים שלך
          </div>
        )}

        {activeMedia && (
          <>
            {/* Property header */}
            <div style={{ marginBottom: 12, textAlign: 'right' }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)' }}>{activeMedia.address}</div>
              <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 2 }}>
                {activeMedia.city} · {activeMedia.photos.length} תמונות
              </div>
            </div>

            {/* Photos grouped by day */}
            {(() => {
              // Group photos by calendar date (YYYY-MM-DD key, newest day first)
              const groups = new Map<string, CCPhoto[]>();
              for (const photo of activeMedia.photos) {
                const d = new Date(photo.capturedAt * 1000);
                const key = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
                if (!groups.has(key)) groups.set(key, []);
                groups.get(key)!.push(photo);
              }
              // Sort groups newest first
              const sortedKeys = [...groups.keys()].sort((a, b) => b.localeCompare(a));

              return sortedKeys.map(key => (
                <div key={key} style={{ marginBottom: 20 }}>
                  {/* Day header */}
                  <div style={{
                    display: 'flex', alignItems: 'center', gap: 10,
                    marginBottom: 10, direction: 'rtl',
                  }}>
                    <span style={{ fontSize: 12, fontWeight: 700, color: GOLD, fontFamily: 'var(--font-ui)', whiteSpace: 'nowrap' }}>
                      {formatDate(groups.get(key)![0].capturedAt)}
                    </span>
                    <div style={{ flex: 1, height: 1, background: `${GOLD}33` }} />
                    <span style={{ fontSize: 11, color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
                      {groups.get(key)!.length} {groups.get(key)!.length === 1 ? 'תמונה' : 'תמונות'}
                    </span>
                  </div>

                  {/* Grid for this day */}
                  <div className="photo-grid">
                    {groups.get(key)!.map(photo => (
                      <div
                        key={photo.id}
                        className="photo-thumb"
                        style={{ position: 'relative', overflow: 'hidden', background: '#111' }}
                        onClick={() => setLightbox({ photo, address: activeMedia.address })}
                      >
                        <img
                          src={photo.thumb}
                          alt=""
                          style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                          loading="lazy"
                        />
                        {photo.isVideo && (
                          <div style={{
                            position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
                            background: 'rgba(0,0,0,0.3)',
                          }}>
                            <div style={{ width: 28, height: 28, borderRadius: '50%', background: 'rgba(255,255,255,0.85)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                              <svg width="10" height="12" viewBox="0 0 10 12" fill="#000"><polygon points="0,0 10,6 0,12"/></svg>
                            </div>
                          </div>
                        )}
                        {photo.tags.length > 0 && (
                          <div style={{
                            position: 'absolute', bottom: 4, left: 4,
                            background: 'rgba(0,0,0,0.6)', borderRadius: 4,
                            padding: '1px 5px', fontSize: 8, color: '#fff',
                          }}>
                            {photo.tags[0]}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              ));
            })()}

            {/* CompanyCam deep-link — videos only available there */}
            {activeMedia && (
              <a
                href={activeMedia.project.publicUrl}
                target="_blank"
                rel="noopener noreferrer"
                style={{ textDecoration: 'none', display: 'block', marginTop: 8, marginBottom: 12 }}
              >
                <div style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                  padding: '11px 0', borderRadius: 12,
                  border: `1px solid ${GOLD}44`,
                  background: `${GOLD}0D`,
                }}>
                  {/* Camera icon */}
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke={GOLD} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2z"/>
                    <circle cx="12" cy="13" r="4"/>
                  </svg>
                  <span style={{ fontSize: 12, fontWeight: 600, color: GOLD, fontFamily: 'var(--font-ui)' }}>
                    צפה בכל התוכן כולל סרטונים ב-CompanyCam
                  </span>
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke={GOLD} strokeWidth="2" strokeLinecap="round">
                    <path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6"/>
                    <polyline points="15 3 21 3 21 9"/>
                    <line x1="10" y1="14" x2="21" y2="3"/>
                  </svg>
                </div>
              </a>
            )}
          </>
        )}
      </div>

      <BottomTabBar active="media" />

      {/* Lightbox */}
      {lightbox && (
        <div
          onClick={() => setLightbox(null)}
          style={{
            position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.96)',
            zIndex: 999, display: 'flex', flexDirection: 'column',
            alignItems: 'center', justifyContent: 'center', gap: 14,
          }}
        >
          <button
            onClick={() => setLightbox(null)}
            style={{
              position: 'absolute', top: 52, right: 16,
              background: 'rgba(255,255,255,0.12)', border: 'none',
              color: '#fff', fontSize: 18, cursor: 'pointer',
              width: 34, height: 34, borderRadius: '50%',
            }}
          >
            ×
          </button>

          <img
            src={lightbox.photo.web}
            alt=""
            style={{ width: '90%', maxHeight: '65vh', objectFit: 'contain', borderRadius: 10, border: `1px solid ${GOLD}44` }}
            onClick={e => e.stopPropagation()}
          />

          {/* Meta */}
          <div style={{ textAlign: 'center', paddingBottom: 8 }}>
            <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.7)', marginBottom: 6 }}>
              {formatDate(lightbox.photo.capturedAt)} · {lightbox.address.split(',')[0]}
            </div>
            {lightbox.photo.tags.length > 0 && (
              <div style={{ display: 'flex', gap: 6, justifyContent: 'center', flexWrap: 'wrap' }}>
                {lightbox.photo.tags.map(tag => (
                  <span key={tag} style={{
                    background: `${GOLD}22`, border: `1px solid ${GOLD}44`,
                    borderRadius: 20, padding: '3px 10px',
                    fontSize: 11, color: GOLD,
                  }}>
                    {tag}
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
