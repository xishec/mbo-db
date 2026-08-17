import * as fs from "fs";
import * as path from "path";
import { fileURLToPath } from "url";
import { DET, Net } from "../src/types/DET.js";
import { db, ENVIRONMENT } from "./firebase-node.js";
import { fetchWeatherForDateRange } from "../src/services/weatherService.js";
import { getDETProgramKey, isValidDETProgramId } from "../src/utils/detIdentity.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function getArgument(name: string): string | undefined {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

const LOCAL_JSON_MODE = process.argv.includes("--local-json");
const sourceDirectory = path.resolve(getArgument("--source-dir") ?? path.join(__dirname, "../public/data"));
const outputPath = path.resolve(getArgument("--output") ?? path.join(__dirname, "../DETsByDateMap.json"));
const firebaseMergeEnvironment = getArgument("--merge-firebase-env");

if (firebaseMergeEnvironment && !LOCAL_JSON_MODE) {
  throw new Error("--merge-firebase-env can only be used with --local-json");
}

// Parse a single CSV line respecting quoted fields
function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    const nextChar = line[i + 1];

    if (inQuotes) {
      if (char === '"') {
        if (nextChar === '"') {
          current += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        current += char;
      }
    } else {
      if (char === '"') {
        inQuotes = true;
      } else if (char === ",") {
        result.push(current.trim());
        current = "";
      } else {
        current += char;
      }
    }
  }

  result.push(current.trim());
  return result;
}

// Parse CSV helper
function parseCSV(content: string): Record<string, string>[] {
  content = content.replace(/^\uFEFF/, "").replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  const lines = content.split("\n");
  if (lines.length < 2) return [];

  const headers = parseCSVLine(lines[0]);
  const data: Record<string, string>[] = [];

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    const values = parseCSVLine(line);
    const row: Record<string, string> = {};

    headers.forEach((header, idx) => {
      row[header] = values[idx] || "";
    });

    data.push(row);
  }

  return data;
}

/**
 * Convert "M/D/YYYY 0:00:00" or "YYYY-MM-DD" to "YYYY-MM-DD"
 */
