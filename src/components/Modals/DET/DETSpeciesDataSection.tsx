import { useEffect, useMemo, useState } from "react";
import { Button } from "@heroui/react";
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
    const groupedSpecies: SpeciesGroupTable[] = [];
    let currentGroup: SpeciesGroupTable | null = null;

    SPECIES_GROUPS.forEach((item) => {
      if (item.type === "group") {
        currentGroup = { name: item.groupName, codes: [] };
        groupedSpecies.push(currentGroup);
        return;
      }

      currentGroup?.codes.push(item.code);
    });

    return groupedSpecies.filter((group) => group.codes.length > 0);
  }, []);

  const customCodes = useMemo(() => {
    const codes = new Set<string>();
    [
      observedSpeciesCount,
      censusSpeciesCount,
      bandedSpeciesCount,
      repeatSpeciesCount,
      returnSpeciesCount,
      DETSpeciesCount,
    ].forEach((counts) => {
      Object.keys(counts).forEach((code) => {
        if (!DET_SPECIES_CODES_SET.has(code)) codes.add(code);
      });
    });
    return Array.from(codes).sort((a, b) => a.localeCompare(b));
  }, [
    DETSpeciesCount,
    bandedSpeciesCount,
    censusSpeciesCount,
    observedSpeciesCount,
    repeatSpeciesCount,
    returnSpeciesCount,
  ]);
  const [otherCodes, setOtherCodes] = useState<string[]>(customCodes);
  const [otherCodeError, setOtherCodeError] = useState("");
  const [otherEditorRevision, setOtherEditorRevision] = useState(0);

  useEffect(() => {
    setOtherCodes((currentCodes) => {
      const nextCodes = [...currentCodes];
      customCodes.forEach((code) => {
        if (!nextCodes.includes(code)) nextCodes.push(code);
      });
      return nextCodes;
    });
  }, [customCodes]);

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

  const otherCsvTemplate = useMemo(
    () =>
      stringifyCsv([
        headers,
        ...otherCodes.map((code) => [
          code,
          countValue(observedSpeciesCount, code),
          countValue(censusSpeciesCount, code),
          countValue(bandedSpeciesCount, code),
          countValue(repeatSpeciesCount, code),
          countValue(returnSpeciesCount, code),
          countValue(DETSpeciesCount, code),
        ]),
      ]),
    [
      DETSpeciesCount,
      bandedSpeciesCount,
      censusSpeciesCount,
      observedSpeciesCount,
      otherCodes,
      repeatSpeciesCount,
      returnSpeciesCount,
    ]
  );

  const handleOtherCsvChange = (csv: string) => {
    const rows = parseCsv(csv);
    const nextCodes = rows.slice(1).map(
      (row) =>
        row[0]
          ?.trim()
          .toUpperCase()
          .replace(/[^A-Z0-9_-]/g, "") ?? ""
    );
    const filledCodes = nextCodes.filter(Boolean);
    const duplicateCode = filledCodes.find((code, index) => filledCodes.indexOf(code) !== index);
    if (duplicateCode) {
      setOtherCodeError(`Code ${duplicateCode} is already used by another OTHER row.`);
      setOtherEditorRevision((revision) => revision + 1);
      return;
    }
    const mainSpeciesCode = filledCodes.find((code) => DET_SPECIES_CODES_SET.has(code));
    if (mainSpeciesCode) {
      setOtherCodeError(`Code ${mainSpeciesCode} already exists in the main species tables.`);
      setOtherEditorRevision((revision) => revision + 1);
      return;
    }

    const previousCustomCodes = new Set([...customCodes, ...otherCodes.filter(Boolean)]);
    const nextCustomCodes = new Set(nextCodes.filter((code) => code && !DET_SPECIES_CODES_SET.has(code)));

    setOtherCodeError("");
    setOtherCodes(nextCodes);
    onObservedChange(mergeGroupCount(observedSpeciesCount, previousCustomCodes, rowsToCount(rows, 1, nextCustomCodes)));
    onCensusChange(mergeGroupCount(censusSpeciesCount, previousCustomCodes, rowsToCount(rows, 2, nextCustomCodes)));
    onDETChange(mergeGroupCount(DETSpeciesCount, previousCustomCodes, rowsToCount(rows, 6, nextCustomCodes)));
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
        <section>
          <div className="flex items-center justify-between pb-1">
            <p className="text-sm font-semibold text-default-700">OTHER</p>
            <Button size="sm" variant="flat" onPress={() => setOtherCodes((codes) => [...codes, ""])}>
              Add row
            </Button>
          </div>
          {otherCodeError && (
            <div className="mb-2 rounded-lg bg-danger-50 p-3 text-sm text-danger-500">{otherCodeError}</div>
          )}
          {otherCodes.length > 0 ? (
            <CsvEditor
              key={otherEditorRevision}
              ariaLabel="Other species data"
              csvTemplate={otherCsvTemplate}
              onChange={handleOtherCsvChange}
              readOnlyColumns={["Band", "Repeat", "Ret"]}
            />
          ) : (
            <div className="rounded-medium border border-default-200 px-3 py-4 text-sm text-default-500">
              No custom bird entries.
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
