import { BirdEventType, type BirdEvent } from "../../../types";

export type ReportCapture = {
  id: string;
  programId: string;
  species: string;
  wing: number;
  age: string;
  sex: string;
  fat: number;
  weight: number;
  date: string;
  bander: string;
  net: string;
  captureType: BirdEventType;
  bandId: string;
  previousEventId: string | null;
};

export type SpeciesCount = {
  name: string;
  count: number;
  percentage: number;
  newBands: number;
  recaptures: number;
  returns: number;
};

export type MonthlyMetric = {
  month: string;
  year: number;
  monthYear: string; // e.g., "Jan 2024"
  captures: number;
  species: number;
  days: number;
  sortKey: number; // timestamp for sorting
};

export type DailyTrendPoint = {
  date: string;
  label: string;
  value: number;
  mean7: number;
};

export type ReportAnalysis = {
  totalCaptures: number;
  uniqueSpecies: number;
  newBands: number;
  recaptures: number;
  returns: number;
  captureTypes: Record<string, number>;
  topSpecies: SpeciesCount[];
  ageDistribution: Record<string, number>;
  sexDistribution: Record<string, number>;
  monthlyData: MonthlyMetric[];
  peakMonth: string;
  activeDays: number;
};

const MONTH_ORDER = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const MONTH_LABELS = MONTH_ORDER;

export const formatNumber = (value: number) => value.toLocaleString();

export const formatShortDate = (dateString: string) => {
  const date = new Date(`${dateString}T00:00:00`);
  if (Number.isNaN(date.getTime())) return dateString;
  return date.toLocaleDateString("en-CA", { month: "short", day: "numeric" });
};

export const getWeekStart = (dateString: string) => {
  const date = new Date(`${dateString}T00:00:00`);
  if (Number.isNaN(date.getTime())) return dateString;
  const day = date.getDay();
  const diff = (day + 6) % 7;
  date.setDate(date.getDate() - diff);
  return date.toISOString().slice(0, 10);
};

export const formatWeekLabel = (weekStart: string) => `Week of ${formatShortDate(weekStart)}`;

export const getMonthKey = (dateString: string) => {
  const date = new Date(`${dateString}T00:00:00`);
  if (Number.isNaN(date.getTime())) return dateString;
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  return `${year}-${month}-01`;
};

export const formatMonthLabel = (monthKey: string) => {
  const date = new Date(`${monthKey}T00:00:00`);
  if (Number.isNaN(date.getTime())) return monthKey;
  return date.toLocaleDateString("en-CA", { month: "short", year: "numeric" });
};

export const enumerateDates = (start: string, end: string): string[] => {
  if (!start || !end) return [];
  const startDate = new Date(`${start}T00:00:00`);
  const endDate = new Date(`${end}T00:00:00`);
  if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime())) return [];
  if (startDate > endDate) return [];

  const dates: string[] = [];
  const current = new Date(startDate);
  while (current <= endDate) {
    dates.push(current.toISOString().slice(0, 10));
    current.setDate(current.getDate() + 1);
  }
  return dates;
};

export const buildDailyTrend = (dates: string[], valuesByDate: Map<string, number>, windowSize = 7): DailyTrendPoint[] => {
  if (!dates.length) return [];
  const values = dates.map((date) => valuesByDate.get(date) ?? 0);
  const trend = values.map((value, index) => {
    const start = Math.max(0, index - windowSize + 1);
    const slice = values.slice(start, index + 1);
    const mean7 = slice.reduce((sum, entry) => sum + entry, 0) / slice.length;
    return {
      date: dates[index],
      label: formatShortDate(dates[index]),
      value,
      mean7,
    };
  });
  return trend;
};

export const toReportCapture = (event: BirdEvent): ReportCapture => ({
  id: event.id,
  programId: event.programId,
  species: event.species || "Unknown",
  wing: event.wing ?? 0,
  age: event.age || "Unknown",
  sex: event.sex || "Unknown",
  fat: event.fat ?? 0,
  weight: event.weight ?? 0,
  date: event.date,
  bander: event.bander || "Unknown",
  net: event.net || "Unknown",
  captureType: event.birdEventType ?? BirdEventType.None,
  bandId: event.band?.id ?? "",
  previousEventId: event.previousEventId ?? null,
});

export const getCaptureYear = (capture: ReportCapture): number | null => {
  if (!capture.date) return null;
  const year = new Date(capture.date).getFullYear();
  return Number.isNaN(year) ? null : year;
};

export const getReportYears = (captures: ReportCapture[]): number[] => {
  const years = new Set<number>();
  captures.forEach((capture) => {
    const year = getCaptureYear(capture);
    if (year) years.add(year);
  });
  return Array.from(years).sort((a, b) => b - a);
};

