import { readFileSync } from "fs";
import { join } from "path";
import { db, ENVIRONMENT } from "./firebase-node";
import type { Database } from "firebase-admin/database";
import {
  BirdEvent,
  BirdEventType,
  HEADERS,
  Band,
  YearToProgramMap,
  ProgramsMap,
  BandIdToBirdEventIdsMap,
  BirdEventsMap,
  BandGroupsMap,
  BandGroup,
  BandersMap,
  generateBirdEventId,
} from "../src/types";

async function main() {
  try {
    console.log("Reading CSV file...");
    const csvPath = join(process.cwd(), "public", "data", "tblCaptures.csv");
    const csvContent = readFileSync(csvPath, "utf-8");

    console.log("Starting RTDB import...");
    await CSVToRTDB(csvContent, db);

    console.log("Importing magic table...");
    const { importMagicTable } = await import("./importMagicTable");
    await importMagicTable();

    console.log("✅ Import completed successfully!");
    process.exit(0);
  } catch (error) {
    console.error("❌ Import failed:", error);
    process.exit(1);
  }
}

const isDirectRun = process.argv[1]?.endsWith("import.ts");
if (isDirectRun) main();

/**
 * Parse a single CSV line respecting quoted fields (handles commas inside quotes)
 */
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
          // Escaped quote ("") -> add single quote
          current += '"';
          i++; // Skip next quote
        } else {
          // End of quoted field
          inQuotes = false;
        }
      } else {
        current += char;
      }
    } else {
      if (char === '"') {
        // Start of quoted field
        inQuotes = true;
      } else if (char === ",") {
        // Field separator
        result.push(current);
        current = "";
      } else {
        current += char;
      }
    }
  }

  // Don't forget the last field
  result.push(current);

  return result;
}

/**
 * Parse CSV content into array of RawCaptureData
 */
export function parseCSV(csvContent: string): BirdEvent[] {
  // Remove BOM and normalize line endings
  csvContent = csvContent.replace(/^\uFEFF/, "").replace(/\r\n/g, "\n").replace(/\r/g, "\n");

  const rows = csvContent.split("\n");
  const headers = parseCSVLine(rows[0]);
  const birdEvents: BirdEvent[] = [];

  // const lastRows = rows.slice(-5000);
  const lastRows = rows;

  for (let i = 1; i < lastRows.length; i++) {
    const row = lastRows[i].trim();
    if (!row) continue;

    const values = parseCSVLine(row);
    const birdEvent = parseCSVRow(headers, values);
    birdEvents.push(birdEvent);
  }

  return birdEvents;
}

/**
 * Parse CSV row into Capture object
 */

// WingChord,
// Weight,
// Fat,

/**
 * Convert "M/D/YYYY 0:00:00" or "YYYY-MM-DD" to "YYYY-MM-DD"
 */
