import { readFileSync } from "fs";
import { join } from "path";
import { ref, set, type Database } from "firebase/database";
import { db } from "./firebase-node";
import { MagicTable } from "../src/helper/helper";

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

    magicTable.pyle[speciesCode] = {
      fWeightLower: Number(values[0]) || 0,
      fWeightUpper: Number(values[1]) || 0,
      fWingLower: Number(values[2]) || 0,
      fWingUpper: Number(values[3]) || 0,
      mWeightLower: Number(values[4]) || 0,
      mWeightUpper: Number(values[5]) || 0,
      mWingLower: Number(values[6]) || 0,
      mWingUpper: Number(values[7]) || 0,
    };
  }

  return magicTable;
}

/**
 * Import magic table to RTDB
 */
async function importMagicTable(database: Database, magicTable: MagicTable): Promise<void> {
  console.log(`Uploading ${Object.keys(magicTable).length} species records to 'magicTable'...`);

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
    console.log(`Parsed ${Object.keys(magicTable).length} species entries`);

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
