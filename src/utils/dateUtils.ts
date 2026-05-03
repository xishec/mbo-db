// Local YYYY-MM-DD. `Date.toISOString()` returns UTC, which rolls the
// date forward for users west of UTC in the evening.
export function getLocalDateString(now: Date = new Date()): string {
  const yyyy = now.getFullYear();
  const mm = String(now.getMonth() + 1).padStart(2, "0");
  const dd = String(now.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}
