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

// /**
//  * Group captures by band ID (BandPrefix-BandSuffix)
//  */
// function groupCapturesByBand(captures: Capture[]): Bands {
//   const bands: Bands = new Map<string, Capture[]>();

//   for (const capture of captures) {
//     const bandId = capture.BandPrefix + "-" + capture.BandSuffix;

//     if (!bands.has(bandId)) {
//       bands.set(bandId, []);
//     }
//     bands.get(bandId)!.push(capture);
//   }

//   console.log(
//     `Grouped ${captures.length} captures into ${bands.size} bands for import.`
//   );

//   return bands;
// }

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

  generateDB(captures, database);

  // console.log("Grouping by band...");
  // const bands = groupCapturesByBand(captures);

  // if (false) {
  //   console.log("Uploading to RTDB in batches...");
  //   const BATCH_SIZE = 10000;
  //   const bandEntries = Array.from(bands.entries());
  //   let uploadedCount = 0;

  //   for (let i = 0; i < bandEntries.length; i += BATCH_SIZE) {
  //     const batch = bandEntries.slice(i, i + BATCH_SIZE);

  //     // Batch multiple writes into a single Promise.all()
  //     const promises = batch.map(([bandId, captures]) =>
  //       set(ref(database, `bands/${bandId}`), captures)
  //     );
  //     await Promise.all(promises);

  //     uploadedCount += batch.length;
  //     console.log(`Uploaded ${uploadedCount}/${bands.size} bands...`);
  //   }
  //   console.log(`✅ Import complete! Uploaded ${bands.size} bands.`);
  // }

  // // Build programs and years maps in one pass
  // console.log("Building programs and years maps...");
  // const programs = new Map<string, Set<string>>(); // program -> bandIds
  // const years = new Map<string, Set<string>>(); // year -> programs

  // for (const [bandId, captures] of bands.entries()) {
  //   for (const capture of captures) {
  //     const program = (capture as Capture).Program?.trim();
  //     const captureDate = (capture as Capture).CaptureDate?.trim();
  //     if (program) {
  //       if (!programs.has(program)) programs.set(program, new Set<string>());
  //       programs.get(program)!.add(bandId);
  //     }
  //     if (captureDate && program) {
  //       const year = captureDate.slice(0, 4);
  //       if (year) {
  //         if (!years.has(year)) years.set(year, new Set<string>());
  //         years.get(year)!.add(program);
  //       }
  //     }
  //   }
  // }

  // // Convert and upload programs map
  // const programsObject: Record<string, string[]> = {};
  // for (const [program, bandSet] of programs.entries()) {
  //   programsObject[program] = Array.from(bandSet).sort();
  // }
  // console.log("Uploading programs map to RTDB...");
  // await set(ref(database, `programs`), programsObject);

  // // Convert and upload years map
  // const yearsObject: Record<string, string[]> = {};
  // for (const [year, programSet] of years.entries()) {
  //   yearsObject[year] = Array.from(programSet).sort();
  // }
  // console.log("Uploading years map to RTDB...");
  // await set(ref(database, `years`), yearsObject);
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

    if (!yearsMap.has(year)) {
      yearsMap.set(year, { id: year, programs: [program] });
    } else {
      yearsMap.get(year)!.programs.push(program);
    }

    if (!programsMap.has(program)) {
      programsMap.set(program, {
        name: program,
        bandGroupIds: [bandGroupId],
        recaptureIds: [captureId],
      });
    } else {
      programsMap.get(program)!.bandGroupIds.push(bandGroupId);
      programsMap.get(program)!.recaptureIds.push(captureId);
    }

    if (!bandGroupsMap.has(bandGroupId)) {
      bandGroupsMap.set(bandGroupId, {
        id: bandGroupId,
        captureIds: [captureId],
      });
    } else {
      bandGroupsMap.get(bandGroupId)!.captureIds.push(captureId);
    }
  }
  writeObjectToDB(database, "yearsMap", yearsMap);
  writeObjectToDB(database, "programsMap", programsMap);
  writeObjectToDB(database, "bandGroupsMap", bandGroupsMap);
  writeObjectToDB(database, "capturesMap", capturesMap);
};

const writeObjectToDB = async (
  database: Database,
  path: string,
  data: Map<string, unknown>
) => {

};
