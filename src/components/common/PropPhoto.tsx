const GOLD = '#C9A84C';

const PALETTES: [string, string, string][] = [
  ['#2a3a52', '#3d5a8a', '#1e2a3a'],
  ['#3a2a1e', '#5a3d2a', '#2a1e14'],
  ['#1e3a2a', '#2a5a3d', '#143d28'],
];

interface PropPhotoProps {
  index?: number;
  heightRatio?: number;
  photoUrl?: string | null;
}

export function PropPhoto({ index = 0, heightRatio = 56, photoUrl }: PropPhotoProps) {
  const [bg, accent, dark] = PALETTES[index % PALETTES.length];

  return (
    <div style={{ position: 'relative', width: '100%', paddingTop: `${heightRatio}%`, maxHeight: 220, background: bg, flexShrink: 0 }}>
      {photoUrl ? (
        <img
          src={photoUrl}
          alt=""
          style={{
            position: 'absolute', inset: 0,
            width: '100%', height: '100%',
            objectFit: 'cover', display: 'block',
          }}
        />
      ) : (
        <svg
          style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }}
          viewBox="0 0 320 180"
          preserveAspectRatio="xMidYMid slice"
        >
          <rect width="320" height="180" fill={bg} />
          <rect y="120" width="320" height="60" fill={dark} />
          <rect x="80" y="70" width="160" height="80" fill={accent} />
          <polygon points="65,70 160,20 255,70" fill={dark} />
          <rect x="100" y="85" width="35" height="30" rx="2" fill={bg} opacity="0.7" />
          <rect x="185" y="85" width="35" height="30" rx="2" fill={bg} opacity="0.7" />
          <rect x="143" y="110" width="34" height="40" rx="3" fill={dark} opacity="0.8" />
          <circle cx="170" cy="132" r="2.5" fill={GOLD} opacity="0.8" />
          <rect width="320" height="180" fill="black" opacity="0.2" />
          <line x1="0" y1="179" x2="320" y2="179" stroke={GOLD} strokeWidth="2" opacity="0.35" />
        </svg>
      )}
    </div>
  );
}
