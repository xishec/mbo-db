import { readFileSync, writeFileSync } from "node:fs";

const [inputPath, outputPath, reportPath] = process.argv.slice(2);
if (!inputPath || !outputPath || !reportPath) {
  throw new Error("Usage: node migrateRtdbExportLocations.mjs <input.json> <output.json> <report.json>");
}

const SOURCE_PATH = new URL("../public/data/tblCaptures.csv", import.meta.url);
const MBO_2026_PROGRAMS = new Set(["SMMP2026", "FMMP2026", "MAPS2026"]);

function parseCsvLine(line) {
  const values = [];
  let value = "";
  let quoted = false;
  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    const next = line[index + 1];
    if (quoted) {
      if (char === '"') {
        if (next === '"') {
          value += '"';
          index += 1;
        } else {
          quoted = false;
        }
      } else {
        value += char;
      }
    } else if (char === '"') {
      quoted = true;
    } else if (char === ",") {
      values.push(value);
      value = "";
    } else {
      value += char;
    }
  }
  values.push(value);
  return values;
}

function normalizeDate(value) {
  const match = value.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (!match) return value;
  return `${match[3]}-${match[1].padStart(2, "0")}-${match[2].padStart(2, "0")}`;
}

function sourceEventId(row) {
  const prefix = (row.BandPrefix || "").padStart(4, "0");
  const suffix = (row.BandSuffix || "").padStart(5, "0");
  const bandId = prefix + suffix.slice(0, 3) + suffix.slice(-2);
  const wing = String(Number(row.WingChord || ""));
  const weight = String(Number(row.Weight || ""));
  return `${bandId}${normalizeDate(row.CaptureDate || "")}${row.Net || ""}${wing}${weight}`.replaceAll(".", "");
}

function buildSourceLocations() {
  const lines = readFileSync(SOURCE_PATH, "utf8").trimEnd().split(/\r?\n/);
  const headers = parseCsvLine(lines[0]);
  const byId = new Map();
  const accessProgramIds = new Set();
  const duplicateIds = [];
  for (const line of lines.slice(1)) {
    const values = parseCsvLine(line);
    const row = Object.fromEntries(headers.map((header, index) => [header, values[index] ?? ""]));
    const id = sourceEventId(row);
    const location = row.Location.trim().toUpperCase();
    const programId = row.Program.trim().toUpperCase();
    if (programId) accessProgramIds.add(programId);
    const existing = byId.get(id);
    if (existing && existing.location !== location) duplicateIds.push({ id, locations: [existing.location, location] });
    else byId.set(id, { location, programId });
  }
  if (duplicateIds.length > 0) throw new Error(`Source has ${duplicateIds.length} duplicate event IDs with different locations`);
  return { byId, accessProgramIds, sourceRows: lines.length - 1 };
}

function canonicalProgramId(value) {
  return typeof value === "string" ? value.toUpperCase() : "";
}

function updateDetProgramIds(root) {
  let changed = 0;
  for (const [date, dets] of Object.entries(root.DETsByDateMap ?? {})) {
    if (!dets || typeof dets !== "object") continue;
    const normalizedDets = {};
    for (const [key, det] of Object.entries(dets)) {
      const programId = canonicalProgramId(det?.programId || key);
      if (!programId) continue;
      if (det?.programId !== programId || key !== programId) changed += 1;
      normalizedDets[programId] = { ...det, programId };
    }
    root.DETsByDateMap[date] = normalizedDets;
  }
  for (const det of Object.values(root.DETsMap ?? {})) {
    if (!det || typeof det !== "object" || typeof det.programId !== "string") continue;
    const programId = canonicalProgramId(det.programId);
    if (det.programId !== programId) {
      det.programId = programId;
      changed += 1;
    }
  }
  return changed;
}

