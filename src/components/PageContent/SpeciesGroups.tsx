import { Table, TableBody, TableCell, TableColumn, TableHeader, TableRow } from "@heroui/react";
import { useMemo, useRef, useState } from "react";
import { useRemainingHeight } from "../../hooks/useRemainingHeight";
import { SPECIES_GROUPS } from "../../types/DET";
import { SPECIES_MAP } from "../../types/species";
import { useData } from "../../services/useData";
import { formatSpanDays } from "../Helper/Info/formatSpanDays";
import SpeciesInfoModal from "../Modals/SpeciesInfoModal";
import PageHeader from "./PageHeader";
import { useCascadingSort, cascadingSort } from "../../hooks/useCascadingSort";

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
  width?: number;
};

const SPECIES_COLUMNS: ColumnType[] = [
  { key: "groupName", label: "Group", type: "string", width: 200 },
  { key: "code", label: "Code", type: "string", width: 100 },
  { key: "englishName", label: "English", type: "string", width: 150 },
  { key: "frenchName", label: "French", type: "string", width: 150 },
  { key: "totalCaptures", label: "Total Captures", type: "number", align: "end", width: 100 },
  { key: "dummiestCount", label: "Dummiest Count", type: "number", align: "end", width: 100 },
  { key: "oldestSpanDays", label: "Oldest Span", type: "number", align: "end", width: 150 },
];

export default function SpeciesGroups() {
  const { speciesInfoMap } = useData();
  const [selectedSpeciesCode, setSelectedSpeciesCode] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const { sortDescriptors, handleSortChange, resetSort } = useCascadingSort();
  const tableRef = useRef<HTMLDivElement>(null);
  const tableHeight = useRemainingHeight(tableRef);

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

  const numericColumns = useMemo(
    () => new Set<string>(SPECIES_COLUMNS.filter((col) => col.type === "number").map((col) => col.key)),
    []
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
    <div className="h-full w-full max-w-7xl mx-auto flex flex-col pt-4 p-8 gap-4">
      <div className="w-full">
        <PageHeader
          title="Species Catalog"
          subtitle="Browse species grouped by the DET classification table."
          actions={
            sortDescriptors.length > 0 ? (
              <button
                type="button"
                onClick={resetSort}
                className="text-sm font-medium text-primary hover:text-primary-600"
              >
                Reset sort
              </button>
            ) : null
          }
        />
      </div>

      <div ref={tableRef} className="min-h-0">
        <div className="overflow-hidden rounded-medium border border-default-200">
          <Table
            aria-label="species catalog table"
            isVirtualized
            maxTableHeight={tableHeight}
            sortDescriptor={sortDescriptors[0]}
            onSortChange={handleSortChange}
            selectionMode="single"
            classNames={{
              wrapper: "shadow-none",
              base: "table-fixed",
              table: "table-fixed",
              th: "bg-default-100 text-xs font-semibold uppercase tracking-wide text-default-600",
              td: "text-sm select-text",
            }}
          >
            <TableHeader<ColumnType> columns={SPECIES_COLUMNS}>
              {(column) => (
                <TableColumn
                  key={column.key}
                  allowsSorting
                  width={column.width}
                  className={`${column.align === "end" ? "text-right" : ""}`}
                >
                  {column.label}
                </TableColumn>
              )}
            </TableHeader>
            <TableBody items={cascadingSort(rows, sortDescriptors, numericColumns)} emptyContent="No species found">
              {(item) => (
                <TableRow key={item.code} onClick={() => handleRowClick(item.code)} className="cursor-pointer">
                  {(columnKey) => {
                    const value = item[columnKey as keyof SpeciesRow];
                    if (columnKey === "code") {
                      return (
                        <TableCell height={50} className="font-mono text-default-900">
                          {value}
                        </TableCell>
                      );
                    }
                    if (columnKey === "groupName") {
                      return <TableCell className="text-default-900 whitespace-normal break-words">{value}</TableCell>;
                    }
                    if (columnKey === "oldestSpanDays") {
                      const numValue = typeof value === "number" ? value : Number(value) || -1;
                      return (
                        <TableCell className="text-right tabular-nums text-default-900 whitespace-nowrap">
                          {formatSpanDays(numValue, true)}
                        </TableCell>
                      );
                    }
                    if (typeof value === "number") {
                      return <TableCell className="text-right tabular-nums text-default-900">{value}</TableCell>;
                    }
                    return <TableCell className="text-default-900 whitespace-normal break-words">{value}</TableCell>;
                  }}
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </div>

      {selectedSpeciesCode && (
        <SpeciesInfoModal isOpen={isModalOpen} onOpenChange={handleModalOpenChange} speciesCode={selectedSpeciesCode} />
      )}
    </div>
  );
}
