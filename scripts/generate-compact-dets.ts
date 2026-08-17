import { db, ENVIRONMENT } from "./firebase-node";
import { writeFileSync } from "fs";
import type { DET } from "../src/types/DET";

type CompactDET = {
  dt?: string;
  d?: Record<string, number>;
  b?: Record<string, number>;
  rp?: Record<string, number>;
  rt?: Record<string, number>;
  o?: Record<string, number>;
  nh?: string;
  oh?: number;
};

async function generateCompactDETs() {
  console.log(`📊 Fetching DETs from ${ENVIRONMENT} environment...`);

  const detsRef = db.ref(`${ENVIRONMENT}/DETsByDateMap`);
  const snapshot = await detsRef.once("value");
  const fullDETsByDateMap = snapshot.val() as Record<string, Record<string, DET>> | null;

  if (!fullDETsByDateMap) {
    console.error("❌ No DETs data found");
    return;
  }

  const detCount = Object.values(fullDETsByDateMap).reduce(
    (total, detsByProgram) => total + Object.keys(detsByProgram ?? {}).length,
    0
  );
  console.log(`✓ Loaded ${detCount} DETs`);

  // Preserve the date/program nesting while keeping only trend fields.
  const compactDETsByDateMap: Record<string, Record<string, CompactDET>> = {};

  Object.entries(fullDETsByDateMap).forEach(([date, detsByProgram]) => {
    Object.entries(detsByProgram ?? {}).forEach(([programKey, det]) => {
      const entry: CompactDET = {};

      // Only include non-empty species counts
      if (det.DETSpeciesCount && Object.keys(det.DETSpeciesCount).length > 0) entry.d = det.DETSpeciesCount;
      if (det.bandedSpeciesCount && Object.keys(det.bandedSpeciesCount).length > 0) entry.b = det.bandedSpeciesCount;
      if (det.repeatSpeciesCount && Object.keys(det.repeatSpeciesCount).length > 0) entry.rp = det.repeatSpeciesCount;
      if (det.returnSpeciesCount && Object.keys(det.returnSpeciesCount).length > 0) entry.rt = det.returnSpeciesCount;
      if (det.observedSpeciesCount && Object.keys(det.observedSpeciesCount).length > 0) entry.o = det.observedSpeciesCount;

      // Hours - only include if non-zero
      const netHoursTotal = det.netHours?.total;
      if (netHoursTotal && netHoursTotal !== "0" && netHoursTotal !== "") entry.nh = netHoursTotal;
      const observerHoursTotal = det.observerHours?.total;
      if (observerHoursTotal && observerHoursTotal !== 0) entry.oh = observerHoursTotal;

      if (Object.keys(entry).length > 0) {
        entry.dt = det.date ?? date;
        compactDETsByDateMap[date] ??= {};
        compactDETsByDateMap[date][programKey] = entry;
      }
    });
  });

  const json = JSON.stringify(compactDETsByDateMap);
  const outputPath = "public/data/trends-data.json";

  writeFileSync(outputPath, json);

  const originalSize = JSON.stringify(fullDETsByDateMap).length / 1024 / 1024;
  const compactSize = json.length / 1024 / 1024;
  const reduction = ((1 - json.length / JSON.stringify(fullDETsByDateMap).length) * 100);

  console.log(`\n📦 Compact trends data generated at ${outputPath}`);
  console.log(`📏 Original size: ${originalSize.toFixed(2)} MB`);
  console.log(`📏 Compact JSON: ${compactSize.toFixed(2)} MB`);
  console.log(`🗜️  Size reduction: ${reduction.toFixed(1)}%`);
  console.log(`ℹ️  Firebase Hosting will automatically gzip this file when serving`);

  process.exit(0);
}

generateCompactDETs().catch((error) => {
  console.error("❌ Error:", error);
  process.exit(1);
});
