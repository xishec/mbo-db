import { readFileSync } from "fs";
import { join } from "path";
import { db } from "./firebase-node";
import { ref, set, type Database } from "firebase/database";
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
  SpeciesRange,
} from "../src/types";

async function main() {
  try {
    await set(ref(db, "alpha"), {});

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

main();

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
  // Remove BOM if present
  csvContent = csvContent.replace(/^\uFEFF/, "");

  const rows = csvContent.split("\n");
  const headers = parseCSVLine(rows[0]);
  const birdEvents: BirdEvent[] = [];

  const lastRows = rows.slice(-10000);
  // const lastRows = rows;

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
        birdEvent.date = value;
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
      default:
        break;
    }
  });

  birdEvent.id = crypto.randomUUID();
  birdEvent.band = new Band(bandPrefix, bandSuffix);
  birdEvent.time = "10:00";
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
  const mboMagicTable: Record<string, SpeciesRange> = {};

  for (const birdEvent of birdEvents) {
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

    // bandGroupsMap
    const bandGroupId = birdEvent.band.bandGroupId;
    const birdEventType = birdEvent.birdEventType;
    if (bandGroupId && birdEventType === BirdEventType.Banded) {
      if (!bandGroupsMap[bandGroupId]) {
        bandGroupsMap[bandGroupId] = {
          id: bandGroupId,
          captureIds: [],
        } as BandGroup;
      }
      bandGroupsMap[bandGroupId].captureIds.push(birdEventId);
    }

    // programsMap
    const programId = birdEvent.programId;
    if (programId) {
      if (!programsMap[programId]) {
        programsMap[programId] = {
          id: programId,
          bandGroupIds: [],
          recaptureIds: [],
        };
      }
      if (birdEventType === BirdEventType.Banded) {
        programsMap[programId].bandGroupIds.push(bandGroupId);
      } else {
        programsMap[programId].recaptureIds.push(birdEventId);
      }
    }

    // BandIdToBirdEventIdsMap
    (bandIdToBirdEventIdsMap[birdEvent.band.id] ??= []).push(birdEventId);

    // mboMagicTable
    if (mboMagicTable[birdEvent.species] === undefined) {
      mboMagicTable[birdEvent.species] = {
        fWeightLower: 1000000,
        fWeightUpper: 0,
        fWingLower: 1000000,
        fWingUpper: 0,
        fCounter: 0,
        mWeightLower: 1000000,
        mWeightUpper: 0,
        mWingLower: 1000000,
        mWingUpper: 0,
        mCounter: 0,
        unknownWeightLower: 1000000,
        unknownWeightUpper: 0,
        unknownWingLower: 1000000,
        unknownWingUpper: 0,
        unknownCounter: 0,
      };
    }

    if (birdEvent.sex === "4") {
      // male
      if (birdEvent.weight > 0) {
        mboMagicTable[birdEvent.species].mWeightLower = Math.min(
          mboMagicTable[birdEvent.species].mWeightLower,
          birdEvent.weight
        );
        mboMagicTable[birdEvent.species].mWeightUpper = Math.max(
          mboMagicTable[birdEvent.species].mWeightUpper,
          birdEvent.weight
        );
      }
      if (birdEvent.wing > 0) {
        mboMagicTable[birdEvent.species].mWingLower = Math.min(
          mboMagicTable[birdEvent.species].mWingLower,
          birdEvent.wing
        );
        mboMagicTable[birdEvent.species].mWingUpper = Math.max(
          mboMagicTable[birdEvent.species].mWingUpper,
          birdEvent.wing
        );
      }
      if (birdEvent.weight > 0 || birdEvent.wing > 0) {
        mboMagicTable[birdEvent.species].mCounter = (mboMagicTable[birdEvent.species].mCounter ?? 0) + 1;
      }
    } else if (birdEvent.sex === "5") {
      // female
      if (birdEvent.weight > 0) {
        mboMagicTable[birdEvent.species].fWeightLower = Math.min(
          mboMagicTable[birdEvent.species].fWeightLower,
          birdEvent.weight
        );
        mboMagicTable[birdEvent.species].fWeightUpper = Math.max(
          mboMagicTable[birdEvent.species].fWeightUpper,
          birdEvent.weight
        );
      }
      if (birdEvent.wing > 0) {
        mboMagicTable[birdEvent.species].fWingLower = Math.min(
          mboMagicTable[birdEvent.species].fWingLower,
          birdEvent.wing
        );
        mboMagicTable[birdEvent.species].fWingUpper = Math.max(
          mboMagicTable[birdEvent.species].fWingUpper,
          birdEvent.wing
        );
      }
      if (birdEvent.weight > 0 || birdEvent.wing > 0) {
        mboMagicTable[birdEvent.species].fCounter = (mboMagicTable[birdEvent.species].fCounter ?? 0) + 1;
      }
    } else {
      // unknown
      if (birdEvent.weight > 0) {
        mboMagicTable[birdEvent.species].unknownWeightLower = Math.min(
          mboMagicTable[birdEvent.species].unknownWeightLower,
          birdEvent.weight
        );
        mboMagicTable[birdEvent.species].unknownWeightUpper = Math.max(
          mboMagicTable[birdEvent.species].unknownWeightUpper,
          birdEvent.weight
        );
      }
      if (birdEvent.wing > 0) {
        mboMagicTable[birdEvent.species].unknownWingLower = Math.min(
          mboMagicTable[birdEvent.species].unknownWingLower,
          birdEvent.wing
        );
        mboMagicTable[birdEvent.species].unknownWingUpper = Math.max(
          mboMagicTable[birdEvent.species].unknownWingUpper,
          birdEvent.wing
        );
      }
      if (birdEvent.weight > 0 || birdEvent.wing > 0) {
        mboMagicTable[birdEvent.species].unknownCounter = (mboMagicTable[birdEvent.species].unknownCounter ?? 0) + 1;
      }
    }
  }

  console.log("Uploading data to RTDB...");

  await set(ref(db, "alpha/yearsToProgramMap"), yearsToProgramMap);
  await set(ref(db, "alpha/programsMap"), programsMap);
  await writeObjectToDB(db, "alpha/bandIdToBirdEventIdsMap", bandIdToBirdEventIdsMap);
  await writeObjectToDB(db, "alpha/birdEventsMap", birdEventsMap);
  await writeObjectToDB(db, "alpha/bandGroupsMap", bandGroupsMap);
  await set(ref(db, "alpha/magicTable/mbo"), mboMagicTable);

  // Update lastUpdated timestamp
  const lastUpdated = Date.now();
  await set(ref(db, "alpha/metadata/lastUpdated"), lastUpdated);
  console.log(`Set lastUpdated timestamp: ${lastUpdated}`);

  console.log("✅ All data uploaded successfully!");
}

const writeObjectToDB = async (db: Database, path: string, data: Record<string, unknown>) => {
  const entries = Object.entries(data);
  const BATCH_SIZE = 1000;
  let uploadedCount = 0;

  console.log(`Uploading ${entries.length} records to '${path}' in batches...`);

  for (let i = 0; i < entries.length; i += BATCH_SIZE) {
    const batch = entries.slice(i, i + BATCH_SIZE);
    const promises = batch.map(([key, value]) => set(ref(db, `${path}/${key}`), value));
    await Promise.all(promises);
    uploadedCount += batch.length;
    console.log(`Uploaded ${uploadedCount}/${entries.length} to '${path}'...`);
  }

  console.log(`✅ Import to '${path}' complete! Uploaded ${entries.length} records.`);
};
