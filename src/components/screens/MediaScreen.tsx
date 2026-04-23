import { useState, useEffect, useRef } from 'react';
import { MGLogo } from '../common/MGLogo';
import { GoldDivider } from '../common/GoldDivider';
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
  const { investors: mondayInvestors, properties: allProperties, mgProperties } = useMondayData();
  const user = currentUser ?? MOCK_USER;
  const isAdmin = Boolean(user.isAdmin);

  const mondayInvestor = user.mondayInvestorId
    ? mondayInvestors.find(inv => inv.mondayId === user.mondayInvestorId)
    : null;

  // Admin sees ALL properties; investor sees only their linked ones.
  const sourceProperties = isAdmin
    ? [...allProperties, ...mgProperties]
    : (mondayInvestor?.properties ?? []);

  const [mediaList, setMediaList] = useState<PropertyMedia[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
  const [selectedProperty, setSelectedProperty] = useState<string | null>(null);
  const touchStartX = useRef<number | null>(null);

  useEffect(() => {
    if (sourceProperties.length === 0) {
      if (!isAdmin && !mondayInvestor) return; // investor not loaded yet
      if (sourceProperties.length === 0) {
        setError(isAdmin ? 'לא נמצאו נכסים במערכת' : 'לא נמצאו נכסים מקושרים למשקיע זה');
        return;
      }
    }

    setLoading(true);
    setError('');

    (async () => {
      try {
        const allProjects = await fetchAllCCProjects();

        // Match each property to a project
        const matched: PropertyMedia[] = [];
        for (const prop of sourceProperties) {
          const project = allProjects.find(p => addressMatchesProject(prop.address, p));
          if (!project) continue;
          const photos = await fetchCCPhotos(project.id, 50);
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
  }, [isAdmin, mondayInvestor?.mondayId, sourceProperties.length]);

  const activeMedia = mediaList.find(m => m.address === selectedProperty) ?? mediaList[0];

  // Lightbox navigation
  const closeLightbox = () => setLightboxIndex(null);
  const nextPhoto = () => {
    if (!activeMedia || lightboxIndex === null) return;
    setLightboxIndex((lightboxIndex + 1) % activeMedia.photos.length);
  };
  const prevPhoto = () => {
    if (!activeMedia || lightboxIndex === null) return;
    setLightboxIndex((lightboxIndex - 1 + activeMedia.photos.length) % activeMedia.photos.length);
  };

  // Keyboard navigation when lightbox open
  useEffect(() => {
    if (lightboxIndex === null) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeLightbox();
      // RTL-aware: ArrowLeft goes forward visually, ArrowRight goes back
      else if (e.key === 'ArrowLeft') nextPhoto();
      else if (e.key === 'ArrowRight') prevPhoto();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [lightboxIndex, activeMedia?.photos.length]);

  const lightboxPhoto = (lightboxIndex !== null && activeMedia) ? activeMedia.photos[lightboxIndex] : null;

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: 'var(--bg-base)', overflow: 'hidden', position: 'relative' }}>
      {/* Desktop title */}
      <div className="desktop-page-title">
        <div className="subtitle">תיעוד חזותי של ההתקדמות</div>
        <h1>עדכוני התקדמות</h1>
      </div>

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

        {!loading && !error && !isAdmin && !mondayInvestor && (
          <div style={{ textAlign: 'center', paddingTop: 60, color: 'var(--text-secondary)', fontSize: 13 }}>
            היכנס כמשקיע לצפות בתמונות
          </div>
        )}

        {!loading && !error && (isAdmin || mondayInvestor) && mediaList.length === 0 && (
          <div style={{ textAlign: 'center', paddingTop: 60, color: 'var(--text-secondary)', fontSize: 13 }}>
            {isAdmin
              ? 'לא נמצאו תמונות בCompanyCam עבור נכסי המערכת'
              : 'לא נמצאו תמונות בCompanyCam עבור הנכסים שלך'}
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
                        onClick={() => setLightboxIndex(activeMedia.photos.findIndex(p => p.id === photo.id))}
                      >
                        <img
                          src={photo.web || photo.thumb}
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
                            position: 'absolute', bottom: 4, left: 4, right: 4,
                            display: 'flex', gap: 3, flexWrap: 'wrap',
                          }}>
                            {photo.tags.slice(0, 3).map(tag => (
                              <span key={tag} style={{
                                background: 'rgba(0,0,0,0.7)',
                                border: `1px solid ${GOLD}66`,
                                borderRadius: 4,
                                padding: '2px 6px',
                                fontSize: 9,
                                fontWeight: 600,
                                color: GOLD,
                                lineHeight: 1.2,
                              }}>
                                {tag}
                              </span>
                            ))}
                            {photo.tags.length > 3 && (
                              <span style={{
                                background: 'rgba(0,0,0,0.7)',
                                borderRadius: 4, padding: '2px 6px',
                                fontSize: 9, color: '#fff', lineHeight: 1.2,
                              }}>
                                +{photo.tags.length - 3}
                              </span>
                            )}
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


      {/* Lightbox */}
      {lightboxPhoto && activeMedia && (
        <div
          onClick={closeLightbox}
          onTouchStart={e => { touchStartX.current = e.touches[0].clientX; }}
          onTouchEnd={e => {
            if (touchStartX.current === null) return;
            const dx = e.changedTouches[0].clientX - touchStartX.current;
            touchStartX.current = null;
            if (Math.abs(dx) < 50) return;
            // RTL-aware swipe: swipe right → prev, swipe left → next
            if (dx > 0) prevPhoto();
            else nextPhoto();
          }}
          style={{
            position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.96)',
            zIndex: 999, display: 'flex', flexDirection: 'column',
            alignItems: 'center', justifyContent: 'center', gap: 14,
          }}
        >
          {/* Close */}
          <button
            onClick={e => { e.stopPropagation(); closeLightbox(); }}
            style={{
              position: 'absolute', top: 24, right: 24,
              background: 'rgba(255,255,255,0.12)', border: 'none',
              color: '#fff', fontSize: 22, cursor: 'pointer',
              width: 40, height: 40, borderRadius: '50%',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              zIndex: 2,
            }}
          >×</button>

          {/* Counter */}
          <div style={{
            position: 'absolute', top: 32, left: 24,
            fontSize: 13, color: 'rgba(255,255,255,0.7)', fontFamily: 'var(--font-ui)',
            zIndex: 2,
          }}>
            {(lightboxIndex ?? 0) + 1} / {activeMedia.photos.length}
          </div>

          {/* Prev (right side in RTL visually, but navigates backward) */}
          <button
            onClick={e => { e.stopPropagation(); prevPhoto(); }}
            style={{
              position: 'absolute', top: '50%', right: 16, transform: 'translateY(-50%)',
              background: 'rgba(255,255,255,0.12)', border: 'none', color: '#fff',
              width: 44, height: 44, borderRadius: '50%', cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              zIndex: 2,
            }}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="9 18 15 12 9 6" />
            </svg>
          </button>

          {/* Next */}
          <button
            onClick={e => { e.stopPropagation(); nextPhoto(); }}
            style={{
              position: 'absolute', top: '50%', left: 16, transform: 'translateY(-50%)',
              background: 'rgba(255,255,255,0.12)', border: 'none', color: '#fff',
              width: 44, height: 44, borderRadius: '50%', cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              zIndex: 2,
            }}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="15 18 9 12 15 6" />
            </svg>
          </button>

          <img
            src={lightboxPhoto.original || lightboxPhoto.web}
            alt=""
            style={{ width: '85%', maxWidth: 1100, maxHeight: '70vh', objectFit: 'contain', borderRadius: 10, border: `1px solid ${GOLD}44` }}
            onClick={e => e.stopPropagation()}
          />

          {/* Meta */}
          <div style={{ textAlign: 'center', paddingBottom: 8, maxWidth: '90%' }} onClick={e => e.stopPropagation()}>
            <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.7)', marginBottom: 8 }}>
              {formatDate(lightboxPhoto.capturedAt)} · {activeMedia.address.split(',')[0]}
            </div>
            {lightboxPhoto.tags.length > 0 && (
              <div style={{ display: 'flex', gap: 6, justifyContent: 'center', flexWrap: 'wrap' }}>
                {lightboxPhoto.tags.map(tag => (
                  <span key={tag} style={{
                    background: `${GOLD}22`, border: `1px solid ${GOLD}44`,
                    borderRadius: 20, padding: '4px 12px',
                    fontSize: 11, fontWeight: 600, color: GOLD,
                    fontFamily: 'var(--font-ui)',
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
