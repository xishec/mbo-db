import {
  Table,
  TableBody,
  TableCell,
  TableColumn,
  TableHeader,
  TableRow,
  Input,
  Button,
  Select,
  SelectItem,
} from "@heroui/react";
import { useMemo, useRef, useState } from "react";
import { useAppStore, useActions, useIsLoggedIn } from "../../stores/useAppStore";
import { birdEventsStore, useBirdEventsVersion } from "../../services/birdEventsStore";
import { useCascadingSort, cascadingSort } from "../../hooks/useCascadingSort";
import { useRemainingHeight } from "../../hooks/useRemainingHeight";
import ModalShell, { ModalBodyShell, ModalFooterShell, ModalHeaderShell } from "../Modals/ModalShell";
import { modalInputProps, modalCancelButtonProps, modalPrimaryButtonProps } from "../Modals/modalDefaults";
import BirdEventsTable from "./Programs/Captures/BirdEventsTable";
import PageHeader from "./PageHeader";
import { BandSize, BirdEventType, getBandGroupMapKey, type BirdEvent } from "../../types";
import { isActiveBirdEvent } from "../../stores/derive";
import { showPersistentErrorToast } from "../../utils/toast";

type Row = {
  bandGroupId: string;
  bandsUsed: number;
  used: string;
  lastUsedDate: string;
  available: string;
  note: string;
  bandSize: BandSize | null;
};

type BandSizeSummaryRow = {
  bandSize: string;
  total: number;
  programCounts: Record<string, number>;
};

type ProgramBandUsageRow = {
  id: string;
  program: string;
  counts: Record<string, number>;
};

function pad(n: number): string {
  return (n % 100).toString().padStart(2, "0");
}

// Band order: 01-99, then 00 (represented as 100 internally)
const ALL_DIGITS = [...Array.from({ length: 99 }, (_, i) => i + 1), 100];

function formatRanges(digits: number[]): string {
  if (digits.length === 0) return "";
  const ranges: string[] = [];
  let start = digits[0];
  let end = digits[0];
  for (let i = 1; i < digits.length; i++) {
    if (digits[i] === end + 1) {
      end = digits[i];
    } else {
      ranges.push(start === end ? pad(start) : `${pad(start)}-${pad(end)}`);
      start = digits[i];
      end = digits[i];
    }
  }
  ranges.push(start === end ? pad(start) : `${pad(start)}-${pad(end)}`);
  return ranges.join(", ");
}

function formatUsedAndAvailable(usedDigits: Set<string>) {
  const usedNums = ALL_DIGITS.filter((n) => usedDigits.has(pad(n)));
  const availNums = ALL_DIGITS.filter((n) => !usedDigits.has(pad(n)));
  return { used: formatRanges(usedNums), available: formatRanges(availNums) };
}

const COLUMNS = [
  { key: "bandGroupId" as const, label: "Band Group", type: "string" as const, width: 200 },
  { key: "bandSize" as const, label: "Size", type: "string" as const, width: 100 },
  { key: "lastUsedDate" as const, label: "Last Used", type: "string" as const, width: 200 },
  { key: "used" as const, label: "Used", type: "string" as const, width: 200 },
  { key: "available" as const, label: "Available", type: "string" as const, width: 200 },
  { key: "note" as const, label: "Note", type: "string" as const },
];

const numericColumns = new Set<string>();
function formatBandSize(size: BandSize): string {
  return size === BandSize.Other ? "Other" : size.toUpperCase();
}

