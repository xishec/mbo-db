import * as fs from "fs";
import * as path from "path";
import { fileURLToPath } from "url";
import { DET, Net } from "../src/types/DET.js";
import { db, ENVIRONMENT } from "./firebase-node.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Parse CSV helper
function parseCSV(content: string): Record<string, string>[] {
  const lines = content.split("\n");
  if (lines.length < 2) return [];

  const headers = lines[0].split(",").map((h) => h.trim());
  const data: Record<string, string>[] = [];

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    const values = line.split(",").map((v) => v.trim());
    const row: Record<string, string> = {};

    headers.forEach((header, idx) => {
      row[header] = values[idx] || "";
    });

    data.push(row);
  }

  return data;
}

// Read CSV files
const dailyPath = path.join(__dirname, "../public/data/tblDETDaily.csv");
const speciesPath = path.join(__dirname, "../public/data/tblDETSpecies.csv");
const netHoursPath = path.join(__dirname, "../public/data/tblDETNetHours.csv");

const dailyContent = fs.readFileSync(dailyPath, "utf-8");
const speciesContent = fs.readFileSync(speciesPath, "utf-8");
const netHoursContent = fs.readFileSync(netHoursPath, "utf-8");

const dailyRecords = parseCSV(dailyContent);
const speciesRecords = parseCSV(speciesContent);
const netHoursRecords = parseCSV(netHoursContent);

// Build DETsMap
const DETsMap = new Map<string, DET>();

// Process daily records
dailyRecords.forEach((record) => {
  const date = record.DateEx;
  if (!date) return;

  DETsMap.set(date, {
    date: date,
    programId: record.Program || "",
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
    coverageCode: parseInt(record.CoverageCode) || 0,
    narrative: "",
    deviations: "",
    visitors: [],
    stationManagement: "",
    injuries: [],
    released: [],
    observedSpeciesCount: {},
    census: {
      censuser: undefined,
      start: undefined,
      end: undefined,
      speciesCount: {},
    },
    bandedSpeciesCount: {},
    repeatSpeciesCount: {},
    returnSpeciesCount: {},
    DETSpeciesCount: {},
  });
});

// Process species records
speciesRecords.forEach((record) => {
  const date = record.DateEx;
  if (!date || !DETsMap.has(date)) return;

  const dMap = DETsMap.get(date)!;
  const species = record.Species;

  if (record.Observed && parseInt(record.Observed) > 0) {
    dMap.observedSpeciesCount[species] = parseInt(record.Observed);
  }

  if (record.Census && parseInt(record.Census) > 0) {
    dMap.census.speciesCount[species] = parseInt(record.Census);
  }

  if (record.Banded && parseInt(record.Banded) > 0) {
    dMap.bandedSpeciesCount[species] = parseInt(record.Banded);
  }

  if (record.Repeats && parseInt(record.Repeats) > 0) {
    dMap.repeatSpeciesCount[species] = parseInt(record.Repeats);
  }

  if (record.Returns && parseInt(record.Returns) > 0) {
    dMap.returnSpeciesCount[species] = parseInt(record.Returns);
  }

  if (record.DET && parseInt(record.DET) > 0) {
    dMap.DETSpeciesCount[species] = parseInt(record.DET);
  }
});

// Process net hours records
const netsByDate = new Map<string, Net[]>();
netHoursRecords.forEach((record) => {
  const date = record.DateEx;
  if (!date) return;

  if (!netsByDate.has(date)) {
    netsByDate.set(date, []);
  }

  netsByDate.get(date)!.push({
    id: record.NetID || "",
    open: undefined,
    closed: undefined,
    hours: undefined,
    multiplier: undefined,
    total: record.NetHours || "",
  });
});

// Add net hours to DETs
netsByDate.forEach((nets, date) => {
  if (DETsMap.has(date)) {
    const dMap = DETsMap.get(date)!;
    dMap.netHours.nets = nets;

    // Calculate total net hours if there are nets, otherwise keep SongbirdNets value
    if (nets.length > 0) {
      const total = nets.reduce((sum, net) => sum + (parseFloat(net.total || "0") || 0), 0);
      dMap.netHours.total = (Math.round(total * 100) / 100).toString();
    }
  }
});

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

// Upload to RTDB
async function uploadDETsToRTDB() {
  console.log("Uploading DETs to RTDB...");

  // Convert Map to object and remove undefined values
  const DETsObject: Record<string, DET> = {};
  DETsMap.forEach((dMap, date) => {
    DETsObject[date] = removeUndefined(dMap);
  });

  // Write to Firebase
  await db.ref(`${ENVIRONMENT}/DETsMap`).set(DETsObject);

  console.log(`✅ Uploaded ${DETsMap.size} DET records to RTDB at ${ENVIRONMENT}/DETsMap`);

  // Update metadata - triggers DataService to fetch fresh data
  await db.ref(`${ENVIRONMENT}/metadata/lastModified`).set(Date.now());

  console.log("✅ All DETs uploaded successfully!");
  process.exit(0);
}

uploadDETsToRTDB().catch((error) => {
  console.error("❌ Upload failed:", error);
  process.exit(1);
});
