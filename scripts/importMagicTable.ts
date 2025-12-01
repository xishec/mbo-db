import { readFileSync } from "fs";
import { join } from "path";
import { ref, set, type Database } from "firebase/database";
import { db } from "./firebase-node";
import { MagicTable } from "../src/types";

/**
 * Parse the magic_table CSV into a structured object with pyle source
 */
function parseMagicTableCSV(csvContent: string): MagicTable {
  // Remove BOM if present
  csvContent = csvContent.replace(/^\uFEFF/, "");

  const lines = csvContent.trim().split("\n");

  const magicTable: MagicTable = { pyle: {}, mbo: {} };

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

    magicTable.pyle[speciesCode] = {
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

  return magicTable;
}

/**
 * Import magic table to RTDB
 */
async function importMagicTable(database: Database, magicTable: MagicTable): Promise<void> {
  console.log(`Uploading ${Object.keys(magicTable.pyle).length} species records to 'magicTable'...`);

  await set(ref(database, "magicTable"), magicTable);

  console.log(`✅ Import to 'magicTable' complete!`);
}

async function main() {
  try {
    console.log("Reading magic_table CSV file...");
    const csvPath = join(process.cwd(), "public", "data", "magic_table.csv");
    const csvContent = readFileSync(csvPath, "utf-8");

    console.log("Parsing magic table...");
    const magicTable = parseMagicTableCSV(csvContent);
    console.log(`Parsed ${Object.keys(magicTable.pyle).length} species entries`);

    console.log("Starting RTDB import...");
    await importMagicTable(db, magicTable);

    console.log("✅ Magic table import completed successfully!");
    process.exit(0);
  } catch (error) {
    console.error("❌ Import failed:", error);
    process.exit(1);
  }
}

main();
