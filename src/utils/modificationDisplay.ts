import type { BirdEvent } from "../types";

const ROUTINE_EDITORS = new Set(["shawnasevigny@hotmail.com", "cindybouchard@outlook.com"]);

const CHANGED_FIELD_LABELS: Array<[keyof BirdEvent, string]> = [
  ["programId", "Program"],
  ["species", "Species"],
  ["wing", "Wing"],
  ["age", "Age"],
  ["howAged", "How Aged"],
  ["sex", "Sex"],
  ["howSexed", "How Sexed"],
  ["fat", "Fat"],
  ["weight", "Weight"],
  ["date", "Date"],
  ["time", "Time"],
  ["bander", "Bander"],
  ["scribe", "Scribe"],
  ["net", "Net"],
  ["location", "Location"],
  ["birdEventType", "Event Type"],
  ["birdStatus", "Bird Status"],
  ["notes", "Notes"],
  ["reminder", "Reminder"],
];

export function isNonRoutineEditor(email: string | undefined): boolean {
  return !email || !ROUTINE_EDITORS.has(email.toLowerCase());
}

export function formatModificationTimestamp(timestamp: string | undefined): string {
  const value = Number(timestamp);
  return Number.isFinite(value) ? new Date(value).toLocaleString() : "";
}

export function getChangedBirdEventFields(event: BirdEvent, previousEvent: BirdEvent | undefined): string[] {
  if (!event.previousEventId) return [];
  if (!previousEvent) return [];

  const changedFields = CHANGED_FIELD_LABELS
    .filter(([field]) => (event[field] ?? "") !== (previousEvent[field] ?? ""))
    .map(([, label]) => label);
  const bandChanged =
    event.band.bandPrefix !== previousEvent.band.bandPrefix ||
    event.band.bandSuffix !== previousEvent.band.bandSuffix ||
    (event.band.bandSize ?? null) !== (previousEvent.band.bandSize ?? null);

  return bandChanged ? ["Band", ...changedFields] : changedFields;
}
