import { Button, Select, SelectItem, Spinner } from "@heroui/react";
import { useCallback, useDeferredValue, useEffect, useMemo, useState, useTransition } from "react";
import PageHeader from "../PageHeader";
import { useData } from "../../../services/useData";
import { ChartContainer, DailyTrendChart } from "./ReportCharts";
import {
  analyzeCaptures,
  buildDailyTrend,
  enumerateDates,
  formatMonthLabel,
  formatNumber,
  formatShortDate,
  formatWeekLabel,
  getMonthKey,
  getWeekStart,
  summarizeSeason,
  toReportCapture,
  type DailyTrendPoint,
  type ReportCapture,
  type ReportAnalysis,
} from "./reportUtils";
import { BirdEventType, type Program } from "../../../types";
import { SPECIES_MAP } from "../../../types/species";

function StatTile({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="rounded-lg border border-default-200 bg-default-50 p-4 transition-shadow hover:shadow-sm">
      <div className="text-xs font-medium uppercase tracking-wide text-default-900">{label}</div>
      <div className="mt-2 text-2xl font-semibold text-default-900">{value}</div>
      {hint && <div className="mt-1.5 text-xs text-default-900">{hint}</div>}
    </div>
  );
}

type TableColumn = {
  key: string;
  label: string;
  align?: "left" | "right" | "center";
};

