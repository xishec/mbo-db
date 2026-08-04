import { cert, deleteApp, getApps, initializeApp, type ServiceAccount } from "firebase-admin/app";
import { getDatabase, type Database } from "firebase-admin/database";
import { config as loadEnv } from "dotenv";
import { readFileSync } from "node:fs";
import nodemailer from "nodemailer";
import type {
  BandIdToBirdEventIdsMap,
  BandResetsMap,
  BirdEvent,
  Species,
  SpeciesAliasesMap,
  VolunteersMap,
} from "../src/types/index.js";

const TIME_ZONE = "America/Toronto";
const DAY_IN_MS = 24 * 60 * 60 * 1000;

loadEnv({ path: process.env.EMAIL_ENV_FILE ?? ".env.email.local", quiet: true });
process.env.TZ ??= TIME_ZONE;

interface EmailConfig {
  from: string;
  to: string | string[];
  host: string;
  port: number;
  user: string;
  pass: string;
}

interface FirebaseConfig {
  databaseUrl: string;
  environment: string;
  serviceAccount: ServiceAccount;
}

interface RankedItem {
  label: string;
  value: number;
  detail?: string;
}

interface SpeciesBreakdown extends RankedItem {
  banded: number;
  repeats: number;
  returns: number;
  aliens: number;
}

interface OldestBird {
  event: BirdEvent;
  spanDays: number;
}

interface DailyStats {
  totalEvents: number;
  speciesCount: number;
  bandedSpeciesCount: number;
  recaptureSpeciesCount: number;
  banded: number;
  repeats: number;
  returns: number;
  allSpecies: SpeciesBreakdown[];
  topBandedSpecies: RankedItem[];
  topRecapturedSpecies: RankedItem[];
  topNets: RankedItem[];
  topBanders: RankedItem[];
  topScribes: RankedItem[];
  heaviestBirds: BirdEvent[];
  fattestBirds: BirdEvent[];
  oldestBirds: OldestBird[];
  rareBirds: RankedItem[];
  dummestBirds: RankedItem[];
}

function loadEmailConfig(): EmailConfig {
  const requiredEnvVars = ["EMAIL_USER", "EMAIL_PASSWORD", "RECIPIENT_EMAIL"];
  const missing = requiredEnvVars.filter((varName) => !process.env[varName]);
  if (missing.length > 0) throw new Error(`Missing required environment variables: ${missing.join(", ")}`);

  const recipientEmails = process.env.RECIPIENT_EMAIL!;
  const recipients = recipientEmails.includes(",")
    ? recipientEmails.split(",").map((email) => email.trim()).filter(Boolean)
    : recipientEmails.trim();

  return {
    from: process.env.EMAIL_USER!,
    to: recipients,
    host: "smtp.gmail.com",
    port: 587,
    user: process.env.EMAIL_USER!,
    pass: process.env.EMAIL_PASSWORD!,
  };
}

function loadFirebaseConfig(): FirebaseConfig {
  const serviceAccountPath = process.env.FIREBASE_SERVICE_ACCOUNT_PATH;
  const rawServiceAccount = process.env.FIREBASE_SERVICE_ACCOUNT ??
    (serviceAccountPath ? readFileSync(serviceAccountPath, "utf8") : undefined);
  if (!rawServiceAccount) {
    throw new Error(
      "Missing Firebase credentials. Set FIREBASE_SERVICE_ACCOUNT or FIREBASE_SERVICE_ACCOUNT_PATH."
    );
  }

  return {
    databaseUrl: process.env.FIREBASE_DATABASE_URL ?? "https://mbodatabase-default-rtdb.firebaseio.com",
    environment: process.env.FIREBASE_ENVIRONMENT ?? "prod",
    serviceAccount: JSON.parse(rawServiceAccount) as ServiceAccount,
  };
}

function dateKey(date: Date): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const value = (type: Intl.DateTimeFormatPartTypes) => parts.find((part) => part.type === type)?.value ?? "";
  return `${value("year")}-${value("month")}-${value("day")}`;
}

