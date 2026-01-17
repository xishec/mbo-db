import * as fs from "fs";
import * as path from "path";
import { fileURLToPath } from "url";
import { DET, Net } from "../src/types/DET.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Parse CSV helper
function parseCSV(content: string): Record<string, string>[] {
  const lines = content.split("\n");
  if (lines.length < 2) return [];

  const headers = lines[0].split(",").map(h => h.trim());
  const data: Record<string, string>[] = [];

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    const values = line.split(",").map(v => v.trim());
    const row: Record<string, string> = {};

    headers.forEach((header, idx) => {
      row[header] = values[idx] || "";
    });

    data.push(row);
  }

  return data;
}

// Read CSV files
const dailyPath = path.join(__dirname, "../public/data/tblDETDaily.csv");
const speciesPath = path.join(__dirname, "../public/data/tblDETSpecies.csv");
const netHoursPath = path.join(__dirname, "../public/data/tblDETNetHours.csv");

const dailyContent = fs.readFileSync(dailyPath, "utf-8");
const speciesContent = fs.readFileSync(speciesPath, "utf-8");
const netHoursContent = fs.readFileSync(netHoursPath, "utf-8");

const dailyRecords = parseCSV(dailyContent);
const speciesRecords = parseCSV(speciesContent);
const netHoursRecords = parseCSV(netHoursContent);

// Build DETsMap
const detsMap = new Map<string, DET>();

// Process daily records
dailyRecords.forEach((record) => {
  const date = record.DateEx;
  if (!date) return;

  detsMap.set(date, {
    date: date,
    programId: record.Program || "",
    location: record.Location || "",
    banderInCharge: undefined,
    start: undefined,
    end: undefined,
    observerHours: {
      observers: [],
      total: parseFloat(record.Observers) || 0,
    },
    netHours: {
      nets: [],
      hummingbirdTrapTotal: "",
      total: "",
    },
    coverageCode: parseInt(record.CoverageCode) || 0,
    narrative: "",
    deviations: "",
    visitors: [],
    stationManagement: "",
    injuries: [],
    released: [],
    observedSpeciesCount: {},
    census: {
      censuser: undefined,
      start: undefined,
      end: undefined,
      speciesCount: {},
    },
    bandedSpeciesCount: {},
    repeatSpeciesCount: {},
    returnSpeciesCount: {},
    DETSpeciesCount: {},
  });
});

// Process species records
speciesRecords.forEach((record) => {
  const date = record.DateEx;
  if (!date || !detsMap.has(date)) return;

  const det = detsMap.get(date)!;
  const species = record.Species;

  if (record.Observed && parseInt(record.Observed) > 0) {
    det.observedSpeciesCount[species] = parseInt(record.Observed);
  }

  if (record.Census && parseInt(record.Census) > 0) {
    det.census.speciesCount[species] = parseInt(record.Census);
  }

  if (record.Banded && parseInt(record.Banded) > 0) {
    det.bandedSpeciesCount[species] = parseInt(record.Banded);
  }

  if (record.Repeats && parseInt(record.Repeats) > 0) {
    det.repeatSpeciesCount[species] = parseInt(record.Repeats);
  }

  if (record.Returns && parseInt(record.Returns) > 0) {
    det.returnSpeciesCount[species] = parseInt(record.Returns);
  }

  if (record.DET && parseInt(record.DET) > 0) {
    det.DETSpeciesCount[species] = parseInt(record.DET);
  }
});

// Process net hours records
const netsByDate = new Map<string, Net[]>();
netHoursRecords.forEach((record) => {
  const date = record.DateEx;
  if (!date) return;

  if (!netsByDate.has(date)) {
    netsByDate.set(date, []);
  }

  netsByDate.get(date)!.push({
    name: record.NetID || "",
    open: "",
    closed: "",
    hours: record.NetHours || "",
    multiplier: 1,
    total: record.NetHours || "",
  });
});

// Add net hours to DETs
netsByDate.forEach((nets, date) => {
  if (detsMap.has(date)) {
    const det = detsMap.get(date)!;
    det.netHours.nets = nets;
    
    // Calculate total net hours
    const total = nets.reduce((sum, net) => sum + (parseFloat(net.hours) || 0), 0);
    det.netHours.total = total.toString();
  }
});

// Generate TypeScript output
const entries: string[] = [];

// Sort by date
const sortedDates = Array.from(detsMap.keys()).sort();

sortedDates.forEach((date) => {
  const det = detsMap.get(date);
  
  const entry = `  "${date}": ${JSON.stringify(det, null, 4).replace(/"([^"]+)":/g, "$1:")}`;
  entries.push(entry);
});

const outputContent = `import { DET } from "../types/det";

export const DETs_MAP: Record<string, DET> = {
${entries.join(",\n")}
};
`;

// Write to output file
const outputPath = path.join(__dirname, "../src/types/detsMap.ts");
fs.writeFileSync(outputPath, outputContent, "utf-8");

console.log(`✅ Generated DETs map with ${detsMap.size} entries`);
console.log(`📝 Written to ${outputPath}`);
