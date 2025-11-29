import { ref, set, type Database } from "firebase/database";
import { NUMERIC_FIELDS } from "../src/constants/constants";
import {
  BandGroupsMap,
  Capture,
  CapturesMap,
  generateBandGroupId,
  generateCaptureId,
  ProgramsMap,
  YearsMap,
} from "../src/types/types";
import { headerToCaptureProperty } from "./helper";

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

  for (let i = 1; i < rows.length; i++) {
    const row = rows[i].trim();
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
    const captureKey = headerToCaptureProperty[header] as keyof Capture;
    if (captureKey) {
      if (NUMERIC_FIELDS.has(header)) {
        (capture[captureKey] as number) = Number(value);
      } else {
        (capture[captureKey] as string) = value;
      }
    }
  });

  capture.id = generateCaptureId(capture.bandPrefix, capture.bandSuffix, capture.date);
  capture.lastTwoDigits = capture.bandSuffix.slice(-2);
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
  const yearsMap: YearsMap = new Map();
  const programsMap: ProgramsMap = new Map();
  const bandGroupsMap: BandGroupsMap = new Map();
  const capturesMap: CapturesMap = new Map();

  for (const capture of captures) {
    capturesMap.set(capture.id, capture);

    const year = capture.date.slice(0, 4);
    const program = capture.program;
    const bandGroupId = generateBandGroupId(capture.bandPrefix, capture.bandSuffix);
    const captureId = capture.id;
    if (year && program && bandGroupId) {
      if (!yearsMap.has(year)) {
        yearsMap.set(year, { id: year, programs: new Set([program]) });
      } else {
        yearsMap.get(year)!.programs.add(program);
      }

      if (!programsMap.has(program)) {
        programsMap.set(program, {
          name: program,
          bandGroupIds: new Set([bandGroupId]),
          recaptureIds: new Set([captureId]),
        });
      } else {
        programsMap.get(program)!.bandGroupIds.add(bandGroupId);
        programsMap.get(program)!.recaptureIds.add(captureId);
      }

      if (!bandGroupsMap.has(bandGroupId)) {
        bandGroupsMap.set(bandGroupId, {
          id: bandGroupId,
          captureIds: new Set([captureId]),
        });
      } else {
        bandGroupsMap.get(bandGroupId)!.captureIds.add(captureId);
      }
    }
  }

  await writeObjectToDB(database, "yearsMap", yearsMap);
  await writeObjectToDB(database, "programsMap", programsMap);
  await writeObjectToDB(database, "bandGroupsMap", bandGroupsMap);
  await writeObjectToDB(database, "capturesMap", capturesMap);
};

const writeObjectToDB = async (database: Database, path: string, data: Map<string, unknown>) => {
  const entries = Array.from(data.entries());
  const BATCH_SIZE = 10000;
  let uploadedCount = 0;

  console.log(`Uploading ${entries.length} records to '${path}' in batches...`);

  // Helper to convert Sets to arrays recursively
  const serializeValue = (value: unknown): unknown => {
    if (value instanceof Set) {
      return Array.from(value);
    }
    if (value instanceof Map) {
      const obj: Record<string, unknown> = {};
      for (const [k, v] of value.entries()) {
        obj[String(k)] = serializeValue(v);
      }
      return obj;
    }
    if (Array.isArray(value)) {
      return value.map(serializeValue);
    }
    if (value !== null && typeof value === "object") {
      const obj: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(value)) {
        obj[k] = serializeValue(v);
      }
      return obj;
    }
    return value;
  };

  for (let i = 0; i < entries.length; i += BATCH_SIZE) {
    const batch = entries.slice(i, i + BATCH_SIZE);
    const promises = batch.map(([key, value]) => set(ref(database, `${path}/${key}`), serializeValue(value)));
    await Promise.all(promises);
    uploadedCount += batch.length;
    console.log(`Uploaded ${uploadedCount}/${entries.length} to '${path}'...`);
  }

  console.log(`✅ Import to '${path}' complete! Uploaded ${entries.length} records.`);
};
