import { Table, TableBody, TableCell, TableColumn, TableHeader, TableRow, Input, Button } from "@heroui/react";
import { useMemo, useRef, useState } from "react";
import { useData } from "../../services/useData";
import { useCascadingSort, cascadingSort } from "../../hooks/useCascadingSort";
import { useRemainingHeight } from "../../hooks/useRemainingHeight";
import ModalShell, { ModalBodyShell, ModalFooterShell, ModalHeaderShell } from "../Modals/ModalShell";
import { modalInputProps, modalCancelButtonProps, modalPrimaryButtonProps } from "../Modals/modalDefaults";
import SpeciesTooltip from "../Helper/Info/SpeciesTooltip";
import ExportButton from "../Helper/ExportButton";
import { BirdEventType, type BirdEvent } from "../../types";
import PageHeader from "./PageHeader";

type Row = {
  code: string;
  fullName: string;
  totalBanded: number;
  totalScribed: number;
};

const COLUMNS = [
  { key: "code" as const, label: "Code", type: "string" as const, width: 100 },
  { key: "fullName" as const, label: "Full Name", type: "string" as const, width: 300 },
  { key: "totalBanded" as const, label: "Banded", type: "number" as const, align: "end" as const, width: 150 },
  { key: "totalScribed" as const, label: "Scribed", type: "number" as const, align: "end" as const, width: 150 },
];

const numericColumns = new Set<string>(COLUMNS.filter((c) => c.type === "number").map((c) => c.key));

type BreakdownRole = "banded" | "scribed";

