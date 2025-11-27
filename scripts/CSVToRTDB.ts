import { ref, set, type Database } from "firebase/database";
import type { Capture } from "../src/types/Capture";
import type { Bands } from "../src/types/Bands";

const VALID_FIELDS = new Set([
  "IDBand",
  "Disposition",
  "BandPrefix",
  "BandSuffix",
  "Species",
  "WingChord",
  "Age",
  "HowAged",
  "Sex",
  "HowSexed",
  "Fat",
  "Weight",
  "CaptureDate",
  "Bander",
  "Scribe",
  "Net",
  "NotesForMBO",
  "Location",
  "BirdStatus",
  "PresentCondition",
  "HowObtainedCode",
  "Program",
  "D18",
  "D20",
  "D22",
]);
const NUMERIC_FIELDS = new Set(["WingChord", "Weight"]);

/**
 * Parse CSV row into Capture object
 */
function parseCSVRow(headers: string[], values: string[]): Capture {
  const capture: Record<string, string | number> = {};
  headers.forEach((header, index) => {
    if (VALID_FIELDS.has(header)) {
      const value = values[index];
      if (value) {
        if (NUMERIC_FIELDS.has(header)) {
          capture[header] = Number(value);
        } else {
          capture[header] = value;
        }
      }
    }
  });
  return capture;
}

/**
 * Parse CSV content into array of Capture objects
 */
export function parseCSV(csvContent: string): Capture[] {
  // Remove BOM if present
  csvContent = csvContent.replace(/^\uFEFF/, "");

  const lines = csvContent.split("\n");
  const headers = lines[0].split(",");
  const captures: Capture[] = [];

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    const values = line.split(",");
    const capture = parseCSVRow(headers, values);
    captures.push(capture);
  }

  return captures;
}

/**
 * Group captures by band ID (BandPrefix-BandSuffix)
 */
function groupCapturesByBand(captures: Capture[]): Bands {
  const bands: Bands = new Map<string, Capture[]>();

  for (const capture of captures) {
    const bandId = capture.BandPrefix + "-" + capture.BandSuffix;

    if (!bands.has(bandId)) {
      bands.set(bandId, []);
    }
    bands.get(bandId)!.push(capture);
  }

  console.log(
    `Grouped ${captures.length} captures into ${bands.size} bands for import.`
  );

  return bands;
}

/**
 * Import CSV file to RTDB
 */
export async function CSVToRTDB(
  csvContent: string,
  database: Database
): Promise<void> {
  console.log("Parsing CSV...");
  const captures = parseCSV(csvContent);
  console.log(`Parsed ${captures.length} captures`);

  console.log("Grouping by band...");
  const bands = groupCapturesByBand(captures);

  // console.log("Uploading to RTDB in batches...");
  // const BATCH_SIZE = 10000;
  // const bandEntries = Array.from(bands.entries());
  // let uploadedCount = 0;

  // for (let i = 0; i < bandEntries.length; i += BATCH_SIZE) {
  //   const batch = bandEntries.slice(i, i + BATCH_SIZE);

  //   // Batch multiple writes into a single Promise.all()
  //   const promises = batch.map(([bandId, captures]) =>
  //     set(ref(database, `bands/${bandId}`), captures)
  //   );
  //   await Promise.all(promises);

  //   uploadedCount += batch.length;
  //   console.log(`Uploaded ${uploadedCount}/${bands.size} bands...`);
  // }
  // console.log(`✅ Import complete! Uploaded ${bands.size} bands.`);

  // Build and upload programs map: programName -> [bandId]
  console.log("Building programs map...");
  const programs = new Map<string, Set<string>>();

  for (const [bandId, captures] of bands.entries()) {
    for (const capture of captures) {
      const program = (capture as Capture).Program?.trim();
      if (!program) continue;
      if (!programs.has(program)) {
        programs.set(program, new Set<string>());
      }
      programs.get(program)!.add(bandId);
    }
  }
  // Convert Map<program, Set<bandId>> to plain object for RTDB
  const programsObject: Record<string, string[]> = {};
  for (const [program, bandSet] of programs.entries()) {
    programsObject[program] = Array.from(bandSet).sort();
  }

  console.log("Uploading programs map to RTDB...");
  await set(ref(database, `programs`), programsObject);
}