function normalizeDate(value: string): string {
  if (!value) return "";
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
  const match = value.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (match) {
    const [, month, day, year] = match;
    return `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
  }
  return value;
}

// Read CSV files
const dailyPath = path.join(sourceDirectory, "tblDETDaily.csv");
const speciesPath = path.join(sourceDirectory, "tblDETSpecies.csv");
const netHoursPath = path.join(sourceDirectory, "tblDETNetHours.csv");
const speciesLookupPath = path.join(sourceDirectory, "tblSpecies.csv");

const dailyContent = fs.readFileSync(dailyPath, "utf-8");
const speciesContent = fs.readFileSync(speciesPath, "utf-8");
const netHoursContent = fs.readFileSync(netHoursPath, "utf-8");
const speciesLookupContent = fs.readFileSync(speciesLookupPath, "utf-8");

const dailyRecords = parseCSV(dailyContent);
const speciesRecords = parseCSV(speciesContent);
const netHoursRecords = parseCSV(netHoursContent);
const speciesLookupRecords = parseCSV(speciesLookupContent);

const knownSpecies = new Set(speciesLookupRecords.map((record) => record.Species).filter(Boolean));
const unknownSpecies = Array.from(
  new Set(speciesRecords.map((record) => record.Species).filter((species) => species && !knownSpecies.has(species)))
).sort();
if (unknownSpecies.length > 0) {
  console.warn(`⚠️  ${unknownSpecies.length} species codes are absent from tblSpecies.csv: ${unknownSpecies.join(", ")}`);
}

const getDETIdentityKey = (date: string, programId: string) => `${date}\u0000${getDETProgramKey(programId)}`;

// Build one DET for each date/program identity before nesting for Firebase.
const detsByIdentity = new Map<string, DET>();

// Process daily records
dailyRecords.forEach((record) => {
  const date = normalizeDate(record.DateEx);
  const programId = record.Program || "";
  if (!date || !isValidDETProgramId(programId)) return;
  const key = getDETIdentityKey(date, programId);
  const existing = detsByIdentity.get(key);

  if (existing) {
    existing.observerHours.total += parseFloat(record.Observers) || 0;
    existing.netHours.total = (
      (parseFloat(existing.netHours.total) || 0) + (parseFloat(record.SongbirdNets) || 0)
    ).toString();
    existing.coverageCode = Math.max(existing.coverageCode, parseFloat(record.CoverageCode) || 0);
    if (record.Location === "MBO") existing.location = "MBO";
    return;
  }

  detsByIdentity.set(key, {
    date: date,
    programId,
    location: record.Location || "",
    banderInCharge: undefined,
    start: undefined,
    end: undefined,
    observerHours: {
      observers: [],
      total: parseFloat(record.Observers) || 0,
    },
    netHours: {
      nets: [],
      hummingbirdTrapTotal: "",
      total: record.SongbirdNets || "",
    },
    coverageCode: parseFloat(record.CoverageCode) || 0,
    narrative: "",
    deviations: "",
    visitors: [],
    stationManagement: "",
    injuries: [],
    released: [],
    censuser: undefined,
    censusStart: undefined,
    censusEnd: undefined,
    observedSpeciesCount: {},
    censusSpeciesCount: {},
    bandedSpeciesCount: {},
    repeatSpeciesCount: {},
    returnSpeciesCount: {},
    DETSpeciesCount: {},
  });
});

// Process species records
speciesRecords.forEach((record) => {
  const date = normalizeDate(record.DateEx);
  const key = getDETIdentityKey(date, record.Program || "");
  if (!date || !detsByIdentity.has(key)) return;

  const detMap = detsByIdentity.get(key)!;
  const species = record.Species;

  if (record.Observed && parseInt(record.Observed) > 0) {
    detMap.observedSpeciesCount[species] = (detMap.observedSpeciesCount[species] || 0) + parseInt(record.Observed);
  }

  if (record.Census && parseInt(record.Census) > 0) {
    detMap.censusSpeciesCount[species] = (detMap.censusSpeciesCount[species] || 0) + parseInt(record.Census);
  }

  if (record.Banded && parseInt(record.Banded) > 0) {
    detMap.bandedSpeciesCount[species] = (detMap.bandedSpeciesCount[species] || 0) + parseInt(record.Banded);
  }

  if (record.Repeats && parseInt(record.Repeats) > 0) {
    detMap.repeatSpeciesCount[species] = (detMap.repeatSpeciesCount[species] || 0) + parseInt(record.Repeats);
  }

  if (record.Returns && parseInt(record.Returns) > 0) {
    detMap.returnSpeciesCount[species] = (detMap.returnSpeciesCount[species] || 0) + parseInt(record.Returns);
  }

  if (record.DET && parseInt(record.DET) > 0) {
    detMap.DETSpeciesCount[species] = (detMap.DETSpeciesCount[species] || 0) + parseInt(record.DET);
  }
});

// Process net hours records
const netsByDate = new Map<string, Net[]>();
netHoursRecords.forEach((record) => {
  const date = normalizeDate(record.DateEx);
  const key = getDETIdentityKey(date, record.Program || "");
  if (!date || !record.Program) return;

  if (!netsByDate.has(key)) {
    netsByDate.set(key, []);
  }

  netsByDate.get(key)!.push({
    id: record.NetID || "",
    open: undefined,
    closed: undefined,
    hours: undefined,
    multiplier: undefined,
    total: record.NetHours || "",
  });
});

// Add net hours to DETs
netsByDate.forEach((nets, key) => {
  if (detsByIdentity.has(key)) {
    const detMap = detsByIdentity.get(key)!;
    detMap.netHours.nets = nets;

    // Calculate total net hours if there are nets, otherwise keep SongbirdNets value
    if (nets.length > 0) {
      const total = nets.reduce((sum, net) => sum + (parseFloat(net.total || "0") || 0), 0);
      detMap.netHours.total = (Math.round(total * 100) / 100).toString();
    }
  }
});

// Weather fetching is now handled by fetchWeatherForDate from weatherService

// Remove undefined values from an object (Firebase doesn't accept undefined)
function removeUndefined<T>(obj: T): T {
  if (obj === null || obj === undefined) {
    return obj as T;
  }
  if (Array.isArray(obj)) {
    return obj.map(removeUndefined) as T;
  }
  if (typeof obj === "object") {
    const cleaned: Record<string, unknown> = {};
    for (const key in obj) {
      if ((obj as Record<string, unknown>)[key] !== undefined) {
        cleaned[key] = removeUndefined((obj as Record<string, unknown>)[key]);
      }
    }
    return cleaned as T;
  }
  return obj;
}

function isDET(value: unknown): value is DET {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Partial<DET>;
  return (
    typeof candidate.date === "string" &&
    typeof candidate.programId === "string" &&
    isValidDETProgramId(candidate.programId)
  );
}

async function generateDETs() {
  console.log(LOCAL_JSON_MODE ? "Generating local DETsByDateMap JSON..." : "Uploading DETs to RTDB...");

  // Fetch weather data for MBO locations only
  console.log("Fetching weather data for MBO locations...");
  let weatherSuccessCount = 0;
  let weatherErrorCount = 0;

  const mboDates = Array.from(
    new Set(Array.from(detsByIdentity.values()).filter((det) => det.location === "MBO").map((det) => det.date))
  ).sort();
  const datesByYear = new Map<number, string[]>();
  mboDates.forEach((date) => {
    const year = parseInt(date.slice(0, 4), 10);
    if (!datesByYear.has(year)) {
      datesByYear.set(year, []);
    }
    datesByYear.get(year)!.push(date);
  });

  const years = Array.from(datesByYear.keys()).sort((a, b) => a - b);
  for (let i = 0; i < years.length; i++) {
    const year = years[i];
    const yearDates = datesByYear.get(year)!;
    const startDate = yearDates[0];
    const endDate = yearDates[yearDates.length - 1];

    try {
      const weatherByDate = await fetchWeatherForDateRange(startDate, endDate);
      yearDates.forEach((date) => {
        const weather = weatherByDate.get(date);
        if (weather) {
          for (const det of detsByIdentity.values()) {
            if (det.date === date && det.location === "MBO") {
              det.weather = weather;
              weatherSuccessCount++;
            }
          }
        } else {
          weatherErrorCount++;
        }
      });
    } catch (error) {
      console.error(`Failed to fetch weather for ${year}:`, error);
      weatherErrorCount += yearDates.length;
    }

    console.log(`Progress: ${i + 1}/${years.length} years processed`);

    // Small delay to avoid rate limiting
    await new Promise((resolve) => setTimeout(resolve, 200));
  }

  console.log(`✅ Weather data: ${weatherSuccessCount} successful, ${weatherErrorCount} failed`);

  const DETsByDateObject: Record<string, Record<string, DET>> = {};
  const DETUpdates: Record<string, DET> = {};
  detsByIdentity.forEach((det) => {
    const cleanedDET = removeUndefined(det);
    const programKey = getDETProgramKey(det.programId);
    DETsByDateObject[det.date] ??= {};
    DETsByDateObject[det.date][programKey] = cleanedDET;
    DETUpdates[`${det.date}/${programKey}`] = cleanedDET;
  });

  if (LOCAL_JSON_MODE) {
    let firebaseOnlyCount = 0;
    if (firebaseMergeEnvironment) {
      const [legacySnapshot, currentSnapshot] = await Promise.all([
        db.ref(`${firebaseMergeEnvironment}/DETsMap`).once("value"),
        db.ref(`${firebaseMergeEnvironment}/DETsByDateMap`).once("value"),
      ]);
      const legacyDETs = Object.values(legacySnapshot.val() ?? {}).filter(isDET);
      const currentDETs = Object.values(currentSnapshot.val() ?? {})
        .flatMap((detsByProgram) =>
          detsByProgram && typeof detsByProgram === "object" ? Object.values(detsByProgram) : []
        )
        .filter(isDET);
      const firebaseOnlyDETs = new Map<string, DET>();

      // Current nested records override legacy records, but neither can
      // overwrite a corrected CSV date/program identity.
      for (const det of [...legacyDETs, ...currentDETs]) {
        const identityKey = getDETIdentityKey(det.date, det.programId);
        if (!detsByIdentity.has(identityKey)) firebaseOnlyDETs.set(identityKey, det);
      }

      for (const det of firebaseOnlyDETs.values()) {
        const programKey = getDETProgramKey(det.programId);
        DETsByDateObject[det.date] ??= {};
        DETsByDateObject[det.date][programKey] = removeUndefined(det);
      }
      firebaseOnlyCount = firebaseOnlyDETs.size;
      console.log(`✅ Added ${firebaseOnlyCount} Firebase-only DETs from ${firebaseMergeEnvironment}`);
    }

    fs.writeFileSync(outputPath, JSON.stringify(DETsByDateObject));
    const dateCount = Object.keys(DETsByDateObject).length;
    const finalRecordCount = detsByIdentity.size + firebaseOnlyCount;
    const multiProgramDateCount = Object.values(DETsByDateObject).filter(
      (detsByProgram) => Object.keys(detsByProgram).length > 1
    ).length;
    console.log(`✅ Wrote ${finalRecordCount} DET records across ${dateCount} dates to ${outputPath}`);
    console.log(`✅ ${multiProgramDateCount} dates contain more than one program`);
    return;
  }

  // Update each date/program record independently so current DETs that are
  // not present in the historical CSV import are never removed.
  await db.ref(`${ENVIRONMENT}/DETsByDateMap`).update(DETUpdates);

  console.log(`✅ Uploaded ${detsByIdentity.size} DET records to RTDB at ${ENVIRONMENT}/DETsByDateMap`);

  // Update metadata - triggers DataService to fetch fresh data
  await db.ref(`${ENVIRONMENT}/metadata/lastModified_DETsByDateMap`).set(Date.now());

  console.log("✅ All DETs uploaded successfully!");
  process.exit(0);
}

generateDETs().catch((error) => {
  console.error(LOCAL_JSON_MODE ? "❌ JSON generation failed:" : "❌ Upload failed:", error);
  process.exit(1);
});
