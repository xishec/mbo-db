import { ref, set, type Database } from "firebase/database";
import { NUMERIC_FIELDS } from "../src/constants/constants";
import {
  BandGroup,
  Capture,
  generateBandGroupId,
  generateCaptureId,
  Program,
  Year,
} from "../src/types/types";
import { headerToCaptureProperty } from "./helper";

/**
 * Parse CSV content into array of RawCaptureData
 */
export function parseCSV(csvContent: string): Capture[] {
  // Remove BOM if present
  csvContent = csvContent.replace(/^\uFEFF/, "");

  const rows = csvContent.split("\n");
  const headers = rows[0].split(",");
  const captures: Capture[] = [];

  for (let i = 1; i < rows.length; i++) {
    const row = rows[i].trim();
    if (!row) continue;

    const values = row.split(",");
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

  capture.id = generateCaptureId(
    capture.bandPrefix,
    capture.bandSuffix,
    capture.date
  );
  return capture;
}

/**
 * Import CSV file to RTDB
 */
export async function CSVToRTDB(
  csvContent: string,
  database: Database
): Promise<void> {
  // console.log(database.type);
  console.log("Parsing CSV...");
  const captures = parseCSV(csvContent);
  console.log(`Parsed ${captures.length} captures`);
  // console.log(captures);

  await generateDB(captures, database);
}

const generateDB = async (captures: Capture[], database: Database) => {
  const yearsMap: Map<string, Year> = new Map();
  const programsMap: Map<string, Program> = new Map();
  const bandGroupsMap: Map<string, BandGroup> = new Map();
  const capturesMap: Map<string, Capture> = new Map();

  for (const capture of captures) {
    capturesMap.set(capture.id, capture);

    const year = capture.date.slice(0, 4);
    const program = capture.program;
    const bandGroupId = generateBandGroupId(
      capture.bandPrefix,
      capture.bandSuffix
    );
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

const writeObjectToDB = async (
  database: Database,
  path: string,
  data: Map<string, unknown>
) => {
  const entries = Array.from(data.entries());
  const BATCH_SIZE = 10000;
  let uploadedCount = 0;

  console.log(`Uploading ${entries.length} records to '${path}' in batches...`);

  for (let i = 0; i < entries.length; i += BATCH_SIZE) {
    const batch = entries.slice(i, i + BATCH_SIZE);
    const promises = batch.map(([key, value]) =>
      set(ref(database, `${path}/${key}`), value)
    );
    await Promise.all(promises);
    uploadedCount += batch.length;
    console.log(`Uploaded ${uploadedCount}/${entries.length} to '${path}'...`);
  }

  console.log(
    `✅ Import to '${path}' complete! Uploaded ${entries.length} records.`
  );
};