export default function Volunteers() {
  const { volunteersMap, birdEventsMap, isLoggedIn, isOnline, updateVolunteerName } = useData();
  const { sortDescriptors, handleSortChange, resetSort } = useCascadingSort([
    { column: "totalBanded", direction: "descending" },
  ]);
  const [search, setSearch] = useState("");
  const [editingCode, setEditingCode] = useState<string | null>(null);
  const [editingName, setEditingName] = useState("");
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [breakdown, setBreakdown] = useState<{ code: string; role: BreakdownRole } | null>(null);
  const tableRef = useRef<HTMLDivElement>(null);
  const tableHeight = useRemainingHeight(tableRef);

  // Events attributed to the selected volunteer + role. Mirrors the filter
  // used by rebuildMapsFromEvents for totalBanded/totalScribed (skip
  // modifiedEventId so we only keep the current version of each record) so
  // the per-species counts and the exported CSV agree with the total shown
  // in the volunteers table.
  const breakdownEvents = useMemo<BirdEvent[]>(() => {
    if (!breakdown) return [];
    const events: BirdEvent[] = [];
    for (const ev of Object.values(birdEventsMap)) {
      if (!ev || ev.modifiedEventId || !ev.species) continue;
      if (breakdown.role === "banded") {
        const isNewCapture = ev.birdEventType === BirdEventType.Banded || ev.birdEventType === BirdEventType.None;
        if (!isNewCapture || ev.bander !== breakdown.code) continue;
      } else {
        if (ev.scribe !== breakdown.code) continue;
      }
      events.push(ev);
    }
    return events;
  }, [breakdown, birdEventsMap]);

  const breakdownRows = useMemo(() => {
    const counts = new Map<string, number>();
    for (const ev of breakdownEvents) {
      counts.set(ev.species, (counts.get(ev.species) ?? 0) + 1);
    }
    return [...counts.entries()]
      .map(([species, count]) => ({ species, count }))
      .sort((a, b) => b.count - a.count || a.species.localeCompare(b.species));
  }, [breakdownEvents]);

  const rows = useMemo<Row[]>(() => {
    const allRows = Object.values(volunteersMap).map((b) => ({
      code: b.code,
      fullName: b.fullName || "",
      totalBanded: b.totalBanded,
      totalScribed: b.totalScribed,
    }));

    if (search) {
      const q = search.toLowerCase();
      return allRows.filter((r) => r.code.toLowerCase().includes(q) || r.fullName.toLowerCase().includes(q));
    }

    return allRows;
  }, [volunteersMap, search]);

  const sortedRows = useMemo(() => cascadingSort(rows, sortDescriptors, numericColumns), [rows, sortDescriptors]);

  return (
    <div className="h-full w-full max-w-7xl mx-auto flex flex-col pt-4 p-8 gap-4 overflow-hidden">
      <PageHeader
        title="Volunteers"
        subtitle={`${Object.keys(volunteersMap).length} volunteers`}
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
        placeholder="Search by code or name..."
        variant="bordered"
        size="md"
        value={search}
        onValueChange={setSearch}
        className="max-w-xs"
      />

      <div ref={tableRef} className="min-h-0">
        <div className="overflow-hidden rounded-medium border border-default-200">
          <Table
            aria-label="Volunteers table"
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
                <TableColumn
                  key={column.key}
                  allowsSorting
                  className={column.align === "end" ? "text-right" : ""}
                  width={column.width}
                >
                  {column.label}
                </TableColumn>
              )}
            </TableHeader>
            <TableBody items={sortedRows} emptyContent="No volunteer found">
              {(item) => (
                <TableRow key={item.code}>
                  {(columnKey) => {
                    const value = item[columnKey as keyof Row];
                    if (columnKey === "code") {
                      return <TableCell className="font-mono font-bold text-default-900">{value}</TableCell>;
                    }
                    if (columnKey === "fullName") {
                      return (
                        <TableCell
                          className={`text-default-700 ${isLoggedIn && isOnline ? "cursor-pointer hover:text-primary" : ""}`}
                          onClick={(e) => {
                            if (isLoggedIn && isOnline) {
                              e.stopPropagation();
                              setEditingCode(item.code);
                              setEditingName(item.fullName);
                              setIsEditModalOpen(true);
                            }
                          }}
                        >
                          {value || <span className="text-default-400">-</span>}
                        </TableCell>
                      );
                    }
                    if (columnKey === "totalBanded" || columnKey === "totalScribed") {
                      const count = value as number;
                      const role: BreakdownRole = columnKey === "totalBanded" ? "banded" : "scribed";
                      const clickable = count > 0;
                      return (
                        <TableCell
                          className={`text-right tabular-nums text-default-900 ${
                            clickable ? "cursor-pointer hover:text-primary" : ""
                          }`}
                          onClick={
                            clickable
                              ? (e) => {
                                  e.stopPropagation();
                                  setBreakdown({ code: item.code, role });
                                }
                              : undefined
                          }
                        >
                          {count}
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

      <ModalShell
        modalProps={{
          isDismissable: false,
          isOpen: isEditModalOpen,
          onOpenChange: setIsEditModalOpen,
          placement: "top-center",
        }}
      >
        <ModalHeaderShell>
          Edit Full Name for <span className="font-mono">{editingCode}</span>
        </ModalHeaderShell>
        <ModalBodyShell>
          <Input
            label="Full Name"
            placeholder="Enter full name"
            {...modalInputProps}
            value={editingName}
            onValueChange={setEditingName}
            autoFocus
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                if (editingCode) updateVolunteerName(editingCode, editingName);
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
              if (editingCode) updateVolunteerName(editingCode, editingName);
              setIsEditModalOpen(false);
            }}
          >
            Save
          </Button>
        </ModalFooterShell>
      </ModalShell>

      <ModalShell
        modalProps={{
          isDismissable: true,
          isOpen: breakdown !== null,
          onClose: () => setBreakdown(null),
          scrollBehavior: "inside",
          size: "lg",
        }}
      >
        <ModalHeaderShell>
          Species {breakdown?.role === "banded" ? "banded" : "scribed"} by{" "}
          <span className="font-mono">{breakdown?.code}</span>
          {breakdownRows.length > 0 && (
            <span className="text-sm font-normal text-default-500 ml-2">
              {breakdownRows.length} species, {breakdownRows.reduce((s, r) => s + r.count, 0)} total
            </span>
          )}
        </ModalHeaderShell>
        <ModalBodyShell>
          <div className="overflow-hidden rounded-medium border border-default-200">
            <Table
              aria-label={`Species breakdown for ${breakdown?.code ?? ""}`}
              isHeaderSticky
              isVirtualized
              maxTableHeight={500}
              classNames={{
                wrapper: "shadow-none rounded-none",
                th: "bg-default-100 text-xs font-semibold uppercase tracking-wide text-default-600",
                td: "text-sm select-text",
              }}
            >
              <TableHeader>
                <TableColumn key="species">Species</TableColumn>
                <TableColumn key="count" className="text-right">
                  Count
                </TableColumn>
              </TableHeader>
              <TableBody items={breakdownRows} emptyContent="No captures found">
                {(item) => (
                  <TableRow key={item.species}>
                    {(columnKey) => {
                      if (columnKey === "species") {
                        return (
                          <TableCell className="font-mono text-default-900">
                            <SpeciesTooltip speciesCode={item.species} />
                          </TableCell>
                        );
                      }
                      return <TableCell className="text-right tabular-nums text-default-900">{item.count}</TableCell>;
                    }}
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </ModalBodyShell>
        <ModalFooterShell>
          <ExportButton
            birdEvents={breakdownEvents}
            filename={
              breakdown
                ? `volunteer-${breakdown.role}-${breakdown.code}-${new Date().toISOString().slice(0, 10)}.csv`
                : "volunteer.csv"
            }
          />
          <Button {...modalPrimaryButtonProps} onPress={() => setBreakdown(null)}>
            Close
          </Button>
        </ModalFooterShell>
      </ModalShell>
    </div>
  );
}
