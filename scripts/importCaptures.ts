import { ref, set, type Database } from "firebase/database";
import type { Capture } from "../src/types/Capture";
import type { Bands } from "../src/types/Bands";
import { writeFileSync } from "fs";
import { join } from "path";

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
export async function importCSVToRTDB(
  csvContent: string,
  database: Database
): Promise<void> {
  console.log("Parsing CSV...");
  const captures = parseCSV(csvContent);
  console.log(`Parsed ${captures.length} captures`);

  console.log("Grouping by band...");
  const bands = groupCapturesByBand(captures);

  console.log("Converting to object...");
  const bandsObject = Object.fromEntries(bands);

  console.log("Saving to file...");
  const outputPath = join(process.cwd(), "public", "data", "bands.json");
  writeFileSync(outputPath, JSON.stringify(bandsObject, null, 2));
  console.log(`Saved to ${outputPath}`);

  console.log("Uploading to RTDB...");
  await set(ref(database, "bands"), bandsObject);

  console.log(`✅ Import complete! Uploaded ${bands.size} bands.`);
}
