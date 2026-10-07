/** "28 min", "1 hr 5 min". Empty when the length isn't known. */
export function formatLength(seconds: number): string {
  if (!(seconds > 0)) return "";
  const minutes = Math.max(1, Math.round(seconds / 60));
  if (minutes < 60) return `${minutes} min`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m === 0 ? `${h} hr` : `${h} hr ${m} min`;
}
