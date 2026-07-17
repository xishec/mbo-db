import { useCallback, useMemo } from "react";
import type { Observer, ObserverHours } from "../../../types/DET";
import type { VolunteersMap } from "../../../types";
import CsvEditor from "../../Helper/CsvEditor";
import { parseCsv, stringifyCsv } from "../../../utils/csv";

interface DETObserverHoursSectionProps {
  observerHours: ObserverHours;
  volunteersMap: VolunteersMap;
  onChange: (observerHours: ObserverHours) => void;
}

const OBSERVER_HOURS_HEADERS = ["Obs Initials", "Hours Obs", "Class", "Total hours"];
const MIN_OBSERVER_ROWS = 8;

function calculateObserverTotal(hoursObserved: number, classValue: number): number {
  const multipliers: Record<number, number> = {
    1: 1,
    2: 0.5,
    3: 0.33,
  };
  return hoursObserved * (multipliers[classValue] ?? 0);
}

function formatObserverNumber(value: number): string {
  if (!Number.isFinite(value)) return "";
  return Number(value.toFixed(2)).toString();
}

function normalizeObserverClass(value: string): number {
  const parsed = Number(value);
  return parsed >= 1 && parsed <= 3 ? parsed : 0;
}

function getVolunteer(code: string, volunteersMap: VolunteersMap) {
  return volunteersMap[code] ?? volunteersMap[code.toUpperCase()] ?? volunteersMap[code.toLowerCase()];
}

function getObserverClass(initials: string, currentValue: string, volunteersMap: VolunteersMap): number {
  const code = initials.trim().toUpperCase();
  return normalizeObserverClass(currentValue) || getVolunteer(code, volunteersMap)?.observerClass || 0;
}

function observerHoursToCsv(observerHours: ObserverHours, volunteersMap: VolunteersMap): string {
  const rows = (observerHours.observers ?? []).map((observer) => {
    const classValue = getObserverClass(observer.initials, String(observer.class || ""), volunteersMap);

    return [
      observer.initials,
      formatObserverNumber(observer.hoursObserved),
      classValue ? String(classValue) : "",
      formatObserverNumber(calculateObserverTotal(observer.hoursObserved, classValue)),
    ];
  });

  while (rows.length < MIN_OBSERVER_ROWS) {
    rows.push(["", "", "", "0"]);
  }

  return stringifyCsv([OBSERVER_HOURS_HEADERS, ...rows]);
}

function csvToObserverHours(csv: string, volunteersMap: VolunteersMap): ObserverHours {
  const observers: Observer[] = parseCsv(csv)
    .slice(1)
    .flatMap((row) => {
      const initials = (row[0] ?? "").trim().toUpperCase();
      const hoursObserved = Number(row[1]) || 0;
      const volunteer = getVolunteer(initials, volunteersMap);
      const classValue = getObserverClass(initials, row[2] ?? "", volunteersMap);

      if (!initials && !hoursObserved && !classValue) return [];

      return [
        {
          name: volunteer?.fullName ?? "",
          initials,
          hoursObserved,
          class: classValue,
          totalHours: calculateObserverTotal(hoursObserved, classValue),
        },
      ];
    });

  return {
    observers,
    total: observers.reduce((sum, observer) => sum + observer.totalHours, 0),
  };
}

export default function DETObserverHoursSection({
  observerHours,
  volunteersMap,
  onChange,
}: DETObserverHoursSectionProps) {
  const observerHoursCsv = useMemo(
    () => observerHoursToCsv(observerHours, volunteersMap),
    [observerHours, volunteersMap]
  );

  const handleObserverHoursCsvChange = useCallback(
    (csv: string) => {
      onChange(csvToObserverHours(csv, volunteersMap));
    },
    [onChange, volunteersMap]
  );

  return (
    <div>
      <p className="text-small pb-1">Observer Hours</p>
      <div>
        <CsvEditor
          csvTemplate={observerHoursCsv}
          onChange={handleObserverHoursCsvChange}
          ariaLabel="Observer hours table"
          readOnlyColumns={["Total hours"]}
        />
        <div className="mt-2 flex justify-between gap-3 text-small pb-1 mr-3">
          <span>Total Observer Hours (Class 1 x 1) + (Class 2 x 0.5) + (Class 3 x 0.33)</span>
          <span>{formatObserverNumber(observerHours.total)}</span>
        </div>
      </div>
    </div>
  );
}
