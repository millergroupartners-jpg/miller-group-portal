interface MGLogoProps {
  size?: number;
  showWordmark?: boolean;
}

export function MGLogo({ size = 52, showWordmark: _showWordmark = true }: MGLogoProps) {
  // The SVG is landscape (1440×810) — use size as height, width auto
  const logoHeight = size * 2;
  return (
    <img
      src="/logo.svg?v=2"
      alt="Miller Group"
      style={{ height: logoHeight, width: 'auto', maxWidth: '100%', objectFit: 'contain' }}
    />
  );
}
