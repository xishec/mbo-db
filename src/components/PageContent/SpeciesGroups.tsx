import { Table, TableBody, TableCell, TableColumn, TableHeader, TableRow, type SortDescriptor } from "@heroui/react";
import { useCallback, useMemo, useState } from "react";
import { SPECIES_GROUPS } from "../../types/DET";
import { SPECIES_MAP } from "../../types/species";
import { useData } from "../../services/useData";
import SpeciesInfoModal from "../Modals/SpeciesInfoModal";

type SpeciesGroup = {
  name: string;
  speciesCodes: string[];
};

type SpeciesRow = {
  groupName: string;
  code: string;
  englishName: string;
  frenchName: string;
  totalCaptures: number;
  dummiestCount: number;
  oldestSpanDays: number;
};

type ColumnType = {
  key: keyof SpeciesRow;
  label: string;
  type: "string" | "number";
  align?: "end";
};

const SPECIES_COLUMNS: ColumnType[] = [
  { key: "groupName", label: "Group", type: "string" },
  { key: "code", label: "Code", type: "string" },
  { key: "englishName", label: "English", type: "string" },
  { key: "frenchName", label: "French", type: "string" },
  { key: "totalCaptures", label: "Total Captures", type: "number", align: "end" },
  { key: "dummiestCount", label: "Dummiest Count", type: "number", align: "end" },
  { key: "oldestSpanDays", label: "Oldest Span", type: "number", align: "end" },
];

const formatSpanDays = (days: number): string => {
  if (days < 0) return "—";
  const years = Math.floor(days / 365);
  const remainderDays = days % 365;
  const parts: string[] = [];

  if (years > 0) {
    parts.push(`${years} year${years === 1 ? "" : "s"}`);
  }
  if (remainderDays > 0 || parts.length === 0) {
    parts.push(`${remainderDays} day${remainderDays === 1 ? "" : "s"}`);
  }

  return parts.join(" ");
};

