import { db, ENVIRONMENT } from "./firebase-node";

async function main() {
  console.log(`Inferring band sizes in ${ENVIRONMENT}...`);

  const [bsSnap, bgSnap, evSnap] = await Promise.all([
    db.ref(`${ENVIRONMENT}/bandSizeToBandIdMap`).once("value"),
    db.ref(`${ENVIRONMENT}/bandGroupsMap`).once("value"),
    db.ref(`${ENVIRONMENT}/birdEventsMap`).once("value"),
  ]);

  if (!bsSnap.exists() || !bgSnap.exists() || !evSnap.exists()) {
    console.log("Missing data");
    process.exit(1);
  }

  const bandSizeMap = bsSnap.val() as Record<string, string>;
  const bandGroups = bgSnap.val() as Record<string, { id: string; newCaptureIds: string[] }>;
  const events = evSnap.val() as Record<string, { band?: { bandPrefix: string; bandSuffix: string }; species?: string; modifiedEventId?: string; birdEventType?: string }>;
  const allGroupIds = new Set(Object.keys(bandGroups).map(Number).filter((n) => !isNaN(n)));

  // Step 1: Find known groups by contiguous adjacency
  const knownGroupSize = new Map<number, string>();

  for (const [size, bandId] of Object.entries(bandSizeMap)) {
    if (size === "other" || !bandId) continue;
    const currentGroup = parseInt(bandId.slice(0, 7), 10);

    let g = currentGroup;
    while (allGroupIds.has(g)) { knownGroupSize.set(g, size); g--; }
    g = currentGroup + 1;
    while (allGroupIds.has(g)) { knownGroupSize.set(g, size); g++; }
  }

  console.log(`Known band groups (from contiguity): ${knownGroupSize.size}`);

  // Step 2: Build species → band size profile from known groups
  // For each event in a known group, record species → size
  const speciesSizeVotes = new Map<string, Map<string, number>>(); // species → (size → count)

  for (const ev of Object.values(events)) {
    if (!ev || ev.modifiedEventId || !ev.species || !ev.band?.bandPrefix) continue;
    if (ev.birdEventType !== "Banded" && ev.birdEventType !== "None") continue;

    const groupId = parseInt(ev.band.bandPrefix + ev.band.bandSuffix.slice(0, 3), 10);
    const size = knownGroupSize.get(groupId);
    if (!size) continue;

    if (!speciesSizeVotes.has(ev.species)) speciesSizeVotes.set(ev.species, new Map());
    const votes = speciesSizeVotes.get(ev.species)!;
    votes.set(size, (votes.get(size) ?? 0) + 1);
  }

  // Build species → best size (with confidence)
  const speciesBestSize = new Map<string, { size: string; confidence: number; total: number }>();
  for (const [species, votes] of speciesSizeVotes) {
    const total = [...votes.values()].reduce((a, b) => a + b, 0);
    let bestSize = "";
    let bestCount = 0;
    for (const [size, count] of votes) {
      if (count > bestCount) { bestCount = count; bestSize = size; }
    }
    speciesBestSize.set(species, { size: bestSize, confidence: bestCount / total, total });
  }

  console.log(`Species with known size preference: ${speciesBestSize.size}`);
  console.log("\nTop species by sample size:");
  [...speciesBestSize.entries()]
    .sort((a, b) => b[1].total - a[1].total)
    .slice(0, 20)
    .forEach(([sp, { size, confidence, total }]) => {
      console.log(`  ${sp.padEnd(6)} → ${size.padEnd(3)} (${(confidence * 100).toFixed(0)}% of ${total} birds)`);
    });

  // Step 3: For each unknown group, vote by species
  const unknownGroups = [...allGroupIds].filter((g) => !knownGroupSize.has(g));

  // Build groupId → species counts from events
  const groupSpecies = new Map<number, Map<string, number>>();
  for (const ev of Object.values(events)) {
    if (!ev || ev.modifiedEventId || !ev.species || !ev.band?.bandPrefix) continue;
    if (ev.birdEventType !== "Banded" && ev.birdEventType !== "None") continue;

    const groupId = parseInt(ev.band.bandPrefix + ev.band.bandSuffix.slice(0, 3), 10);
    if (knownGroupSize.has(groupId)) continue;

    if (!groupSpecies.has(groupId)) groupSpecies.set(groupId, new Map());
    const sp = groupSpecies.get(groupId)!;
    sp.set(ev.species, (sp.get(ev.species) ?? 0) + 1);
  }

  // Infer size for each unknown group
  const CONFIDENCE_THRESHOLD = 0.7;
  const MIN_VOTES = 3;
  let inferredCount = 0;
  let lowConfidenceCount = 0;
  let noDataCount = 0;
  const inferred: { groupId: number; size: string; confidence: number; totalBirds: number; topSpecies: string }[] = [];
  const lowConfidence: typeof inferred = [];

  for (const groupId of unknownGroups.sort((a, b) => a - b)) {
    const speciesMap = groupSpecies.get(groupId);
    if (!speciesMap || speciesMap.size === 0) {
      noDataCount++;
      continue;
    }

    // Each bird votes for a size based on its species preference
    const sizeVotes = new Map<string, number>();
    let totalVotes = 0;
    for (const [species, count] of speciesMap) {
      const pref = speciesBestSize.get(species);
      if (!pref || pref.confidence < 0.5) continue; // skip unreliable species
      sizeVotes.set(pref.size, (sizeVotes.get(pref.size) ?? 0) + count);
      totalVotes += count;
    }

    if (totalVotes < MIN_VOTES) {
      noDataCount++;
      continue;
    }

    let bestSize = "";
    let bestCount = 0;
    for (const [size, count] of sizeVotes) {
      if (count > bestCount) { bestCount = count; bestSize = size; }
    }

    const confidence = bestCount / totalVotes;
    const totalBirds = [...speciesMap.values()].reduce((a, b) => a + b, 0);
    const topSpecies = [...speciesMap.entries()].sort((a, b) => b[1] - a[1])[0][0];

    if (confidence >= CONFIDENCE_THRESHOLD) {
      inferredCount++;
      inferred.push({ groupId, size: bestSize, confidence, totalBirds, topSpecies });
    } else {
      lowConfidenceCount++;
      lowConfidence.push({ groupId, size: bestSize, confidence, totalBirds, topSpecies });
    }
  }

  console.log(`\n--- Results ---`);
  console.log(`Known (contiguity):    ${knownGroupSize.size}`);
  console.log(`Inferred (≥${(CONFIDENCE_THRESHOLD * 100).toFixed(0)}%):     ${inferredCount}`);
  console.log(`Low confidence (<${(CONFIDENCE_THRESHOLD * 100).toFixed(0)}%): ${lowConfidenceCount}`);
  console.log(`No data / too few:     ${noDataCount}`);
  console.log(`Total:                 ${allGroupIds.size}`);

  // Summary by size
  const sizeSummary = new Map<string, number>();
  for (const { size } of inferred) sizeSummary.set(size, (sizeSummary.get(size) ?? 0) + 1);
  console.log("\nInferred by size:");
  for (const [size, count] of [...sizeSummary.entries()].sort()) {
    console.log(`  ${size.padEnd(5)}: ${count} groups`);
  }

  if (inferred.length > 0) {
    console.log(`\nHigh-confidence inferences (sample):`);
    inferred.slice(0, 30).forEach(({ groupId, size, confidence, totalBirds, topSpecies }) => {
      console.log(`  ${String(groupId).padStart(7, "0")} → ${size.padEnd(3)} (${(confidence * 100).toFixed(0)}%, ${totalBirds} birds, top: ${topSpecies})`);
    });
    if (inferred.length > 30) console.log(`  ... and ${inferred.length - 30} more`);
  }

  if (lowConfidence.length > 0) {
    console.log(`\nLow-confidence (ambiguous):`);
    lowConfidence.slice(0, 20).forEach(({ groupId, size, confidence, totalBirds, topSpecies }) => {
      console.log(`  ${String(groupId).padStart(7, "0")} → ${size.padEnd(3)}? (${(confidence * 100).toFixed(0)}%, ${totalBirds} birds, top: ${topSpecies})`);
    });
  }

  process.exit(0);
}

main().catch((err) => { console.error(err); process.exit(1); });
