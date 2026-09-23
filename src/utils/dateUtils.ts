// Local YYYY-MM-DD. `Date.toISOString()` returns UTC, which rolls the
// date forward for users west of UTC in the evening.
export function getLocalDateString(now: Date = new Date()): string {
  const yyyy = now.getFullYear();
  const mm = String(now.getMonth() + 1).padStart(2, "0");
  const dd = String(now.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

export function isValidDateString(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}

export function getYearsInDateRange(startDate: string, endDate: string): string[] {
  if (!isValidDateString(startDate) || !isValidDateString(endDate) || startDate > endDate) return [];

  const startYear = Number(startDate.slice(0, 4));
  const endYear = Number(endDate.slice(0, 4));
  const years: string[] = [];
  for (let year = startYear; year <= endYear; year++) years.push(String(year));
  return years;
}

export function isDateInRange(date: string, startDate: string, endDate: string): boolean {
  return (
    isValidDateString(date) &&
    isValidDateString(startDate) &&
    isValidDateString(endDate) &&
    startDate <= date &&
    date <= endDate
  );
}