function eventTimestamp(event: BirdEvent): number {
  const time = /^\d{1,2}:\d{2}$/.test(event.time ?? "") ? event.time : "00:00";
  return new Date(`${event.date}T${time}:00`).getTime();
}

function daysBetween(start: number, end: number): number {
  return Math.round((end - start) / DAY_IN_MS);
}

function formatSpan(spanDays: number): string {
  return `${spanDays} ${spanDays === 1 ? "day" : "days"}`;
}

function isNewCapture(event: BirdEvent): boolean {
  return event.birdEventType === "Banded" || event.birdEventType === "None";
}

function isRecapture(event: BirdEvent): boolean {
  return event.birdEventType === "Repeat" || event.birdEventType === "Return";
}

function isActiveEvent(event: BirdEvent, bandResets: BandResetsMap): boolean {
  if (event.modifiedEventId) return false;
  const reset = bandResets[event.band?.id];
  return !reset || event.bandGenerationId === reset.generationId;
}

function resolveSpeciesCode(
  code: string,
  aliases: SpeciesAliasesMap,
  speciesMap: Record<string, Species>
): string {
  const normalized = code.toUpperCase();
  if (speciesMap[normalized]) return normalized;

  const aliasMatch = Object.entries(aliases).find(([speciesKey, alias]) =>
    speciesMap[speciesKey.toUpperCase()] && alias.toUpperCase() === normalized
  );
  if (aliasMatch) return aliasMatch[0].toUpperCase();

  const directAlias = aliases[normalized]?.toUpperCase();
  return directAlias && speciesMap[directAlias] ? directAlias : normalized;
}

function topUniqueBirds(
  events: BirdEvent[],
  compare: (a: BirdEvent, b: BirdEvent) => number
): BirdEvent[] {
  const bestByBand = new Map<string, BirdEvent>();
  for (const event of events) {
    const key = event.band?.id || `event:${event.id}`;
    const existing = bestByBand.get(key);
    if (!existing || compare(event, existing) < 0) bestByBand.set(key, event);
  }
  return [...bestByBand.values()].sort(compare).slice(0, 3);
}

function ranked(counts: Map<string, number>, limit = Number.POSITIVE_INFINITY): RankedItem[] {
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, limit)
    .map(([label, value]) => ({ label, value }));
}

