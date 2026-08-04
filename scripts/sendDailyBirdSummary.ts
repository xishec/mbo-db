import { cert, deleteApp, getApps, initializeApp, type ServiceAccount } from "firebase-admin/app";
import { getDatabase } from "firebase-admin/database";
import nodemailer from "nodemailer";
import type { BirdEvent, BandResetsMap, Species, SpeciesAliasesMap } from "../src/types/index.js";

const TIME_ZONE = "America/Toronto";
const DAY_IN_MS = 24 * 60 * 60 * 1000;

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
}

interface DailyStats {
  totalEvents: number;
  speciesCount: number;
  banded: number;
  repeats: number;
  returns: number;
  topSpecies: RankedItem[];
  topNet: RankedItem | null;
  heaviest: BirdEvent | null;
  fattest: BirdEvent | null;
}

function loadEmailConfig(): EmailConfig {
  const requiredEnvVars = ["EMAIL_USER", "EMAIL_PASSWORD", "RECIPIENT_EMAIL"];
  const missing = requiredEnvVars.filter((varName) => !process.env[varName]);

  if (missing.length > 0) {
    throw new Error(`Missing required environment variables: ${missing.join(", ")}`);
  }

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
  const rawServiceAccount = process.env.FIREBASE_SERVICE_ACCOUNT;
  if (!rawServiceAccount) throw new Error("Missing required environment variable: FIREBASE_SERVICE_ACCOUNT");

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

function isActiveEvent(event: BirdEvent, bandResets: BandResetsMap): boolean {
  if (event.modifiedEventId) return false;
  const reset = bandResets[event.band?.id];
  return !reset || event.bandGenerationId === reset.generationId;
}

function resolveSpeciesCode(code: string, aliases: SpeciesAliasesMap): string {
  const normalized = code.toUpperCase();
  const aliasMatch = Object.entries(aliases).find(([, alias]) => alias.toUpperCase() === normalized);
  return aliasMatch?.[0] ?? aliases[normalized] ?? normalized;
}

function ranked(counts: Map<string, number>, limit: number): RankedItem[] {
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, limit)
    .map(([label, value]) => ({ label, value }));
}

