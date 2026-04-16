import * as fs from "fs";
import * as path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    const nextChar = line[i + 1];

    if (inQuotes) {
      if (char === '"') {
        if (nextChar === '"') {
          current += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        current += char;
      }
    } else {
      if (char === '"') {
        inQuotes = true;
      } else if (char === ",") {
        result.push(current);
        current = "";
      } else {
        current += char;
      }
    }
  }

  result.push(current);
  return result;
}

function escapeForTS(str: string): string {
  return str.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
}

// Read the CSV file
const csvPath = path.join(__dirname, "../public/data/tblSpecies.csv");
const csvContent = fs.readFileSync(csvPath, "utf-8").replace(/^\uFEFF/, "");

// Parse CSV
const lines = csvContent.split("\n");
const headers = parseCSVLine(lines[0]);

// Find column indices dynamically from header row
const speciesCodeIdx = headers.indexOf("Species");
const pseudoSpeciesTypeIdx = headers.indexOf("PseudoSpeciesType");
const speciesDescriptionMBOIdx = headers.indexOf("SpeciesDescriptionMBO");
const speciesDescriptionCMMNIdx = headers.indexOf("SpeciesDescriptionCMMN");
const speciesFrenchIdx = headers.indexOf("SpeciesFrench");
const speciesScientificIdx = headers.indexOf("SpeciesScientific");

// Build the species map
const speciesEntries: string[] = [];

for (let i = 1; i < lines.length; i++) {
  const line = lines[i].trim();
  if (!line) continue;

  const columns = parseCSVLine(line);
  const code = columns[speciesCodeIdx]?.trim();
  const pseudoSpeciesType = columns[pseudoSpeciesTypeIdx]?.trim() || "";
  const speciesDescriptionMBO = columns[speciesDescriptionMBOIdx]?.trim() || "";
  const speciesDescriptionCMMN = columns[speciesDescriptionCMMNIdx]?.trim() || "";
  const speciesFrench = columns[speciesFrenchIdx]?.trim() || "";
  const speciesScientific = columns[speciesScientificIdx]?.trim() || "";

  if (!code) continue;

  const entry = `  ${escapeForTS(code)}: {
    code: "${escapeForTS(code)}",
    pseudoSpeciesType: "${escapeForTS(pseudoSpeciesType)}",
    speciesDescriptionMBO: "${escapeForTS(speciesDescriptionMBO)}",
    speciesDescriptionCMMN: "${escapeForTS(speciesDescriptionCMMN)}",
    speciesFrench: "${escapeForTS(speciesFrench)}",
    speciesScientific: "${escapeForTS(speciesScientific)}",
  }`;

  speciesEntries.push(entry);
}

// Generate the TypeScript file content
const outputContent = `export interface Species {
  code: string; // Species code (e.g., "ABDU", "AMGO")
  pseudoSpeciesType: string; // Type (e.g., "Species", "Hybrid")
  speciesDescriptionMBO: string; // MBO description
  speciesDescriptionCMMN: string; // CMMN description
  speciesFrench: string; // French name
  speciesScientific: string; // Scientific name
}

export const SPECIES_MAP: Record<string, Species> = {
${speciesEntries.join(",\n")}
};
`;

// Write to species.ts
const outputPath = path.join(__dirname, "../src/types/species.ts");
fs.writeFileSync(outputPath, outputContent, "utf-8");

console.log(`✅ Generated species map with ${speciesEntries.length} species`);
console.log(`📝 Written to ${outputPath}`);
