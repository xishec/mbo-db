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
  SpeciesRange,
} from "../src/types";

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

  // const lastRows = rows.slice(-10000);
  const lastRows = rows;

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
    if (capture.captureType === CaptureType.None) {
      continue;
    }

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

    if (capture.sex === "4") {
      // male
      if (capture.weight > 0) {
        mboMagicTable[capture.species].mWeightLower = Math.min(
          mboMagicTable[capture.species].mWeightLower,
          capture.weight
        );
        mboMagicTable[capture.species].mWeightUpper = Math.max(
          mboMagicTable[capture.species].mWeightUpper,
          capture.weight
        );
      }
      if (capture.wing > 0) {
        mboMagicTable[capture.species].mWingLower = Math.min(mboMagicTable[capture.species].mWingLower, capture.wing);
        mboMagicTable[capture.species].mWingUpper = Math.max(mboMagicTable[capture.species].mWingUpper, capture.wing);
      }
      if (capture.weight > 0 || capture.wing > 0) {
        mboMagicTable[capture.species].mCounter = (mboMagicTable[capture.species].mCounter ?? 0) + 1;
      }
    } else if (capture.sex === "5") {
      // female
      if (capture.weight > 0) {
        mboMagicTable[capture.species].fWeightLower = Math.min(
          mboMagicTable[capture.species].fWeightLower,
          capture.weight
        );
        mboMagicTable[capture.species].fWeightUpper = Math.max(
          mboMagicTable[capture.species].fWeightUpper,
          capture.weight
        );
      }
      if (capture.wing > 0) {
        mboMagicTable[capture.species].fWingLower = Math.min(mboMagicTable[capture.species].fWingLower, capture.wing);
        mboMagicTable[capture.species].fWingUpper = Math.max(mboMagicTable[capture.species].fWingUpper, capture.wing);
      }
      if (capture.weight > 0 || capture.wing > 0) {
        mboMagicTable[capture.species].fCounter = (mboMagicTable[capture.species].fCounter ?? 0) + 1;
      }
    } else {
      // unknown
      if (capture.weight > 0) {
        mboMagicTable[capture.species].unknownWeightLower = Math.min(
          mboMagicTable[capture.species].unknownWeightLower,
          capture.weight
        );
        mboMagicTable[capture.species].unknownWeightUpper = Math.max(
          mboMagicTable[capture.species].unknownWeightUpper,
          capture.weight
        );
      }
      if (capture.wing > 0) {
        mboMagicTable[capture.species].unknownWingLower = Math.min(
          mboMagicTable[capture.species].unknownWingLower,
          capture.wing
        );
        mboMagicTable[capture.species].unknownWingUpper = Math.max(
          mboMagicTable[capture.species].unknownWingUpper,
          capture.wing
        );
      }
      if (capture.weight > 0 || capture.wing > 0) {
        mboMagicTable[capture.species].unknownCounter = (mboMagicTable[capture.species].unknownCounter ?? 0) + 1;
      }
    }
  }

  await set(ref(database, "yearsToProgramMap"), yearsToProgramMap);
  await set(ref(database, "programsMap"), programsMap);
  await set(ref(database, "bandIdToCaptureIdsMap"), bandIdToCaptureIdsMap);
  await set(ref(database, "capturesMap"), capturesMap);
  await set(ref(database, "bandGroupToCaptureIdsMap"), bandGroupToCaptureIdsMap);
  await set(ref(database, "magicTable/mbo"), mboMagicTable);

  console.log("✅ Generated RTDB structure");
};