function calculateCurrentStats(
  events: BirdEvent[],
  aliases: SpeciesAliasesMap,
  speciesMap: Record<string, Species>,
  volunteers: VolunteersMap
): Omit<DailyStats, "oldestBirds" | "rareBirds"> {
  const allSpecies = new Set<string>();
  const bandedSpecies = new Set<string>();
  const recapturedSpecies = new Set<string>();
  const speciesBreakdowns = new Map<string, SpeciesBreakdown>();
  const bandedSpeciesCounts = new Map<string, number>();
  const recapturedSpeciesCounts = new Map<string, number>();
  const netCounts = new Map<string, number>();
  const banderCounts = new Map<string, number>();
  const scribeCounts = new Map<string, number>();
  const recaptureBandCounts = new Map<string, { count: number; species: string }>();
  let banded = 0;
  let repeats = 0;
  let returns = 0;
  const weightedBirds: BirdEvent[] = [];
  const fatBirds: BirdEvent[] = [];

  for (const event of events) {
    const species = event.species ? resolveSpeciesCode(event.species, aliases, speciesMap) : "";
    if (species) {
      allSpecies.add(species);
      const breakdown = speciesBreakdowns.get(species) ?? {
        label: species,
        value: 0,
        banded: 0,
        repeats: 0,
        returns: 0,
        aliens: 0,
      };
      breakdown.value += 1;
      if (isNewCapture(event)) breakdown.banded += 1;
      else if (event.birdEventType === "Repeat") breakdown.repeats += 1;
      else if (event.birdEventType === "Return") breakdown.returns += 1;
      else if (event.birdEventType === "Alien") breakdown.aliens += 1;
      speciesBreakdowns.set(species, breakdown);
    }

    if (isNewCapture(event)) {
      banded += 1;
      if (species) {
        bandedSpecies.add(species);
        bandedSpeciesCounts.set(species, (bandedSpeciesCounts.get(species) ?? 0) + 1);
      }
      if (event.bander) banderCounts.set(event.bander, (banderCounts.get(event.bander) ?? 0) + 1);
    } else if (event.birdEventType === "Repeat") {
      repeats += 1;
    } else if (event.birdEventType === "Return") {
      returns += 1;
    }

    if (isRecapture(event)) {
      if (species) {
        recapturedSpecies.add(species);
        recapturedSpeciesCounts.set(species, (recapturedSpeciesCounts.get(species) ?? 0) + 1);
      }
      if (event.band?.id) {
        const existing = recaptureBandCounts.get(event.band.id);
        recaptureBandCounts.set(event.band.id, {
          count: (existing?.count ?? 0) + 1,
          species: species || "?",
        });
      }
    }

    if (event.net) netCounts.set(event.net, (netCounts.get(event.net) ?? 0) + 1);
    if (event.scribe) scribeCounts.set(event.scribe, (scribeCounts.get(event.scribe) ?? 0) + 1);
    if (event.weight > 0) weightedBirds.push(event);
    if (event.fat > 0) fatBirds.push(event);
  }

  const withVolunteerNames = (items: RankedItem[]) =>
    items.map((item) => ({
      ...item,
      label: volunteers[item.label]?.fullName || item.label,
      detail: item.label,
    }));
  const dummestBirds = [...recaptureBandCounts.entries()]
    .filter(([, item]) => item.count > 1)
    .sort((a, b) => b[1].count - a[1].count || a[0].localeCompare(b[0]))
    .slice(0, 3)
    .map(([bandId, item]) => ({ label: item.species, value: item.count, detail: bandId }));

  return {
    totalEvents: events.length,
    speciesCount: allSpecies.size,
    bandedSpeciesCount: bandedSpecies.size,
    recaptureSpeciesCount: recapturedSpecies.size,
    banded,
    repeats,
    returns,
    allSpecies: [...speciesBreakdowns.values()].sort(
      (a, b) => b.value - a.value || a.label.localeCompare(b.label)
    ),
    topBandedSpecies: ranked(bandedSpeciesCounts, 3),
    topRecapturedSpecies: ranked(recapturedSpeciesCounts, 3),
    topNets: ranked(netCounts, 3),
    topBanders: withVolunteerNames(ranked(banderCounts, 3)),
    topScribes: withVolunteerNames(ranked(scribeCounts, 3)),
    heaviestBirds: topUniqueBirds(weightedBirds, (a, b) => b.weight - a.weight),
    fattestBirds: topUniqueBirds(fatBirds, (a, b) => b.fat - a.fat || b.weight - a.weight),
    dummestBirds,
  };
}

async function loadOldestRecapture(
  db: Database,
  environment: string,
  events: BirdEvent[],
  bandResets: BandResetsMap
): Promise<OldestBird[]> {
  const latestRecaptures = new Map<string, BirdEvent>();
  for (const event of events) {
    if (!isRecapture(event) || !event.band?.id) continue;
    const existing = latestRecaptures.get(event.band.id);
    if (!existing || eventTimestamp(event) > eventTimestamp(existing)) latestRecaptures.set(event.band.id, event);
  }

  const oldestBirds: OldestBird[] = [];
  await Promise.all(
    [...latestRecaptures.entries()].map(async ([bandId, recentEvent]) => {
      const idsSnapshot = await db.ref(`${environment}/bandIdToBirdEventIdsMap/${bandId}`).once("value");
      const rawIds = (idsSnapshot.val() ?? []) as BandIdToBirdEventIdsMap[string];
      const eventIds = Array.isArray(rawIds) ? rawIds : Object.values(rawIds);
      const historicalSnapshots = await Promise.all(
        eventIds.map((id) => db.ref(`${environment}/birdEventsMap/${id}`).once("value"))
      );
      const historicalEvents = historicalSnapshots
        .map((snapshot) => snapshot.val() as BirdEvent | null)
        .filter((event): event is BirdEvent => Boolean(event?.date) && isActiveEvent(event!, bandResets));
      if (historicalEvents.length === 0) return;

      const firstTimestamp = Math.min(...historicalEvents.map(eventTimestamp).filter(Number.isFinite));
      const spanDays = daysBetween(firstTimestamp, eventTimestamp(recentEvent));
      if (spanDays > 0) oldestBirds.push({ event: recentEvent, spanDays });
    })
  );
  return oldestBirds.sort((a, b) => b.spanDays - a.spanDays).slice(0, 3);
}