function migrateProd(root, source) {
  const events = root.birdEventsMap ?? {};
  const existingSyncedAt = Object.values(events).reduce(
    (maximum, event) => Math.max(maximum, Number(event?.syncedAt) || 0),
    0
  );
  const metadataMaximum = Object.values(root.metadata ?? {}).reduce(
    (maximum, value) => Math.max(maximum, Number(value) || 0),
    0
  );
  const migrationTimestamp = Math.max(Date.now(), existingSyncedAt + 1, metadataMaximum + 1);
  const programEvents = new Map();
  const stats = {
    captures: Object.keys(events).length,
    locationFromAccessDb: 0,
    locationMbo2026: 0,
    locationStillBlank: 0,
    programIdsNormalized: 0,
    syncedAtUpdated: 0,
    detProgramIdsNormalized: 0,
    programGroupsMerged: 0,
    migrationTimestamp,
  };

  for (const [eventId, event] of Object.entries(events)) {
    const previousProgramId = event.programId || "";
    const programId = canonicalProgramId(previousProgramId);
    const sourceRow = source.byId.get(eventId);
    let location = typeof event.location === "string" ? event.location.trim().toUpperCase() : "";
    if (sourceRow?.location) {
      location = sourceRow.location;
      stats.locationFromAccessDb += 1;
    } else if (!location && MBO_2026_PROGRAMS.has(programId)) {
      location = "MBO";
      stats.locationMbo2026 += 1;
    }
    if (!location) stats.locationStillBlank += 1;

    const changed = event.programId !== programId || event.location !== location;
    if (event.programId !== programId) stats.programIdsNormalized += 1;
    if (changed) {
      event.programId = programId;
      event.location = location;
      event.syncedAt = migrationTimestamp;
      stats.syncedAtUpdated += 1;
    }
    if (!programEvents.has(programId)) programEvents.set(programId, []);
    programEvents.get(programId).push(event);
  }

  const candidates = new Map();
  for (const [programId, program] of Object.entries(root.programsMap ?? {})) {
    const canonicalId = canonicalProgramId(programId);
    if (!candidates.has(canonicalId)) candidates.set(canonicalId, []);
    candidates.get(canonicalId).push({ programId, program });
  }
  for (const [programId, eventsForProgram] of programEvents) {
    if (!candidates.has(programId)) candidates.set(programId, []);
  }

  const programsMap = {};
  for (const [programId, variants] of candidates) {
    const preferred = variants.find(({ programId: id }) => id === programId) ?? variants[0];
    if (variants.length > 1) stats.programGroupsMerged += 1;
    const entries = programEvents.get(programId) ?? [];
    const isAllMbo = entries.length > 0 && entries.every((event) => event.location === "MBO");
    const isNew2026Program = MBO_2026_PROGRAMS.has(programId);
    const isAccessProgram = source.accessProgramIds.has(programId);
    const locationConfig = isNew2026Program || (isAccessProgram && isAllMbo)
      ? { defaultLocation: "MBO", isMultiLocation: false }
      : isAccessProgram
        ? { defaultLocation: "", isMultiLocation: true }
        : { defaultLocation: "", isMultiLocation: false };
    const startDates = variants.map(({ program }) => program?.startDate).filter(Boolean).sort();
    const endDates = variants.map(({ program }) => program?.endDate).filter(Boolean).sort();
    programsMap[programId] = {
      ...(preferred?.program ?? {}),
      id: programId,
      displayName: programId,
      ...(startDates.length > 0 ? { startDate: startDates[0] } : {}),
      ...(endDates.length > 0 ? { endDate: endDates.at(-1) } : {}),
      ...locationConfig,
    };
  }
  root.programsMap = programsMap;

  stats.detProgramIdsNormalized = updateDetProgramIds(root);
  root.metadata = {
    ...(root.metadata ?? {}),
    lastModified: migrationTimestamp,
    dbVersion: migrationTimestamp,
    lastModified_programsMap: migrationTimestamp,
    ...(stats.detProgramIdsNormalized > 0 ? { lastModified_DETsByDateMap: migrationTimestamp } : {}),
  };
  return stats;
}

const source = buildSourceLocations();
const exportData = JSON.parse(readFileSync(inputPath, "utf8"));
if (!exportData.prod) throw new Error("Export does not contain prod");
const report = {
  sourceRows: source.sourceRows,
  sourceLocationRows: [...source.byId.values()].filter(({ location }) => location).length,
  prod: migrateProd(exportData.prod, source),
};
exportData.alpha = structuredClone(exportData.prod);
report.alpha = { copiedFromProd: true, captures: Object.keys(exportData.alpha.birdEventsMap ?? {}).length };
writeFileSync(outputPath, JSON.stringify(exportData));
writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`);
console.log(JSON.stringify(report, null, 2));
