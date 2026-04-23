import { Table, TableBody, TableCell, TableColumn, TableHeader, TableRow, Input, Button } from "@heroui/react";
import { useMemo, useRef, useState } from "react";
import { useData } from "../../services/useData";
import { useCascadingSort, cascadingSort } from "../../hooks/useCascadingSort";
import { useRemainingHeight } from "../../hooks/useRemainingHeight";
import ModalShell, { ModalBodyShell, ModalFooterShell, ModalHeaderShell } from "../Modals/ModalShell";
import { modalInputProps, modalCancelButtonProps, modalPrimaryButtonProps } from "../Modals/modalDefaults";
import BirdEventsTable from "./Programs/Captures/BirdEventsTable";
import PageHeader from "./PageHeader";
import type { BirdEvent } from "../../types";

type Row = {
  bandGroupId: string;
  bandsUsed: number;
  used: string;
  lastUsedDate: string;
  available: string;
  note: string;
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
  { key: "lastUsedDate" as const, label: "Last Used", type: "string" as const, width: 200 },
  { key: "used" as const, label: "Used", type: "string" as const, width: 200 },
  { key: "available" as const, label: "Available", type: "string" as const, width: 200 },
  { key: "note" as const, label: "Note", type: "string" as const },
];

const numericColumns = new Set<string>();

export default function Bands() {
  const { bandGroupsMap, birdEventsMap, bandGroupNotesMap, updateBandGroupNote, isLoggedIn, isOnline } = useData();
  const { sortDescriptors, handleSortChange, resetSort } = useCascadingSort([
    { column: "lastUsedDate", direction: "descending" },
  ]);
  const [search, setSearch] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingNote, setEditingNote] = useState("");
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [selectedBandGroupId, setSelectedBandGroupId] = useState<string | null>(null);
  const tableRef = useRef<HTMLDivElement>(null);
  const tableHeight = useRemainingHeight(tableRef);

  const selectedBandGroupEvents = useMemo<BirdEvent[]>(() => {
    if (!selectedBandGroupId) return [];
    const bg = bandGroupsMap[selectedBandGroupId];
    if (!bg) return [];
    return bg.newCaptureIds
      .map((id) => birdEventsMap[id])
      .filter(Boolean) as BirdEvent[];
  }, [selectedBandGroupId, bandGroupsMap, birdEventsMap]);

  const rows = useMemo<Row[]>(() => {
    const result: Row[] = [];

    for (const [bgKey, bg] of Object.entries(bandGroupsMap)) {
      const usedDigits = new Set<string>();
      let lastDate = "";

      for (const eventId of bg.newCaptureIds) {
        const ev = birdEventsMap[eventId];
        if (!ev) continue;
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
      });
    }

    if (search) {
      const q = search.toLowerCase();
      return result.filter(
        (r) => r.bandGroupId.includes(q) || r.note.toLowerCase().includes(q)
      );
    }

    return result;
  }, [bandGroupsMap, birdEventsMap, bandGroupNotesMap, search]);

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
                      return (
                        <TableCell className="font-mono">
                          {item.bandsUsed === 100 ? "All" : item.used}
                        </TableCell>
                      );
                    }
                    if (columnKey === "available") {
                      return (
                        <TableCell className="font-mono">
                          {item.available || "-"}
                        </TableCell>
                      );
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
                if (editingId) updateBandGroupNote(editingId, editingNote);
                setIsEditModalOpen(false);
              }
            }}
          />
        </ModalBodyShell>
        <ModalFooterShell>
          <Button {...modalCancelButtonProps} onPress={() => setIsEditModalOpen(false)}>
            Cancel
          </Button>
          <Button
            {...modalPrimaryButtonProps}
            onPress={() => {
              if (editingId) updateBandGroupNote(editingId, editingNote);
              setIsEditModalOpen(false);
            }}
          >
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
          <span className="text-sm font-normal text-default-500 ml-2">
            {selectedBandGroupEvents.length} banded
          </span>
        </ModalHeaderShell>
        <ModalBodyShell>
          <BirdEventsTable
            birdEvents={selectedBandGroupEvents}
            maxTableHeight={500}
            allowInspectBandId
          />
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
