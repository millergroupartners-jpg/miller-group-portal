/** Time-of-day Hebrew greeting for the dashboard header. */
export function timeGreetingHe(d: Date = new Date()): string {
  const h = d.getHours();
  if (h >= 5 && h < 12) return 'בוקר טוב';
  if (h >= 12 && h < 17) return 'צהריים טובים';
  if (h >= 17 && h < 21) return 'ערב טוב';
  return 'לילה טוב';
}
