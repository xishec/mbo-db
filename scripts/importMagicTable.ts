import { readFileSync } from "fs";
import { join } from "path";
import { db as database } from "./firebase-node";
import { SpeciesRange } from "../src/types";

/**
 * Parse the magic_table CSV into a structured object with pyle source
 */
function parseCSV(csvContent: string): Record<string, SpeciesRange> {
  // Remove BOM if present
  csvContent = csvContent.replace(/^\uFEFF/, "");

  const lines = csvContent.trim().split("\n");

  const pyleMagicTable: Record<string, SpeciesRange> = {};

  for (let i = 1; i < lines.length; i++) {
    const values = lines[i].split(",");
    if (values.length < 9) continue;

    const speciesCode = values[8].trim();
    if (!speciesCode) continue;

    const fWeightLower = Number(values[0]) || 0;
    const fWeightUpper = Number(values[1]) || 0;
    const fWingLower = Number(values[2]) || 0;
    const fWingUpper = Number(values[3]) || 0;
    const mWeightLower = Number(values[4]) || 0;
    const mWeightUpper = Number(values[5]) || 0;
    const mWingLower = Number(values[6]) || 0;
    const mWingUpper = Number(values[7]) || 0;

    pyleMagicTable[speciesCode] = {
      fWeightLower,
      fWeightUpper,
      fWingLower,
      fWingUpper,
      mWeightLower,
      mWeightUpper,
      mWingLower,
      mWingUpper,
      unknownWeightLower: Math.min(fWeightLower, mWeightLower),
      unknownWeightUpper: Math.max(fWeightUpper, mWeightUpper),
      unknownWingLower: Math.min(fWingLower, mWingLower),
      unknownWingUpper: Math.max(fWingUpper, mWingUpper),
    };
  }

  return pyleMagicTable;
}

/**
 * Import magic table to RTDB
 */
export async function importMagicTable(): Promise<void> {
  console.log("Reading magic_table CSV file...");
  const csvPath = join(process.cwd(), "public", "data", "magic_table.csv");
  const csvContent = readFileSync(csvPath, "utf-8");

  console.log("Parsing magic table...");
  const pyleMagicTable = parseCSV(csvContent);
  console.log(`Parsed ${Object.keys(pyleMagicTable).length} species entries`);

  // Write to constants/{env}/ path
  const environments = ["alpha", "prod"];
  for (const env of environments) {
    console.log(`Uploading ${Object.keys(pyleMagicTable).length} species records to 'constants/${env}/magicTable/pyle'...`);
    await database.ref(`constants/${env}/magicTable/pyle`).set(pyleMagicTable);
  }

  console.log(`✅ Import to all environments complete!`);
}
