export const formatSpanDays = (days: number, shouldPad = true): string => {
  if (days <= 0) return "n/a";
  const years = Math.floor(days / 365);
  const remainderDays = days % 365;
  const parts: string[] = [];

  if (years > 0) {
    parts.push(`${years} year${years === 1 ? "" : "s"}`);
  }
  if (remainderDays > 0 || parts.length === 0) {
    const days = shouldPad ? String(remainderDays).padStart(3, "\u00A0") : String(remainderDays);
    parts.push(`${days} day${remainderDays === 1 ? "" : "s"}`);
  }

  return parts.join(" ");
};