async function loadRareBirds(
  db: Database,
  environment: string,
  events: BirdEvent[],
  aliases: SpeciesAliasesMap,
  speciesMap: Record<string, Species>,
  bandResets: BandResetsMap,
  periodStart: Date
): Promise<RankedItem[]> {
  const speciesInPeriod = new Set(
    events.map((event) => resolveSpeciesCode(event.species, aliases, speciesMap)).filter(Boolean)
  );
  const results = await Promise.all(
    [...speciesInPeriod].map(async (species) => {
      const codes = new Set([species, aliases[species], speciesMap[species]?.currentCode].filter(Boolean));
      const snapshots = await Promise.all(
        [...codes].map((code) =>
          db.ref(`${environment}/birdEventsMap`).orderByChild("species").equalTo(code).once("value")
        )
      );
      let lastSeen = Number.NEGATIVE_INFINITY;
      for (const snapshot of snapshots) {
        for (const event of Object.values((snapshot.val() ?? {}) as Record<string, BirdEvent>)) {
          const timestamp = eventTimestamp(event);
          if (
            isActiveEvent(event, bandResets) &&
            timestamp < periodStart.getTime() &&
            timestamp > lastSeen
          ) {
            lastSeen = timestamp;
          }
        }
      }
      return Number.isFinite(lastSeen)
        ? { label: species, value: daysBetween(lastSeen, periodStart.getTime()) }
        : null;
    })
  );

  return results
    .filter((item): item is RankedItem => item !== null)
    .sort((a, b) => b.value - a.value || a.label.localeCompare(b.label))
    .slice(0, 3);
}

