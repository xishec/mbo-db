/** Format a time value consistently for display and native time inputs. */
export function formatTime(time: string | undefined | null): string {
  if (!time) return "";

  const match = time.trim().match(/^(\d{0,2}):(\d{1,2})$/);
  if (!match) return time;

  const hours = Number(match[1] || "0");
  const minutes = Number(match[2]);
  if (!Number.isInteger(hours) || !Number.isInteger(minutes) || hours < 0 || hours > 23 || minutes < 0 || minutes > 59)
    return time;

  return `${hours.toString().padStart(2, "0")}:${minutes.toString().padStart(2, "0")}`;
}
