import * as fs from "fs";
import * as path from "path";
import { fileURLToPath } from "url";
import { DET, Net, Weather } from "../src/types/DET.js";
import { db, ENVIRONMENT } from "./firebase-node.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Parse CSV helper
function parseCSV(content: string): Record<string, string>[] {
  const lines = content.split("\n");
  if (lines.length < 2) return [];

  const headers = lines[0].split(",").map((h) => h.trim());
  const data: Record<string, string>[] = [];

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    const values = line.split(",").map((v) => v.trim());
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
const DETsMap = new Map<string, DET>();

// Process daily records
dailyRecords.forEach((record) => {
  const date = record.DateEx;
  if (!date) return;

  DETsMap.set(date, {
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
      total: record.SongbirdNets || "",
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
  if (!date || !DETsMap.has(date)) return;

  const detMap = DETsMap.get(date)!;
  const species = record.Species;

  if (record.Observed && parseInt(record.Observed) > 0) {
    detMap.observedSpeciesCount[species] = parseInt(record.Observed);
  }

  if (record.Census && parseInt(record.Census) > 0) {
    detMap.census.speciesCount[species] = parseInt(record.Census);
  }

  if (record.Banded && parseInt(record.Banded) > 0) {
    detMap.bandedSpeciesCount[species] = parseInt(record.Banded);
  }

  if (record.Repeats && parseInt(record.Repeats) > 0) {
    detMap.repeatSpeciesCount[species] = parseInt(record.Repeats);
  }

  if (record.Returns && parseInt(record.Returns) > 0) {
    detMap.returnSpeciesCount[species] = parseInt(record.Returns);
  }

  if (record.DET && parseInt(record.DET) > 0) {
    detMap.DETSpeciesCount[species] = parseInt(record.DET);
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
    id: record.NetID || "",
    open: undefined,
    closed: undefined,
    hours: undefined,
    multiplier: undefined,
    total: record.NetHours || "",
  });
});

// Add net hours to DETs
netsByDate.forEach((nets, date) => {
  if (DETsMap.has(date)) {
    const detMap = DETsMap.get(date)!;
    detMap.netHours.nets = nets;

    // Calculate total net hours if there are nets, otherwise keep SongbirdNets value
    if (nets.length > 0) {
      const total = nets.reduce((sum, net) => sum + (parseFloat(net.total || "0") || 0), 0);
      detMap.netHours.total = (Math.round(total * 100) / 100).toString();
    }
  }
});

// Fetch weather data from Open-Meteo API
const MBO_LAT = 45.43075783523065;
const MBO_LON = -73.93855172247436;

async function fetchWeatherForDate(date: string): Promise<Weather | null> {
  try {
    const url = `https://archive-api.open-meteo.com/v1/archive?latitude=${MBO_LAT}&longitude=${MBO_LON}&start_date=${date}&end_date=${date}&daily=temperature_2m_max,temperature_2m_min,temperature_2m_mean,precipitation_sum,windspeed_10m_max,winddirection_10m_dominant,cloudcover_mean&timezone=America/Toronto`;

    const response = await fetch(url);
    if (!response.ok) {
      console.error(`Weather API error for ${date}:`, response.status);
      return null;
    }

    const data = await response.json();

    if (!data.daily) {
      return null;
    }

    const windDirectionDegrees = data.daily.winddirection_10m_dominant?.[0];
    const windDirection = windDirectionDegrees !== undefined ? degreesToCardinal(windDirectionDegrees) : undefined;

    return {
      temperature: data.daily.temperature_2m_mean?.[0],
      temperatureMin: data.daily.temperature_2m_min?.[0],
      temperatureMax: data.daily.temperature_2m_max?.[0],
      cloudCoverage: data.daily.cloudcover_mean?.[0],
      precipitation: data.daily.precipitation_sum?.[0],
      windSpeed: data.daily.windspeed_10m_max?.[0],
      windDirection,
    };
  } catch (error) {
    console.error(`Failed to fetch weather for ${date}:`, error);
    return null;
  }
}

function degreesToCardinal(degrees: number): string {
  const directions = [
    "N",
    "NNE",
    "NE",
    "ENE",
    "E",
    "ESE",
    "SE",
    "SSE",
    "S",
    "SSW",
    "SW",
    "WSW",
    "W",
    "WNW",
    "NW",
    "NNW",
  ];
  const index = Math.round(degrees / 22.5) % 16;
  return directions[index];
}

// Remove undefined values from an object (Firebase doesn't accept undefined)
function removeUndefined<T>(obj: T): T {
  if (obj === null || obj === undefined) {
    return obj as T;
  }
  if (Array.isArray(obj)) {
    return obj.map(removeUndefined) as T;
  }
  if (typeof obj === "object") {
    const cleaned: Record<string, unknown> = {};
    for (const key in obj) {
      if ((obj as Record<string, unknown>)[key] !== undefined) {
        cleaned[key] = removeUndefined((obj as Record<string, unknown>)[key]);
      }
    }
    return cleaned as T;
  }
  return obj;
}

// Upload to RTDB
async function uploadDETsToRTDB() {
  console.log("Uploading DETs to RTDB...");

  // Fetch weather data for MBO locations only
  console.log("Fetching weather data for MBO locations...");
  const dates = Array.from(DETsMap.keys());
  let weatherSuccessCount = 0;
  let weatherErrorCount = 0;

  for (let i = 0; i < dates.length; i++) {
    if (!dates[i].startsWith("2024-")) continue;
    const date = dates[i];
    const det = DETsMap.get(date)!;

    // Only fetch weather for MBO location
    if (det.location !== "MBO") {
      continue;
    }

    try {
      const weather = await fetchWeatherForDate(date);
      if (weather) {
        det.weather = weather;
        weatherSuccessCount++;
      } else {
        weatherErrorCount++;
      }
    } catch (error) {
      console.error(`Failed to fetch weather for ${date}:`, error);
      weatherErrorCount++;
    }

    // Progress indicator
    if ((i + 1) % 10 === 0 || i === dates.length - 1) {
      console.log(`Progress: ${i + 1}/${dates.length} dates processed`);
    }

    // Small delay to avoid rate limiting
    await new Promise((resolve) => setTimeout(resolve, 100));
  }

  console.log(`✅ Weather data: ${weatherSuccessCount} successful, ${weatherErrorCount} failed`);

  // Convert Map to object and remove undefined values
  const DETsObject: Record<string, DET> = {};
  DETsMap.forEach((detMap, date) => {
    DETsObject[date] = removeUndefined(detMap);
  });

  // Write to Firebase
  await db.ref(`${ENVIRONMENT}/DETsMap`).set(DETsObject);

  console.log(`✅ Uploaded ${DETsMap.size} DET records to RTDB at ${ENVIRONMENT}/DETsMap`);

  // Update metadata - triggers DataService to fetch fresh data
  await db.ref(`${ENVIRONMENT}/metadata/lastModified`).set(Date.now());

  console.log("✅ All DETs uploaded successfully!");
  process.exit(0);
}

uploadDETsToRTDB().catch((error) => {
  console.error("❌ Upload failed:", error);
  process.exit(1);
});