export default function Bands() {
  const bandGroupsMap = useAppStore((s) => s.bandGroupsMap);
  const bandGroupNotesMap = useAppStore((s) => s.bandGroupNotesMap);
  const bandGroupSizesMap = useAppStore((s) => s.bandGroupSizesMap);
  const programsMap = useAppStore((s) => s.programsMap);
  const isOnline = useAppStore((s) => s.isOnline);
  const isLoggedIn = useIsLoggedIn();
  const { updateBandGroupNote, updateBandGroupSize } = useActions();
  const birdEventsVersion = useBirdEventsVersion();
  const bandResetsMap = useAppStore((s) => s.bandResetsMap);
  const { sortDescriptors, handleSortChange, resetSort } = useCascadingSort([
    { column: "lastUsedDate", direction: "descending" },
  ]);
  const [search, setSearch] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingNote, setEditingNote] = useState("");
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isSavingNote, setIsSavingNote] = useState(false);
  const [selectedBandGroupId, setSelectedBandGroupId] = useState<string | null>(null);
  const [selectedProgramIds, setSelectedProgramIds] = useState<Set<string>>(new Set());
  const tableRef = useRef<HTMLDivElement>(null);
  const tableHeight = useRemainingHeight(tableRef);

  const programOptions = useMemo(
    () =>
      Object.values(programsMap).sort(
        (a, b) =>
          b.endDate?.localeCompare(a.endDate ?? "") ||
          b.startDate?.localeCompare(a.startDate ?? "") ||
          a.id.localeCompare(b.id)
      ),
    [programsMap]
  );

  const selectedPrograms = useMemo(
    () => programOptions.filter((program) => selectedProgramIds.has(program.id)),
    [programOptions, selectedProgramIds]
  );

  const bandSizeSummaryRows = useMemo<BandSizeSummaryRow[]>(() => {
    const counts = new Map<BandSize | "unrecorded", { total: number; programCounts: Record<string, number> }>();

    for (const event of birdEventsStore.getAll().values()) {
      if (!isActiveBirdEvent(event, bandResetsMap) || event.birdEventType !== BirdEventType.Banded) continue;
      if (selectedProgramIds.size > 0 && !selectedProgramIds.has(event.programId)) continue;

      const size = bandGroupSizesMap[getBandGroupMapKey(event.band)] ?? "unrecorded";
      const count = counts.get(size) ?? { total: 0, programCounts: {} };
      count.total += 1;
      if (selectedProgramIds.size > 0) {
        count.programCounts[event.programId] = (count.programCounts[event.programId] ?? 0) + 1;
      }
      counts.set(size, count);
    }

    const rows = Object.values(BandSize).map((size) => ({
      bandSize: formatBandSize(size),
      total: counts.get(size)?.total ?? 0,
      programCounts: counts.get(size)?.programCounts ?? {},
    }));
    const unrecorded = counts.get("unrecorded");
    if (unrecorded) {
      rows.push({ bandSize: "Not recorded", total: unrecorded.total, programCounts: unrecorded.programCounts });
    }
    return rows;
    // birdEventsVersion is the store's change signal for this derived summary.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [birdEventsVersion, bandResetsMap, selectedProgramIds, bandGroupSizesMap]);

  const bandSizeSummaryColumns = [
    { key: "program", label: "Program" },
    ...Object.values(BandSize).map((size) => ({ key: size, label: formatBandSize(size) })),
    ...(bandSizeSummaryRows.some((row) => row.bandSize === "Not recorded")
      ? [{ key: "unrecorded", label: "Not recorded" }]
      : []),
  ];

  const programBandUsageRows = useMemo<ProgramBandUsageRow[]>(() => {
    const totalCounts = Object.fromEntries(
      bandSizeSummaryRows.map((row) => [
        row.bandSize === "Not recorded" ? "unrecorded" : row.bandSize.toLowerCase(),
        row.total,
      ])
    );

    if (selectedPrograms.length === 0) {
      return [{ id: "all", program: "All programs", counts: totalCounts }];
    }

    return [
      { id: "total", program: "Total selected", counts: totalCounts },
      ...selectedPrograms.map((program) => ({
        id: program.id,
        program: program.displayName || program.id,
        counts: Object.fromEntries(
          bandSizeSummaryRows.map((row) => [
            row.bandSize === "Not recorded" ? "unrecorded" : row.bandSize.toLowerCase(),
            row.programCounts[program.id] ?? 0,
          ])
        ),
      })),
    ];
  }, [bandSizeSummaryRows, selectedPrograms]);

  const handleSaveNote = async () => {
    if (!editingId || isSavingNote) return;
    setIsSavingNote(true);
    try {
      await updateBandGroupNote(editingId, editingNote);
      setIsEditModalOpen(false);
    } catch (err) {
      showPersistentErrorToast("Note save failed", err, "Please try again.");
    } finally {
      setIsSavingNote(false);
    }
  };

  const selectedBandGroupEvents = useMemo<BirdEvent[]>(() => {
    if (!selectedBandGroupId) return [];
    const bg = bandGroupsMap[selectedBandGroupId];
    if (!bg) return [];
    return bg.newCaptureIds
      .map((id) => birdEventsStore.get(id))
      .filter((ev): ev is BirdEvent => !!ev && isActiveBirdEvent(ev, bandResetsMap));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedBandGroupId, bandGroupsMap, birdEventsVersion, bandResetsMap]);

  const rows = useMemo<Row[]>(() => {
    const result: Row[] = [];

    for (const [bgKey, bg] of Object.entries(bandGroupsMap)) {
      const usedDigits = new Set<string>();
      let lastDate = "";

      for (const eventId of bg.newCaptureIds) {
        const ev = birdEventsStore.get(eventId);
        if (!ev || !isActiveBirdEvent(ev, bandResetsMap)) continue;
        usedDigits.add(ev.band.last2digits);
        if (ev.date > lastDate) lastDate = ev.date;
      }

      const bandsUsed = usedDigits.size;
      const { used, available } = formatUsedAndAvailable(usedDigits);

      result.push({
        bandGroupId: bgKey,
        bandsUsed,
        used,
        lastUsedDate: lastDate,
        available,
        note: bandGroupNotesMap[bgKey] ?? "",
        bandSize: bandGroupSizesMap[bgKey] ?? null,
      });
    }

    if (search) {
      const q = search.toLowerCase();
      return result.filter((r) => r.bandGroupId.includes(q) || r.note.toLowerCase().includes(q));
    }

    return result;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bandGroupsMap, birdEventsVersion, bandGroupNotesMap, bandGroupSizesMap, search, bandResetsMap]);

  const sortedRows = useMemo(() => cascadingSort(rows, sortDescriptors, numericColumns), [rows, sortDescriptors]);

  return (
    <div className="h-full w-full max-w-7xl mx-auto flex flex-col pt-4 p-8 gap-4 overflow-hidden">
      <PageHeader
        title="Bands"
        subtitle={`${Object.keys(bandGroupsMap).length} band groups`}
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

      <div className="flex flex-col gap-4">
        <Select
          aria-label="Programs to include"
          placeholder="All programs"
          selectionMode="multiple"
          variant="bordered"
          selectedKeys={selectedProgramIds}
          onSelectionChange={(keys) => {
            setSelectedProgramIds(
              keys === "all" ? new Set(programOptions.map((program) => program.id)) : new Set(Array.from(keys, String))
            );
          }}
          size="md"
          className="max-w-xs"
          classNames={{ trigger: "min-h-unit-10 h-unit-10", value: "text-sm" }}
        >
          {programOptions.map((program) => (
            <SelectItem key={program.id}>{program.displayName || program.id}</SelectItem>
          ))}
        </Select>

        <div className="overflow-x-auto rounded-medium border border-default-200">
          <Table
            aria-label="Band usage by size"
            classNames={{
              wrapper: "shadow-none",
              th: "bg-default-100 text-xs font-semibold uppercase tracking-wide text-default-600",
              td: "text-sm select-text",
            }}
          >
            <TableHeader columns={bandSizeSummaryColumns}>
              {(column) => <TableColumn key={column.key}>{column.label}</TableColumn>}
            </TableHeader>
            <TableBody items={programBandUsageRows}>
              {(item) => (
                <TableRow key={item.id}>
                  {(columnKey) => {
                    if (columnKey === "program") {
                      return <TableCell className="font-medium text-default-900">{item.program}</TableCell>;
                    }
                    return <TableCell>{item.counts[String(columnKey)] ?? 0}</TableCell>;
                  }}
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </div>

      <Input
        placeholder="Search by band group or note..."
        variant="bordered"
        size="md"
        value={search}
        onValueChange={setSearch}
        className="max-w-xs"
      />

      <div ref={tableRef} className="min-h-0">
        <div className="overflow-hidden rounded-medium border border-default-200">
          <Table
            aria-label="Band groups table"
            isHeaderSticky
            isVirtualized
            maxTableHeight={tableHeight}
            sortDescriptor={sortDescriptors[0]}
            onSortChange={handleSortChange}
            classNames={{
              wrapper: "shadow-none",
              th: "bg-default-100 text-xs font-semibold uppercase tracking-wide text-default-600",
              td: "text-sm select-text",
            }}
          >
            <TableHeader columns={COLUMNS}>
              {(column) => (
                <TableColumn key={column.key} allowsSorting width={column.width}>
                  {column.label}
                </TableColumn>
              )}
            </TableHeader>
            <TableBody items={sortedRows} emptyContent="No band groups found">
              {(item) => (
                <TableRow key={item.bandGroupId}>
                  {(columnKey) => {
                    if (columnKey === "bandGroupId") {
                      return (
                        <TableCell
                          className="font-mono font-bold text-default-900 cursor-pointer hover:text-primary"
                          onClick={() => setSelectedBandGroupId(item.bandGroupId)}
                        >
                          {item.bandGroupId}
                        </TableCell>
                      );
                    }
                    if (columnKey === "used") {
                      return <TableCell className="font-mono">{item.bandsUsed === 100 ? "All" : item.used}</TableCell>;
                    }
                    if (columnKey === "bandSize") {
                      return (
                        <TableCell>
                          <Select
                            aria-label={`Band size for ${item.bandGroupId}`}
                            size="sm"
                            variant="flat"
                            selectedKeys={item.bandSize ? [item.bandSize] : []}
                            placeholder="Not recorded"
                            isDisabled={!isLoggedIn || !isOnline}
                            onSelectionChange={(keys) => {
                              const size = Array.from(keys)[0] as BandSize | undefined;
                              if (size) void updateBandGroupSize(item.bandGroupId, size);
                            }}
                          >
                            {Object.values(BandSize)
                              .filter((size) => size !== BandSize.Other)
                              .map((size) => (
                                <SelectItem key={size}>{formatBandSize(size)}</SelectItem>
                              ))}
                          </Select>
                        </TableCell>
                      );
                    }
                    if (columnKey === "available") {
                      return <TableCell className="font-mono">{item.available || "-"}</TableCell>;
                    }
                    if (columnKey === "note") {
                      return (
                        <TableCell
                          className={`${isLoggedIn && isOnline ? "cursor-pointer hover:text-primary" : ""}`}
                          onClick={(e) => {
                            if (isLoggedIn && isOnline) {
                              e.stopPropagation();
                              setEditingId(item.bandGroupId);
                              setEditingNote(item.note);
                              setIsEditModalOpen(true);
                            }
                          }}
                        >
                          {item.note || <span className="text-default-400">-</span>}
                        </TableCell>
                      );
                    }
                    return <TableCell className="text-default-900">{item[columnKey as keyof Row]}</TableCell>;
                  }}
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </div>

      <ModalShell
        modalProps={{
          isDismissable: false,
          isOpen: isEditModalOpen,
          onOpenChange: setIsEditModalOpen,
          placement: "top-center",
        }}
      >
        <ModalHeaderShell>
          Edit Note for <span className="font-mono">{editingId}</span>
        </ModalHeaderShell>
        <ModalBodyShell>
          <Input
            label="Note"
            placeholder="Enter note"
            {...modalInputProps}
            value={editingNote}
            onValueChange={setEditingNote}
            autoFocus
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                handleSaveNote();
              }
            }}
          />
        </ModalBodyShell>
        <ModalFooterShell>
          <Button {...modalCancelButtonProps} onPress={() => setIsEditModalOpen(false)} isDisabled={isSavingNote}>
            Cancel
          </Button>
          <Button {...modalPrimaryButtonProps} onPress={handleSaveNote} isLoading={isSavingNote}>
            Save
          </Button>
        </ModalFooterShell>
      </ModalShell>

      <ModalShell
        modalProps={{
          isDismissable: false,
          isOpen: selectedBandGroupId !== null,
          onClose: () => setSelectedBandGroupId(null),
          className: "!max-w-[calc(100%-8rem)]",
          scrollBehavior: "inside",
        }}
      >
        <ModalHeaderShell>
          Band Group <span className="font-mono">{selectedBandGroupId}</span>
          <span className="text-sm font-normal text-default-500 ml-2">{selectedBandGroupEvents.length} banded</span>
        </ModalHeaderShell>
        <ModalBodyShell>
          <BirdEventsTable birdEvents={selectedBandGroupEvents} maxTableHeight={500} allowInspectBandId />
        </ModalBodyShell>
        <ModalFooterShell>
          <Button {...modalPrimaryButtonProps} onPress={() => setSelectedBandGroupId(null)}>
            Close
          </Button>
        </ModalFooterShell>
      </ModalShell>
    </div>
  );
}