function ReportTable({
  title,
  subtitle,
  columns,
  rows,
}: {
  title: string;
  subtitle?: string;
  columns: TableColumn[];
  rows: Array<Record<string, React.ReactNode>>;
}) {
  return (
    <div className="rounded-xl border border-default-200 bg-white p-4 shadow-sm">
      <div className="mb-3">
        <h3 className="text-base font-semibold text-default-900">{title}</h3>
        {subtitle && <p className="text-xs text-default-900">{subtitle}</p>}
      </div>
      <div className="max-h-80 overflow-auto rounded-lg border border-default-100">
        <table className="w-full text-sm">
          <thead className="sticky top-0 bg-default-50 text-xs uppercase text-default-900">
            <tr>
              {columns.map((column) => (
                <th
                  key={column.key}
                  className={`px-3 py-2.5 font-semibold ${
                    column.align === "right"
                      ? "text-right"
                      : column.align === "center"
                        ? "text-center"
                        : "text-left"
                  }`}
                >
                  {column.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-default-100">
            {rows.length ? (
              rows.map((row, index) => (
                <tr
                  key={index}
                  className={`text-default-900 transition-colors hover:bg-default-50 ${
                    index % 2 === 0 ? "bg-white" : "bg-default-25"
                  }`}
                >
                  {columns.map((column) => (
                    <td
                      key={column.key}
                      className={`px-3 py-2.5 ${
                        column.align === "right"
                          ? "text-right"
                          : column.align === "center"
                            ? "text-center"
                            : "text-left"
                      }`}
                    >
                      {row[column.key] ?? "—"}
                    </td>
                  ))}
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={columns.length} className="px-3 py-6 text-center text-sm text-default-900">
                  No data available.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function ReportSection({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) {
  return (
    <section className="rounded-2xl border border-default-200 bg-white p-6 shadow-sm print:shadow-none">
      <div className="mb-5">
        <h2 className="text-xl font-semibold text-default-900">{title}</h2>
        {subtitle && <p className="mt-1 text-sm text-default-900">{subtitle}</p>}
      </div>
      {children}
    </section>
  );
}


const parseCsvLine = (line: string): string[] => {
  const result: string[] = [];
  let current = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i += 1) {
    const char = line[i];
    if (char === "\"") {
      if (inQuotes && line[i + 1] === "\"") {
        current += "\"";
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === "," && !inQuotes) {
      result.push(current);
      current = "";
    } else {
      current += char;
    }
  }
  result.push(current);
  return result;
};

type ProgramGroupDefinition = {
  key: string;
  title: string;
  subtitle: string;
  matchers: string[];
  showCharts?: boolean;
};

type ProgramGroup = ProgramGroupDefinition & {
  programs: Program[];
};

type ReportGroupData = {
  group: ProgramGroup;
  groupAnalysis: ReportAnalysis | null;
  groupCaptures: ReportCapture[];
  effortDays: number;
  netHours: number;
  dailyBanded: DailyTrendPoint[];
  dailyBandedSpecies: DailyTrendPoint[];
  dailyCensusSpecies: DailyTrendPoint[];
  dailyObservedSpecies: DailyTrendPoint[];
  summary: string;
  periodLabel: string;
  weatherRows: Array<Record<string, React.ReactNode>>;
  summaryRows: Array<Record<string, React.ReactNode>>;
  topBandedRows: Array<Record<string, React.ReactNode>>;
  topRecapturedRows: Array<Record<string, React.ReactNode>>;
  returnsRows: Array<Record<string, React.ReactNode>>;
  netUsageRows: Array<Record<string, React.ReactNode>>;
  priorityRows: Array<Record<string, React.ReactNode>>;
};

const PROGRAM_GROUPS: ProgramGroupDefinition[] = [
  {
    key: "winter",
    title: "Winter Population Monitoring Program",
    subtitle: "Seasonal banding activity during winter monitoring.",
    matchers: ["winter"],
  },
  {
    key: "spring",
    title: "Spring Migration Monitoring Program",
    subtitle: "Daily banding and census activity during spring migration.",
    matchers: ["spring", "smmp"],
    showCharts: true,
  },
  {
    key: "summer",
    title: "Summer (MAPS) Program",
    subtitle: "Breeding season monitoring and capture activity.",
    matchers: ["summer", "maps"],
  },
  {
    key: "fall",
    title: "Fall Migration Monitoring Program",
    subtitle: "Daily banding and census activity during fall migration.",
    matchers: ["fall", "fmmp"],
    showCharts: true,
  },
  {
    key: "owl",
    title: "Northern Saw-whet Owl Migration Monitoring Program",
    subtitle: "Owl migration monitoring program results.",
    matchers: ["owl", "saw-whet", "saw whet", "nswo"],
  },
];

export default function Reports() {
  const { birdEventsMap, programsMap, DETsMap, isLoading } = useData();
  const [selectedProgramId, setSelectedProgramId] = useState<string>("all");
  const [startDate, setStartDate] = useState<string>("2022-01-01");
  const [endDate, setEndDate] = useState<string>("2023-12-31");
  const [isReportReady, setIsReportReady] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [appliedStartDate, setAppliedStartDate] = useState<string>("");
  const [appliedEndDate, setAppliedEndDate] = useState<string>("");
  const [appliedProgramId, setAppliedProgramId] = useState<string>("all");
  const [prioritySpeciesMap, setPrioritySpeciesMap] = useState<Record<string, string>>({});
  const deferredStartDate = useDeferredValue(appliedStartDate);
  const deferredEndDate = useDeferredValue(appliedEndDate);
  const deferredProgramId = useDeferredValue(appliedProgramId);

  const captures = useMemo<ReportCapture[]>(() => {
    return Object.values(birdEventsMap)
      .filter((event) => event && !event.modifiedEventId)
      .map((event) => toReportCapture(event));
  }, [birdEventsMap]);

  const dateBounds = useMemo(() => {
    const dates = captures
      .map((capture) => capture.date)
      .filter((date) => Boolean(date))
      .sort();
    if (!dates.length) {
      return { min: "", max: "" };
    }
    return { min: dates[0], max: dates[dates.length - 1] };
  }, [captures]);

  useEffect(() => {
    if (!startDate && dateBounds.min) {
      setStartDate(dateBounds.min);
    }
    if (!endDate && dateBounds.max) {
      setEndDate(dateBounds.max);
    }
  }, [dateBounds, startDate, endDate]);

  useEffect(() => {
    let isActive = true;
    fetch("/data/tblSpecies.csv")
      .then((response) => response.text())
      .then((text) => {
        if (!isActive) return;
        const lines = text.split(/\r?\n/).filter((line) => line.trim().length > 0);
        if (!lines.length) return;
        const header = parseCsvLine(lines[0]).map((entry) => entry.trim());
        const codeIndex = header.indexOf("SpeciesCode");
        const priorityIndex = header.indexOf("PriorityCategory");
        if (codeIndex === -1 || priorityIndex === -1) return;

        const map: Record<string, string> = {};
        lines.slice(1).forEach((line) => {
          const columns = parseCsvLine(line);
          const code = columns[codeIndex]?.trim();
          const priority = columns[priorityIndex]?.trim();
          if (code && priority) {
            map[code] = priority;
          }
        });
        setPrioritySpeciesMap(map);
      })
      .catch(() => {});
    return () => {
      isActive = false;
    };
  }, []);

  const programOptions = useMemo(() => {
    return Object.values(programsMap).sort((a, b) => a.displayName.localeCompare(b.displayName));
  }, [programsMap]);

  const dets = useMemo(() => {
    return Object.values(DETsMap ?? {}).filter((det) => det && det.date);
  }, [DETsMap]);

  const effectiveDateRange = useMemo(() => {
    return {
      start: deferredStartDate || dateBounds.min,
      end: deferredEndDate || dateBounds.max,
    };
  }, [deferredStartDate, deferredEndDate, dateBounds]);

  const reportDates = useMemo(() => {
    if (!isReportReady) return [];
    return enumerateDates(effectiveDateRange.start, effectiveDateRange.end);
  }, [effectiveDateRange, isReportReady]);

  const capturesInRange = useMemo(() => {
    if (!isReportReady) return [];
    const { start, end } = effectiveDateRange;
    if (!start || !end) return [];
    return captures.filter((capture) => {
      if (capture.date < start) return false;
      if (capture.date > end) return false;
      return true;
    });
  }, [captures, effectiveDateRange, isReportReady]);

  const filteredCaptures = useMemo(() => {
    if (!isReportReady) return [];
    if (deferredProgramId === "all") return capturesInRange;
    return capturesInRange.filter((capture) => capture.programId === deferredProgramId);
  }, [capturesInRange, deferredProgramId, isReportReady]);

  const detsInRange = useMemo(() => {
    if (!isReportReady) return [];
    const { start, end } = effectiveDateRange;
    if (!start || !end) return [];
    return dets.filter((det) => {
      if (det.date < start) return false;
      if (det.date > end) return false;
      return true;
    });
  }, [dets, effectiveDateRange, isReportReady]);

  const filteredDets = useMemo(() => {
    if (!isReportReady) return [];
    if (deferredProgramId === "all") return detsInRange;
    return detsInRange.filter((det) => det.programId === deferredProgramId);
  }, [detsInRange, deferredProgramId, isReportReady]);

  const analysis = useMemo(() => {
    if (!filteredCaptures.length) return null;
    return analyzeCaptures(filteredCaptures);
  }, [filteredCaptures]);

  const dateRangeLabel = useMemo(() => {
    if (!deferredStartDate || !deferredEndDate) return "the selected time frame";
    const startLabel = new Date(`${deferredStartDate}T00:00:00`).toLocaleDateString("en-CA", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
    const endLabel = new Date(`${deferredEndDate}T00:00:00`).toLocaleDateString("en-CA", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
    return `${startLabel} to ${endLabel}`;
  }, [deferredStartDate, deferredEndDate]);

  const summaryText = useMemo(() => {
    if (!analysis) return "";
    const programLabel =
      appliedProgramId === "all" ? "all programs" : programsMap[appliedProgramId]?.displayName || "the program";
    return summarizeSeason(analysis, dateRangeLabel, programLabel);
  }, [analysis, dateRangeLabel, appliedProgramId, programsMap]);

  const overallNetHours = useMemo(() => {
    return filteredDets.reduce((sum, det) => {
      const value = Number(det.netHours?.total ?? 0);
      return Number.isNaN(value) ? sum : sum + value;
    }, 0);
  }, [filteredDets]);

  const countSpeciesEntries = useCallback((counts?: Record<string, number>) => {
    if (!counts) return 0;
    return Object.values(counts).filter((value) => Number(value) > 0).length;
  }, []);

  const getSpeciesLabel = useCallback((code: string) => {
    return SPECIES_MAP[code]?.speciesDescriptionMBO ?? code;
  }, []);

  const formatOptional = useCallback((value: number | null, digits = 1) => {
    if (value === null || Number.isNaN(value)) return "—";
    return value.toFixed(digits);
  }, []);

  const formatOptionalInt = useCallback((value: number | null) => {
    if (value === null || Number.isNaN(value)) return "—";
    return formatNumber(Math.round(value));
  }, []);

  const programGroups = useMemo<ProgramGroup[]>(() => {
    if (!programOptions.length) return [];
    const normalizedPrograms = programOptions.map((program) => ({
      ...program,
      normalizedName: program.displayName.toLowerCase(),
    }));
    const assigned = new Set<string>();
    const groups: ProgramGroup[] = PROGRAM_GROUPS.map((group) => {
      const programs = normalizedPrograms.filter((program) =>
        group.matchers.some((matcher) => program.normalizedName.includes(matcher))
      );
      programs.forEach((program) => assigned.add(program.id));
      return { ...group, programs };
    }).filter((group) => group.programs.length);

    const otherPrograms = normalizedPrograms.filter((program) => !assigned.has(program.id));
    if (otherPrograms.length) {
      groups.push({
        key: "other",
        title: "Other MBO Programs",
        subtitle: "Programs without a seasonal match.",
        matchers: [],
        programs: otherPrograms,
      });
    }
    return groups;
  }, [programOptions]);

  const reportGroups = useMemo<ReportGroupData[]>(() => {
    if (!isReportReady || !reportDates.length) return [];
    const results: ReportGroupData[] = [];
    for (const group of programGroups) {
      const allProgramIds = group.programs.map((program) => program.id);
      const activeProgramIds =
        appliedProgramId === "all" ? allProgramIds : allProgramIds.filter((id) => id === appliedProgramId);
      if (!activeProgramIds.length) continue;

      const groupCaptures = capturesInRange.filter((capture) => activeProgramIds.includes(capture.programId));
      const groupDets = detsInRange.filter((det) => activeProgramIds.includes(det.programId));
      const groupAnalysis = groupCaptures.length ? analyzeCaptures(groupCaptures) : null;

      const bandedCaptures = groupCaptures.filter((capture) => capture.captureType === BirdEventType.Banded);
      const bandedCounts = new Map<string, number>();
      const bandedSpeciesSets = new Map<string, Set<string>>();
      bandedCaptures.forEach((capture) => {
        if (!capture.date) return;
        bandedCounts.set(capture.date, (bandedCounts.get(capture.date) ?? 0) + 1);
        if (!bandedSpeciesSets.has(capture.date)) {
          bandedSpeciesSets.set(capture.date, new Set<string>());
        }
        bandedSpeciesSets.get(capture.date)!.add(capture.species);
      });

      const bandedSpeciesCounts = new Map<string, number>();
      bandedSpeciesSets.forEach((set, date) => bandedSpeciesCounts.set(date, set.size));

      const censusSpeciesCounts = new Map<string, number>();
      const observedSpeciesCounts = new Map<string, number>();
      groupDets.forEach((det) => {
        censusSpeciesCounts.set(det.date, countSpeciesEntries(det.censusSpeciesCount));
        observedSpeciesCounts.set(det.date, countSpeciesEntries(det.observedSpeciesCount));
      });

      const dailyBanded = buildDailyTrend(reportDates, bandedCounts);
      const dailyBandedSpecies = buildDailyTrend(reportDates, bandedSpeciesCounts);
      const dailyCensusSpecies = buildDailyTrend(reportDates, censusSpeciesCounts);
      const dailyObservedSpecies = buildDailyTrend(reportDates, observedSpeciesCounts);

      const effortDays = groupDets.length;
      const netHours = groupDets.reduce((sum, det) => {
        const value = Number(det.netHours?.total ?? 0);
        return Number.isNaN(value) ? sum : sum + value;
      }, 0);

      const peakBandedDay = dailyBanded.reduce(
        (max, entry) => (entry.value > max.value ? entry : max),
        { date: "", label: "", value: -1, mean7: 0 }
      );

      const summary =
        groupAnalysis && groupAnalysis.totalCaptures
          ? `During ${dateRangeLabel}, ${group.title} recorded ${formatNumber(
              groupAnalysis.totalCaptures
            )} captures across ${formatNumber(
              groupAnalysis.uniqueSpecies
            )} species. Banders logged ${formatNumber(effortDays)} effort days and ${formatNumber(
              Math.round(netHours)
            )} net hours. Peak banding occurred on ${peakBandedDay.label || "N/A"} with ${formatNumber(
              Math.max(0, peakBandedDay.value)
            )} individuals.`
          : `No report data available for ${group.title} during ${dateRangeLabel}.`;

      const periodGranularity = group.key === "winter" || group.key === "summer" ? "month" : "week";
      const periodLabel = periodGranularity === "week" ? "Week" : "Month";
      const getPeriodKey = (date: string) => (periodGranularity === "week" ? getWeekStart(date) : getMonthKey(date));
      const getPeriodLabel = (key: string) =>
        periodGranularity === "week" ? formatWeekLabel(key) : formatMonthLabel(key);

      const periodMap = new Map<
        string,
        {
          key: string;
          label: string;
          totalCaptures: number;
          banded: number;
          recaptures: number;
          returns: number;
          bandedSpecies: Set<string>;
          effortDays: number;
          netHours: number;
          tempSum: number;
          tempCount: number;
          tempMin: number | null;
          tempMax: number | null;
          precipSum: number;
          windSum: number;
          windCount: number;
          cloudSum: number;
          cloudCount: number;
        }
      >();

      const ensurePeriodEntry = (date: string) => {
        const key = getPeriodKey(date);
        const existing = periodMap.get(key);
        if (existing) return existing;
        const entry = {
          key,
          label: getPeriodLabel(key),
          totalCaptures: 0,
          banded: 0,
          recaptures: 0,
          returns: 0,
          bandedSpecies: new Set<string>(),
          effortDays: 0,
          netHours: 0,
          tempSum: 0,
          tempCount: 0,
          tempMin: null,
          tempMax: null,
          precipSum: 0,
          windSum: 0,
          windCount: 0,
          cloudSum: 0,
          cloudCount: 0,
        };
        periodMap.set(key, entry);
        return entry;
      };

      groupCaptures.forEach((capture) => {
        if (!capture.date) return;
        const entry = ensurePeriodEntry(capture.date);
        entry.totalCaptures += 1;
        if (capture.captureType === BirdEventType.Banded) {
          entry.banded += 1;
          entry.bandedSpecies.add(capture.species);
        }
        if (capture.captureType === BirdEventType.Return) entry.returns += 1;
        if (capture.captureType === BirdEventType.Repeat || capture.captureType === BirdEventType.Alien) {
          entry.recaptures += 1;
        }
      });

      groupDets.forEach((det) => {
        const entry = ensurePeriodEntry(det.date);
        entry.effortDays += 1;
        const netHoursValue = Number(det.netHours?.total ?? 0);
        if (!Number.isNaN(netHoursValue)) {
          entry.netHours += netHoursValue;
        }
        const weather = det.weather;
        if (weather) {
          let temperature = weather.temperature ?? null;
          if (temperature === null) {
            const minTemp = Number(weather.temperatureMin);
            const maxTemp = Number(weather.temperatureMax);
            if (!Number.isNaN(minTemp) && !Number.isNaN(maxTemp)) {
              temperature = (minTemp + maxTemp) / 2;
            }
          }
          if (temperature !== null && !Number.isNaN(temperature)) {
            entry.tempSum += temperature;
            entry.tempCount += 1;
          }
          const minTemp = Number(weather.temperatureMin);
          if (!Number.isNaN(minTemp)) {
            entry.tempMin = entry.tempMin === null ? minTemp : Math.min(entry.tempMin, minTemp);
          }
          const maxTemp = Number(weather.temperatureMax);
          if (!Number.isNaN(maxTemp)) {
            entry.tempMax = entry.tempMax === null ? maxTemp : Math.max(entry.tempMax, maxTemp);
          }
          const precip = Number(weather.precipitation);
          if (!Number.isNaN(precip)) {
            entry.precipSum += precip;
          }
          const wind = Number(weather.windSpeed);
          if (!Number.isNaN(wind)) {
            entry.windSum += wind;
            entry.windCount += 1;
          }
          const cloud = Number(weather.cloudCoverage);
          if (!Number.isNaN(cloud)) {
            entry.cloudSum += cloud;
            entry.cloudCount += 1;
          }
        }
      });

      const periodEntries = Array.from(periodMap.values()).sort((a, b) => a.key.localeCompare(b.key));

      const weatherRows = periodEntries.map((entry) => ({
        period: entry.label,
        avgTemp: formatOptional(entry.tempCount ? entry.tempSum / entry.tempCount : null),
        minTemp: formatOptional(entry.tempMin),
        maxTemp: formatOptional(entry.tempMax),
        precip: formatOptionalInt(entry.precipSum),
        wind: formatOptional(entry.windCount ? entry.windSum / entry.windCount : null),
        cloud: formatOptional(entry.cloudCount ? entry.cloudSum / entry.cloudCount : null),
      }));

      const summaryRows = periodEntries.map((entry) => {
        const captureRate = entry.netHours ? (entry.banded / entry.netHours) * 100 : null;
        return {
          period: entry.label,
          effortDays: formatNumber(entry.effortDays),
          netHours: formatOptionalInt(entry.netHours),
          banded: formatNumber(entry.banded),
          species: formatNumber(entry.bandedSpecies.size),
          recaptures: formatNumber(entry.recaptures),
          returns: formatNumber(entry.returns),
          rate: captureRate === null ? "—" : formatOptional(captureRate),
        };
      });

      const bandedBySpecies = new Map<string, number>();
      const recapturedBySpecies = new Map<string, number>();
      const returnedBySpecies = new Map<string, number>();

      groupCaptures.forEach((capture) => {
        const current = capture.species;
        if (capture.captureType === BirdEventType.Banded) {
          bandedBySpecies.set(current, (bandedBySpecies.get(current) ?? 0) + 1);
        }
        if (capture.captureType === BirdEventType.Repeat || capture.captureType === BirdEventType.Alien) {
          recapturedBySpecies.set(current, (recapturedBySpecies.get(current) ?? 0) + 1);
        }
        if (capture.captureType === BirdEventType.Return) {
          returnedBySpecies.set(current, (returnedBySpecies.get(current) ?? 0) + 1);
        }
      });

      const totalBanded = bandedCaptures.length || 1;
      const topBandedRows = Array.from(bandedBySpecies.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10)
        .map(([species, count]) => ({
          species: getSpeciesLabel(species),
          count: formatNumber(count),
          share: `${((count / totalBanded) * 100).toFixed(1)}%`,
        }));

      const totalRecaptured = Array.from(recapturedBySpecies.values()).reduce((sum, count) => sum + count, 0) || 1;
      const topRecapturedRows = Array.from(recapturedBySpecies.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10)
        .map(([species, count]) => ({
          species: getSpeciesLabel(species),
          count: formatNumber(count),
          share: `${((count / totalRecaptured) * 100).toFixed(1)}%`,
        }));

      const returnsRows = groupCaptures
        .filter((capture) => capture.captureType === BirdEventType.Return)
        .map((capture) => {
          const previous = capture.previousEventId ? birdEventsMap[capture.previousEventId] : null;
          let daysElapsed: number | null = null;
          if (previous?.date && capture.date) {
            const currentDate = new Date(`${capture.date}T00:00:00`);
            const previousDate = new Date(`${previous.date}T00:00:00`);
            if (!Number.isNaN(currentDate.getTime()) && !Number.isNaN(previousDate.getTime())) {
              const diffMs = currentDate.getTime() - previousDate.getTime();
              daysElapsed = Math.round(diffMs / 86400000);
            }
          }
          return {
            date: formatShortDate(capture.date),
            species: getSpeciesLabel(capture.species),
            band: capture.bandId || "—",
            elapsedValue: daysElapsed,
          };
        })
        .sort((a, b) => {
          if (a.elapsedValue === null && b.elapsedValue === null) return 0;
          if (a.elapsedValue === null) return 1;
          if (b.elapsedValue === null) return -1;
          return b.elapsedValue - a.elapsedValue;
        })
        .slice(0, 25)
        .map((entry) => ({
          date: entry.date,
          species: entry.species,
          band: entry.band,
          elapsed: entry.elapsedValue === null ? "—" : formatNumber(entry.elapsedValue),
        }));

      const netHoursByNet = new Map<string, number>();
      groupDets.forEach((det) => {
        det.netHours?.nets?.forEach((net) => {
          const netId = net.id || "Unknown";
          const hours = Number(net.total ?? 0);
          if (!Number.isNaN(hours)) {
            netHoursByNet.set(netId, (netHoursByNet.get(netId) ?? 0) + hours);
          }
        });
      });

      const capturesByNet = new Map<string, number>();
      groupCaptures.forEach((capture) => {
        const netId = capture.net || "Unknown";
        capturesByNet.set(netId, (capturesByNet.get(netId) ?? 0) + 1);
      });

      const netUsageRows = Array.from(netHoursByNet.entries())
        .sort((a, b) => b[1] - a[1])
        .map(([netId, hours]) => {
          const capturesForNet = capturesByNet.get(netId) ?? 0;
          const rate = hours ? (capturesForNet / hours) * 100 : null;
          return {
            net: netId,
            netHours: formatOptionalInt(hours),
            captures: formatNumber(capturesForNet),
            rate: rate === null ? "—" : formatOptional(rate),
          };
        });

      const priorityCounts = new Map<string, { observed: number; banded: number; priority: string }>();
      groupDets.forEach((det) => {
        Object.entries(det.observedSpeciesCount ?? {}).forEach(([speciesCode, count]) => {
          const priority = prioritySpeciesMap[speciesCode];
          if (!priority) return;
          const entry = priorityCounts.get(speciesCode) ?? { observed: 0, banded: 0, priority };
          entry.observed += Number(count) || 0;
          priorityCounts.set(speciesCode, entry);
        });
      });
      bandedCaptures.forEach((capture) => {
        const priority = prioritySpeciesMap[capture.species];
        if (!priority) return;
        const entry = priorityCounts.get(capture.species) ?? { observed: 0, banded: 0, priority };
        entry.banded += 1;
        priorityCounts.set(capture.species, entry);
      });

      const priorityRows = Array.from(priorityCounts.entries())
        .sort((a, b) => b[1].banded - a[1].banded)
        .slice(0, 15)
        .map(([speciesCode, entry]) => ({
          species: getSpeciesLabel(speciesCode),
          priority: entry.priority,
          observed: formatNumber(entry.observed),
          banded: formatNumber(entry.banded),
        }));

      results.push({
        group,
        groupAnalysis,
        groupCaptures,
        effortDays,
        netHours,
        dailyBanded,
        dailyBandedSpecies,
        dailyCensusSpecies,
        dailyObservedSpecies,
        summary,
        periodLabel,
        weatherRows,
        summaryRows,
        topBandedRows,
        topRecapturedRows,
        returnsRows,
        netUsageRows,
        priorityRows,
      });
    }
    return results;
  }, [
    appliedProgramId,
    birdEventsMap,
    countSpeciesEntries,
    capturesInRange,
    dateRangeLabel,
    detsInRange,
    formatOptional,
    formatOptionalInt,
    getSpeciesLabel,
    isReportReady,
    programGroups,
    prioritySpeciesMap,
    reportDates,
  ]);

  const handlePrint = () => window.print();
  const handleGenerate = () => {
    setAppliedStartDate(startDate);
    setAppliedEndDate(endDate);
    setAppliedProgramId(selectedProgramId);
    startTransition(() => {
      setIsReportReady(true);
    });
  };

  if (isLoading) {
    return (
      <div className="p-6 flex items-center gap-3">
        <Spinner size="sm" /> Generating report...
      </div>
    );
  }

  return (
    <div className="mx-auto flex h-full w-full max-w-6xl flex-col gap-6 p-6 print:max-w-full print:p-4">
      <PageHeader
        title="Annual Program Report"
        subtitle="Structured to mirror the 2019 MBO annual report with daily banding and census charts."
        actions={
          <Button color="secondary" onPress={handlePrint} isDisabled={!analysis} className="print:hidden">
            Export / Print PDF
          </Button>
        }
      />

      <div className="rounded-2xl border border-default-200 bg-white p-5 shadow-sm print:hidden">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
          <div className="flex-1 space-y-4">
            <div>
              <p className="text-sm font-semibold text-default-900">Time frame</p>
              <p className="text-xs text-default-900">Set the start and end date for the report.</p>
            </div>
            <div className="flex flex-wrap items-end gap-3">
              <div className="flex flex-col gap-1">
                <label className="text-xs font-medium text-default-900" htmlFor="report-start-date">
                  Start date
                </label>
                <input
                  id="report-start-date"
                  type="date"
                  className="rounded-medium border border-default-200 bg-white px-3 py-2 text-sm text-default-900 transition-colors hover:border-default-300 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                  min={dateBounds.min || undefined}
                  max={endDate || dateBounds.max || undefined}
                  value={startDate}
                  onChange={(event) => {
                    setStartDate(event.target.value);
                    setIsReportReady(false);
                  }}
                />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-xs font-medium text-default-900" htmlFor="report-end-date">
                  End date
                </label>
                <input
                  id="report-end-date"
                  type="date"
                  className="rounded-medium border border-default-200 bg-white px-3 py-2 text-sm text-default-900 transition-colors hover:border-default-300 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                  min={startDate || dateBounds.min || undefined}
                  max={dateBounds.max || undefined}
                  value={endDate}
                  onChange={(event) => {
                    setEndDate(event.target.value);
                    setIsReportReady(false);
                  }}
                />
              </div>
            </div>
          </div>
          <div className="lg:min-w-[220px]">
            <Select
              size="sm"
              label="Program"
              selectedKeys={new Set([selectedProgramId])}
              disallowEmptySelection
              onSelectionChange={(keys) => {
                setSelectedProgramId(String(Array.from(keys)[0] ?? "all"));
                setIsReportReady(false);
              }}
              className="w-full lg:min-w-[200px]"
            >
              <SelectItem key="all" textValue="All programs">
                All programs
              </SelectItem>
              {programOptions.map((program) => (
                <SelectItem key={program.id} textValue={program.displayName}>
                  {program.displayName}
                </SelectItem>
              ))}
            </Select>
            <Button
              color="secondary"
              onPress={handleGenerate}
              isDisabled={!startDate || !endDate || isPending}
              isLoading={isPending}
              className="mt-3 w-full"
            >
              Generate report
            </Button>
          </div>
        </div>
      </div>

      {isPending ? (
        <div className="rounded-2xl border border-dashed border-default-300 bg-default-50 p-10 text-center">
          <div className="mx-auto flex max-w-md items-center justify-center gap-3 text-sm text-default-900">
            <Spinner size="sm" /> Generating report...
          </div>
        </div>
      ) : !isReportReady ? (
        <div className="rounded-2xl border border-dashed border-default-300 bg-default-50 p-10 text-center">
          <div className="mx-auto max-w-md">
            <svg
              className="mx-auto h-12 w-12 text-default-900"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
              />
            </svg>
            <h3 className="mt-4 text-lg font-semibold text-default-900">Generate a report</h3>
            <p className="mt-2 text-sm text-default-900">
              Select a date range and click “Generate report” to run the analysis.
            </p>
          </div>
        </div>
      ) : !analysis ? (
        <div className="rounded-2xl border border-dashed border-default-300 bg-default-50 p-10 text-center">
          <div className="mx-auto max-w-md">
            <svg
              className="mx-auto h-12 w-12 text-default-900"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
              />
            </svg>
            <h3 className="mt-4 text-lg font-semibold text-default-900">No data available</h3>
            <p className="mt-2 text-sm text-default-900">
              No report data available for the selected filters. Try adjusting your date range or program selection.
            </p>
          </div>
        </div>
      ) : (
        <div className="flex flex-col gap-6">
          <ReportSection title="Executive Summary" subtitle="Highlights from the annual monitoring report.">
            <p className="text-sm text-default-900">{summaryText}</p>
            <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
              <StatTile label="Total captures" value={formatNumber(analysis.totalCaptures)} />
              <StatTile label="Species recorded" value={formatNumber(analysis.uniqueSpecies)} />
              <StatTile label="Active days" value={formatNumber(analysis.activeDays)} />
              <StatTile label="Effort days" value={formatNumber(filteredDets.length)} />
              <StatTile label="Net hours" value={formatNumber(Math.round(overallNetHours))} />
            </div>
          </ReportSection>

          {reportGroups.map((groupData) => {
            const groupAnalysis = groupData.groupAnalysis;
            const programList = groupData.group.programs.map((program) => program.displayName).join(", ");
            return (
              <ReportSection
                key={groupData.group.key}
                title={groupData.group.title}
                subtitle={groupData.group.subtitle}
              >
                <p className="text-sm text-default-900">{groupData.summary}</p>
                {programList && <p className="mt-2 text-xs text-default-900">Programs: {programList}</p>}
                <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                  <StatTile label="Total captures" value={formatNumber(groupAnalysis?.totalCaptures ?? 0)} />
                  <StatTile label="Species recorded" value={formatNumber(groupAnalysis?.uniqueSpecies ?? 0)} />
                  <StatTile label="Effort days" value={formatNumber(groupData.effortDays)} />
                  <StatTile label="Net hours" value={formatNumber(Math.round(groupData.netHours))} />
                </div>

                {groupData.group.showCharts && (
                  <div className="mt-6 grid gap-6 lg:grid-cols-2">
                    <ChartContainer
                      title="Individuals banded per day"
                      subtitle="Daily totals with 7-day running mean"
                    >
                      <DailyTrendChart data={groupData.dailyBanded} ariaLabel="Individuals banded per day" />
                    </ChartContainer>
                    <ChartContainer
                      title="Species banded per day"
                      subtitle="Daily species totals with 7-day running mean"
                    >
                      <DailyTrendChart data={groupData.dailyBandedSpecies} ariaLabel="Species banded per day" />
                    </ChartContainer>
                    <ChartContainer
                      title="Species on census per day"
                      subtitle="Daily census species counts with 7-day running mean"
                    >
                      <DailyTrendChart data={groupData.dailyCensusSpecies} ariaLabel="Species on census per day" />
                    </ChartContainer>
                    <ChartContainer
                      title="Species observed per day"
                      subtitle="Daily observed species counts with 7-day running mean"
                    >
                      <DailyTrendChart data={groupData.dailyObservedSpecies} ariaLabel="Species observed per day" />
                    </ChartContainer>
                  </div>
                )}

                <div className="mt-6 grid gap-6 lg:grid-cols-2">
                  <ReportTable
                    title={`Weather conditions (${groupData.periodLabel.toLowerCase()}ly)`}
                    subtitle="Summarized from DET weather logs."
                    columns={[
                      { key: "period", label: groupData.periodLabel },
                      { key: "avgTemp", label: "Avg temp (C)", align: "right" },
                      { key: "minTemp", label: "Min (C)", align: "right" },
                      { key: "maxTemp", label: "Max (C)", align: "right" },
                      { key: "precip", label: "Precip (mm)", align: "right" },
                      { key: "wind", label: "Wind (km/h)", align: "right" },
                      { key: "cloud", label: "Cloud (%)", align: "right" },
                    ]}
                    rows={groupData.weatherRows}
                  />
                  <ReportTable
                    title={`Summary results (${groupData.periodLabel.toLowerCase()}ly)`}
                    subtitle="Effort and banding totals."
                    columns={[
                      { key: "period", label: groupData.periodLabel },
                      { key: "effortDays", label: "Effort days", align: "right" },
                      { key: "netHours", label: "Net hours", align: "right" },
                      { key: "banded", label: "Banded", align: "right" },
                      { key: "species", label: "Species banded", align: "right" },
                      { key: "recaptures", label: "Recaptures", align: "right" },
                      { key: "returns", label: "Returns", align: "right" },
                      { key: "rate", label: "Captures/100 NH", align: "right" },
                    ]}
                    rows={groupData.summaryRows}
                  />
                  <ReportTable
                    title="Net usage and capture rates"
                    subtitle="Effort by net with capture rates."
                    columns={[
                      { key: "net", label: "Net" },
                      { key: "netHours", label: "Net hours", align: "right" },
                      { key: "captures", label: "Captures", align: "right" },
                      { key: "rate", label: "Captures/100 NH", align: "right" },
                    ]}
                    rows={groupData.netUsageRows}
                  />
                  <ReportTable
                    title="Priority species coverage"
                    subtitle="Priority species observed vs banded."
                    columns={[
                      { key: "species", label: "Species" },
                      { key: "priority", label: "Priority" },
                      { key: "observed", label: "Observed", align: "right" },
                      { key: "banded", label: "Banded", align: "right" },
                    ]}
                    rows={groupData.priorityRows}
                  />
                </div>

                <div className="mt-6 grid gap-6 lg:grid-cols-2">
                  <ReportTable
                    title="Top species banded"
                    subtitle="Top 10 species by banding volume."
                    columns={[
                      { key: "species", label: "Species" },
                      { key: "count", label: "Banded", align: "right" },
                      { key: "share", label: "Share", align: "right" },
                    ]}
                    rows={groupData.topBandedRows}
                  />
                  <ReportTable
                    title="Top species recaptured"
                    subtitle="Top 10 recapture species."
                    columns={[
                      { key: "species", label: "Species" },
                      { key: "count", label: "Recaptures", align: "right" },
                      { key: "share", label: "Share", align: "right" },
                    ]}
                    rows={groupData.topRecapturedRows}
                  />
                  <ReportTable
                    title="Return list"
                    subtitle="Sorted by elapsed time since previous capture."
                    columns={[
                      { key: "date", label: "Date" },
                      { key: "species", label: "Species" },
                      { key: "band", label: "Band" },
                      { key: "elapsed", label: "Days since previous", align: "right" },
                    ]}
                    rows={groupData.returnsRows}
                  />
                </div>
              </ReportSection>
            );
          })}

          <ReportSection title="Report Metadata" subtitle="Export and audit-ready details.">
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <StatTile label="Date range" value={dateRangeLabel} />
              <StatTile
                label="Program"
                value={appliedProgramId === "all" ? "All programs" : programsMap[appliedProgramId]?.displayName || ""}
              />
              <StatTile
                label="Generated"
                value={new Date().toLocaleDateString("en-CA", {
                  year: "numeric",
                  month: "long",
                  day: "numeric",
                })}
                hint="Local time"
              />
            </div>
            <div className="mt-4 rounded-lg bg-primary-50 p-3 text-xs text-primary-700">
              <strong>Export:</strong> Use the "Export / Print PDF" button above to generate a print-ready version of this report.
            </div>
          </ReportSection>
        </div>
      )}
    </div>
  );
}
