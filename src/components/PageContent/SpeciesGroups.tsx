import {
  Button,
  Input,
  Table,
  TableBody,
  TableCell,
  TableColumn,
  TableHeader,
  TableRow,
  Tab,
  Tabs,
} from "@heroui/react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useRemainingHeight } from "../../hooks/useRemainingHeight";
import { SPECIES_GROUPS } from "../../types/DET";
import { showPersistentErrorToast } from "../../utils/toast";
import { getSpeciesDisplayCode, getSpeciesWithOverrides, SPECIES_MAP } from "../../types/species";
import { useActions, useAppStore } from "../../stores/useAppStore";
import { formatSpanDays } from "../Helper/Info/formatSpanDays";
import SpeciesInfoModal from "../Modals/SpeciesInfoModal";
import SpeciesAliasesModal from "../Modals/SpeciesAliasesModal";
import SpeciesTooltip from "../Helper/Info/SpeciesTooltip";
import PageHeader from "./PageHeader";
import { useCascadingSort, cascadingSort } from "../../hooks/useCascadingSort";
import ModalShell, { ModalBodyShell, ModalFooterShell, ModalHeaderShell } from "../Modals/ModalShell";
import { modalCancelButtonProps, modalInputProps, modalPrimaryButtonProps } from "../Modals/modalDefaults";

type SpeciesGroup = {
  name: string;
  speciesCodes: string[];
};

type DetRow = {
  speciesKey: string;
  groupName: string;
  code: string;
  englishName: string;
  frenchName: string;
  totalCaptures: number;
  dummiestCount: number;
  oldestSpanDays: number;
};

type PyleRow = {
  speciesKey: string;
  code: string;
  englishName: string;
  frenchName: string;
  totalCaptures: number;
  dummiestCount: number;
  oldestSpanDays: number;
};

type ColumnType<T> = {
  key: keyof T | "actions";
  label: string;
  type: "string" | "number" | "actions";
  align?: "end";
  width?: number;
};

const DET_COLUMNS: ColumnType<DetRow>[] = [
  { key: "groupName", label: "Group", type: "string", width: 200 },
  { key: "code", label: "Code", type: "string", width: 100 },
  { key: "englishName", label: "English Name", type: "string", width: 240 },
  { key: "totalCaptures", label: "Total Captures", type: "number", align: "end", width: 100 },
  { key: "dummiestCount", label: "Dummiest Count", type: "number", align: "end", width: 100 },
  { key: "oldestSpanDays", label: "Oldest Span", type: "number", align: "end", width: 150 },
  { key: "actions", label: "Actions", type: "actions", align: "end", width: 110 },
];

const PYLE_COLUMNS: ColumnType<PyleRow>[] = [
  { key: "code", label: "Code", type: "string", width: 90 },
  { key: "englishName", label: "English Name", type: "string", width: 260 },
  { key: "totalCaptures", label: "Total Captures", type: "number", align: "end", width: 110 },
  { key: "dummiestCount", label: "Dummiest Count", type: "number", align: "end", width: 120 },
  { key: "oldestSpanDays", label: "Oldest Span", type: "number", align: "end", width: 130 },
  { key: "actions", label: "Actions", type: "actions", align: "end", width: 110 },
];

