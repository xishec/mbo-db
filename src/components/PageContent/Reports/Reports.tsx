import { Autocomplete, AutocompleteItem, Button, Spinner } from "@heroui/react";
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
        <h3 className="text-lg font-semibold text-default-900">{title}</h3>
        {subtitle && <p className="mt-1 text-sm text-default-900">{subtitle}</p>}
      </div>
      <div className="overflow-x-auto rounded-lg border border-default-100">
        <table className="w-full text-xs whitespace-nowrap">
          <thead className="sticky top-0 bg-default-50 text-xs uppercase text-default-900">
            <tr>
              {columns.map((column) => (
                <th
                  key={column.key}
                  className={`px-3 py-2.5 font-semibold ${column.align === "right"
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
                  className={`text-default-900 transition-colors hover:bg-default-50 ${index % 2 === 0 ? "bg-white" : "bg-default-25"
                    }`}
                >
                  {columns.map((column) => (
                    <td
                      key={column.key}
                      className={`px-3 py-2.5 ${column.align === "right"
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
        <h2 className="text-lg font-semibold text-default-900">{title}</h2>
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

const trimDatesByValues = (dates: string[], maps: Array<Map<string, number>>) => {
  if (!dates.length) return [];
  const hasValueAt = (index: number) =>
    maps.some((map) => {
      const value = map.get(dates[index]) ?? 0;
      return value > 0;
    });
  let startIndex = 0;
  while (startIndex < dates.length && !hasValueAt(startIndex)) {
    startIndex += 1;
  }
  let endIndex = dates.length - 1;
  while (endIndex >= 0 && !hasValueAt(endIndex)) {
    endIndex -= 1;
  }
  if (startIndex > endIndex) return [];
  return dates.slice(startIndex, endIndex + 1);
};

const trimPeriodEntries = <T,>(entries: T[], hasData: (entry: T) => boolean) => {
  if (!entries.length) return entries;
  let startIndex = 0;
  while (startIndex < entries.length && !hasData(entries[startIndex])) {
    startIndex += 1;
  }
  let endIndex = entries.length - 1;
  while (endIndex >= 0 && !hasData(entries[endIndex])) {
    endIndex -= 1;
  }
  if (startIndex > endIndex) return [];
  return entries.slice(startIndex, endIndex + 1);
};

const formatMonthRangeLabel = (start: string, end: string) => {
  const startDate = new Date(`${start}T00:00:00`);
  const endDate = new Date(`${end}T00:00:00`);
  if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime())) {
    return formatMonthLabel(getMonthKey(start));
  }
  if (startDate.getMonth() !== endDate.getMonth() || startDate.getFullYear() !== endDate.getFullYear()) {
    const startLabel = startDate.toLocaleDateString("en-CA", { month: "short", day: "numeric" });
    const endLabel = endDate.toLocaleDateString("en-CA", { month: "short", day: "numeric" });
    return `${startLabel}-${endLabel}`;
  }
  const monthLabel = startDate.toLocaleDateString("en-CA", { month: "short" });
  const startDay = startDate.getDate();
  const endDay = endDate.getDate();
  if (startDay === endDay) return `${monthLabel} ${startDay}`;
  return `${monthLabel} ${startDay}-${endDay}`;
};

const coerceNumber = (value: unknown): number => {
  if (typeof value === "number") return value;
  if (typeof value === "string") {
    const parsed = Number(value);
    if (!Number.isNaN(parsed)) return parsed;
    const match = value.match(/-?\d+(\.\d+)?/);
    return match ? Number(match[0]) : Number.NaN;
  }
  if (value && typeof value === "object" && "value" in value) {
    return coerceNumber((value as { value?: unknown }).value);
  }
  return Number.NaN;
};

const readWeatherNumber = (weather: Record<string, unknown> | undefined, keys: string[]) => {
  if (!weather) return Number.NaN;
  for (const key of keys) {
    const value = key.includes(".")
      ? key.split(".").reduce<unknown>((acc, part) => {
        if (!acc || typeof acc !== "object") return undefined;
        return (acc as Record<string, unknown>)[part];
      }, weather)
      : weather[key];
    const parsed = coerceNumber(value);
    if (!Number.isNaN(parsed)) return parsed;
  }
  return Number.NaN;
};

const formatLongDate = (dateString: string) => {
  const date = new Date(`${dateString}T00:00:00`);
  if (Number.isNaN(date.getTime())) return dateString;
  return date.toLocaleDateString("en-CA", { day: "numeric", month: "short", year: "numeric" });
};

const formatElapsedVerbose = (start: Date, end: Date) => {
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return "—";
  if (end < start) return "—";
  let years = end.getFullYear() - start.getFullYear();
  let months = end.getMonth() - start.getMonth();
  let days = end.getDate() - start.getDate();

  if (days < 0) {
    months -= 1;
    const prevMonthDays = new Date(end.getFullYear(), end.getMonth(), 0).getDate();
    days += prevMonthDays;
  }
  if (months < 0) {
    years -= 1;
    months += 12;
  }

  const parts: string[] = [];
  if (years > 0) parts.push(`${years} year${years === 1 ? "" : "s"}`);
  if (months > 0) parts.push(`${months} month${months === 1 ? "" : "s"}`);
  if (days > 0 || parts.length === 0) parts.push(`${days} day${days === 1 ? "" : "s"}`);
  return parts.join(" ");
};

const formatAgeSex = (age?: string, sex?: string) => {
  const safeAge = age?.trim() || "";
  const safeSex = sex?.trim() || "";
  if (!safeAge && !safeSex) return "—";
  if (safeAge && safeSex) return `${safeAge}-${safeSex}`;
  return safeAge || safeSex || "—";
};

const getWinterSeasonKey = (dateString: string) => {
  const date = new Date(`${dateString}T00:00:00`);
  if (Number.isNaN(date.getTime())) return null;
  const month = date.getMonth();
  if (month >= 10) {
    const startYear = date.getFullYear();
    return { key: `${startYear}-${startYear + 1}`, label: `${startYear}-${startYear + 1}` };
  }
  if (month <= 2) {
    const endYear = date.getFullYear();
    return { key: `${endYear - 1}-${endYear}`, label: `${endYear - 1}-${endYear}` };
  }
  return null;
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
  groupDateBounds: { start: string; end: string };
  dailyBanded: DailyTrendPoint[];
  dailyBandedSpecies: DailyTrendPoint[];
  dailyCensusSpecies: DailyTrendPoint[];
  dailyObservedSpecies: DailyTrendPoint[];
  summary: string;
  effortSummary: string;
  siteConditionsSummary: string;
  bandedSummary: string;
  recaptureSummary: string;
  periodLabel: string;
  weatherColumns: TableColumn[];
  weatherRows: Array<Record<string, React.ReactNode>>;
  summaryColumns: TableColumn[];
  summaryRows: Array<Record<string, React.ReactNode>>;
  bandedComparisonColumns: TableColumn[];
  bandedComparisonRows: Array<Record<string, React.ReactNode>>;
  returnDetailColumns: TableColumn[];
  returnDetailRows: Array<Record<string, React.ReactNode>>;
  topBandedRows: Array<Record<string, React.ReactNode>>;
  topRecapturedRows: Array<Record<string, React.ReactNode>>;
  returnsRows: Array<Record<string, React.ReactNode>>;
  netUsageRows: Array<Record<string, React.ReactNode>>;
  netProductivitySummary: string;
  netTopSpeciesRows: Array<Record<string, React.ReactNode>>;
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
  const { birdEventsMap, programsMap, DETsMap, yearsToProgramMap, isLoading } = useData();
  const [startDate, setStartDate] = useState<string>("");
  const [endDate, setEndDate] = useState<string>("");
  const [isReportReady, setIsReportReady] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [appliedStartDate, setAppliedStartDate] = useState<string>("");
  const [appliedEndDate, setAppliedEndDate] = useState<string>("");
  const [selectedProgramIds, setSelectedProgramIds] = useState<string[]>([]);
  const [appliedProgramIds, setAppliedProgramIds] = useState<string[]>([]);
  const [programSearchKey, setProgramSearchKey] = useState<string | null>(null);
  const [autocompleteResetKey, setAutocompleteResetKey] = useState(0);
  const [prioritySpeciesMap, setPrioritySpeciesMap] = useState<Record<string, string>>({});
  const deferredStartDate = useDeferredValue(appliedStartDate);
  const deferredEndDate = useDeferredValue(appliedEndDate);
  const deferredProgramIds = useDeferredValue(appliedProgramIds);

  const captures = useMemo<ReportCapture[]>(() => {
    return Object.values(birdEventsMap)
      .filter((event) => event && !event.modifiedEventId)
      .map((event) => toReportCapture(event));
  }, [birdEventsMap]);

  const bandingByBandId = useMemo(() => {
    const map = new Map<string, { date: string; age: string; sex: string }>();
    Object.values(birdEventsMap).forEach((event) => {
      if (!event || event.modifiedEventId || event.birdEventType !== BirdEventType.Banded) return;
      const bandId = event.band?.id;
      if (!bandId || !event.date) return;
      const existing = map.get(bandId);
      if (!existing || event.date < existing.date) {
        map.set(bandId, {
          date: event.date,
          age: event.age || "",
          sex: event.sex || "",
        });
      }
    });
    return map;
  }, [birdEventsMap]);

  const captureHistoryByBandId = useMemo(() => {
    const history = new Map<string, Array<{ date: string; age: string; sex: string }>>();
    Object.values(birdEventsMap).forEach((event) => {
      if (!event || event.modifiedEventId || !event.date) return;
      const bandId = event.band?.id;
      if (!bandId) return;
      if (!history.has(bandId)) {
        history.set(bandId, []);
      }
      history.get(bandId)!.push({
        date: event.date,
        age: event.age || "",
        sex: event.sex || "",
      });
    });
    history.forEach((entries, bandId) => {
      entries.sort((a, b) => a.date.localeCompare(b.date));
      history.set(bandId, entries);
    });
    return history;
  }, [birdEventsMap]);

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
      .catch(() => { });
    return () => {
      isActive = false;
    };
  }, []);

  const programLatestYearMap = useMemo(() => {
    const map = new Map<string, number>();
    Object.entries(yearsToProgramMap ?? {}).forEach(([yearKey, programIds]) => {
      const year = Number(yearKey);
      if (Number.isNaN(year)) return;
      (programIds ?? []).forEach((programId) => {
        const existing = map.get(programId) ?? -1;
        if (year > existing) map.set(programId, year);
      });
    });
    return map;
  }, [yearsToProgramMap]);

  const programOptions = useMemo(() => {
    return Object.values(programsMap).sort((a, b) => {
      const yearA = programLatestYearMap.get(a.id) ?? -1;
      const yearB = programLatestYearMap.get(b.id) ?? -1;
      if (yearA !== yearB) return yearB - yearA;
      return a.displayName.localeCompare(b.displayName);
    });
  }, [programsMap, programLatestYearMap]);

  const selectedPrograms = useMemo(
    () => selectedProgramIds.map((id) => programsMap[id]).filter((program): program is Program => Boolean(program)),
    [selectedProgramIds, programsMap]
  );

  const selectedProgramDateBounds = useMemo(() => {
    if (!selectedProgramIds.length) return { min: "", max: "" };
    const dates = [
      ...Object.values(DETsMap ?? {})
        .filter((det) => det && selectedProgramIds.includes(det.programId))
        .map((det) => det.date),
      ...Object.values(birdEventsMap)
        .filter((event) => event && selectedProgramIds.includes(event.programId))
        .map((event) => event.date),
    ].filter(Boolean);
    if (!dates.length) return { min: "", max: "" };
    return { min: dates.reduce((a, b) => (a < b ? a : b)), max: dates.reduce((a, b) => (a > b ? a : b)) };
  }, [selectedProgramIds, DETsMap, birdEventsMap]);

  useEffect(() => {
    if (selectedProgramIds.length) {
      setStartDate(selectedProgramDateBounds.min);
      setEndDate(selectedProgramDateBounds.max);
    } else {
      setStartDate("");
      setEndDate("");
    }
  }, [selectedProgramIds, selectedProgramDateBounds]);

  const dets = useMemo(() => {
    return Object.values(DETsMap ?? {}).filter((det) => det && det.date);
  }, [DETsMap]);

  const effectiveDateRange = useMemo(() => {
    return {
      start: deferredStartDate,
      end: deferredEndDate,
    };
  }, [deferredStartDate, deferredEndDate]);

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
    if (!deferredProgramIds.length) return [];
    return capturesInRange.filter((capture) => deferredProgramIds.includes(capture.programId));
  }, [capturesInRange, deferredProgramIds, isReportReady]);

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
    if (!deferredProgramIds.length) return [];
    return detsInRange.filter((det) => deferredProgramIds.includes(det.programId));
  }, [detsInRange, deferredProgramIds, isReportReady]);

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
    return summarizeSeason(analysis, dateRangeLabel, "all programs");
  }, [analysis, dateRangeLabel]);

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
    if (!programOptions.length || !deferredProgramIds.length) return [];
    const programsById = new Map(programOptions.map((program) => [program.id, program]));
    const assigned = new Set<string>();
    const groups: ProgramGroup[] = PROGRAM_GROUPS.map((group) => {
      const programs = deferredProgramIds
        .map((id) => programsById.get(id))
        .filter((program): program is Program => Boolean(program));
      const filteredPrograms = programs.filter((program) =>
        group.matchers.some((matcher) => program.displayName.toLowerCase().includes(matcher))
      );
      filteredPrograms.forEach((program) => assigned.add(program.id));
      return { ...group, programs: filteredPrograms };
    }).filter((group) => group.programs.length);

    const otherPrograms = deferredProgramIds
      .map((id) => programsById.get(id))
      .filter((program): program is Program => Boolean(program))
      .filter((program) => !assigned.has(program.id));
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
  }, [programOptions, deferredProgramIds]);

  const reportGroups = useMemo<ReportGroupData[]>(() => {
    if (!isReportReady || !reportDates.length) return [];
    const results: ReportGroupData[] = [];
    for (const group of programGroups) {
      const activeProgramIds = group.programs.map((program) => program.id);
      if (!activeProgramIds.length) continue;

      const groupCaptures = capturesInRange.filter((capture) => activeProgramIds.includes(capture.programId));
      const groupDets = detsInRange.filter((det) => activeProgramIds.includes(det.programId));
      const groupDates = [
        ...groupDets.map((det) => det.date),
        ...groupCaptures.map((capture) => capture.date),
      ].filter(Boolean);
      const groupDateBounds = groupDates.length
        ? {
          min: groupDates.reduce((a, b) => (a < b ? a : b)),
          max: groupDates.reduce((a, b) => (a > b ? a : b)),
        }
        : { min: effectiveDateRange.start, max: effectiveDateRange.end };
      const groupDateRange = { start: groupDateBounds.min, end: groupDateBounds.max };
      const groupReportDates = enumerateDates(groupDateBounds.min, groupDateBounds.max);
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

      const bandedDates = trimDatesByValues(groupReportDates, [bandedCounts]);
      const bandedSpeciesDates = trimDatesByValues(groupReportDates, [bandedSpeciesCounts]);
      const censusSpeciesDates = trimDatesByValues(groupReportDates, [censusSpeciesCounts]);
      const observedSpeciesDates = trimDatesByValues(groupReportDates, [observedSpeciesCounts]);
      const dailyBanded = buildDailyTrend(bandedDates, bandedCounts);
      const dailyBandedSpecies = buildDailyTrend(bandedSpeciesDates, bandedSpeciesCounts);
      const dailyCensusSpecies = buildDailyTrend(censusSpeciesDates, censusSpeciesCounts);
      const dailyObservedSpecies = buildDailyTrend(observedSpeciesDates, observedSpeciesCounts);

      const effortDays = groupDets.length;
      const netHours = groupDets.reduce((sum, det) => {
        const value = Number(det.netHours?.total ?? 0);
        return Number.isNaN(value) ? sum : sum + value;
      }, 0);

      const peakBandedDay = dailyBanded.reduce(
        (max, entry) => (entry.value > max.value ? entry : max),
        { date: "", label: "", value: -1, mean7: 0 }
      );

      const bandingDates = new Set(bandedCaptures.map((capture) => capture.date).filter(Boolean));

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
          periodStart: string;
          periodEnd: string;
          totalCaptures: number;
          banded: number;
          recaptures: number;
          returns: number;
          bandedSpecies: Set<string>;
          returnSpecies: Set<string>;
          repeatSpecies: Set<string>;
          observedSpecies: Set<string>;
          bandingDates: Set<string>;
          fullCoverageDays: number;
          effortDays: number;
          netHours: number;
          tempSum: number; // Sum of dailyMeanTemp for "Mean daily temp"
          tempCount: number;
          dailyHighSum: number; // Sum of dailyHighTemp for "Mean daily high"
          dailyHighCount: number;
          dailyLowSum: number; // Sum of dailyLowTemp for "Mean daily low"
          dailyLowCount: number;
          tempMin: number | null; // Min of dailyLowTemp for "Lowest temp"
          tempMax: number | null; // Max of dailyHighTemp for "Highest temp"
          rainDays: number;
          precipSum: number;
          snowDays: number;
          snowSum: number;
          snowDepthMeanSum: number;
          snowDepthMeanCount: number;
          snowDepthMax: number | null;
        }
      >();

      const ensurePeriodEntry = (date: string) => {
        const key = getPeriodKey(date);
        const existing = periodMap.get(key);
        if (existing) {
          if (date < existing.periodStart) existing.periodStart = date;
          if (date > existing.periodEnd) existing.periodEnd = date;
          return existing;
        }
        const entry = {
          key,
          label: getPeriodLabel(key),
          periodStart: date,
          periodEnd: date,
          totalCaptures: 0,
          banded: 0,
          recaptures: 0,
          returns: 0,
          bandedSpecies: new Set<string>(),
          returnSpecies: new Set<string>(),
          repeatSpecies: new Set<string>(),
          observedSpecies: new Set<string>(),
          bandingDates: new Set<string>(),
          fullCoverageDays: 0,
          effortDays: 0,
          netHours: 0,
          tempSum: 0,
          tempCount: 0,
          dailyHighSum: 0,
          dailyHighCount: 0,
          dailyLowSum: 0,
          dailyLowCount: 0,
          tempMin: null,
          tempMax: null,
          rainDays: 0,
          precipSum: 0,
          snowDays: 0,
          snowSum: 0,
          snowDepthMeanSum: 0,
          snowDepthMeanCount: 0,
          snowDepthMax: null,
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
          entry.bandingDates.add(capture.date);
        }
        if (capture.captureType === BirdEventType.Return) {
          entry.returns += 1;
          entry.returnSpecies.add(capture.species);
        }
        if (capture.captureType === BirdEventType.Repeat || capture.captureType === BirdEventType.Alien) {
          entry.recaptures += 1;
          entry.repeatSpecies.add(capture.species);
        }
      });

      const maxNetHoursPerDay = groupDets.reduce((max, det) => {
        const value = Number(det.netHours?.total ?? 0);
        if (Number.isNaN(value)) return max;
        return Math.max(max, value);
      }, 0);
      const fullCoverageThreshold = maxNetHoursPerDay ? maxNetHoursPerDay * 0.95 : null;

      groupDets.forEach((det) => {
        const entry = ensurePeriodEntry(det.date);
        entry.effortDays += 1;
        const netHoursValue = Number(det.netHours?.total ?? 0);
        if (!Number.isNaN(netHoursValue)) {
          entry.netHours += netHoursValue;
          if (fullCoverageThreshold !== null && netHoursValue >= fullCoverageThreshold) {
            entry.fullCoverageDays += 1;
          }
        }
        const weather =
          (det.weather as Record<string, unknown> | undefined) ??
          ((det as { weatherData?: Record<string, unknown> }).weatherData ?? undefined) ??
          ((det as { weatherSummary?: Record<string, unknown> }).weatherSummary ?? undefined);
        if (weather) {
          // Use daily temperature values for aggregation
          const dailyHigh = readWeatherNumber(weather, [
            "dailyHighTemp",
            "daily_high_temp",
            "dailyHighTempC",
            "highTemp",
            "tempHigh",
            "tempMax",
            "maxTemp",
            "temperatureMax",
            "temperature_2m_max",
          ]);
          const dailyLow = readWeatherNumber(weather, [
            "dailyLowTemp",
            "daily_low_temp",
            "dailyLowTempC",
            "lowTemp",
            "tempLow",
            "tempMin",
            "minTemp",
            "temperatureMin",
            "temperature_2m_min",
          ]);
          let dailyMean = readWeatherNumber(weather, [
            "dailyMeanTemp",
            "daily_mean_temp",
            "dailyMeanTempC",
            "meanTemp",
            "tempMean",
            "temperatureMean",
            "temperature_2m_mean",
          ]);
          if (Number.isNaN(dailyMean) && !Number.isNaN(dailyHigh) && !Number.isNaN(dailyLow)) {
            dailyMean = (dailyHigh + dailyLow) / 2;
          }

          // Track daily highs for "Mean daily high" calculation
          if (!Number.isNaN(dailyHigh)) {
            entry.dailyHighSum += dailyHigh;
            entry.dailyHighCount += 1;
            // Also track for "Highest temp" (period max)
            entry.tempMax = entry.tempMax === null ? dailyHigh : Math.max(entry.tempMax, dailyHigh);
          }

          // Track daily lows for "Mean daily low" calculation
          if (!Number.isNaN(dailyLow)) {
            entry.dailyLowSum += dailyLow;
            entry.dailyLowCount += 1;
            // Also track for "Lowest temp" (period min)
            entry.tempMin = entry.tempMin === null ? dailyLow : Math.min(entry.tempMin, dailyLow);
          }

          // Track daily means for "Mean daily temp" calculation
          if (!Number.isNaN(dailyMean)) {
            entry.tempSum += dailyMean;
            entry.tempCount += 1;
          }
          const precip = readWeatherNumber(weather, [
            "totalRainfallMm",
            "total_rainfall_mm",
            "rainfallMm",
            "precipitationMm",
            "precipitation_sum",
            "rain_mm",
            "totalRainMm",
          ]);
          if (!Number.isNaN(precip)) {
            entry.precipSum += precip;
            if (precip > 0) entry.rainDays += 1;
          }
          const snowfall = readWeatherNumber(weather, [
            "totalSnowCm",
            "total_snow_cm",
            "snowfallCm",
            "snowfall_sum",
            "snow_cm",
            "totalSnowfallCm",
          ]);
          if (!Number.isNaN(snowfall)) {
            entry.snowSum += snowfall;
            if (snowfall > 0) entry.snowDays += 1;
          }
          const meanSnowDepth = readWeatherNumber(weather, [
            "meanSnowDepthCm",
            "mean_snow_depth_cm",
            "snowDepthMeanCm",
            "snow_depth_mean",
          ]);
          if (!Number.isNaN(meanSnowDepth)) {
            entry.snowDepthMeanSum += meanSnowDepth;
            entry.snowDepthMeanCount += 1;
          }
          const maxSnowDepth = readWeatherNumber(weather, [
            "maxSnowDepthCm",
            "max_snow_depth_cm",
            "snowDepthMaxCm",
            "snow_depth_max",
          ]);
          if (!Number.isNaN(maxSnowDepth)) {
            entry.snowDepthMax =
              entry.snowDepthMax === null ? maxSnowDepth : Math.max(entry.snowDepthMax, maxSnowDepth);
          }
        }

        Object.entries(det.observedSpeciesCount ?? {}).forEach(([speciesCode, count]) => {
          if (Number(count) > 0) {
            entry.observedSpecies.add(speciesCode);
          }
        });
      });

      const periodEntries = trimPeriodEntries(
        Array.from(periodMap.values())
          .map((entry) => {
            if (periodGranularity === "month" && entry.periodStart && entry.periodEnd) {
              return { ...entry, label: formatMonthRangeLabel(entry.periodStart, entry.periodEnd) };
            }
            return entry;
          })
          .sort((a, b) => a.key.localeCompare(b.key)),
        (entry) =>
          entry.effortDays > 0 ||
          entry.netHours > 0 ||
          entry.banded > 0 ||
          entry.recaptures > 0 ||
          entry.returns > 0 ||
          entry.observedSpecies.size > 0 ||
          entry.dailyHighCount > 0 ||
          entry.dailyLowCount > 0 ||
          entry.tempCount > 0 ||
          entry.precipSum > 0 ||
          entry.snowSum > 0 ||
          entry.snowDepthMeanCount > 0
      );

      const totalSeasonDays = groupReportDates.length;
      const seasonStartLabel = groupDateBounds.min ? formatShortDate(groupDateBounds.min) : "";
      const seasonEndLabel = groupDateBounds.max ? formatShortDate(groupDateBounds.max) : "";
      const seasonWeeks = totalSeasonDays ? Math.round(totalSeasonDays / 7) : 0;

      const summary = (() => {
        if (!groupAnalysis || !groupAnalysis.totalCaptures) {
          return `No report data available for ${group.title} during ${dateRangeLabel}.`;
        }

        const baseSummary = `During ${dateRangeLabel}, ${group.title} recorded ${formatNumber(
          groupAnalysis.totalCaptures
        )} captures across ${formatNumber(groupAnalysis.uniqueSpecies)} species. Banders logged ${formatNumber(
          effortDays
        )} effort days and ${formatNumber(Math.round(netHours))} net hours. Peak banding occurred on ${peakBandedDay.label || "N/A"
          } with ${formatNumber(Math.max(0, peakBandedDay.value))} individuals.`;

        const effortPercent = totalSeasonDays ? Math.round((effortDays / totalSeasonDays) * 100) : 0;

        const monthEffort = periodEntries.map((entry) => ({
          label: entry.label,
          effortDays: entry.effortDays,
          bandingDays: entry.bandingDates.size,
        }));
        const effortCounts = monthEffort.map((entry) => entry.effortDays);
        const maxEffort = effortCounts.length ? Math.max(...effortCounts) : 0;
        const minEffort = effortCounts.length ? Math.min(...effortCounts) : 0;
        const monthsWithMax = monthEffort.filter((entry) => entry.effortDays === maxEffort).map((entry) => entry.label);
        const monthsWithMin = monthEffort.filter((entry) => entry.effortDays === minEffort).map((entry) => entry.label);
        const noBandingMonths = monthEffort.filter((entry) => entry.bandingDays === 0).map((entry) => entry.label);

        const effortSentence = totalSeasonDays
          ? `Observations were recorded on ${formatNumber(effortDays)} (${effortPercent}%) of the ${formatNumber(
            totalSeasonDays
          )} days during the season${seasonWeeks ? ` (${seasonWeeks}-week period)` : ""} from ${seasonStartLabel} through ${seasonEndLabel}.`
          : `Observations were recorded on ${formatNumber(effortDays)} days during the season.`;

        let monthSentence = "";
        if (maxEffort && minEffort && maxEffort === minEffort) {
          monthSentence = `There were ${formatNumber(maxEffort)} visits each month.`;
        } else if (maxEffort && minEffort) {
          const maxLabel = monthsWithMax.join(", ");
          const minLabel = monthsWithMin.join(", ");
          monthSentence = `There were ${formatNumber(maxEffort)} visits in ${maxLabel}${minLabel ? `, except for ${minLabel} with ${formatNumber(minEffort)}` : ""
            }.`;
        }

        const bandingSentence = `There were ${formatNumber(
          bandingDates.size
        )} days with banding effort${noBandingMonths.length ? `; no banding occurred in ${noBandingMonths.join(", ")}.` : "."
          }`;

        return [
          seasonStartLabel && seasonEndLabel
            ? `The ${group.title} season spans the ${seasonWeeks}-week period from ${seasonStartLabel} through ${seasonEndLabel}.`
            : "",
          baseSummary,
          effortSentence,
          monthSentence,
          bandingSentence,
        ]
          .filter(Boolean)
          .join(" ");
      })();

      const seasonAggregate = periodEntries.reduce(
        (acc, entry) => {
          acc.dailyHighSum += entry.dailyHighSum;
          acc.dailyHighCount += entry.dailyHighCount;
          acc.dailyLowSum += entry.dailyLowSum;
          acc.dailyLowCount += entry.dailyLowCount;
          acc.tempSum += entry.tempSum;
          acc.tempCount += entry.tempCount;
          acc.tempMax = acc.tempMax === null ? entry.tempMax : Math.max(acc.tempMax, entry.tempMax ?? acc.tempMax);
          acc.tempMin = acc.tempMin === null ? entry.tempMin : Math.min(acc.tempMin, entry.tempMin ?? acc.tempMin);
          acc.rainDays += entry.rainDays;
          acc.precipSum += entry.precipSum;
          acc.snowDays += entry.snowDays;
          acc.snowSum += entry.snowSum;
          acc.snowDepthMeanSum += entry.snowDepthMeanSum;
          acc.snowDepthMeanCount += entry.snowDepthMeanCount;
          acc.snowDepthMax =
            acc.snowDepthMax === null
              ? entry.snowDepthMax
              : Math.max(acc.snowDepthMax, entry.snowDepthMax ?? acc.snowDepthMax);
          return acc;
        },
        {
          dailyHighSum: 0,
          dailyHighCount: 0,
          dailyLowSum: 0,
          dailyLowCount: 0,
          tempSum: 0,
          tempCount: 0,
          tempMax: null as number | null,
          tempMin: null as number | null,
          rainDays: 0,
          precipSum: 0,
          snowDays: 0,
          snowSum: 0,
          snowDepthMeanSum: 0,
          snowDepthMeanCount: 0,
          snowDepthMax: null as number | null,
        }
      );

      const bandedSpeciesCount = new Set(bandedCaptures.map((capture) => capture.species)).size;
      const returnSpeciesSet = new Set(
        groupCaptures
          .filter((capture) => capture.captureType === BirdEventType.Return)
          .map((capture) => capture.species)
      );
      const repeatSpeciesSet = new Set(
        groupCaptures
          .filter((capture) => capture.captureType === BirdEventType.Repeat || capture.captureType === BirdEventType.Alien)
          .map((capture) => capture.species)
      );

      const effortPercent = totalSeasonDays ? Math.round((effortDays / totalSeasonDays) * 100) : 0;
      const avgNetHoursPerDay = effortDays ? netHours / effortDays : null;
      const totalFullCoverageDays = periodEntries.reduce((sum, entry) => sum + entry.fullCoverageDays, 0);
      const reducedNetDays = Math.max(0, effortDays - totalFullCoverageDays);
      const effortSummary = groupAnalysis
        ? `Observations were recorded on ${formatNumber(effortDays)}${totalSeasonDays ? ` (${effortPercent}%)` : ""
        } of the ${formatNumber(totalSeasonDays)} days in the season. Banding occurred on ${formatNumber(
          bandingDates.size
        )} days, totaling ${formatOptional(netHours, 1)} net hours${avgNetHoursPerDay ? ` (avg ${formatOptional(avgNetHoursPerDay, 1)} per day)` : ""
        }.${totalFullCoverageDays ? ` ${formatNumber(totalFullCoverageDays)} days met full net coverage,` : ""}${reducedNetDays ? ` with ${formatNumber(reducedNetDays)} days reduced by weather.` : ""
        }`
        : "";

      const meanHigh =
        seasonAggregate.dailyHighCount > 0 ? seasonAggregate.dailyHighSum / seasonAggregate.dailyHighCount : null;
      const meanLow =
        seasonAggregate.dailyLowCount > 0 ? seasonAggregate.dailyLowSum / seasonAggregate.dailyLowCount : null;
      const meanTemp = seasonAggregate.tempCount > 0 ? seasonAggregate.tempSum / seasonAggregate.tempCount : null;
      const siteConditionsSummary = groupAnalysis
        ? `Mean daily high was ${formatOptional(meanHigh)}°C and mean daily low ${formatOptional(
          meanLow
        )}°C (mean ${formatOptional(meanTemp)}°C). Rain fell on ${formatNumber(
          seasonAggregate.rainDays
        )} days (${formatOptionalInt(seasonAggregate.precipSum)} mm total)${seasonAggregate.snowDays
          ? `, with snow on ${formatNumber(seasonAggregate.snowDays)} days (${formatOptionalInt(
            seasonAggregate.snowSum
          )} cm total).`
          : "."
        }`
        : "";

      const averageBandedPerDay = bandingDates.size ? bandedCaptures.length / bandingDates.size : null;
      const bandedSummary = groupAnalysis
        ? `${formatNumber(bandedCaptures.length)} individuals of ${formatNumber(
          bandedSpeciesCount
        )} species were banded. Peak banding occurred on ${peakBandedDay.label || "N/A"} with ${formatNumber(
          Math.max(0, peakBandedDay.value)
        )} individuals${averageBandedPerDay ? `; average ${formatOptional(averageBandedPerDay, 1)} per banding day.` : "."}`
        : "";

      const recaptureSummary = groupAnalysis
        ? `${formatNumber(groupAnalysis.recaptures)} repeats from ${formatNumber(
          repeatSpeciesSet.size
        )} species and ${formatNumber(groupAnalysis.returns)} returns from ${formatNumber(
          returnSpeciesSet.size
        )} species were recorded.`
        : "";

      const weatherColumns: TableColumn[] = [
        { key: "metric", label: "" },
        ...periodEntries.map((entry) => ({ key: entry.key, label: entry.label, align: "right" })),
        { key: "season", label: "Season", align: "right" },
      ];

      const buildWeatherRow = (
        label: string,
        getValue: (entry: (typeof periodEntries)[number]) => React.ReactNode,
        seasonValue: React.ReactNode
      ) => {
        const row: Record<string, React.ReactNode> = { metric: label, season: seasonValue };
        periodEntries.forEach((entry) => {
          row[entry.key] = getValue(entry);
        });
        return row;
      };

      const weatherRows = [
        buildWeatherRow(
          "Mean daily high (°C)",
          (entry) => formatOptional(entry.dailyHighCount ? entry.dailyHighSum / entry.dailyHighCount : null),
          formatOptional(
            seasonAggregate.dailyHighCount ? seasonAggregate.dailyHighSum / seasonAggregate.dailyHighCount : null
          )
        ),
        buildWeatherRow(
          "Mean daily low (°C)",
          (entry) => formatOptional(entry.dailyLowCount ? entry.dailyLowSum / entry.dailyLowCount : null),
          formatOptional(
            seasonAggregate.dailyLowCount ? seasonAggregate.dailyLowSum / seasonAggregate.dailyLowCount : null
          )
        ),
        buildWeatherRow(
          "Mean daily temp (°C)",
          (entry) => formatOptional(entry.tempCount ? entry.tempSum / entry.tempCount : null),
          formatOptional(seasonAggregate.tempCount ? seasonAggregate.tempSum / seasonAggregate.tempCount : null)
        ),
        buildWeatherRow("Highest temp (°C)", (entry) => formatOptional(entry.tempMax), formatOptional(seasonAggregate.tempMax)),
        buildWeatherRow("Lowest temp (°C)", (entry) => formatOptional(entry.tempMin), formatOptional(seasonAggregate.tempMin)),
        buildWeatherRow(
          "# days with rainfall",
          (entry) => formatOptionalInt(entry.rainDays),
          formatOptionalInt(seasonAggregate.rainDays)
        ),
        buildWeatherRow(
          "Total rain (mm)",
          (entry) => formatOptionalInt(entry.precipSum),
          formatOptionalInt(seasonAggregate.precipSum)
        ),
        buildWeatherRow(
          "# days with snowfall",
          (entry) => formatOptionalInt(entry.snowDays),
          formatOptionalInt(seasonAggregate.snowDays)
        ),
        buildWeatherRow(
          "Total snow (cm)",
          (entry) => formatOptionalInt(entry.snowSum),
          formatOptionalInt(seasonAggregate.snowSum)
        ),
        buildWeatherRow(
          "Mean snow depth (cm)",
          (entry) => formatOptional(entry.snowDepthMeanCount ? entry.snowDepthMeanSum / entry.snowDepthMeanCount : null),
          formatOptional(
            seasonAggregate.snowDepthMeanCount
              ? seasonAggregate.snowDepthMeanSum / seasonAggregate.snowDepthMeanCount
              : null
          )
        ),
        buildWeatherRow(
          "Max. snow depth (cm)",
          (entry) => formatOptional(entry.snowDepthMax),
          formatOptional(seasonAggregate.snowDepthMax)
        ),
      ];

      const seasonSummary = periodEntries.reduce(
        (acc, entry) => {
          acc.banded += entry.banded;
          acc.returns += entry.returns;
          acc.recaptures += entry.recaptures;
          acc.netHours += entry.netHours;
          acc.effortDays += entry.effortDays;
          acc.fullCoverageDays += entry.fullCoverageDays;
          entry.bandedSpecies.forEach((species) => acc.bandedSpecies.add(species));
          entry.returnSpecies.forEach((species) => acc.returnSpecies.add(species));
          entry.repeatSpecies.forEach((species) => acc.repeatSpecies.add(species));
          entry.observedSpecies.forEach((species) => acc.observedSpecies.add(species));
          entry.bandingDates.forEach((date) => acc.bandingDates.add(date));
          return acc;
        },
        {
          banded: 0,
          returns: 0,
          recaptures: 0,
          netHours: 0,
          effortDays: 0,
          fullCoverageDays: 0,
          bandedSpecies: new Set<string>(),
          returnSpecies: new Set<string>(),
          repeatSpecies: new Set<string>(),
          observedSpecies: new Set<string>(),
          bandingDates: new Set<string>(),
        }
      );

      const summaryColumns: TableColumn[] = [
        { key: "metric", label: "" },
        ...periodEntries.map((entry) => ({ key: entry.key, label: entry.label, align: "right" })),
        ...(group.key !== "winter" ? [{ key: "average", label: "Average", align: "right" } as TableColumn] : []),
        { key: "season", label: "Season", align: "right" },
      ];

      const hasSummaryData = (entry: (typeof periodEntries)[number]) =>
        entry.effortDays > 0 ||
        entry.banded > 0 ||
        entry.returns > 0 ||
        entry.recaptures > 0 ||
        entry.observedSpecies.size > 0;

      const formatSummaryValue = (value: React.ReactNode, entry: (typeof periodEntries)[number]) =>
        hasSummaryData(entry) ? value : "n/a";

      const averageOf = (values: number[]) => (values.length ? values.reduce((sum, val) => sum + val, 0) / values.length : null);

      const buildSummaryRow = (
        label: string,
        getValue: (entry: (typeof periodEntries)[number]) => React.ReactNode,
        seasonValue: React.ReactNode,
        getAverage?: () => React.ReactNode
      ) => {
        const row: Record<string, React.ReactNode> = { metric: label, season: seasonValue };
        periodEntries.forEach((entry) => {
          row[entry.key] = formatSummaryValue(getValue(entry), entry);
        });
        if (group.key !== "winter") {
          row.average = getAverage ? getAverage() : "n/a";
        }
        return row;
      };

      const seasonHasData =
        seasonSummary.effortDays > 0 ||
        seasonSummary.banded > 0 ||
        seasonSummary.returns > 0 ||
        seasonSummary.recaptures > 0 ||
        seasonSummary.observedSpecies.size > 0;

      const summaryRows = [
        buildSummaryRow(
          "# individuals (species) banded",
          (entry) => `${formatNumber(entry.banded)} (${formatNumber(entry.bandedSpecies.size)})`,
          seasonHasData
            ? `${formatNumber(seasonSummary.banded)} (${formatNumber(seasonSummary.bandedSpecies.size)})`
            : "n/a"
          ,
          () => {
            const bandedValues = periodEntries.filter(hasSummaryData).map((entry) => entry.banded);
            const speciesValues = periodEntries.filter(hasSummaryData).map((entry) => entry.bandedSpecies.size);
            const avgBanded = averageOf(bandedValues);
            const avgSpecies = averageOf(speciesValues);
            if (avgBanded === null || avgSpecies === null) return "n/a";
            return `${formatNumber(Math.round(avgBanded))} (${formatNumber(Math.round(avgSpecies))})`;
          }
        ),
        buildSummaryRow(
          "# individuals (species) return",
          (entry) => `${formatNumber(entry.returns)} (${formatNumber(entry.returnSpecies.size)})`,
          seasonHasData
            ? `${formatNumber(seasonSummary.returns)} (${formatNumber(seasonSummary.returnSpecies.size)})`
            : "n/a"
          ,
          () => {
            const values = periodEntries.filter(hasSummaryData).map((entry) => entry.returns);
            const speciesValues = periodEntries.filter(hasSummaryData).map((entry) => entry.returnSpecies.size);
            const avgReturns = averageOf(values);
            const avgSpecies = averageOf(speciesValues);
            if (avgReturns === null || avgSpecies === null) return "n/a";
            return `${formatNumber(Math.round(avgReturns))} (${formatNumber(Math.round(avgSpecies))})`;
          }
        ),
        buildSummaryRow(
          "# individuals (species) repeat",
          (entry) => `${formatNumber(entry.recaptures)} (${formatNumber(entry.repeatSpecies.size)})`,
          seasonHasData
            ? `${formatNumber(seasonSummary.recaptures)} (${formatNumber(seasonSummary.repeatSpecies.size)})`
            : "n/a"
          ,
          () => {
            const values = periodEntries.filter(hasSummaryData).map((entry) => entry.recaptures);
            const speciesValues = periodEntries.filter(hasSummaryData).map((entry) => entry.repeatSpecies.size);
            const avgRepeats = averageOf(values);
            const avgSpecies = averageOf(speciesValues);
            if (avgRepeats === null || avgSpecies === null) return "n/a";
            return `${formatNumber(Math.round(avgRepeats))} (${formatNumber(Math.round(avgSpecies))})`;
          }
        ),
        buildSummaryRow(
          "# species observed",
          (entry) => formatNumber(entry.observedSpecies.size),
          seasonHasData ? formatNumber(seasonSummary.observedSpecies.size) : "n/a"
          ,
          () => {
            const values = periodEntries.filter(hasSummaryData).map((entry) => entry.observedSpecies.size);
            const avg = averageOf(values);
            return avg === null ? "n/a" : formatOptional(avg, 1);
          }
        ),
        buildSummaryRow(
          "# net hours",
          (entry) => formatOptional(entry.netHours, 1),
          seasonHasData ? formatOptional(seasonSummary.netHours, 1) : "n/a"
          ,
          () => {
            const values = periodEntries.filter(hasSummaryData).map((entry) => entry.netHours);
            const avg = averageOf(values);
            return avg === null ? "n/a" : formatOptional(avg, 1);
          }
        ),
        buildSummaryRow(
          "# birds banded / 100 net hours",
          (entry) => (entry.netHours ? formatOptional((entry.banded / entry.netHours) * 100, 1) : "n/a"),
          seasonSummary.netHours
            ? formatOptional((seasonSummary.banded / seasonSummary.netHours) * 100, 1)
            : "n/a"
          ,
          () => {
            const values = periodEntries
              .filter(hasSummaryData)
              .map((entry) => (entry.netHours ? (entry.banded / entry.netHours) * 100 : Number.NaN))
              .filter((value) => !Number.isNaN(value));
            const avg = averageOf(values);
            return avg === null ? "n/a" : formatOptional(avg, 1);
          }
        ),
        buildSummaryRow(
          "# days operating",
          (entry) => formatNumber(entry.effortDays),
          seasonHasData ? formatNumber(seasonSummary.effortDays) : "n/a"
          ,
          () => {
            const values = periodEntries.filter(hasSummaryData).map((entry) => entry.effortDays);
            const avg = averageOf(values);
            return avg === null ? "n/a" : formatOptional(avg, 1);
          }
        ),
        buildSummaryRow(
          "# days banding",
          (entry) => formatNumber(entry.bandingDates.size),
          seasonHasData ? formatNumber(seasonSummary.bandingDates.size) : "n/a"
          ,
          () => {
            const values = periodEntries.filter(hasSummaryData).map((entry) => entry.bandingDates.size);
            const avg = averageOf(values);
            return avg === null ? "n/a" : formatOptional(avg, 1);
          }
        ),
      ];

      if (group.key === "spring" || group.key === "fall") {
        summaryRows.push(
          buildSummaryRow(
            "# days with full net coverage",
            (entry) => formatNumber(entry.fullCoverageDays),
            seasonHasData ? formatNumber(seasonSummary.fullCoverageDays) : "n/a"
            ,
            () => {
              const values = periodEntries.filter(hasSummaryData).map((entry) => entry.fullCoverageDays);
              const avg = averageOf(values);
              return avg === null ? "n/a" : formatOptional(avg, 1);
            }
          )
        );
      }

      const bandedComparisonColumns: TableColumn[] = [];
      const bandedComparisonRows: Array<Record<string, React.ReactNode>> = [];
      const returnDetailColumns: TableColumn[] = [];
      const returnDetailRows: Array<Record<string, React.ReactNode>> = [];

      const seasonStats = new Map<string, { label: string; counts: Map<string, number>; sortKey: number }>();
      const seasonRankings = new Map<string, Map<string, number>>();
      const comparisonProgramIds = group.matchers.length
        ? Object.values(programsMap)
          .filter((program) =>
            group.matchers.some((matcher) => program.displayName.toLowerCase().includes(matcher))
          )
          .map((program) => program.id)
        : activeProgramIds;
      const bandedCapturesByProgram = captures.filter(
        (capture) =>
          comparisonProgramIds.includes(capture.programId) && capture.captureType === BirdEventType.Banded
      );

      bandedCapturesByProgram.forEach((capture) => {
        if (!capture.date) return;
        if (group.key === "winter") {
          const season = getWinterSeasonKey(capture.date);
          if (!season) return;
          const endYear = Number(season.key.split("-")[1]) || 0;
          if (!seasonStats.has(season.key)) {
            seasonStats.set(season.key, { label: season.label, counts: new Map<string, number>(), sortKey: endYear });
          }
          const entry = seasonStats.get(season.key)!;
          entry.counts.set(capture.species, (entry.counts.get(capture.species) ?? 0) + 1);
          return;
        }
        const year = new Date(`${capture.date}T00:00:00`).getFullYear();
        if (Number.isNaN(year)) return;
        const key = String(year);
        if (!seasonStats.has(key)) {
          seasonStats.set(key, { label: key, counts: new Map<string, number>(), sortKey: year });
        }
        const entry = seasonStats.get(key)!;
        entry.counts.set(capture.species, (entry.counts.get(capture.species) ?? 0) + 1);
      });

      seasonStats.forEach((seasonEntry, seasonKey) => {
        const ranked = Array.from(seasonEntry.counts.entries()).sort((a, b) => b[1] - a[1]);
        const rankMap = new Map<string, number>();
        ranked.forEach(([species], index) => {
          rankMap.set(species, index + 1);
        });
        seasonRankings.set(seasonKey, rankMap);
      });

      const seasonList = Array.from(seasonStats.entries())
        .map(([key, entry]) => ({ key, label: entry.label, sortKey: entry.sortKey }))
        .sort((a, b) => b.sortKey - a.sortKey);

      const defaultSeason =
        group.key === "winter"
          ? getWinterSeasonKey(groupDateBounds.max) ?? getWinterSeasonKey(groupDateBounds.min)
          : groupDateBounds.max
            ? { key: String(new Date(`${groupDateBounds.max}T00:00:00`).getFullYear()), label: "" }
            : null;

      if (defaultSeason && seasonStats.has(defaultSeason.key)) {
        const selectedSeason = seasonStats.get(defaultSeason.key)!;
        const topSpecies = Array.from(selectedSeason.counts.entries())
          .sort((a, b) => b[1] - a[1])
          .slice(0, 10);

        bandedComparisonColumns.push({ key: "species", label: "Species" });
        seasonList.forEach((season) => {
          bandedComparisonColumns.push({ key: season.key, label: season.label, align: "right" });
        });

        topSpecies.forEach(([speciesCode]) => {
          const row: Record<string, React.ReactNode> = {
            species: getSpeciesLabel(speciesCode),
          };
          seasonList.forEach((season) => {
            const seasonEntry = seasonStats.get(season.key);
            const seasonCount = seasonEntry?.counts.get(speciesCode) ?? 0;
            if (!seasonCount) {
              row[season.key] = "—";
              return;
            }
            if (season.key === defaultSeason.key) {
              row[season.key] = formatNumber(seasonCount);
              return;
            }
            const rank = seasonRankings.get(season.key)?.get(speciesCode);
            row[season.key] = rank ? `${formatNumber(seasonCount)}(${rank})` : formatNumber(seasonCount);
          });
          bandedComparisonRows.push(row);
        });
      }

      returnDetailColumns.push(
        { key: "band", label: "Band" },
        { key: "species", label: "Species" },
        { key: "returnAgeSex", label: "Age/sex at return" },
        { key: "bandingAgeSex", label: "Age/sex at banding" },
        { key: "bandingDate", label: "Banding date" },
        { key: "previousCapture", label: "Previous capture" },
        { key: "returnDate", label: "Return date" },
        { key: "elapsed", label: "Time elapsed" }
      );

      const returnEntries = groupCaptures
        .filter((capture) => capture.captureType === BirdEventType.Return)
        .map((capture) => {
          let previous: { date?: string } | null = null;
          if (capture.previousEventId) {
            previous = birdEventsMap[capture.previousEventId] ?? null;
          }
          if (!previous && capture.bandId) {
            const history = captureHistoryByBandId.get(capture.bandId) ?? [];
            const previousEntry = history
              .filter((entry) => entry.date < capture.date)
              .sort((a, b) => b.date.localeCompare(a.date))[0];
            if (previousEntry) {
              previous = { date: previousEntry.date };
            }
          }
          const banding = capture.bandId ? bandingByBandId.get(capture.bandId) : null;
          const returnDate = capture.date;
          const previousDate = previous?.date || "";
          let elapsed = "—";
          let elapsedMs: number | null = null;
          if (previousDate && returnDate) {
            const currentDate = new Date(`${returnDate}T00:00:00`);
            const previousDateObj = new Date(`${previousDate}T00:00:00`);
            if (!Number.isNaN(currentDate.getTime()) && !Number.isNaN(previousDateObj.getTime())) {
              elapsed = formatElapsedVerbose(previousDateObj, currentDate);
              elapsedMs = currentDate.getTime() - previousDateObj.getTime();
            }
          }
          return {
            band: capture.bandId || "—",
            species: getSpeciesLabel(capture.species),
            returnAgeSex: formatAgeSex(capture.age, capture.sex),
            bandingAgeSex: banding ? formatAgeSex(banding.age, banding.sex) : "—",
            bandingDate: banding?.date ? formatLongDate(banding.date) : "—",
            previousCapture: previousDate ? formatLongDate(previousDate) : "—",
            returnDate: returnDate ? formatLongDate(returnDate) : "—",
            elapsed,
            elapsedMs,
          };
        })
        .sort((a, b) => {
          if (a.elapsedMs === null && b.elapsedMs === null) return 0;
          if (a.elapsedMs === null) return 1;
          if (b.elapsedMs === null) return -1;
          return b.elapsedMs - a.elapsedMs;
        });

      returnDetailRows.push(...returnEntries.map(({ elapsedMs: _elapsedMs, ...row }) => row));

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

      const returnsRows: Array<Record<string, React.ReactNode>> = [];

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

      const netStatsByNet = new Map<
        string,
        { newCaptures: number; returns: number; recaptures: number; totalCaptures: number }
      >();
      groupCaptures.forEach((capture) => {
        const netId = capture.net || "Unknown";
        if (!netStatsByNet.has(netId)) {
          netStatsByNet.set(netId, { newCaptures: 0, returns: 0, recaptures: 0, totalCaptures: 0 });
        }
        const stats = netStatsByNet.get(netId)!;
        stats.totalCaptures += 1;
        if (capture.captureType === BirdEventType.Banded) stats.newCaptures += 1;
        if (capture.captureType === BirdEventType.Return) stats.returns += 1;
        if (capture.captureType === BirdEventType.Repeat || capture.captureType === BirdEventType.Alien) {
          stats.recaptures += 1;
        }
      });

      const getNetGroup = (netId: string) => {
        const trimmed = netId.trim().toUpperCase();
        if (!trimmed) return "Other";
        const first = trimmed[0];
        if (first === "B" || first === "N") return "B/N";
        if (["A", "C", "D", "E", "H"].includes(first)) return first;
        return "Other";
      };

      const groupedNetIds = new Map<string, string[]>();
      Array.from(netHoursByNet.keys()).forEach((netId) => {
        const groupKey = getNetGroup(netId);
        if (!groupedNetIds.has(groupKey)) groupedNetIds.set(groupKey, []);
        groupedNetIds.get(groupKey)!.push(netId);
      });

      const groupOrder = ["A", "B/N", "C", "D", "E", "H", "Other"];
      const netUsageRows: Array<Record<string, React.ReactNode>> = [];

      const grandTotals = {
        hours: 0,
        newCaptures: 0,
        returns: 0,
        recaptures: 0,
        totalCaptures: 0,
      };

      groupOrder.forEach((groupKey) => {
        const nets = groupedNetIds.get(groupKey);
        if (!nets?.length) return;
        nets.sort((a, b) => a.localeCompare(b));

        const groupTotals = {
          hours: 0,
          newCaptures: 0,
          returns: 0,
          recaptures: 0,
          totalCaptures: 0,
        };

        nets.forEach((netId) => {
          const hours = netHoursByNet.get(netId) ?? 0;
          const stats = netStatsByNet.get(netId) ?? {
            newCaptures: 0,
            returns: 0,
            recaptures: 0,
            totalCaptures: 0,
          };
          groupTotals.hours += hours;
          groupTotals.newCaptures += stats.newCaptures;
          groupTotals.returns += stats.returns;
          groupTotals.recaptures += stats.recaptures;
          groupTotals.totalCaptures += stats.totalCaptures;

          netUsageRows.push({
            net: netId,
            netHours: formatOptional(hours, 1),
            newCaptures: formatNumber(stats.newCaptures),
            returnsRecaptures: formatNumber(stats.returns + stats.recaptures),
            totalCaptures: formatNumber(stats.totalCaptures),
            newRate: hours ? formatOptional((stats.newCaptures / hours) * 100, 1) : "—",
            totalRate: hours ? formatOptional((stats.totalCaptures / hours) * 100, 1) : "—",
          });
        });

        grandTotals.hours += groupTotals.hours;
        grandTotals.newCaptures += groupTotals.newCaptures;
        grandTotals.returns += groupTotals.returns;
        grandTotals.recaptures += groupTotals.recaptures;
        grandTotals.totalCaptures += groupTotals.totalCaptures;

        netUsageRows.push({
          net: `${groupKey} - TOTAL`,
          netHours: formatOptional(groupTotals.hours, 1),
          newCaptures: formatNumber(groupTotals.newCaptures),
          returnsRecaptures: formatNumber(groupTotals.returns + groupTotals.recaptures),
          totalCaptures: formatNumber(groupTotals.totalCaptures),
          newRate: groupTotals.hours ? formatOptional((groupTotals.newCaptures / groupTotals.hours) * 100, 1) : "—",
          totalRate: groupTotals.hours ? formatOptional((groupTotals.totalCaptures / groupTotals.hours) * 100, 1) : "—",
        });
      });

      if (grandTotals.hours > 0 || grandTotals.totalCaptures > 0) {
        netUsageRows.push({
          net: "GRAND TOTAL",
          netHours: formatOptional(grandTotals.hours, 1),
          newCaptures: formatNumber(grandTotals.newCaptures),
          returnsRecaptures: formatNumber(grandTotals.returns + grandTotals.recaptures),
          totalCaptures: formatNumber(grandTotals.totalCaptures),
          newRate: grandTotals.hours ? formatOptional((grandTotals.newCaptures / grandTotals.hours) * 100, 1) : "—",
          totalRate: grandTotals.hours ? formatOptional((grandTotals.totalCaptures / grandTotals.hours) * 100, 1) : "—",
        });
      }

      const speciesByNet = new Map<string, Map<string, number>>();
      groupCaptures.forEach((capture) => {
        const netId = capture.net || "Unknown";
        if (!speciesByNet.has(netId)) {
          speciesByNet.set(netId, new Map());
        }
        const netMap = speciesByNet.get(netId)!;
        netMap.set(capture.species, (netMap.get(capture.species) ?? 0) + 1);
      });

      const netTopSpeciesRows = Array.from(speciesByNet.entries())
        .sort((a, b) => a[0].localeCompare(b[0]))
        .map(([netId, speciesCounts]) => {
          const topSpecies = Array.from(speciesCounts.entries())
            .sort((a, b) => b[1] - a[1])
            .slice(0, 3)
            .map(([species, count]) => `${getSpeciesLabel(species)} (${formatNumber(count)})`);
          return {
            net: netId,
            top1: topSpecies[0] ?? "—",
            top2: topSpecies[1] ?? "—",
            top3: topSpecies[2] ?? "—",
          };
        });

      const groupSummaries = netUsageRows.filter((row) => String(row.net).includes("TOTAL"));
      const groupRates = groupSummaries
        .filter((row) => row.net !== "GRAND TOTAL")
        .map((row) => {
          const netLabel = String(row.net);
          const hoursValue = Number(String(row.netHours).replace(/,/g, ""));
          const totalRate = Number(String(row.totalRate).replace(/,/g, ""));
          return { label: netLabel, totalRate, hoursValue };
        })
        .filter((row) => !Number.isNaN(row.totalRate));
      const topGroup = groupRates.sort((a, b) => b.totalRate - a.totalRate)[0];
      const lowGroup = groupRates.sort((a, b) => a.totalRate - b.totalRate)[0];

      const overallNewRate =
        grandTotals.hours > 0 ? formatOptional((grandTotals.newCaptures / grandTotals.hours) * 100, 1) : "—";
      const overallRecaptureRate =
        grandTotals.hours > 0
          ? formatOptional(((grandTotals.returns + grandTotals.recaptures) / grandTotals.hours) * 100, 1)
          : "—";

      const netProductivitySummary =
        grandTotals.hours > 0
          ? `Overall productivity was ${overallNewRate} new birds per 100 net hours, with ${overallRecaptureRate} returns + repeats per 100 net hours. ${topGroup && lowGroup
            ? `${topGroup.label.replace(" - TOTAL", "")} nets were the most productive, while ${lowGroup.label.replace(
              " - TOTAL",
              ""
            )} nets had the lowest capture rates.`
            : ""
            }`.trim()
          : "No net productivity data available.";

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
        groupDateBounds: groupDateRange,
        effortSummary,
        siteConditionsSummary,
        bandedSummary,
        recaptureSummary,
        periodLabel,
        weatherColumns,
        weatherRows,
        summaryColumns,
        summaryRows,
        bandedComparisonColumns,
        bandedComparisonRows,
        returnDetailColumns,
        returnDetailRows,
        topBandedRows,
        topRecapturedRows,
        returnsRows,
        netUsageRows,
        netProductivitySummary,
        netTopSpeciesRows,
        priorityRows,
      });
    }
    return results;
  }, [
    birdEventsMap,
    bandingByBandId,
    captureHistoryByBandId,
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
    setAppliedProgramIds(selectedProgramIds);
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
    <div className="mx-auto flex h-full w-full max-w-7xl flex-col gap-6 p-6 print:max-w-full print:p-4">
      <PageHeader
        title="Annual Program Report"
        subtitle="Structured to mirror the 2019 MBO annual report with daily banding and census charts."
        actions={
          <Button color="secondary" onPress={handlePrint} isDisabled={!analysis} className="print:hidden">
            Export / Print PDF
          </Button>
        }
      />

      <div className="rounded-2xl border border-default-200 bg-white p-6 shadow-sm print:hidden">
        <div className="mb-5">
          <h2 className="text-lg font-semibold text-default-900">Programs</h2>
          <p className="mt-1 text-sm text-default-900">Pick program(s) to generate the report.</p>
        </div>
        <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
          <div className="space-y-4 w-full lg:min-w-[320px]">
            <div>
              <Autocomplete
                key={autocompleteResetKey}
                label="Programs"
                placeholder="Search programs"
                size="sm"
                selectedKey={programSearchKey}
                onSelectionChange={(key) => {
                  const programId = key ? String(key) : "";
                  if (programId && !selectedProgramIds.includes(programId)) {
                    setSelectedProgramIds((current) => [...current, programId]);
                    setIsReportReady(false);
                  }
                  setProgramSearchKey(null);
                  setAutocompleteResetKey((current) => current + 1);
                }}
              >
                {programOptions.map((program) => (
                  <AutocompleteItem key={program.id} textValue={program.displayName}>
                    {program.displayName}
                  </AutocompleteItem>
                ))}
              </Autocomplete>
            </div>
            {selectedPrograms.length ? (
              <div>
                <p className="mb-2 text-xs font-medium text-default-600">Selected programs</p>
                <div className="flex flex-wrap gap-2">
                  {selectedPrograms.map((program) => (
                    <Button
                      key={program.id}
                      size="sm"
                      variant="flat"
                      onPress={() => {
                        setSelectedProgramIds((current) => current.filter((id) => id !== program.id));
                        setIsReportReady(false);
                      }}
                    >
                      {program.displayName}
                    </Button>
                  ))}
                </div>
              </div>
            ) : (
              <div className="text-sm text-default-600">Select at least one program to generate a report.</div>
            )}
            <Button
              color="secondary"
              onPress={handleGenerate}
              isDisabled={!selectedProgramIds.length || !startDate || !endDate || isPending}
              isLoading={isPending}
              className="w-full"
            >
              Generate report
            </Button>
          </div>
        </div>
      </div>

      {isReportReady && reportGroups.length ? (
        <ReportSection title="Report Metadata" subtitle="Programs and date ranges included in this report.">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <StatTile label="Date range" value={dateRangeLabel} />
            <StatTile label="Programs selected" value={formatNumber(appliedProgramIds.length)} />
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
          <div className="mt-6 space-y-4">
            {reportGroups.map((groupData) => {
              const programList = groupData.group.programs
                .map((program) => program.displayName)
                .sort((a, b) => a.localeCompare(b))
                .join(", ");
              const hasStart = Boolean(groupData.groupDateBounds.start);
              const hasEnd = Boolean(groupData.groupDateBounds.end);
              const startLabel = hasStart ? formatShortDate(groupData.groupDateBounds.start) : null;
              const endLabel = hasEnd ? formatShortDate(groupData.groupDateBounds.end) : null;
              return (
                <div key={groupData.group.key} className="rounded-lg border border-default-200 bg-default-50 p-4">
                  <div className="text-base font-semibold text-default-900">{groupData.group.title}</div>
                  <div className="mt-2 text-sm text-default-900">
                    <span className="font-medium">Programs:</span> {programList || "—"}
                  </div>
                  {hasStart && hasEnd && (
                    <div className="mt-1 text-sm text-default-900">
                      <span className="font-medium">Date range:</span> {startLabel} to {endLabel}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </ReportSection>
      ) : null}

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
              Select program(s) and click “Generate report” to run the analysis.
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
          {reportGroups.map((groupData) => {
            const groupAnalysis = groupData.groupAnalysis;
            return (
              <ReportSection
                key={groupData.group.key}
                title={groupData.group.title}
                subtitle={groupData.group.subtitle}
              >
                <p className="text-sm text-default-900">{groupData.summary}</p>
                {(groupData.effortSummary ||
                  groupData.siteConditionsSummary ||
                  groupData.bandedSummary ||
                  groupData.recaptureSummary) && (
                    <div className="mt-4 space-y-3 text-sm text-default-900">
                      {groupData.effortSummary && (
                        <div>
                          <p className="text-xs font-semibold uppercase tracking-wide text-default-600">Effort</p>
                          <p className="text-default-900">{groupData.effortSummary}</p>
                        </div>
                      )}
                      {groupData.siteConditionsSummary && (
                        <div>
                          <p className="text-xs font-semibold uppercase tracking-wide text-default-600">Site conditions</p>
                          <p className="text-default-900">{groupData.siteConditionsSummary}</p>
                        </div>
                      )}
                      {groupData.bandedSummary && (
                        <div>
                          <p className="text-xs font-semibold uppercase tracking-wide text-default-600">Birds banded</p>
                          <p className="text-default-900">{groupData.bandedSummary}</p>
                        </div>
                      )}
                      {groupData.recaptureSummary && (
                        <div>
                          <p className="text-xs font-semibold uppercase tracking-wide text-default-600">
                            Birds recaptured
                          </p>
                          <p className="text-default-900">{groupData.recaptureSummary}</p>
                        </div>
                      )}
                    </div>
                  )}

                <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                  <StatTile label="Total captures" value={formatNumber(groupAnalysis?.totalCaptures ?? 0)} />
                  <StatTile label="Species recorded" value={formatNumber(groupAnalysis?.uniqueSpecies ?? 0)} />
                  <StatTile label="Effort days" value={formatNumber(groupData.effortDays)} />
                  <StatTile label="Net hours" value={formatNumber(Math.round(groupData.netHours))} />
                </div>

                <div className="mt-6 grid gap-6 grid-cols-1">

                  <ReportTable
                    title={`Weather conditions (${groupData.periodLabel.toLowerCase()}ly)`}
                    subtitle="Summarized from DET weather logs."
                    columns={groupData.weatherColumns}
                    rows={groupData.weatherRows}
                  />

                  <ReportTable
                    title={`Summary results (${groupData.periodLabel.toLowerCase()}ly)`}
                    subtitle="Effort and banding totals."
                    columns={groupData.summaryColumns}
                    rows={groupData.summaryRows}
                  />

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

                  {groupData.bandedComparisonRows.length ? (
                    <ReportTable
                      title={`Top 10 species banded (${groupData.group.title} comparison)`}
                      subtitle="Counts include rank in other seasons (in parentheses); dashes indicate no banding."
                      columns={groupData.bandedComparisonColumns}
                      rows={groupData.bandedComparisonRows}
                    />
                  ) : null}

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

                  {groupData.returnDetailRows.length ? (
                    <ReportTable
                      title="Returns list"
                      subtitle="Returns sorted by time elapsed since the previous capture."
                      columns={groupData.returnDetailColumns}
                      rows={groupData.returnDetailRows}
                    />
                  ) : null}


                  <ChartContainer
                    title="Species on cCensus per day"
                    subtitle="Daily census species counts with 7-day running mean"
                  >
                    <DailyTrendChart data={groupData.dailyCensusSpecies} ariaLabel="Species on census per day" />
                  </ChartContainer>

                  <ChartContainer
                    title="Species observed on DET per day"
                    subtitle="Daily observed species counts with 7-day running mean"
                  >
                    <DailyTrendChart data={groupData.dailyObservedSpecies} ariaLabel="Species observed per day" />
                  </ChartContainer>

                  <div>
                    <ReportTable
                      title="Net usage and capture rates"
                      subtitle="Effort by net with productivity rates."
                      columns={[
                        { key: "net", label: "Net" },
                        { key: "netHours", label: "Hours open", align: "right" },
                        { key: "newCaptures", label: "New captures", align: "right" },
                        { key: "returnsRecaptures", label: "Returns + repeats", align: "right" },
                        { key: "totalCaptures", label: "Total captures", align: "right" },
                        { key: "newRate", label: "New / 100 NH", align: "right" },
                        { key: "totalRate", label: "Total / 100 NH", align: "right" },
                      ]}
                      rows={groupData.netUsageRows}
                    />
                    {groupData.netProductivitySummary && (
                      <p className="mt-3 text-sm text-default-900">{groupData.netProductivitySummary}</p>
                    )}
                  </div>

                  {groupData.netTopSpeciesRows.length ? (
                    <ReportTable
                      title="Top species captured per net"
                      subtitle="Top 3 species by capture count for each net."
                      columns={[
                        { key: "net", label: "Net" },
                        { key: "top1", label: "Top 1", align: "right" },
                        { key: "top2", label: "Top 2", align: "right" },
                        { key: "top3", label: "Top 3", align: "right" },
                      ]}
                      rows={groupData.netTopSpeciesRows}
                    />
                  ) : null}
                  
                  {groupData.priorityRows.length ? (
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
                  ) : null}

                  {groupData.returnsRows.length ? (
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
                  ) : null}
                </div>

              </ReportSection>
            );
          })}

        </div>
      )}
    </div>
  );
}
