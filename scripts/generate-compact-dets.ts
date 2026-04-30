import { db, ENVIRONMENT } from "./firebase-node";
import { writeFileSync } from "fs";
import { gzipSync } from "zlib";

async function generateCompactDETs() {
  console.log(`📊 Fetching DETs from ${ENVIRONMENT} environment...`);

  const detsRef = db.ref(`${ENVIRONMENT}/DETsMap`);
  const snapshot = await detsRef.once("value");
  const fullDETsMap = snapshot.val();

  if (!fullDETsMap) {
    console.error("❌ No DETs data found");
    return;
  }

  console.log(`✓ Loaded ${Object.keys(fullDETsMap).length} DETs`);

  // Build compact DETsMap - only include fields needed for YearlyHeatmap
  const compactDETsMap: Record<string, any> = {};

  Object.entries(fullDETsMap).forEach(([date, det]: [string, any]) => {
    const entry: any = {};

    // Only include non-empty species counts
    if (det.DETSpeciesCount && Object.keys(det.DETSpeciesCount).length > 0) {
      entry.d = det.DETSpeciesCount;
    }
    if (det.bandedSpeciesCount && Object.keys(det.bandedSpeciesCount).length > 0) {
      entry.b = det.bandedSpeciesCount;
    }
    if (det.repeatSpeciesCount && Object.keys(det.repeatSpeciesCount).length > 0) {
      entry.rp = det.repeatSpeciesCount;
    }
    if (det.returnSpeciesCount && Object.keys(det.returnSpeciesCount).length > 0) {
      entry.rt = det.returnSpeciesCount;
    }
    if (det.observedSpeciesCount && Object.keys(det.observedSpeciesCount).length > 0) {
      entry.o = det.observedSpeciesCount;
    }

    // Hours - only include if non-zero
    const netHoursTotal = det.netHours?.total;
    if (netHoursTotal && netHoursTotal !== "0" && netHoursTotal !== "") {
      entry.nh = netHoursTotal;
    }
    const observerHoursTotal = det.observerHours?.total;
    if (observerHoursTotal && observerHoursTotal !== 0) {
      entry.oh = observerHoursTotal;
    }

    // Only add date if it has data
    if (Object.keys(entry).length > 0) {
      compactDETsMap[date] = entry;
    }
  });

  const json = JSON.stringify(compactDETsMap);
  const compressed = gzipSync(json, { level: 9 });
  const outputPath = "public/data/trends-data.json.gz";

  writeFileSync(outputPath, compressed);

  const originalSize = JSON.stringify(fullDETsMap).length / 1024 / 1024;
  const compactSize = json.length / 1024 / 1024;
  const compressedSize = compressed.length / 1024;
  const totalReduction = ((1 - compressed.length / JSON.stringify(fullDETsMap).length) * 100);

  console.log(`\n📦 Compressed trends data generated at ${outputPath}`);
  console.log(`📏 Original size: ${originalSize.toFixed(2)} MB`);
  console.log(`📏 Compact JSON: ${compactSize.toFixed(2)} MB`);
  console.log(`📏 Gzipped: ${compressedSize.toFixed(0)} KB`);
  console.log(`🗜️  Total reduction: ${totalReduction.toFixed(1)}%`);

  process.exit(0);
}

generateCompactDETs().catch((error) => {
  console.error("❌ Error:", error);
  process.exit(1);
});
