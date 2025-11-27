import { collection, writeBatch, doc } from "firebase/firestore";
import { db } from "../firebase";
import type { Capture } from "../types/Capture";

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
  "WeightTime",
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
 * Import captures to Firestore in batches
 * Firestore has a limit of 500 writes per batch
 */
export async function importCapturesToFirestore(
  captures: Capture[]
): Promise<void> {
  const BATCH_SIZE = 500;
  const capturesCollection = collection(db, "captures");

  let batch = writeBatch(db);
  let batchCount = 0;
  let totalImported = 0;

  console.log(`Starting import of ${captures.length} captures...`);

  for (const capture of captures) {
    // Create a new document reference
    const docRef = doc(capturesCollection);
    batch.set(docRef, { ...capture });
    batchCount++;

    // Commit batch when it reaches the limit
    if (batchCount === BATCH_SIZE) {
      await batch.commit();
      totalImported += batchCount;
      console.log(`Imported ${totalImported} / ${captures.length} captures`);

      // Start a new batch
      batch = writeBatch(db);
      batchCount = 0;
    }
  }

  // Commit remaining items
  if (batchCount > 0) {
    await batch.commit();
    totalImported += batchCount;
    console.log(`Imported ${totalImported} / ${captures.length} captures`);
  }

  console.log("Import complete!");
}

/**
 * Import CSV file to Firestore
 */
export async function importCSVToFirestore(csvContent: string): Promise<void> {
  const captures = parseCSV(csvContent);
  const hi = captures.splice(captures.length - 1000, 1000);
  // console.log(hi.length);
  await importCapturesToFirestore(hi);
}
