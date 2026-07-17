import { Button, Table, TableBody, TableCell, TableColumn, TableHeader, TableRow, Tab, Tabs } from "@heroui/react";
import { useMemo, useRef, useState } from "react";
import { useRemainingHeight } from "../../hooks/useRemainingHeight";
import { SPECIES_GROUPS } from "../../types/DET";
import { SPECIES_MAP } from "../../types/species";
import { useAppStore } from "../../stores/useAppStore";
import { formatSpanDays } from "../Helper/Info/formatSpanDays";
import SpeciesInfoModal from "../Modals/SpeciesInfoModal";
import SpeciesAliasesModal from "../Modals/SpeciesAliasesModal";
import SpeciesTooltip from "../Helper/Info/SpeciesTooltip";
import PageHeader from "./PageHeader";
import { useCascadingSort, cascadingSort } from "../../hooks/useCascadingSort";

type SpeciesGroup = {
  name: string;
  speciesCodes: string[];
};

type DetRow = {
  groupName: string;
  code: string;
  englishName: string;
  frenchName: string;
  totalCaptures: number;
  dummiestCount: number;
  oldestSpanDays: number;
};

type PyleRow = {
  code: string;
  englishName: string;
  frenchName: string;
  totalCaptures: number;
  dummiestCount: number;
  oldestSpanDays: number;
};

type ColumnType<T> = {
  key: keyof T;
  label: string;
  type: "string" | "number";
  align?: "end";
  width?: number;
};

const DET_COLUMNS: ColumnType<DetRow>[] = [
  { key: "groupName", label: "Group", type: "string", width: 200 },
  { key: "code", label: "Code", type: "string", width: 100 },
  { key: "totalCaptures", label: "Total Captures", type: "number", align: "end", width: 100 },
  { key: "dummiestCount", label: "Dummiest Count", type: "number", align: "end", width: 100 },
  { key: "oldestSpanDays", label: "Oldest Span", type: "number", align: "end", width: 150 },
];

const PYLE_COLUMNS: ColumnType<PyleRow>[] = [
  { key: "code", label: "Code", type: "string", width: 90 },
  { key: "totalCaptures", label: "Total Captures", type: "number", align: "end", width: 110 },
  { key: "dummiestCount", label: "Dummiest Count", type: "number", align: "end", width: 120 },
  { key: "oldestSpanDays", label: "Oldest Span", type: "number", align: "end", width: 130 },
];