export default function SpeciesGroups() {
  const { speciesInfoMap } = useData();
  const [selectedSpeciesCode, setSelectedSpeciesCode] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [sortDescriptors, setSortDescriptors] = useState<SortDescriptor[]>([]);

  const groupedSpecies = useMemo<SpeciesGroup[]>(() => {
    const groups: SpeciesGroup[] = [];
    let currentGroup: SpeciesGroup | null = null;

    for (const item of SPECIES_GROUPS) {
      if (item.type === "group") {
        currentGroup = { name: item.groupName, speciesCodes: [] };
        groups.push(currentGroup);
        continue;
      }

      if (!currentGroup) {
        currentGroup = { name: "Other", speciesCodes: [] };
        groups.push(currentGroup);
      }

      currentGroup.speciesCodes.push(item.code);
    }

    return groups;
  }, []);

  const handleRowClick = (code: string) => {
    setSelectedSpeciesCode(code);
    setIsModalOpen(true);
  };

  const handleModalOpenChange = (open: boolean) => {
    setIsModalOpen(open);
    if (!open) {
      setSelectedSpeciesCode(null);
    }
  };

  const handleSortChange = useCallback((descriptor: SortDescriptor) => {
    setSortDescriptors((prev) => {
      const existingIndex = prev.findIndex((item) => item.column === descriptor.column);

      if (existingIndex === 0) {
        const updated = [...prev];
        updated[0] = descriptor;
        return updated;
      }
      if (existingIndex > 0) {
        const updated = prev.filter((item) => item.column !== descriptor.column);
        return [descriptor, ...updated];
      }
      return [descriptor, ...prev].slice(0, 3);
    });
  }, []);

  const handleResetSort = () => {
    setSortDescriptors([]);
  };

  const sortRows = useCallback(
    (rows: SpeciesRow[]) => {
      if (sortDescriptors.length === 0) return rows;
      const numericColumns = new Set<keyof SpeciesRow>(
        SPECIES_COLUMNS.filter((column) => column.type === "number").map((column) => column.key)
      );

      return [...rows].sort((a, b) => {
        for (const descriptor of sortDescriptors) {
          const column = descriptor.column as keyof SpeciesRow;
          const first = a[column];
          const second = b[column];
          let cmp = 0;

          if (numericColumns.has(column)) {
            const firstNum = Number(first) || 0;
            const secondNum = Number(second) || 0;
            cmp = firstNum - secondNum;
          } else {
            cmp = String(first).localeCompare(String(second));
          }

          if (cmp !== 0) {
            return descriptor.direction === "descending" ? -cmp : cmp;
          }
        }
        return 0;
      });
    },
    [sortDescriptors]
  );

  const rows = useMemo(() => {
    const allRows: SpeciesRow[] = [];
    for (const group of groupedSpecies) {
      for (const code of group.speciesCodes) {
        const species = SPECIES_MAP[code];
        allRows.push({
          groupName: group.name,
          code,
          englishName: species?.speciesDescriptionMBO ?? species?.speciesDescriptionCMMN ?? "Unknown",
          frenchName: species?.speciesFrench ?? "Unknown",
          totalCaptures: speciesInfoMap[code]?.totalCaptures ?? 0,
          dummiestCount: speciesInfoMap[code]?.dummiestCount ?? 0,
          oldestSpanDays: speciesInfoMap[code]?.oldestSpanDays ?? -1,
        });
      }
    }
    return allRows;
  }, [groupedSpecies, speciesInfoMap]);

  return (
    <div className="px-8 py-8">
      <div className="mx-auto max-w-7xl">
        <div className="mb-8">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <h1 className="text-3xl font-semibold text-default-900">Species Catalog</h1>
            {sortDescriptors.length > 0 && (
              <button
                type="button"
                onClick={handleResetSort}
                className="text-sm font-medium text-primary hover:text-primary-600"
              >
                Reset sort
              </button>
            )}
          </div>
        </div>

        <div className="pb-[200px]">
          <div className="overflow-hidden rounded-medium border border-default-200">
            <Table
              aria-label="species catalog table"
              sortDescriptor={sortDescriptors[0]}
              onSortChange={handleSortChange}
              selectionMode="single"
              classNames={{
                wrapper: "shadow-none",
                th: "bg-default-100 text-xs font-semibold uppercase tracking-wide text-default-600",
                td: "text-sm select-text",
              }}
            >
              <TableHeader<ColumnType> columns={SPECIES_COLUMNS}>
                {(column) => (
                  <TableColumn
                    key={column.key}
                    allowsSorting
                    className={`${column.align === "end" ? "text-right" : ""} ${column.key === "groupName" ? "whitespace-nowrap" : ""
                      }`}
                  >
                    {column.label}
                  </TableColumn>
                )}
              </TableHeader>
              <TableBody items={sortRows(rows)} emptyContent="No species found">
                {(item) => (
                  <TableRow key={item.code} onClick={() => handleRowClick(item.code)} className="cursor-pointer">
                    {(columnKey) => {
                      const value = item[columnKey as keyof SpeciesRow];
                      if (columnKey === "code") {
                        return <TableCell className="font-mono text-default-900">{value}</TableCell>;
                      }
                      if (columnKey === "groupName") {
                        return <TableCell className="text-default-900 whitespace-nowrap">{value}</TableCell>;
                      }
                      if (columnKey === "oldestSpanDays") {
                        const numValue = typeof value === "number" ? value : Number(value) || -1;
                        return (
                          <TableCell className="text-right tabular-nums text-default-900 whitespace-nowrap">
                            {formatSpanDays(numValue)}
                          </TableCell>
                        );
                      }
                      if (typeof value === "number") {
                        return <TableCell className="text-right tabular-nums text-default-900">{value}</TableCell>;
                      }
                      return <TableCell className="text-default-900">{value}</TableCell>;
                    }}
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </div>
      </div>

      {selectedSpeciesCode && (
        <SpeciesInfoModal isOpen={isModalOpen} onOpenChange={handleModalOpenChange} speciesCode={selectedSpeciesCode} />
      )}
    </div>
  );
}