function escapeHtml(value: string | number): string {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function speciesLabel(code: string, speciesMap: Record<string, Species>): string {
  const name = speciesMap[code]?.speciesDescriptionCMMN;
  return name ? `${name} (${code})` : code;
}

function card(title: string, content: string, height?: number): string {
  const heightAttribute = height ? String(height) : "100%";
  const heightStyle = height ? `${height}px` : "100%";
  return `<table role="presentation" class="stat-card" width="100%" height="${heightAttribute}" cellpadding="0" cellspacing="0" style="height:${heightStyle};border:1px solid #dbe3ee;border-radius:10px">
    <tr><td class="card-content" style="padding:16px;vertical-align:top">
      <div class="card-title" style="font-size:12px;font-weight:700;color:#64748b;margin-bottom:9px">${escapeHtml(title)}</div>
      ${content}
    </td></tr>
  </table>`;
}

function cardRow(cards: string[], className = ""): string {
  const width = `${100 / cards.length}%`;
  return `<table role="presentation" class="card-row ${className}" width="100%" cellspacing="0" style="table-layout:fixed;margin-top:12px"><tbody class="card-row-body"><tr class="card-row-content">${cards
    .map((content, index) => {
      const positionClass = index === 0 ? "card-cell-first" : index === cards.length - 1 ? "card-cell-last" : "card-cell-middle";
      const padding =
        cards.length === 1
          ? "padding:0"
          : index === 0
            ? "padding-right:6px"
            : index === cards.length - 1
              ? "padding-left:6px"
              : "padding:0 6px";
      return `<td class="card-cell ${positionClass}" width="${width}" height="100%" style="${padding};height:100%;vertical-align:top">${content}</td>`;
    })
    .join("")}</tr></tbody></table>`;
}

function metricCard(title: string, value: string | number, detail = ""): string {
  return card(
    title,
    `<div class="metric-value" style="font-size:25px;font-weight:700">${escapeHtml(value)}</div>${
      detail ? `<div style="font-size:12px;color:#64748b;margin-top:5px">${escapeHtml(detail)}</div>` : ""
    }`
  );
}

function rankedCard(
  title: string,
  items: RankedItem[],
  unit: string
): string {
  if (items.length === 0) return card(title, `<div style="font-size:13px;color:#64748b">No data</div>`, 220);
  const rows = items
    .map((item, index) => {
      return `<tr>
        <td style="width:22px;padding:5px 0;color:#15803d;font-weight:700">${index + 1}.</td>
        <td style="padding:5px 8px;font-size:13px;font-weight:700">${escapeHtml(item.label)}${
          item.detail ? `<div style="font-size:11px;color:#64748b;font-weight:400">(${escapeHtml(item.detail)})</div>` : ""
        }</td>
        <td style="padding:5px 0;text-align:right;font-size:12px;color:#64748b">${item.value} ${escapeHtml(unit)}</td>
      </tr>`;
    })
    .join("");
  return card(title, `<table width="100%" cellspacing="0">${rows}</table>`, 220);
}

function recordCard(
  title: string,
  items: Array<{ event: BirdEvent; headline: string; detail?: string }>
): string {
  if (items.length === 0) return card(title, `<div style="font-size:13px;color:#64748b">No data</div>`, 270);
  const rows = items
    .map(
      ({ event, headline, detail }, index) => `<tr>
        <td style="width:22px;padding:6px 0;color:#15803d;font-weight:700;vertical-align:top">${index + 1}.</td>
        <td style="padding:6px 8px;vertical-align:top">
          <div style="font-size:13px;font-weight:700">${escapeHtml(event.species)}</div>
          <div style="font-size:11px;color:#64748b;margin-top:2px">${escapeHtml(event.band?.id ?? "")}</div>
        </td>
        <td style="padding:6px 0;text-align:right;vertical-align:top">
          <div style="font-size:12px;color:#64748b">${escapeHtml(headline)}</div>
          <div style="font-size:11px;color:#64748b;margin-top:2px">${escapeHtml(detail || event.date)}</div>
        </td>
      </tr>`
    )
    .join("");
  return card(title, `<table width="100%" cellspacing="0">${rows}</table>`, 270);
}

function renderEmail(stats: DailyStats, speciesMap: Record<string, Species>, periodStart: Date, periodEnd: Date) {
  const dateFormatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: TIME_ZONE,
    dateStyle: "medium",
    timeStyle: "short",
  });
  const period = `${dateFormatter.format(periodStart)} – ${dateFormatter.format(periodEnd)}`;
  const speciesRows = stats.allSpecies
    .map((item) => {
      const commonName = speciesMap[item.label]?.speciesDescriptionCMMN;
      return `<tr>
        <td width="40%" style="width:40%;padding:7px 4px 7px 0;vertical-align:top;overflow-wrap:anywhere">
          ${commonName ? `<div class="species-name" style="font-size:12px;font-weight:700;line-height:1.2">${escapeHtml(commonName)}</div>` : ""}
          <div class="species-code" style="font-size:10px;color:#64748b;margin-top:2px">${escapeHtml(item.label)}</div>
        </td>
        <td width="15%" style="width:15%;padding:7px 2px;text-align:center;font-size:12px">${item.value}</td>
        <td width="15%" style="width:15%;padding:7px 2px;text-align:center;font-size:12px">${item.banded}</td>
        <td width="17%" style="width:17%;padding:7px 2px;text-align:center;font-size:12px">${item.repeats + item.returns}</td>
        <td width="13%" style="width:13%;padding:7px 0 7px 2px;text-align:center;font-size:12px">${item.aliens}</td>
      </tr>`;
    })
    .join("");
  const speciesTable = `<table class="species-table" width="100%" cellspacing="0" style="table-layout:fixed">
    <colgroup>
      <col width="40%"><col width="15%"><col width="15%"><col width="17%"><col width="13%">
    </colgroup>
    <thead><tr style="color:#64748b;font-size:10px;text-transform:uppercase">
      <th width="40%" style="width:40%;padding:4px 4px 7px 0;text-align:left">Species</th>
      <th width="15%" style="width:15%;padding:4px 2px;text-align:center">Total</th>
      <th width="15%" style="width:15%;padding:4px 2px;text-align:center">Band</th>
      <th width="17%" style="width:17%;padding:4px 2px;text-align:center">Recap</th>
      <th width="13%" style="width:13%;padding:4px 0 4px 2px;text-align:center">Alien</th>
    </tr></thead>
    <tbody>${speciesRows}</tbody>
  </table>`;

  const recordCards = [
    recordCard(
      "Heaviest Bird",
      stats.heaviestBirds.map((event) => ({ event, headline: `${event.weight}g` }))
    ),
    recordCard(
      "Fattest Bird",
      stats.fattestBirds.map((event) => ({ event, headline: `Fat ${event.fat} · ${event.weight}g` }))
    ),
    recordCard(
      "Oldest Recap/Return",
      stats.oldestBirds.map(({ event, spanDays }) => ({
        event,
        headline: formatSpan(spanDays),
        detail: event.date,
      }))
    ),
  ];

  const cards = [
    cardRow([
      metricCard("Species (Banded)", stats.bandedSpeciesCount),
      metricCard("Species (Recaptures)", stats.recaptureSpeciesCount),
    ], "pair-row metric-row"),
    cardRow([
      metricCard("Total Species", stats.speciesCount),
      metricCard("Banded", stats.banded),
    ], "pair-row metric-row"),
    cardRow([
      metricCard("Recaptures", stats.repeats),
      metricCard("Returns", stats.returns),
    ], "pair-row metric-row"),
    cardRow([card("Species", speciesTable)]),
    cardRow([
      rankedCard("Most Banded Species", stats.topBandedSpecies, "banded"),
      rankedCard("Most Recaptured Species", stats.topRecapturedSpecies, "recaptures"),
    ], "pair-row ranking-row"),
    cardRow([
      rankedCard("Most Productive Nets", stats.topNets, "birds"),
      rankedCard("Busiest Banders", stats.topBanders, "banded"),
    ], "pair-row ranking-row"),
    cardRow([
      rankedCard("Busiest Scribes", stats.topScribes, "scribed"),
      rankedCard("Rarest Birds (longest gap since last captured)", stats.rareBirds, "days"),
    ], "pair-row ranking-row"),
    cardRow(recordCards.slice(0, 2), "pair-row record-row"),
    cardRow(
      stats.dummestBirds.length > 0
        ? [
            recordCards[2],
            rankedCard("Dummest Birds (most recaptured)", stats.dummestBirds, "recaptures"),
          ]
        : [recordCards[2]],
      "pair-row record-row"
    ),
  ].join("");

  const html = `<!doctype html>
<html><head>
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <style>
    .ranking-row .stat-card { height: 220px !important; }
    .record-row .stat-card { height: 270px !important; }
    @media screen and (max-width: 600px) {
      .email-shell { padding: 0 !important; }
      .email-body { padding: 20px 14px !important; border-radius: 0 !important; }
      .email-title { font-size: 22px !important; line-height: 1.2 !important; }
      .card-row, .card-row-body, .card-row-content { display: block !important; width: 100% !important; }
      .card-row { margin-top: 0 !important; }
      .card-cell { display: block !important; width: 100% !important; padding: 0 0 12px !important; }
      .pair-row { display: table !important; table-layout: fixed !important; margin: 0 0 8px !important; }
      .pair-row .card-row-body { display: table-row-group !important; width: auto !important; }
      .pair-row .card-row-content { display: table-row !important; width: auto !important; }
      .pair-row .card-cell { display: table-cell !important; width: 50% !important; padding: 0 4px !important; }
      .pair-row .card-cell-first { padding-left: 0 !important; }
      .pair-row .card-cell-last { padding-right: 0 !important; }
      .metric-row { display: table !important; table-layout: fixed !important; margin: 0 0 8px !important; }
      .metric-row .card-row-body { display: table-row-group !important; width: auto !important; }
      .metric-row .card-row-content { display: table-row !important; width: auto !important; }
      .metric-row .card-cell { display: table-cell !important; width: 50% !important; padding: 0 4px !important; }
      .metric-row .card-cell-first { padding-left: 0 !important; }
      .metric-row .card-cell-last { padding-right: 0 !important; }
      .metric-row .stat-card { height: 72px !important; min-height: 72px !important; }
      .metric-row .card-content { padding: 10px !important; }
      .metric-row .card-title { font-size: 10px !important; line-height: 1.2 !important; margin-bottom: 6px !important; }
      .metric-row .metric-value { font-size: 20px !important; line-height: 1 !important; }
      .species-table { width: 100% !important; table-layout: fixed !important; }
      .species-table th { font-size: 8px !important; line-height: 1.15 !important; white-space: normal !important; }
      .species-table td { font-size: 10px !important; }
      .species-table .species-name { font-size: 10px !important; }
      .species-table .species-code { font-size: 9px !important; }
    }
  </style>
</head><body style="margin:0;background:#f1f5f9;font-family:Arial,sans-serif;color:#0f172a">
  <div class="email-shell" style="max-width:640px;margin:0 auto;padding:24px 14px">
    <div class="email-body" style="background:#ffffff;border-radius:14px;padding:28px">
      <div style="font-size:13px;font-weight:700;letter-spacing:.08em;color:#15803d">MBO DAILY SUMMARY</div>
      <h1 class="email-title" style="font-size:25px;line-height:1.25;margin:8px 0 4px">Birds captured in the past 24 hours</h1>
      <div style="font-size:13px;color:#64748b;margin-bottom:18px">${escapeHtml(period)}</div>
      ${cards}
    </div>
  </div>
</body></html>`;

  const list = (title: string, items: RankedItem[], unit: string) => [
    title,
    ...(items.length ? items.map((item, index) => `${index + 1}. ${item.label}${item.detail ? ` (${item.detail})` : ""} — ${item.value} ${unit}`) : ["No data"]),
    "",
  ];
  const recordText = (
    title: string,
    items: Array<{ event: BirdEvent; headline: string; detail?: string }>
  ) => [
    title,
    ...(items.length
      ? items.map(
          ({ event, headline, detail }, index) =>
            `${index + 1}. ${event.species} — ${event.band?.id ?? ""} — ${headline} — ${detail || event.date}`
        )
      : ["No data"]),
    "",
  ];
  const text = [
    "MBO daily bird summary",
    period,
    "",
    `Species (Banded): ${stats.bandedSpeciesCount}`,
    `Species (Recaptures): ${stats.recaptureSpeciesCount}`,
    `Total Species: ${stats.speciesCount}`,
    `Banded: ${stats.banded}`,
    `Recaptures: ${stats.repeats}`,
    `Returns: ${stats.returns}`,
    "",
    ...list("Most Banded Species", stats.topBandedSpecies, "banded"),
    ...list("Most Recaptured Species", stats.topRecapturedSpecies, "recaptures"),
    ...list("Most Productive Nets", stats.topNets, "birds"),
    ...list("Busiest Banders", stats.topBanders, "banded"),
    ...list("Busiest Scribes", stats.topScribes, "scribed"),
    ...recordText(
      "Heaviest Bird",
      stats.heaviestBirds.map((event) => ({ event, headline: `${event.weight}g` }))
    ),
    ...recordText(
      "Fattest Bird",
      stats.fattestBirds.map((event) => ({ event, headline: `Fat ${event.fat} · ${event.weight}g` }))
    ),
    ...recordText(
      "Oldest Recap/Return",
      stats.oldestBirds.map(({ event, spanDays }) => ({
        event,
        headline: formatSpan(spanDays),
        detail: event.date,
      }))
    ),
    ...list("Rarest Birds", stats.rareBirds, "days"),
    ...(stats.dummestBirds.length > 0 ? list("Dummest Birds", stats.dummestBirds, "recaptures") : []),
    "Species — Total | Band | Recap | Alien",
    ...stats.allSpecies.map(
      (item) =>
        `${speciesLabel(item.label, speciesMap)} — ${item.value} | ${item.banded} | ${item.repeats + item.returns} | ${item.aliens}`
    ),
  ].join("\n");

  return { html, text };
}

