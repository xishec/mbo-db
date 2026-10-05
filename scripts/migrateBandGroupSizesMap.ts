import { ServerValue } from "firebase-admin/database";
import { db } from "./firebase-node";

const args = new Set(process.argv.slice(2));
const environmentArg = [...args].find((arg) => arg.startsWith("--env="));
const environment = environmentArg?.slice("--env=".length);
const apply = args.has("--apply");
const verbose = args.has("--verbose");

if (environment !== "alpha" && environment !== "prod") {
  throw new Error("Specify --env=alpha or --env=prod. Add --apply to write resolved entries.");
}

const VALID_SIZES = new Set(["0a", "0", "1", "1b", "1a", "1d", "2", "3", "3b", "3a"]);
type StoredEvent = {
  birdEventType?: string;
  modifiedEventId?: string | null;
  species?: string;
  band?: { bandPrefix?: string; bandSuffix?: string; bandSize?: string | null };
};

function getBandGroupKey(event: StoredEvent): string | null {
  const prefix = event.band?.bandPrefix;
  const suffix = event.band?.bandSuffix;
  if (!prefix || !suffix || suffix.length < 5) return null;
  const group = `${prefix}${suffix.slice(0, 3)}`;
  if (suffix.slice(-2) !== "00") return group;
  const previous = Number(group) - 1;
  return Number.isFinite(previous) ? String(previous).padStart(7, "0") : null;
}

async function main() {
  const [eventsSnapshot, mapSnapshot] = await Promise.all([
    db.ref(`${environment}/birdEventsMap`).once("value"),
    db.ref(`${environment}/bandGroupSizesMap`).once("value"),
  ]);
  const existing = (mapSnapshot.val() ?? {}) as Record<string, string>;
  const candidates = new Map<string, Set<string>>();
  const groupEvents = new Map<string, StoredEvent[]>();

  for (const event of Object.values(eventsSnapshot.val() ?? {}) as StoredEvent[]) {
    if (event.birdEventType !== "Banded" && event.birdEventType !== "None") continue;
    const groupId = getBandGroupKey(event);
    if (!groupId) continue;
    const events = groupEvents.get(groupId) ?? [];
    events.push(event);
    groupEvents.set(groupId, events);

    const size = event.band?.bandSize;
    if (!size || !VALID_SIZES.has(size)) continue;
    const sizes = candidates.get(groupId) ?? new Set<string>();
    sizes.add(size);
    candidates.set(groupId, sizes);
  }

  const resolved: Record<string, string> = {};
  const conflicts: Record<string, string[]> = {};
  for (const [groupId, sizes] of candidates) {
    if (existing[groupId]) continue;
    if (sizes.size === 1) resolved[groupId] = [...sizes][0];
    else conflicts[groupId] = [...sizes].sort();
  }

  // Existing entries and direct event evidence are trusted. The heuristics
  // below only create review suggestions; they never write RTDB.
  const knownSizes = new Map<string, string>(Object.entries(existing));
  for (const [groupId, size] of Object.entries(resolved)) knownSizes.set(groupId, size);
  const allGroupIds = new Set([...groupEvents.keys()].map(Number).filter(Number.isFinite));
  const unknownGroupIds = [...allGroupIds]
    .map((groupId) => String(groupId).padStart(7, "0"))
    .filter((groupId) => !knownSizes.has(groupId));

  const speciesVotes = new Map<string, Map<string, number>>();
  for (const [groupId, events] of groupEvents) {
    const size = knownSizes.get(groupId);
    if (!size) continue;
    for (const event of events) {
      if (event.modifiedEventId || !event.species) continue;
      const votes = speciesVotes.get(event.species) ?? new Map<string, number>();
      votes.set(size, (votes.get(size) ?? 0) + 1);
      speciesVotes.set(event.species, votes);
    }
  }
  const speciesPreference = new Map<string, { size: string; confidence: number }>();
  for (const [species, votes] of speciesVotes) {
    const total = [...votes.values()].reduce((sum, count) => sum + count, 0);
    const [size, count] = [...votes.entries()].sort((a, b) => b[1] - a[1])[0];
    speciesPreference.set(species, { size, confidence: count / total });
  }

  const suggestions: Array<{ groupId: string; size: string; confidence: number; reason: string }> = [];
  for (const groupId of unknownGroupIds) {
    const numericGroupId = Number(groupId);
    const left = String(numericGroupId - 1).padStart(7, "0");
    const right = String(numericGroupId + 1).padStart(7, "0");
    const leftSize = allGroupIds.has(numericGroupId - 1) ? knownSizes.get(left) : undefined;
    const rightSize = allGroupIds.has(numericGroupId + 1) ? knownSizes.get(right) : undefined;
    if (leftSize && leftSize === rightSize) {
      suggestions.push({ groupId, size: leftSize, confidence: 1, reason: "matching adjacent groups" });
      continue;
    }

    const votes = new Map<string, number>();
    let totalVotes = 0;
    for (const event of groupEvents.get(groupId) ?? []) {
      if (event.modifiedEventId || !event.species) continue;
      const preference = speciesPreference.get(event.species);
      if (!preference || preference.confidence < 0.5) continue;
      votes.set(preference.size, (votes.get(preference.size) ?? 0) + 1);
      totalVotes++;
    }
    if (totalVotes < 3) continue;
    const [size, count] = [...votes.entries()].sort((a, b) => b[1] - a[1])[0];
    const confidence = count / totalVotes;
    if (confidence >= 0.7) suggestions.push({ groupId, size, confidence, reason: "species profile" });
  }

  console.log(
    JSON.stringify(
      {
        environment,
        mode: apply ? "apply" : "dry-run",
        existingEntries: Object.keys(existing).length,
        candidates: candidates.size,
        entriesToCreate: Object.keys(resolved).length,
        conflicts: Object.keys(conflicts).length,
        conflictGroups: conflicts,
        reviewSuggestions: suggestions.length,
        suggestionSample: suggestions.slice(0, 30),
        ...(verbose ? { suggestions } : {}),
      },
      null,
      2,
    ),
  );
  if (!apply || Object.keys(resolved).length === 0) process.exit(0);

  const entries = Object.entries(resolved);
  for (let index = 0; index < entries.length; index += 500) {
    const updates: Record<string, unknown> = {};
    for (const [groupId, size] of entries.slice(index, index + 500)) {
      updates[`${environment}/bandGroupSizesMap/${groupId}`] = size;
    }
    updates[`${environment}/metadata/lastModified_bandGroupSizesMap`] = ServerValue.TIMESTAMP;
    await db.ref().update(updates);
  }
  console.log(`Created ${entries.length} missing band-group size entries.`);
  if (suggestions.length > 0) {
    console.log("Heuristic suggestions were not written; review and set them on the Bands page.");
  }
  process.exit(0);
}

main().catch((error) => {
  console.error("Band-group size migration failed:", error);
  process.exitCode = 1;
});
