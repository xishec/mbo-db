import * as fs from "fs";
import * as path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Read the CSV file
const csvPath = path.join(__dirname, "../public/data/tblSpecies.csv");
const csvContent = fs.readFileSync(csvPath, "utf-8");

// Parse CSV
const lines = csvContent.split("\n");

// Find column indices (based on tblSpecies.csv structure)
const speciesCodeIdx = 0; // Species
const pseudoSpeciesTypeIdx = 1; // PseudoSpeciesType
const speciesDescriptionMBOIdx = 2; // SpeciesDescriptionMBO
const speciesDescriptionCMMNIdx = 3; // SpeciesDescriptionCMMN
const speciesFrenchIdx = 4; // SpeciesFrench
const speciesScientificIdx = 5; // SpeciesScientific

// Build the species map
const speciesEntries: string[] = [];

for (let i = 1; i < lines.length; i++) {
  const line = lines[i].trim();
  if (!line) continue;

  const columns = line.split(",");
  const code = columns[speciesCodeIdx]?.trim();
  const pseudoSpeciesType = columns[pseudoSpeciesTypeIdx]?.trim() || "";
  const speciesDescriptionMBO = columns[speciesDescriptionMBOIdx]?.trim() || "";
  const speciesDescriptionCMMN = columns[speciesDescriptionCMMNIdx]?.trim() || "";
  const speciesFrench = columns[speciesFrenchIdx]?.trim() || "";
  const speciesScientific = columns[speciesScientificIdx]?.trim() || "";

  if (!code) continue;

  const entry = `  ${code}: {
    code: "${code}",
    pseudoSpeciesType: "${pseudoSpeciesType}",
    speciesDescriptionMBO: "${speciesDescriptionMBO}",
    speciesDescriptionCMMN: "${speciesDescriptionCMMN}",
    speciesFrench: "${speciesFrench}",
    speciesScientific: "${speciesScientific}",
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
