import { useMemo } from "react";
import CsvEditor from "../../Helper/CsvEditor";
import { DET_SPECIES_CODES_SET, SPECIES_GROUPS } from "../../../types/DET";
import { parseCsv, stringifyCsv } from "../../../utils/csv";

interface DETSpeciesDataSectionProps {
  observedSpeciesCount: Record<string, number>;
  censusSpeciesCount: Record<string, number>;
  bandedSpeciesCount: Record<string, number>;
  repeatSpeciesCount: Record<string, number>;
  returnSpeciesCount: Record<string, number>;
  DETSpeciesCount: Record<string, number>;
  onObservedChange: (count: Record<string, number>) => void;
  onCensusChange: (count: Record<string, number>) => void;
  onDETChange: (count: Record<string, number>) => void;
}

const headers = ["Species", "Obs", "Cns", "Band", "Repeat", "Ret", "DET"];

interface SpeciesGroupTable {
  name: string;
  codes: string[];
}

function countValue(counts: Record<string, number>, code: string): string {
  return counts[code] ? String(counts[code]) : "";
}

function rowsToCount(rows: string[][], columnIndex: number, allowedCodes: Set<string>): Record<string, number> {
  const count: Record<string, number> = {};

  rows.slice(1).forEach((row) => {
    const code = row[0]?.trim().toUpperCase();
    if (!code || !allowedCodes.has(code)) return;

    const value = Number(row[columnIndex]);
    if (Number.isFinite(value) && value > 0) {
      count[code] = value;
    }
  });

  return count;
}

function mergeGroupCount(
  currentCount: Record<string, number>,
  groupCodes: Set<string>,
  nextGroupCount: Record<string, number>
): Record<string, number> {
  const nextCount: Record<string, number> = {};

  Object.entries(currentCount).forEach(([code, value]) => {
    if (!groupCodes.has(code)) {
      nextCount[code] = value;
    }
  });

  return { ...nextCount, ...nextGroupCount };
}

export default function DETSpeciesDataSection({
  observedSpeciesCount,
  censusSpeciesCount,
  bandedSpeciesCount,
  repeatSpeciesCount,
  returnSpeciesCount,
  DETSpeciesCount,
  onObservedChange,
  onCensusChange,
  onDETChange,
}: DETSpeciesDataSectionProps) {
  const groups = useMemo<SpeciesGroupTable[]>(() => {
    const codes = new Set<string>();
    const groupedSpecies: SpeciesGroupTable[] = [];
    let currentGroup: SpeciesGroupTable | null = null;

    SPECIES_GROUPS.forEach((item) => {
      if (item.type === "group") {
        currentGroup = { name: item.groupName, codes: [] };
        groupedSpecies.push(currentGroup);
        return;
      }

      codes.add(item.code);
      currentGroup?.codes.push(item.code);
    });

    [
      observedSpeciesCount,
      censusSpeciesCount,
      bandedSpeciesCount,
      repeatSpeciesCount,
      returnSpeciesCount,
      DETSpeciesCount,
    ].forEach((counts) => {
      Object.keys(counts).forEach((code) => codes.add(code));
    });

    const sortedCustomCodes = Array.from(codes)
      .filter((code) => !DET_SPECIES_CODES_SET.has(code))
      .sort((a, b) => a.localeCompare(b));

    if (sortedCustomCodes.length > 0) {
      groupedSpecies.push({ name: "CUSTOM", codes: sortedCustomCodes });
    }

    return groupedSpecies.filter((group) => group.codes.length > 0);
  }, [
    DETSpeciesCount,
    bandedSpeciesCount,
    censusSpeciesCount,
    observedSpeciesCount,
    repeatSpeciesCount,
    returnSpeciesCount,
  ]);

  const groupCsvTemplates = useMemo(() => {
    return new Map(
      groups.map((group) => [
        group.name,
        stringifyCsv([
          headers,
          ...group.codes.map((code) => [
            code,
            countValue(observedSpeciesCount, code),
            countValue(censusSpeciesCount, code),
            countValue(bandedSpeciesCount, code),
            countValue(repeatSpeciesCount, code),
            countValue(returnSpeciesCount, code),
            countValue(DETSpeciesCount, code),
          ]),
        ]),
      ])
    );
  }, [
    DETSpeciesCount,
    bandedSpeciesCount,
    censusSpeciesCount,
    groups,
    observedSpeciesCount,
    repeatSpeciesCount,
    returnSpeciesCount,
  ]);

  const handleCsvChange = (groupCodes: string[], csv: string) => {
    const rows = parseCsv(csv);
    const groupCodeSet = new Set(groupCodes);

    onObservedChange(mergeGroupCount(observedSpeciesCount, groupCodeSet, rowsToCount(rows, 1, groupCodeSet)));
    onCensusChange(mergeGroupCount(censusSpeciesCount, groupCodeSet, rowsToCount(rows, 2, groupCodeSet)));
    onDETChange(mergeGroupCount(DETSpeciesCount, groupCodeSet, rowsToCount(rows, 6, groupCodeSet)));
  };

  return (
    <div>
      <p className="text-small pb-1">Species Data</p>
      <div className="space-y-5">
        {groups.map((group) => (
          <section key={group.name}>
            <p className="pb-1 text-sm font-semibold text-default-700">{group.name}</p>
            <CsvEditor
              ariaLabel={`${group.name} species data`}
              csvTemplate={groupCsvTemplates.get(group.name) ?? stringifyCsv([headers])}
              onChange={(csv) => handleCsvChange(group.codes, csv)}
              readOnlyColumns={["Species", "Band", "Repeat", "Ret"]}
            />
          </section>
        ))}
      </div>
    </div>
  );
}
