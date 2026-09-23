import { db } from "./firebase-node";
import type { DETsByDateMap, ProgramsMap } from "../src/types";

const MAX_CLUSTER_GAP_DAYS = 90;
const DAY_MS = 24 * 60 * 60 * 1000;
type MigrationEnvironment = "alpha" | "prod";

interface InferredRange {
  startDate: string;
  endDate: string;
  sourceDateCount: number;
  excludedDateCount: number;
}

function getExpectedYears(programId: string): Set<number> {
  const years = new Set<number>();
  const fullYears = programId.match(/(?:19|20)\d{2}/g)?.map(Number) ?? [];
  for (const year of fullYears) years.add(year);

  if (fullYears.length === 1) {
    const shortRange = programId.match(/((?:19|20)\d{2})-(\d{2})(?!\d)/);
    if (shortRange) {
      const startYear = Number(shortRange[1]);
      let endYear = Math.floor(startYear / 100) * 100 + Number(shortRange[2]);
      if (endYear < startYear) endYear += 100;
      years.add(endYear);
    }
  }

  return years;
}

function daysBetween(left: string, right: string): number {
  return (Date.parse(`${right}T00:00:00Z`) - Date.parse(`${left}T00:00:00Z`)) / DAY_MS;
}

function splitIntoClusters(dates: string[]): string[][] {
  const clusters: string[][] = [];
  for (const date of dates) {
    const current = clusters.at(-1);
    if (!current || daysBetween(current.at(-1)!, date) > MAX_CLUSTER_GAP_DAYS) clusters.push([date]);
    else current.push(date);
  }
  return clusters;
}

function inferRange(programId: string, sourceDates: string[]): InferredRange | null {
  const uniqueDates = [...new Set(sourceDates)].sort();
  if (uniqueDates.length === 0) return null;

  const expectedYears = getExpectedYears(programId);
  const expectedDates =
    expectedYears.size > 0
      ? uniqueDates.filter((date) => expectedYears.has(Number(date.slice(0, 4))))
      : uniqueDates;
  if (expectedDates.length === 0) return null;

  const clusters = splitIntoClusters(expectedDates);
  if (expectedYears.size === 0 && clusters.length > 1) return null;

  clusters.sort((left, right) => {
    if (left.length !== right.length) return right.length - left.length;
    const leftSpan = daysBetween(left[0], left.at(-1)!);
    const rightSpan = daysBetween(right[0], right.at(-1)!);
    return rightSpan - leftSpan || right.at(-1)!.localeCompare(left.at(-1)!);
  });
  const selected = clusters[0];

  return {
    startDate: selected[0],
    endDate: selected.at(-1)!,
    sourceDateCount: selected.length,
    excludedDateCount: uniqueDates.length - selected.length,
  };
}

async function main(): Promise<void> {
  const shouldApply = process.argv.includes("--apply");
  const environmentFlagIndex = process.argv.indexOf("--environment");
  const environment = process.argv[environmentFlagIndex + 1] as MigrationEnvironment | undefined;
  if (environment !== "alpha" && environment !== "prod") {
    throw new Error("Specify --environment alpha or --environment prod");
  }
  const [programsSnapshot, detsSnapshot] = await Promise.all([
    db.ref(`${environment}/programsMap`).once("value"),
    db.ref(`${environment}/DETsByDateMap`).once("value"),
  ]);

  const programs = (programsSnapshot.val() ?? {}) as ProgramsMap;
  const detsByDateMap = (detsSnapshot.val() ?? {}) as DETsByDateMap;
  const datesByProgram = new Map<string, string[]>();

  for (const [date, detsByProgram] of Object.entries(detsByDateMap)) {
    for (const det of Object.values(detsByProgram ?? {})) {
      const programId = det?.programId?.trim();
      if (!programId) continue;
      const dates = datesByProgram.get(programId) ?? [];
      dates.push(date);
      datesByProgram.set(programId, dates);
    }
  }

  const proposals = new Map<string, InferredRange>();
  const skippedExisting: string[] = [];
  const skippedAmbiguous: string[] = [];
  const skippedInvalidKey: string[] = [];

  for (const [programId, dates] of [...datesByProgram].sort(([left], [right]) => left.localeCompare(right))) {
    const existing = programs[programId];
    if (existing?.startDate && existing.endDate) {
      skippedExisting.push(programId);
      continue;
    }
    if ([".", "#", "$", "[", "]", "/"].some((character) => programId.includes(character))) {
      skippedInvalidKey.push(programId);
      continue;
    }

    const inferred = inferRange(programId, dates);
    if (!inferred) skippedAmbiguous.push(programId);
    else proposals.set(programId, inferred);
  }

  const adjusted = [...proposals].filter(([, range]) => range.excludedDateCount > 0);
  console.log(`Environment: ${environment}`);
  console.log(`Proposed ranges: ${proposals.size}`);
  console.log(`Already dated (unchanged): ${skippedExisting.length}`);
  console.log(`Ambiguous (skipped): ${skippedAmbiguous.length}`);
  console.log(`Invalid Firebase key (skipped): ${skippedInvalidKey.length}`);
  if (adjusted.length > 0) {
    console.log("\nRanges with outlier dates excluded:");
    for (const [programId, range] of adjusted) {
      console.log(
        `  ${programId}: ${range.startDate} to ${range.endDate} ` +
          `(${range.sourceDateCount} dates used, ${range.excludedDateCount} excluded)`
      );
    }
  }
  if (skippedAmbiguous.length > 0) console.log(`\nAmbiguous programs: ${skippedAmbiguous.join(", ")}`);
  if (skippedInvalidKey.length > 0) console.log(`\nInvalid-key programs: ${skippedInvalidKey.join(", ")}`);

  if (!shouldApply) {
    console.log("\nDry run only. Re-run with --apply to write these ranges.");
    return;
  }

  const lastModified = Date.now();
  const updates: Record<string, string | number> = {
    [`${environment}/metadata/lastModified_programsMap`]: lastModified,
  };
  for (const [programId, range] of proposals) {
    updates[`${environment}/programsMap/${programId}/id`] = programId;
    updates[`${environment}/programsMap/${programId}/displayName`] = programs[programId]?.displayName || programId;
    updates[`${environment}/programsMap/${programId}/startDate`] = range.startDate;
    updates[`${environment}/programsMap/${programId}/endDate`] = range.endDate;
  }
  await db.ref().update(updates);

  const verificationSnapshot = await db.ref(`${environment}/programsMap`).once("value");
  const savedPrograms = (verificationSnapshot.val() ?? {}) as ProgramsMap;
  const verified = [...proposals].filter(
    ([programId, range]) =>
      savedPrograms[programId]?.startDate === range.startDate && savedPrograms[programId]?.endDate === range.endDate
  ).length;
  if (verified !== proposals.size) throw new Error(`Verified ${verified} of ${proposals.size} program ranges`);

  console.log(`\nApplied and verified ${verified} program ranges in ${environment}.`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("Program date-range migration failed:", error);
    process.exit(1);
  });
