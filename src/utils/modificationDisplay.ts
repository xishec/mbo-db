const ROUTINE_EDITORS = new Set(["shawnasevigny@hotmail.com", "cindybouchard@outlook.com"]);

export function isNonRoutineEditor(email: string | undefined): boolean {
  return !email || !ROUTINE_EDITORS.has(email.toLowerCase());
}

export function formatModificationTimestamp(timestamp: string | undefined): string {
  const value = Number(timestamp);
  return Number.isFinite(value) ? new Date(value).toLocaleString() : "";
}
