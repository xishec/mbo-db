import { db, ENVIRONMENT } from "./firebase-node";
import { writeFileSync } from "fs";

function quantile(sorted: number[], q: number): number {
  if (sorted.length === 0) return NaN;
  const pos = (sorted.length - 1) * q;
  const lo = Math.floor(pos);
  const hi = Math.ceil(pos);
  if (lo === hi) return sorted[lo];
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (pos - lo);
}

async function generatePublicTrends() {
  console.log(`📊 Fetching DETs from ${ENVIRONMENT} environment...`);

  const detsRef = db.ref(`${ENVIRONMENT}/DETsMap`);
  const snapshot = await detsRef.once("value");
  const fullDETsMap = snapshot.val();

  if (!fullDETsMap) {
    console.error("❌ No DETs data found");
    return;
  }

  console.log(`✓ Loaded ${Object.keys(fullDETsMap).length} DETs`);

  // Build compact DETsMap - only include fields needed for SpeciesWeeklyHeatmap
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

  console.log(`📊 Fetching birdEvents from ${ENVIRONMENT} environment...`);
  const birdEventsSnap = await db.ref(`${ENVIRONMENT}/birdEventsMap`).once("value");
  const birdEventsMap = birdEventsSnap.val() || {};
  console.log(`✓ Loaded ${Object.keys(birdEventsMap).length} bird events`);

  type BoxStats = { n: number; min: number; q1: number; median: number; q3: number; max: number };
  type StatsMap = Record<string, Record<string, BoxStats>>;

  // Build species -> year -> sorted numeric values for a given field, skipping
  // modified (historical) events and non-positive values.
  const collectByField = (fieldName: "wing" | "weight"): Record<string, Record<string, number[]>> => {
    const out: Record<string, Record<string, number[]>> = {};
    for (const ev of Object.values(birdEventsMap) as any[]) {
      if (!ev || ev.modifiedEventId) continue;
      const raw = ev[fieldName];
      const value = typeof raw === "number" ? raw : parseFloat(raw);
      if (!value || !isFinite(value) || value <= 0) continue;
      if (!ev.species || !ev.date) continue;
      const year = ev.date.slice(0, 4);
      if (!out[ev.species]) out[ev.species] = {};
      if (!out[ev.species][year]) out[ev.species][year] = [];
      out[ev.species][year].push(value);
    }
    return out;
  };

  // Collapse species-year value lists into box-plot stats. Whiskers use the
  // 1.5·IQR rule, clamped to the observed range (no outlier dots).
  const computeBoxStats = (raw: Record<string, Record<string, number[]>>): StatsMap => {
    const result: StatsMap = {};
    for (const [species, yearToValues] of Object.entries(raw)) {
      const yearStats: Record<string, BoxStats> = {};
      for (const [year, values] of Object.entries(yearToValues)) {
        if (values.length === 0) continue;
        const sorted = [...values].sort((a, b) => a - b);
        const q1 = quantile(sorted, 0.25);
        const median = quantile(sorted, 0.5);
        const q3 = quantile(sorted, 0.75);
        const iqr = q3 - q1;
        const lowerFence = q1 - 1.5 * iqr;
        const upperFence = q3 + 1.5 * iqr;
        let whiskerMin = sorted[0];
        for (const v of sorted) {
          if (v >= lowerFence) { whiskerMin = v; break; }
        }
        let whiskerMax = sorted[sorted.length - 1];
        for (let i = sorted.length - 1; i >= 0; i--) {
          if (sorted[i] <= upperFence) { whiskerMax = sorted[i]; break; }
        }
        yearStats[year] = {
          n: sorted.length,
          min: +whiskerMin.toFixed(2),
          q1: +q1.toFixed(2),
          median: +median.toFixed(2),
          q3: +q3.toFixed(2),
          max: +whiskerMax.toFixed(2),
        };
      }
      if (Object.keys(yearStats).length > 0) {
        result[species] = yearStats;
      }
    }
    return result;
  };

  const wingsMap = computeBoxStats(collectByField("wing"));
  const weightsMap = computeBoxStats(collectByField("weight"));

  console.log(`✓ Built wing box-plot stats for ${Object.keys(wingsMap).length} species`);
  console.log(`✓ Built weight box-plot stats for ${Object.keys(weightsMap).length} species`);

  const payload = { dets: compactDETsMap, wings: wingsMap, weights: weightsMap };
  const json = JSON.stringify(payload);
  const outputPath = "public/data/trends-data.json";

  writeFileSync(outputPath, json);

  const originalSize = JSON.stringify(fullDETsMap).length / 1024 / 1024;
  const compactSize = json.length / 1024 / 1024;

  console.log(`\n📦 Compact trends data generated at ${outputPath}`);
  console.log(`📏 Original DETs size: ${originalSize.toFixed(2)} MB`);
  console.log(`📏 Compact JSON (DETs + wings + weights): ${compactSize.toFixed(2)} MB`);
  console.log(`ℹ️  Firebase Hosting will automatically gzip this file when serving`);

  process.exit(0);
}

generatePublicTrends().catch((error) => {
  console.error("❌ Error:", error);
  process.exit(1);
});
