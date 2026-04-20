import { db, ENVIRONMENT } from "./firebase-node";

async function main() {
  console.log(`Checking band groups in ${ENVIRONMENT}...`);

  const snap = await db.ref(`${ENVIRONMENT}/bandGroupsMap`).once("value");
  if (!snap.exists()) {
    console.log("No bandGroupsMap found");
    process.exit(1);
  }

  const bandGroups = snap.val() as Record<string, { id: string; newCaptureIds: string[] }>;
  const groupIds = Object.keys(bandGroups).map(Number).filter((n) => !isNaN(n)).sort((a, b) => a - b);

  console.log(`Total band groups: ${groupIds.length}`);
  console.log();

  // Group by prefix (first 4 digits) to find clusters
  const prefixMap = new Map<string, number[]>();
  for (const id of groupIds) {
    const prefix = String(id).padStart(7, "0").slice(0, 4);
    if (!prefixMap.has(prefix)) prefixMap.set(prefix, []);
    prefixMap.get(prefix)!.push(id);
  }

  // Check each prefix group for gaps
  for (const [prefix, ids] of [...prefixMap.entries()].sort((a, b) => a[0].localeCompare(b[0]))) {
    ids.sort((a, b) => a - b);
    const gaps: string[] = [];
    for (let i = 1; i < ids.length; i++) {
      const diff = ids[i] - ids[i - 1];
      if (diff > 1) {
        gaps.push(`  gap: ${String(ids[i - 1]).padStart(7, "0")} → ${String(ids[i]).padStart(7, "0")} (${diff - 1} missing)`);
      }
    }

    const first = String(ids[0]).padStart(7, "0");
    const last = String(ids[ids.length - 1]).padStart(7, "0");
    const birdCount = ids.reduce((sum, id) => sum + (bandGroups[String(id)]?.newCaptureIds?.length ?? 0), 0);

    console.log(`Prefix ${prefix}: ${ids.length} groups, range ${first}-${last}, ${birdCount} birds`);
    if (gaps.length > 0) {
      for (const gap of gaps) console.log(gap);
    }
  }

  // Also check bandSizeToBandIdMap
  console.log("\n--- Band Size Map (current positions) ---");
  const bsSnap = await db.ref(`${ENVIRONMENT}/bandSizeToBandIdMap`).once("value");
  if (bsSnap.exists()) {
    const bsMap = bsSnap.val() as Record<string, string>;
    for (const [size, bandId] of Object.entries(bsMap).sort((a, b) => a[0].localeCompare(b[0]))) {
      const group = bandId.slice(0, 7);
      const last2 = bandId.slice(7, 9);
      console.log(`  ${size.padEnd(5)}: ${group}-${last2} (next band)`);
    }
  }

  process.exit(0);
}

main().catch((err) => { console.error(err); process.exit(1); });
