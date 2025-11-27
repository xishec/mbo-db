import { ref, set } from "firebase/database";
import { db } from "../firebase";
import type { Capture } from "../types/Capture";
import type { Band } from "../types/Band";

const VALID_FIELDS = new Set([
  "IDBand",
  "Disposition",
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
function groupCapturesByBand(captures: Capture[]): Map<string, Capture[]> {
  const bandMap = new Map<string, Capture[]>();
  
  for (const capture of captures) {
    // Skip if missing required fields
    if (!capture.IDBand) continue;
    
    // Extract band ID from IDBand (format varies, but we'll use the full IDBand as the key)
    const bandId = capture.IDBand;
    
    if (!bandMap.has(bandId)) {
      bandMap.set(bandId, []);
    }
    bandMap.get(bandId)!.push(capture);
  }
  
  return bandMap;
}

/**
 * Import captures to RTDB grouped by band
 */
export async function importCapturesToRTDB(captures: Capture[]): Promise<void> {
  const bandMap = groupCapturesByBand(captures);
  
  console.log(`Starting import of ${captures.length} captures grouped into ${bandMap.size} bands...`);
  
  let processedBands = 0;
  const totalBands = bandMap.size;
  
  for (const [bandId, bandCaptures] of bandMap.entries()) {
    const bandRef = ref(db, `bands/${bandId}`);
    const bandData: Band = {
      id: bandId,
      captures: bandCaptures,
    };
    
    await set(bandRef, bandData);
    processedBands++;
    
    if (processedBands % 100 === 0) {
      console.log(`Processed ${processedBands} / ${totalBands} bands`);
    }
  }
  
  console.log(`Import complete! Processed ${processedBands} bands with ${captures.length} captures.`);
}

/**
 * Import CSV file to RTDB
 */
export async function importCSVToRTDB(csvContent: string): Promise<void> {
  const captures = parseCSV(csvContent);
  await importCapturesToRTDB(captures);
}
