import { readFileSync } from "fs";
import { join } from "path";
import { ref, set, type Database } from "firebase/database";
import { db } from "./firebase-node";

interface SpeciesRange {
  fWeightLower: number;
  fWeightUpper: number;
  fWingLower: number;
  fWingUpper: number;
  mWeightLower: number;
  mWeightUpper: number;
  mWingLower: number;
  mWingUpper: number;
}

interface MagicTable {
  pyle: Map<string, SpeciesRange>;
  mbo: Map<string, SpeciesRange>;
}

/**
 * Parse the magic_table CSV into a structured object with pyle source
 */
function parseMagicTableCSV(csvContent: string): MagicTable {
  // Remove BOM if present
  csvContent = csvContent.replace(/^\uFEFF/, "");

  const lines = csvContent.trim().split("\n");

  const magicTable: MagicTable = {};

  const emptyRange: SpeciesRange = {
    fWeightLower: 0,
    fWeightUpper: 0,
    fWingLower: 0,
    fWingUpper: 0,
    mWeightLower: 0,
    mWeightUpper: 0,
    mWingLower: 0,
    mWingUpper: 0,
  };

  for (let i = 1; i < lines.length; i++) {
    const values = lines[i].split(",");
    if (values.length < 9) continue;

    const speciesCode = values[8].trim();
    if (!speciesCode) continue;

    magicTable[speciesCode] = {
      pyle: {
        fWeightLower: Number(values[0]) || 0,
        fWeightUpper: Number(values[1]) || 0,
        fWingLower: Number(values[2]) || 0,
        fWingUpper: Number(values[3]) || 0,
        mWeightLower: Number(values[4]) || 0,
        mWeightUpper: Number(values[5]) || 0,
        mWingLower: Number(values[6]) || 0,
        mWingUpper: Number(values[7]) || 0,
      },
      mbo: { ...emptyRange }, // Empty MBO data, to be populated separately
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