function calculateStats(events: BirdEvent[], aliases: SpeciesAliasesMap): DailyStats {
  const speciesCounts = new Map<string, number>();
  const netCounts = new Map<string, number>();
  let banded = 0;
  let repeats = 0;
  let returns = 0;
  let heaviest: BirdEvent | null = null;
  let fattest: BirdEvent | null = null;

  for (const event of events) {
    if (event.species) {
      const species = resolveSpeciesCode(event.species, aliases);
      speciesCounts.set(species, (speciesCounts.get(species) ?? 0) + 1);
    }
    if (event.net) netCounts.set(event.net, (netCounts.get(event.net) ?? 0) + 1);

    if (event.birdEventType === "Banded" || event.birdEventType === "None") banded += 1;
    else if (event.birdEventType === "Repeat") repeats += 1;
    else if (event.birdEventType === "Return") returns += 1;

    if (event.weight > 0 && (!heaviest || event.weight > heaviest.weight)) heaviest = event;
    if (
      event.fat > 0 &&
      (!fattest || event.fat > fattest.fat || (event.fat === fattest.fat && event.weight > fattest.weight))
    ) {
      fattest = event;
    }
  }

  return {
    totalEvents: events.length,
    speciesCount: speciesCounts.size,
    banded,
    repeats,
    returns,
    topSpecies: ranked(speciesCounts, 3),
    topNet: ranked(netCounts, 1)[0] ?? null,
    heaviest,
    fattest,
  };
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

function renderEmail(
  stats: DailyStats,
  speciesMap: Record<string, Species>,
  aliases: SpeciesAliasesMap,
  periodStart: Date,
  periodEnd: Date
): { html: string; text: string } {
  const dateFormatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: TIME_ZONE,
    dateStyle: "medium",
    timeStyle: "short",
  });
  const period = `${dateFormatter.format(periodStart)} – ${dateFormatter.format(periodEnd)}`;
  const topSpeciesHtml = stats.topSpecies
    .map(
      (item, index) =>
        `<tr><td style="padding:7px 0;color:#64748b">${index + 1}</td><td style="padding:7px 10px;font-weight:600">${escapeHtml(speciesLabel(item.label, speciesMap))}</td><td style="padding:7px 0;text-align:right">${item.value}</td></tr>`
    )
    .join("");
  const highlight = (title: string, value: string, detail: string) => `
    <td style="width:33.33%;padding:0 6px;vertical-align:top">
      <div style="border:1px solid #e2e8f0;border-radius:10px;padding:14px;min-height:76px">
        <div style="font-size:12px;color:#64748b">${escapeHtml(title)}</div>
        <div style="font-size:19px;font-weight:700;margin-top:5px">${escapeHtml(value)}</div>
        <div style="font-size:12px;color:#64748b;margin-top:3px">${escapeHtml(detail)}</div>
      </div>
    </td>`;
  const eventDetail = (event: BirdEvent | null) =>
    event ? speciesLabel(resolveSpeciesCode(event.species, aliases), speciesMap) : "No data";

  const html = `<!doctype html>
<html><body style="margin:0;background:#f1f5f9;font-family:Arial,sans-serif;color:#0f172a">
  <div style="max-width:640px;margin:0 auto;padding:28px 14px">
    <div style="background:#ffffff;border-radius:14px;padding:28px;box-shadow:0 1px 3px rgba(15,23,42,.08)">
      <div style="font-size:13px;font-weight:700;letter-spacing:.08em;color:#15803d">MBO DAILY SUMMARY</div>
      <h1 style="font-size:25px;margin:8px 0 4px">Birds captured in the past 24 hours</h1>
      <div style="font-size:13px;color:#64748b">${escapeHtml(period)}</div>

      <table role="presentation" width="100%" cellspacing="8" style="margin:22px -8px 12px">
        <tr>
          ${highlight("Captures", String(stats.totalEvents), `${stats.speciesCount} species`)}
          ${highlight("Banded", String(stats.banded), "new captures")}
          ${highlight("Recaptured", String(stats.repeats + stats.returns), `${stats.repeats} repeats · ${stats.returns} returns`)}
        </tr>
      </table>

      <h2 style="font-size:16px;margin:24px 0 8px">Top species</h2>
      <table width="100%" cellspacing="0" style="font-size:14px">${topSpeciesHtml}</table>

      <h2 style="font-size:16px;margin:24px 0 10px">Highlights</h2>
      <table role="presentation" width="100%" cellspacing="0"><tr>
        ${highlight("Busiest net", stats.topNet?.label ?? "No data", stats.topNet ? `${stats.topNet.value} birds` : "")}
        ${highlight("Heaviest bird", stats.heaviest ? `${stats.heaviest.weight} g` : "No data", eventDetail(stats.heaviest))}
        ${highlight("Fattest bird", stats.fattest ? `Fat ${stats.fattest.fat}` : "No data", eventDetail(stats.fattest))}
      </tr></table>
    </div>
  </div>
</body></html>`;

  const text = [
    "MBO daily bird summary",
    period,
    "",
    `${stats.totalEvents} captures · ${stats.speciesCount} species`,
    `${stats.banded} banded · ${stats.repeats} repeats · ${stats.returns} returns`,
    "",
    "Top species:",
    ...stats.topSpecies.map((item, index) => `${index + 1}. ${speciesLabel(item.label, speciesMap)} — ${item.value}`),
    "",
    `Busiest net: ${stats.topNet ? `${stats.topNet.label} (${stats.topNet.value} birds)` : "No data"}`,
    `Heaviest bird: ${stats.heaviest ? `${stats.heaviest.weight} g · ${eventDetail(stats.heaviest)}` : "No data"}`,
    `Fattest bird: ${stats.fattest ? `Fat ${stats.fattest.fat} · ${eventDetail(stats.fattest)}` : "No data"}`,
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
    const [eventsSnapshot, resetsSnapshot, aliasesSnapshot, speciesSnapshot] = await Promise.all([
      root.child("birdEventsMap").orderByChild("date").startAt(dateKey(periodStart)).once("value"),
      root.child("bandResetsMap").once("value"),
      root.child("speciesAliasesMap").once("value"),
      root.child("magicTable/species").once("value"),
    ]);

    const bandResets = (resetsSnapshot.val() ?? {}) as BandResetsMap;
    const aliases = (aliasesSnapshot.val() ?? {}) as SpeciesAliasesMap;
    const speciesMap = (speciesSnapshot.val() ?? {}) as Record<string, Species>;
    const recentEvents = Object.values((eventsSnapshot.val() ?? {}) as Record<string, BirdEvent>).filter((event) => {
      const timestamp = eventTimestamp(event);
      return isActiveEvent(event, bandResets) && timestamp > periodStart.getTime() && timestamp <= now.getTime();
    });

    if (recentEvents.length === 0) {
      console.log("No birds captured in the past 24 hours; no email sent.");
      return;
    }

    const stats = calculateStats(recentEvents, aliases);
    const message = renderEmail(stats, speciesMap, aliases, periodStart, now);
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
