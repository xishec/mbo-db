import { ref, set, type Database } from "firebase/database";
import {
  Capture,
  NUMERIC_FIELDS,
  HEADER_TO_CAPTURE_PROPERTY,
  BandIdToCaptureIdsMap,
  YearToProgramMap,
  ProgramsMap,
  CapturesMap,
  CaptureType,
  BandGroupToCaptureIdsMap,
} from "../src/helper/helper";
import { SpeciesRange } from "./importMagicTable";

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
export function parseCSV(csvContent: string): Capture[] {
  // Remove BOM if present
  csvContent = csvContent.replace(/^\uFEFF/, "");

  const rows = csvContent.split("\n");
  const headers = parseCSVLine(rows[0]);
  const captures: Capture[] = [];

  const lastRows = rows.slice(-10000);

  for (let i = 1; i < lastRows.length; i++) {
    const row = lastRows[i].trim();
    if (!row) continue;

    const values = parseCSVLine(row);
    const capture = parseCSVRow(headers, values);
    captures.push(capture);
  }

  return captures;
}

/**
 * Parse CSV row into Capture object
 */
function parseCSVRow(headers: string[], values: string[]): Capture {
  const capture: Capture = {} as Capture;
  headers.forEach((header, index) => {
    const value = values[index];
    const captureKey = HEADER_TO_CAPTURE_PROPERTY[header] as keyof Capture;
    if (captureKey) {
      if (NUMERIC_FIELDS.has(header)) {
        (capture[captureKey] as number) = Number(value);
      } else {
        (capture[captureKey] as string) = value;
      }
    }
  });

  capture.bandGroup = `${capture.bandPrefix}-${capture.bandSuffix.slice(0, -2)}`;
  capture.bandLastTwoDigits = capture.bandSuffix.slice(-2);
  capture.bandId = `${capture.bandGroup}${capture.bandLastTwoDigits}`;
  capture.id = `${capture.bandId}-${capture.date}`;
  return capture;
}

/**
 * Import CSV file to RTDB
 */
export async function CSVToRTDB(csvContent: string, database: Database): Promise<void> {
  // console.log(database.type);
  console.log("Parsing CSV...");
  const captures = parseCSV(csvContent);
  console.log(`Parsed ${captures.length} captures`);
  // console.log(captures);

  await generateDB(captures, database);
}

const generateDB = async (captures: Capture[], database: Database) => {
  const yearsToProgramMap: YearToProgramMap = {};
  const programsMap: ProgramsMap = {};
  const bandIdToCaptureIdsMap: BandIdToCaptureIdsMap = {};
  const capturesMap: CapturesMap = {};
  const bandGroupToCaptureIdsMap: BandGroupToCaptureIdsMap = {};
  const mboMagicTable: Record<string, SpeciesRange> = {}; // To implement later

  for (const capture of captures) {
    // capturesMap
    capturesMap[capture.id] = capture;

    // year
    const year = capture.date.slice(0, 4);
    if (!yearsToProgramMap[year]) {
      yearsToProgramMap[year] = [];
    }
    if (!yearsToProgramMap[year].includes(capture.programId)) {
      yearsToProgramMap[year].push(capture.programId);
    }

    // programsMap and bandGroupsMap
    if (!programsMap[capture.programId]) {
      programsMap[capture.programId] = {
        name: capture.programId,
        usedBandGroupIds: [],
        reCaptureIds: [],
      };
    }
    if (!bandGroupToCaptureIdsMap[capture.bandGroup]) {
      bandGroupToCaptureIdsMap[capture.bandGroup] = [];
    }
    if (capture.captureType === CaptureType.Banded) {
      if (!programsMap[capture.programId].usedBandGroupIds.includes(capture.bandGroup)) {
        programsMap[capture.programId].usedBandGroupIds.push(capture.bandGroup);
      }
      if (!bandGroupToCaptureIdsMap[capture.bandGroup].includes(capture.id)) {
        bandGroupToCaptureIdsMap[capture.bandGroup].push(capture.id);
      }
    } else {
      if (!programsMap[capture.programId].reCaptureIds.includes(capture.id)) {
        programsMap[capture.programId].reCaptureIds.push(capture.id);
      }
    }

    // bandIdToCaptureIdsMap
    if (!bandIdToCaptureIdsMap[capture.bandId]) {
      bandIdToCaptureIdsMap[capture.bandId] = [];
    }
    if (!bandIdToCaptureIdsMap[capture.bandId].includes(capture.id)) {
      bandIdToCaptureIdsMap[capture.bandId].push(capture.id);
    }

    if (mboMagicTable[capture.species] === undefined) {
      mboMagicTable[capture.species] = {
        fWeightLower: 1000000,
        fWeightUpper: 0,
        fWingLower: 1000000,
        fWingUpper: 0,
        mWeightLower: 1000000,
        mWeightUpper: 0,
        mWingLower: 1000000,
        mWingUpper: 0,
      };
    }

    if (capture.sex === "4") {
      // male
      mboMagicTable[capture.species].mWeightLower = Math.min(
        mboMagicTable[capture.species].mWeightLower,
        capture.weight
      );
      mboMagicTable[capture.species].mWeightUpper = Math.max(
        mboMagicTable[capture.species].mWeightUpper,
        capture.weight
      );
      mboMagicTable[capture.species].mWingLower = Math.min(mboMagicTable[capture.species].mWingLower, capture.wing);
      mboMagicTable[capture.species].mWingUpper = Math.max(mboMagicTable[capture.species].mWingUpper, capture.wing);
    } else if (capture.sex === "5") {
      // female
      mboMagicTable[capture.species].fWeightLower = Math.min(
        mboMagicTable[capture.species].fWeightLower,
        capture.weight
      );
      mboMagicTable[capture.species].fWeightUpper = Math.max(
        mboMagicTable[capture.species].fWeightUpper,
        capture.weight
      );
      mboMagicTable[capture.species].fWingLower = Math.min(mboMagicTable[capture.species].fWingLower, capture.wing);
      mboMagicTable[capture.species].fWingUpper = Math.max(mboMagicTable[capture.species].fWingUpper, capture.wing);
    }
  }
  // await writeObjectToDB(database, "yearsToProgramMap", yearsToProgramMap);
  // await writeObjectToDB(database, "programsMap", programsMap);
  // await writeObjectToDB(database, "bandIdToCaptureIdsMap", bandIdToCaptureIdsMap);
  // await writeObjectToDB(database, "capturesMap", capturesMap);
  // await writeObjectToDB(database, "bandGroupToCaptureIdsMap", bandGroupToCaptureIdsMap);
  // await writeObjectToDB(database, "magicTable/mbo", mboMagicTable);
};

const writeObjectToDB = async (database: Database, path: string, data: Record<string, unknown>) => {
  const entries = Object.entries(data);
  const BATCH_SIZE = 10000;
  let uploadedCount = 0;

  console.log(`Uploading ${entries.length} records to '${path}' in batches...`);

  for (let i = 0; i < entries.length; i += BATCH_SIZE) {
    const batch = entries.slice(i, i + BATCH_SIZE);
    const promises = batch.map(([key, value]) => set(ref(database, `${path}/${key}`), value));
    await Promise.all(promises);
    uploadedCount += batch.length;
    console.log(`Uploaded ${uploadedCount}/${entries.length} to '${path}'...`);
  }

  console.log(`✅ Import to '${path}' complete! Uploaded ${entries.length} records.`);
};
