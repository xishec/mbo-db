import type { DET, DETsByDateMap } from "../types";

const DET_KEY_SEPARATOR = "__";

export function normalizeDETProgramId(programId: string | null | undefined): string {
  return (programId ?? "").trim().toUpperCase();
}

export function isValidDETProgramId(programId: string | null | undefined): boolean {
  const normalized = normalizeDETProgramId(programId);
  return normalized !== "" && normalized !== "NONE";
}

export function getDETProgramKey(programId: string): string {
  return encodeURIComponent(normalizeDETProgramId(programId)).replace(/\./g, "%2E");
}

export function getDETEntriesForDate(DETsByDateMap: DETsByDateMap, date: string): Array<[string, DET]> {
  return Object.entries(DETsByDateMap[date] ?? {})
    .filter(([, det]) => isValidDETProgramId(det.programId))
    .sort(([, left], [, right]) =>
      normalizeDETProgramId(left.programId).localeCompare(normalizeDETProgramId(right.programId))
    );
}

export function findDETEntry(
  DETsByDateMap: DETsByDateMap,
  date: string,
  programId: string
): [string, DET] | undefined {
  if (!isValidDETProgramId(programId)) return undefined;
  const programKey = getDETProgramKey(programId);
  const exact = DETsByDateMap[date]?.[programKey];
  if (exact) return [programKey, exact];

  const normalizedProgramId = normalizeDETProgramId(programId);
  return getDETEntriesForDate(DETsByDateMap, date).find(
    ([, det]) => normalizeDETProgramId(det.programId) === normalizedProgramId
  );
}

export function getAllDETs(DETsByDateMap: DETsByDateMap): DET[] {
  return Object.values(DETsByDateMap)
    .flatMap((detsByProgram) => Object.values(detsByProgram ?? {}))
    .filter((det) => isValidDETProgramId(det.programId));
}

export function getDETDate(storageKey: string, det: Partial<DET> & { dt?: string }): string {
  return det.date || det.dt || storageKey.split(DET_KEY_SEPARATOR, 1)[0];
}