export default function SpeciesGroups() {
  const speciesInfoMap = useAppStore((s) => s.speciesInfoMap);
  const speciesAliasesMap = useAppStore((s) => s.speciesAliasesMap);
  const speciesOverridesMap = useAppStore((s) => s.speciesOverridesMap);
  const user = useAppStore((s) => s.user);
  const isOnline = useAppStore((s) => s.isOnline);
  const [selectedSpeciesCode, setSelectedSpeciesCode] = useState<string | null>(null);
  const [editingSpeciesCode, setEditingSpeciesCode] = useState<string | null>(null);
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
        const species = getSpeciesWithOverrides(code, speciesOverridesMap);
        allRows.push({
          speciesKey: code,
          groupName: group.name,
          code: getSpeciesDisplayCode(code, speciesAliasesMap),
          englishName: species?.speciesDescriptionMBO ?? species?.speciesDescriptionCMMN ?? "Unknown",
          frenchName: species?.speciesFrench ?? "Unknown",
          totalCaptures: speciesInfoMap[code]?.totalCaptures ?? 0,
          dummiestCount: speciesInfoMap[code]?.dummiestCount ?? 0,
          oldestSpanDays: speciesInfoMap[code]?.oldestSpanDays ?? -1,
        });
      }
    }
    return allRows;
  }, [groupedSpecies, speciesAliasesMap, speciesInfoMap, speciesOverridesMap]);

  const pyleRows = useMemo<PyleRow[]>(() => {
    const rows: PyleRow[] = [];
    for (const [code, species] of Object.entries(SPECIES_MAP)) {
      const overriddenSpecies = getSpeciesWithOverrides(code, speciesOverridesMap) ?? species;
      const englishName = overriddenSpecies.speciesDescriptionMBO || overriddenSpecies.speciesDescriptionCMMN;
      if (!englishName) continue;
      rows.push({
        speciesKey: code,
        code: getSpeciesDisplayCode(code, speciesAliasesMap),
        englishName,
        frenchName: overriddenSpecies.speciesFrench || "Unknown",
        totalCaptures: speciesInfoMap[code]?.totalCaptures ?? 0,
        dummiestCount: speciesInfoMap[code]?.dummiestCount ?? 0,
        oldestSpanDays: speciesInfoMap[code]?.oldestSpanDays ?? -1,
      });
    }
    return rows;
  }, [speciesAliasesMap, speciesInfoMap, speciesOverridesMap]);

  const renderEditButton = (code: string) => (
    <Button
      size="sm"
      variant="flat"
      color="primary"
      isDisabled={!user || !isOnline}
      onPress={() => setEditingSpeciesCode(code)}
    >
      Edit
    </Button>
  );

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
          All aliases
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
              onRowAction={(key) => handleRowClick(String(key))}
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
                    allowsSorting={column.key !== "actions"}
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
                  <TableRow key={item.speciesKey} className="cursor-pointer">
                    {(columnKey) => {
                      if (columnKey === "actions") {
                        return (
                          <TableCell className="text-right" onClick={(event) => event.stopPropagation()}>
                            {renderEditButton(item.speciesKey)}
                          </TableCell>
                        );
                      }
                      const value = item[columnKey as keyof DetRow];
                      if (columnKey === "code") {
                        return (
                          <TableCell className="font-mono text-default-900">
                            <SpeciesTooltip speciesCode={item.speciesKey}>{String(value)}</SpeciesTooltip>
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
              onRowAction={(key) => handleRowClick(String(key))}
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
                    allowsSorting={column.key !== "actions"}
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
                  <TableRow key={item.speciesKey} className="cursor-pointer">
                    {(columnKey) => {
                      if (columnKey === "actions") {
                        return (
                          <TableCell className="text-right" onClick={(event) => event.stopPropagation()}>
                            {renderEditButton(item.speciesKey)}
                          </TableCell>
                        );
                      }
                      const value = item[columnKey as keyof PyleRow];
                      if (columnKey === "code") {
                        return (
                          <TableCell height={50} className="font-mono text-default-900">
                            <SpeciesTooltip speciesCode={item.speciesKey}>{String(value)}</SpeciesTooltip>
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
      <SpeciesMetadataModal
        speciesCode={editingSpeciesCode}
        isOpen={!!editingSpeciesCode}
        onOpenChange={(open) => {
          if (!open) setEditingSpeciesCode(null);
        }}
      />
    </div>
  );
}

function SpeciesMetadataModal({
  speciesCode,
  isOpen,
  onOpenChange,
}: {
  speciesCode: string | null;
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const speciesAliasesMap = useAppStore((s) => s.speciesAliasesMap);
  const speciesOverridesMap = useAppStore((s) => s.speciesOverridesMap);
  const user = useAppStore((s) => s.user);
  const isOnline = useAppStore((s) => s.isOnline);
  const { updateSpeciesMetadata } = useActions();
  const species = speciesCode ? SPECIES_MAP[speciesCode] : null;
  const override = speciesCode ? speciesOverridesMap[speciesCode] : undefined;
  const currentAlias = speciesCode ? speciesAliasesMap[speciesCode] : undefined;
  const baseEnglishName = species?.speciesDescriptionMBO || species?.speciesDescriptionCMMN || "";
  const baseFrenchName = species?.speciesFrench || "";
  const baseScientificName = species?.speciesScientific || "";
  const [aliasCode, setAliasCode] = useState("");
  const [englishName, setEnglishName] = useState("");
  const [frenchName, setFrenchName] = useState("");
  const [scientificName, setScientificName] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const canEdit = !!user && isOnline;

  useEffect(() => {
    if (!speciesCode || !species) return;
    setAliasCode("");
    setEnglishName(override?.speciesDescriptionMBO ?? baseEnglishName);
    setFrenchName(override?.speciesFrench ?? baseFrenchName);
    setScientificName(override?.speciesScientific ?? baseScientificName);
  }, [baseEnglishName, baseFrenchName, baseScientificName, override, species, speciesCode]);

  if (!speciesCode || !species) return null;

  const normalizedAlias = aliasCode.trim().toUpperCase();

  const handleSave = async () => {
    if (!canEdit || isSaving) return;
    setIsSaving(true);
    try {
      await updateSpeciesMetadata(speciesCode, normalizedAlias || currentAlias || null, {
        speciesDescriptionMBO: englishName.trim() === baseEnglishName ? undefined : englishName,
        speciesDescriptionCMMN: englishName.trim() === baseEnglishName ? undefined : englishName,
        speciesFrench: frenchName.trim() === baseFrenchName ? undefined : frenchName,
        speciesScientific: scientificName.trim() === baseScientificName ? undefined : scientificName,
      });
      onOpenChange(false);
    } catch (err) {
      showPersistentErrorToast("Could not save species", err, "Unknown error");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <ModalShell
      modalProps={{
        isDismissable: false,
        isOpen,
        onOpenChange,
        placement: "top-center",
        size: "2xl",
      }}
    >
      {(onClose) => (
        <>
          <ModalHeaderShell>
            Edit Species <span className="font-mono">{speciesCode}</span>
          </ModalHeaderShell>
          <ModalBodyShell>
            <div className="grid grid-cols-1 gap-4">
              <Input {...modalInputProps} label="Current Code" value={speciesCode} isReadOnly />
              <Input
                {...modalInputProps}
                label="New Code"
                placeholder={currentAlias ? `Current alias: ${currentAlias}` : "Enter 4-letter code"}
                maxLength={4}
                value={aliasCode}
                autoFocus
                onChange={(event) =>
                  setAliasCode(
                    event.target.value
                      .replace(/[^a-zA-Z]/g, "")
                      .toUpperCase()
                      .slice(0, 4)
                  )
                }
                isDisabled={!canEdit || isSaving}
              />
              <Input
                {...modalInputProps}
                label="English Name"
                value={englishName}
                onValueChange={setEnglishName}
                isDisabled={!canEdit || isSaving}
              />
              <Input
                {...modalInputProps}
                label="French Name"
                value={frenchName}
                onValueChange={setFrenchName}
                isDisabled={!canEdit || isSaving}
              />
              <Input
                {...modalInputProps}
                label="Scientific Name"
                value={scientificName}
                onValueChange={setScientificName}
                isDisabled={!canEdit || isSaving}
              />
            </div>
          </ModalBodyShell>
          <ModalFooterShell>
            <Button {...modalCancelButtonProps} onPress={onClose} isDisabled={isSaving}>
              Cancel
            </Button>
            <Button {...modalPrimaryButtonProps} onPress={handleSave} isLoading={isSaving} isDisabled={!canEdit}>
              Save
            </Button>
          </ModalFooterShell>
        </>
      )}
    </ModalShell>
  );
}