function normalizeDate(value: string): string {
  if (!value) return "";
  // Already in YYYY-MM-DD format
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
  // M/D/YYYY with optional time
  const match = value.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (match) {
    const [, month, day, year] = match;
    return `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
  }
  return value;
}

/**
 * Extract time from "12/30/1899 H:MM:SS" or "HH:MM" formats
 * Normalizes to "HH:MM" with zero-padded hour
 */
function normalizeTime(value: string): string {
  if (!value) return "";
  // Extract time portion after space if present (e.g. "12/30/1899 9:20:00")
  const timePart = value.includes(" ") ? value.slice(value.indexOf(" ") + 1) : value;
  // Match H:MM or HH:MM (with optional :SS)
  const match = timePart.match(/^(\d{1,2}):(\d{2})/);
  if (match) {
    return match[1].padStart(2, "0") + ":" + match[2];
  }
  return "";
}

function parseCSVRow(headers: string[], values: string[]): BirdEvent {
  const birdEvent = {} as BirdEvent;
  let bandPrefix = "";
  let bandSuffix = "";
  headers.forEach((header, index) => {
    const value = values[index];
    switch (header) {
      case HEADERS.Program:
        birdEvent.programId = value;
        break;
      case HEADERS.BandPrefix:
        bandPrefix = value;
        break;
      case HEADERS.BandSuffix:
        bandSuffix = value;
        break;
      case HEADERS.Species:
        birdEvent.species = value;
        break;
      case HEADERS.WingChord:
        birdEvent.wing = Number(value);
        break;
      case HEADERS.Age:
        birdEvent.age = value;
        break;
      case HEADERS.HowAged:
        birdEvent.howAged = value;
        break;
      case HEADERS.Sex:
        birdEvent.sex = value;
        break;
      case HEADERS.HowSexed:
        birdEvent.howSexed = value;
        break;
      case HEADERS.Fat:
        birdEvent.fat = Number(value);
        break;
      case HEADERS.Weight:
        birdEvent.weight = Number(value);
        break;
      case HEADERS.CaptureDate:
        birdEvent.date = normalizeDate(value);
        break;
      case HEADERS.Bander:
        birdEvent.bander = value;
        break;
      case HEADERS.Scribe:
        birdEvent.scribe = value;
        break;
      case HEADERS.Net:
        birdEvent.net = value;
        break;
      case HEADERS.NotesForMBO:
        birdEvent.notes = value;
        break;
      case HEADERS.D18:
        birdEvent.birdEventType = value as unknown as BirdEventType;
        break;
      case HEADERS.BirdStatus:
        birdEvent.birdStatus = value;
        break;
      case HEADERS.WeightTime:
        birdEvent.time = normalizeTime(value);
        break;
      default:
        break;
    }
  });

  // Ensure bandPrefix and bandSuffix have correct padding
  bandPrefix = bandPrefix.padStart(4, "0");
  bandSuffix = bandSuffix.padStart(5, "0");
  
  birdEvent.band = new Band(bandPrefix, bandSuffix);
  birdEvent.id = generateBirdEventId(
    birdEvent.band.id,
    birdEvent.date!,
    birdEvent.net!,
    String(birdEvent.wing),
    String(birdEvent.weight)
  );
  // Set updatedAt using date and time from the bird event as millisecond timestamp
  birdEvent.updatedAt = String(Date.parse(`${birdEvent.date} ${birdEvent.time}`));
  return birdEvent;
}

/**
 * Import CSV file to RTDB
 */
export async function CSVToRTDB(csvContent: string, db: Database): Promise<void> {
  console.log("Parsing CSV...");
  const birdEvents = parseCSV(csvContent);
  console.log(`Parsed ${birdEvents.length} band events`);

  await generateDB(birdEvents, db);
}

async function generateDB(birdEvents: BirdEvent[], db: Database) {
  const birdEventsMap: BirdEventsMap = {};
  const yearsToProgramMap: YearToProgramMap = {};
  const bandGroupsMap: BandGroupsMap = {};
  const programsMap: ProgramsMap = {};
  const bandIdToBirdEventIdsMap: BandIdToBirdEventIdsMap = {};
  const bandersMap: BandersMap = {};

  for (const birdEvent of birdEvents) {
    if (!birdEvent.date) continue;
    if (!birdEvent.programId) birdEvent.programId = "NONE";

    // birdEventsMap
    const birdEventId = birdEvent.id;
    birdEventsMap[birdEventId] = birdEvent;

    // yearsToProgramMap
    const year = birdEvent.date?.slice(0, 4);
    if (year) {
      if (!yearsToProgramMap[year]) {
        yearsToProgramMap[year] = [];
      }
      if (!yearsToProgramMap[year].includes(birdEvent.programId)) {
        yearsToProgramMap[year].push(birdEvent.programId);
      }
    }

    // bandGroupsMap - use map key helper for -00 bands
    const bandGroupMapKey = birdEvent.band.last2digits === "00"
      ? (parseInt(birdEvent.band.bandGroupId, 10) - 1).toString().padStart(7, "0")
      : birdEvent.band.bandGroupId;
    const birdEventType = birdEvent.birdEventType;
    const isNewCapture = birdEventType === BirdEventType.Banded || birdEventType === BirdEventType.None;
    if (bandGroupMapKey && isNewCapture) {
      if (!bandGroupsMap[bandGroupMapKey]) {
        bandGroupsMap[bandGroupMapKey] = {
          id: bandGroupMapKey,
          newCaptureIds: [],
        } as BandGroup;
      }
      bandGroupsMap[bandGroupMapKey].newCaptureIds.push(birdEventId);
    }

    // programsMap
    const programId = birdEvent.programId;
    if (programId) {
      if (!programsMap[programId]) {
        programsMap[programId] = {
          id: programId,
          displayName: programId,
          bandGroupIds: [],
          recaptureIds: [],
        };
      }
      if (isNewCapture && !programsMap[programId].bandGroupIds.includes(bandGroupMapKey)) {
        programsMap[programId].bandGroupIds.push(bandGroupMapKey);
      }
      if (!isNewCapture && !programsMap[programId].recaptureIds.includes(birdEventId)) {
        programsMap[programId].recaptureIds.push(birdEventId);
      }

      // Track first/last capture dates
      const date = birdEvent.date;
      if (date) {
        const prog = programsMap[programId];
        if (!prog.firstCaptureDate || date < prog.firstCaptureDate) prog.firstCaptureDate = date;
        if (!prog.lastCaptureDate || date > prog.lastCaptureDate) prog.lastCaptureDate = date;
      }
    }

    // BandIdToBirdEventIdsMap
    (bandIdToBirdEventIdsMap[birdEvent.band.id] ??= []).push(birdEventId);

    // bandersMap
    const banderCode = birdEvent.bander;
    if (banderCode && isNewCapture) {
      if (!bandersMap[banderCode]) bandersMap[banderCode] = { code: banderCode, fullName: "", totalBanded: 0, totalScribed: 0 };
      bandersMap[banderCode].totalBanded++;
    }
    const scribeCode = birdEvent.scribe;
    if (scribeCode) {
      if (!bandersMap[scribeCode]) bandersMap[scribeCode] = { code: scribeCode, fullName: "", totalBanded: 0, totalScribed: 0 };
      bandersMap[scribeCode].totalScribed++;
    }
  }

  console.log("Uploading data to RTDB...");

  await db.ref(`${ENVIRONMENT}/yearsToProgramMap`).set(yearsToProgramMap);
  await db.ref(`${ENVIRONMENT}/programsMap`).set(programsMap);
  await writeObjectToDB(db, `${ENVIRONMENT}/bandIdToBirdEventIdsMap`, bandIdToBirdEventIdsMap);
  await writeObjectToDB(db, `${ENVIRONMENT}/birdEventsMap`, birdEventsMap);
  await writeObjectToDB(db, `${ENVIRONMENT}/bandGroupsMap`, bandGroupsMap);
  await db.ref(`${ENVIRONMENT}/bandersMap`).set(bandersMap);

  // Set lastModified timestamp to signal clients that data has been updated
  await db.ref(`${ENVIRONMENT}/metadata/lastModified`).set(Date.now());
  await db.ref(`${ENVIRONMENT}/metadata/dbVersion`).set(Date.now());

  console.log("✅ All data uploaded successfully!");
}

const writeObjectToDB = async (db: Database, path: string, data: Record<string, unknown>) => {
  const entries = Object.entries(data);
  const BATCH_SIZE = 1000;
  let uploadedCount = 0;

  console.log(`Uploading ${entries.length} records to '${path}' in batches...`);

  for (let i = 0; i < entries.length; i += BATCH_SIZE) {
    const batch = entries.slice(i, i + BATCH_SIZE);
    const promises = batch.map(([key, value]) => db.ref(`${path}/${key}`).set(value));
    await Promise.all(promises);
    uploadedCount += batch.length;
    console.log(`Uploaded ${uploadedCount}/${entries.length} to '${path}'...`);
  }

  console.log(`✅ Import to '${path}' complete! Uploaded ${entries.length} records.`);
};