async function main(): Promise<void> {
  const emailConfig = loadEmailConfig();
  const firebaseConfig = loadFirebaseConfig();
  const now = new Date();
  const periodStart = new Date(now.getTime() - DAY_IN_MS);
  const app = initializeApp({
    credential: cert(firebaseConfig.serviceAccount),
    databaseURL: firebaseConfig.databaseUrl,
  });

  try {
    const db = getDatabase(app);
    const root = db.ref(firebaseConfig.environment);
    const [eventsSnapshot, resetsSnapshot, aliasesSnapshot, speciesSnapshot, volunteersSnapshot] = await Promise.all([
      root.child("birdEventsMap").orderByChild("date").startAt(dateKey(periodStart)).once("value"),
      root.child("bandResetsMap").once("value"),
      root.child("speciesAliasesMap").once("value"),
      root.child("magicTable/species").once("value"),
      root.child("volunteersMap").once("value"),
    ]);

    const bandResets = (resetsSnapshot.val() ?? {}) as BandResetsMap;
    const aliases = (aliasesSnapshot.val() ?? {}) as SpeciesAliasesMap;
    const speciesMap = (speciesSnapshot.val() ?? {}) as Record<string, Species>;
    const volunteers = (volunteersSnapshot.val() ?? {}) as VolunteersMap;
    const recentEvents = Object.values((eventsSnapshot.val() ?? {}) as Record<string, BirdEvent>).filter((event) => {
      const timestamp = eventTimestamp(event);
      return isActiveEvent(event, bandResets) && timestamp > periodStart.getTime() && timestamp <= now.getTime();
    });

    if (recentEvents.length === 0) {
      console.log("No birds captured in the past 24 hours; no email sent.");
      return;
    }

    const [currentStats, oldestBirds, rareBirds] = await Promise.all([
      Promise.resolve(calculateCurrentStats(recentEvents, aliases, speciesMap, volunteers)),
      loadOldestRecapture(db, firebaseConfig.environment, recentEvents, bandResets),
      loadRareBirds(db, firebaseConfig.environment, recentEvents, aliases, speciesMap, bandResets, periodStart),
    ]);
    const stats: DailyStats = {
      ...currentStats,
      oldestBirds,
      rareBirds,
    };
    const message = renderEmail(stats, speciesMap, periodStart, now);
    const transporter = nodemailer.createTransport({
      host: emailConfig.host,
      port: emailConfig.port,
      secure: false,
      auth: { user: emailConfig.user, pass: emailConfig.pass },
    });

    await transporter.sendMail({
      from: emailConfig.from,
      to: emailConfig.to,
      subject: `MBO daily bird summary — ${stats.totalEvents} captures`,
      html: message.html,
      text: message.text,
    });
    console.log(`Daily bird summary sent for ${stats.totalEvents} captures.`);
  } finally {
    if (getApps().includes(app)) await deleteApp(app);
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