export const analyzeCaptures = (captures: ReportCapture[]): ReportAnalysis => {
  const totalCaptures = captures.length;
  const uniqueSpecies = new Set(captures.map((capture) => capture.species)).size;

  const captureTypes = captures.reduce(
    (acc, capture) => {
      const key = capture.captureType || BirdEventType.None;
      acc[key] = (acc[key] || 0) + 1;
      return acc;
    },
    {} as Record<string, number>
  );

  const newBands = captureTypes[BirdEventType.Banded] || 0;
  const recaptures = (captureTypes[BirdEventType.Repeat] || 0) + (captureTypes[BirdEventType.Alien] || 0);
  const returns = captureTypes[BirdEventType.Return] || 0;

  const speciesCounts = captures.reduce(
    (acc, capture) => {
      const existing = acc[capture.species] || {
        name: capture.species,
        count: 0,
        newBands: 0,
        recaptures: 0,
        returns: 0,
      };
      existing.count += 1;
      if (capture.captureType === BirdEventType.Banded) existing.newBands += 1;
      if (capture.captureType === BirdEventType.Return) existing.returns += 1;
      if (capture.captureType === BirdEventType.Repeat || capture.captureType === BirdEventType.Alien) {
        existing.recaptures += 1;
      }
      acc[capture.species] = existing;
      return acc;
    },
    {} as Record<string, SpeciesCount>
  );

  const topSpecies = Object.values(speciesCounts)
    .sort((a, b) => b.count - a.count)
    .map((species) => ({
      ...species,
      percentage: totalCaptures > 0 ? (species.count / totalCaptures) * 100 : 0,
    }));

  const ageDistribution = captures.reduce(
    (acc, capture) => {
      const age = capture.age?.trim() || "Unknown";
      acc[age] = (acc[age] || 0) + 1;
      return acc;
    },
    {} as Record<string, number>
  );

  const sexDistribution = captures.reduce(
    (acc, capture) => {
      const sex = capture.sex?.trim() || "Unknown";
      acc[sex] = (acc[sex] || 0) + 1;
      return acc;
    },
    {} as Record<string, number>
  );

  const monthlyCaptures = captures.reduce(
    (acc, capture) => {
      const date = new Date(capture.date);
      if (Number.isNaN(date.getTime())) return acc;
      const year = date.getFullYear();
      const monthIndex = date.getMonth();
      const month = MONTH_LABELS[monthIndex] || "";
      const monthYear = `${month} ${year}`;
      const sortKey = year * 12 + monthIndex;

      if (!acc[monthYear]) {
        acc[monthYear] = {
          month,
          year,
          monthYear,
          sortKey,
          captures: 0,
          species: new Set<string>(),
          dates: new Set<string>(),
        };
      }
      acc[monthYear].captures += 1;
      acc[monthYear].species.add(capture.species);
      acc[monthYear].dates.add(capture.date);
      return acc;
    },
    {} as Record<
      string,
      {
        month: string;
        year: number;
        monthYear: string;
        sortKey: number;
        captures: number;
        species: Set<string>;
        dates: Set<string>;
      }
    >
  );

  const monthlyData = Object.values(monthlyCaptures)
    .map((entry) => ({
      month: entry.month,
      year: entry.year,
      monthYear: entry.monthYear,
      sortKey: entry.sortKey,
      captures: entry.captures,
      species: entry.species.size,
      days: entry.dates.size,
    }))
    .sort((a, b) => a.sortKey - b.sortKey);

  const peakMonth = monthlyData.reduce(
    (max, entry) => (entry.captures > max.captures ? entry : max),
    monthlyData[0] || { month: "", year: 0, monthYear: "", sortKey: 0, captures: 0, species: 0, days: 0 }
  ).monthYear;

  const activeDays = new Set(captures.map((capture) => capture.date)).size;

  return {
    totalCaptures,
    uniqueSpecies,
    newBands,
    recaptures,
    returns,
    captureTypes,
    topSpecies,
    ageDistribution,
    sexDistribution,
    monthlyData,
    peakMonth,
    activeDays,
  };
};

export const summarizeSeason = (analysis: ReportAnalysis, yearLabel: string, programLabel: string) => {
  const total = formatNumber(analysis.totalCaptures);
  const species = formatNumber(analysis.uniqueSpecies);
  const newBands = formatNumber(analysis.newBands);
  const returns = formatNumber(analysis.returns);
  const peakMonth = analysis.peakMonth || "N/A";

  return (
    `During ${yearLabel}, ${programLabel} recorded ${total} captures across ${species} species. ` +
    `New bands accounted for ${newBands} captures, while returns accounted for ${returns}. ` +
    `Activity peaked in ${peakMonth}.`
  );
};