export default function SpeciesGroups() {
  const speciesInfoMap = useAppStore((s) => s.speciesInfoMap);
  const [selectedSpeciesCode, setSelectedSpeciesCode] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isAliasesModalOpen, setIsAliasesModalOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<"pyle" | "det">("pyle");
  const tableRef = useRef<HTMLDivElement>(null);
  const tableHeight = useRemainingHeight(tableRef);

  const detSort = useCascadingSort();
  const pyleSort = useCascadingSort();

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

  const detNumericColumns = useMemo(
    () => new Set<string>(DET_COLUMNS.filter((col) => col.type === "number").map((col) => col.key as string)),
    []
  );

  const pyleNumericColumns = useMemo(
    () => new Set<string>(PYLE_COLUMNS.filter((col) => col.type === "number").map((col) => col.key as string)),
    []
  );

  const detRows = useMemo(() => {
    const allRows: DetRow[] = [];
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

  const pyleRows = useMemo<PyleRow[]>(() => {
    const rows: PyleRow[] = [];
    for (const [code, species] of Object.entries(SPECIES_MAP)) {
      const englishName = species.speciesDescriptionMBO || species.speciesDescriptionCMMN;
      if (!englishName) continue;
      rows.push({
        code,
        englishName,
        frenchName: species.speciesFrench || "Unknown",
        totalCaptures: speciesInfoMap[code]?.totalCaptures ?? 0,
        dummiestCount: speciesInfoMap[code]?.dummiestCount ?? 0,
        oldestSpanDays: speciesInfoMap[code]?.oldestSpanDays ?? -1,
      });
    }
    return rows;
  }, [speciesInfoMap]);

  const activeSort = activeTab === "det" ? detSort : pyleSort;

  return (
    <div className="h-full w-full max-w-[1400px] mx-auto flex flex-col pt-4 p-8 gap-4">
      <div className="w-full">
        <PageHeader
          title="Species Catalog"
          subtitle="Pyle reference ranges and DET-grouped capture stats."
          actions={
            activeSort.sortDescriptors.length > 0 ? (
              <button
                type="button"
                onClick={activeSort.resetSort}
                className="text-sm font-medium text-primary hover:text-primary-600"
              >
                Reset sort
              </button>
            ) : null
          }
        />
      </div>

      <div className="flex items-center justify-between gap-3">
        <Tabs
          selectedKey={activeTab}
          onSelectionChange={(k) => setActiveTab(k as "pyle" | "det")}
          color="primary"
          size="md"
        >
          <Tab key="pyle" title="Pyle" />
          <Tab key="det" title="DET" />
        </Tabs>
        <Button color="primary" variant="flat" onPress={() => setIsAliasesModalOpen(true)}>
          Edit aliases
        </Button>
      </div>

      <div ref={tableRef} className="min-h-0">
        <div className="overflow-hidden rounded-medium border border-default-200">
          {activeTab === "det" ? (
            <Table
              aria-label="DET species catalog table"
              isHeaderSticky
              isVirtualized
              maxTableHeight={tableHeight}
              sortDescriptor={detSort.sortDescriptors[0]}
              onSortChange={detSort.handleSortChange}
              selectionMode="single"
              classNames={{
                wrapper: "shadow-none",
                base: "table-fixed",
                table: "table-fixed",
                th: "bg-default-100 text-xs font-semibold uppercase tracking-wide text-default-600",
                td: "text-sm select-text",
              }}
            >
              <TableHeader<ColumnType<DetRow>> columns={DET_COLUMNS}>
                {(column) => (
                  <TableColumn
                    key={column.key as string}
                    allowsSorting
                    width={column.width}
                    className={`${column.align === "end" ? "text-right" : ""}`}
                  >
                    {column.label}
                  </TableColumn>
                )}
              </TableHeader>
              <TableBody
                items={cascadingSort(detRows, detSort.sortDescriptors, detNumericColumns)}
                emptyContent="No species found"
              >
                {(item) => (
                  <TableRow key={item.code} onClick={() => handleRowClick(item.code)} className="cursor-pointer">
                    {(columnKey) => {
                      const value = item[columnKey as keyof DetRow];
                      if (columnKey === "code") {
                        return (
                          <TableCell className="font-mono text-default-900">
                            <SpeciesTooltip speciesCode={String(value)}>{value}</SpeciesTooltip>
                          </TableCell>
                        );
                      }
                      if (columnKey === "groupName") {
                        return (
                          <TableCell className="text-default-900 whitespace-normal break-words">{value}</TableCell>
                        );
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
          ) : (
            <Table
              aria-label="Pyle species reference table"
              isHeaderSticky
              isVirtualized
              maxTableHeight={tableHeight}
              sortDescriptor={pyleSort.sortDescriptors[0]}
              onSortChange={pyleSort.handleSortChange}
              selectionMode="single"
              classNames={{
                wrapper: "shadow-none",
                base: "table-fixed",
                table: "table-fixed",
                th: "bg-default-100 text-xs font-semibold uppercase tracking-wide text-default-600",
                td: "text-sm select-text",
              }}
            >
              <TableHeader<ColumnType<PyleRow>> columns={PYLE_COLUMNS}>
                {(column) => (
                  <TableColumn
                    key={column.key as string}
                    allowsSorting
                    width={column.width}
                    className={`${column.align === "end" ? "text-right" : ""}`}
                  >
                    {column.label}
                  </TableColumn>
                )}
              </TableHeader>
              <TableBody
                items={cascadingSort(pyleRows, pyleSort.sortDescriptors, pyleNumericColumns)}
                emptyContent="No Pyle reference data"
              >
                {(item) => (
                  <TableRow key={item.code} onClick={() => handleRowClick(item.code)} className="cursor-pointer">
                    {(columnKey) => {
                      const value = item[columnKey as keyof PyleRow];
                      if (columnKey === "code") {
                        return (
                          <TableCell height={50} className="font-mono text-default-900">
                            <SpeciesTooltip speciesCode={String(value)}>{value}</SpeciesTooltip>
                          </TableCell>
                        );
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
          )}
        </div>
      </div>

      {selectedSpeciesCode && (
        <SpeciesInfoModal isOpen={isModalOpen} onOpenChange={handleModalOpenChange} speciesCode={selectedSpeciesCode} />
      )}
      <SpeciesAliasesModal isOpen={isAliasesModalOpen} onOpenChange={setIsAliasesModalOpen} />
    </div>
  );
}
