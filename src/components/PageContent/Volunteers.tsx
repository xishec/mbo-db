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
import SpeciesTooltip from "../Helper/Info/SpeciesTooltip";
import ExportButton from "../Helper/ExportButton";
import { BirdEventType, type BirdEvent, type ObserverClass } from "../../types";
import { getSpeciesDisplayCode, resolveSpeciesKey } from "../../types/species";
import { getLocalDateString } from "../../utils/dateUtils";
import PageHeader from "./PageHeader";

type Row = {
  code: string;
  fullName: string;
  observerClass: ObserverClass;
  totalBanded: number;
  totalScribed: number;
  totalDays: number;
  daysPast12Months: number;
};

const COLUMNS = [
  { key: "code" as const, label: "Code", type: "string" as const, width: 100 },
  { key: "fullName" as const, label: "Full Name", type: "string" as const, width: 300 },
  {
    key: "observerClass" as const,
    label: "Observer Class",
    type: "number" as const,
    align: "end" as const,
    width: 150,
  },
  { key: "totalBanded" as const, label: "Banded", type: "number" as const, align: "end" as const, width: 150 },
  { key: "totalScribed" as const, label: "Scribed", type: "number" as const, align: "end" as const, width: 150 },
  { key: "totalDays" as const, label: "Total Days", type: "number" as const, align: "end" as const, width: 130 },
  {
    key: "daysPast12Months" as const,
    label: "Past 12 Months",
    type: "number" as const,
    align: "end" as const,
    width: 160,
  },
  { key: "actions" as const, label: "Actions", type: "actions" as const, align: "end" as const, width: 110 },
];

const numericColumns = new Set<string>(COLUMNS.filter((c) => c.type === "number").map((c) => c.key));

type BreakdownRole = "banded" | "scribed";

export default function Volunteers() {
  const volunteerStatsMap = useAppStore((s) => s.volunteerStatsMap);
  const speciesAliasesMap = useAppStore((s) => s.speciesAliasesMap);
  const isOnline = useAppStore((s) => s.isOnline);
  const isLoggedIn = useIsLoggedIn();
  const { updateVolunteer } = useActions();
  const birdEventsVersion = useBirdEventsVersion();
  const { sortDescriptors, handleSortChange, resetSort } = useCascadingSort([
    { column: "totalBanded", direction: "descending" },
  ]);
  const [search, setSearch] = useState("");
  const [editingCode, setEditingCode] = useState<string | null>(null);
  const [editingName, setEditingName] = useState("");
  const [editingObserverClass, setEditingObserverClass] = useState<ObserverClass>(3);
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
    for (const ev of birdEventsStore.getAll().values()) {
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [breakdown, birdEventsVersion]);

  const breakdownRows = useMemo(() => {
    const counts = new Map<string, number>();
    for (const ev of breakdownEvents) {
      const speciesKey = resolveSpeciesKey(ev.species, speciesAliasesMap);
      counts.set(speciesKey, (counts.get(speciesKey) ?? 0) + 1);
    }
    return [...counts.entries()]
      .map(([species, count]) => ({ species, count }))
      .sort(
        (a, b) =>
          b.count - a.count ||
          getSpeciesDisplayCode(a.species, speciesAliasesMap).localeCompare(
            getSpeciesDisplayCode(b.species, speciesAliasesMap)
          )
      );
  }, [breakdownEvents, speciesAliasesMap]);

  const volunteerDays = useMemo(() => {
    const today = new Date();
    const todayString = getLocalDateString(today);
    const twelveMonthsAgo = new Date(today);
    twelveMonthsAgo.setFullYear(twelveMonthsAgo.getFullYear() - 1);
    const twelveMonthsAgoString = getLocalDateString(twelveMonthsAgo);
    const allDates = new Map<string, Set<string>>();
    const recentDates = new Map<string, Set<string>>();

    for (const ev of birdEventsStore.getAll().values()) {
      if (!ev || ev.modifiedEventId || !ev.date || ev.date > todayString) continue;

      // A volunteer may band and scribe on the same day; that day should
      // still only be counted once.
      const volunteerCodes = new Set([ev.bander, ev.scribe].filter(Boolean));
      for (const code of volunteerCodes) {
        if (!allDates.has(code)) allDates.set(code, new Set());
        allDates.get(code)!.add(ev.date);

        if (ev.date >= twelveMonthsAgoString) {
          if (!recentDates.has(code)) recentDates.set(code, new Set());
          recentDates.get(code)!.add(ev.date);
        }
      }
    }

    return { allDates, recentDates };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [birdEventsVersion]);

  const rows = useMemo<Row[]>(() => {
    const allRows = Object.values(volunteerStatsMap).map((b) => ({
      code: b.code,
      fullName: b.fullName || "",
      observerClass: b.observerClass ?? 3,
      totalBanded: b.totalBanded,
      totalScribed: b.totalScribed,
      totalDays: volunteerDays.allDates.get(b.code)?.size ?? 0,
      daysPast12Months: volunteerDays.recentDates.get(b.code)?.size ?? 0,
    }));

    if (search) {
      const q = search.toLowerCase();
      return allRows.filter((r) => r.code.toLowerCase().includes(q) || r.fullName.toLowerCase().includes(q));
    }

    return allRows;
  }, [volunteerStatsMap, volunteerDays, search]);

  const sortedRows = useMemo(() => cascadingSort(rows, sortDescriptors, numericColumns), [rows, sortDescriptors]);
  const handleOpenEditModal = (row: Row) => {
    setEditingCode(row.code);
    setEditingName(row.fullName);
    setEditingObserverClass(row.observerClass);
    setIsEditModalOpen(true);
  };
  const handleSaveVolunteer = () => {
    if (editingCode) updateVolunteer(editingCode, editingName, editingObserverClass);
    setIsEditModalOpen(false);
  };

  return (
    <div className="h-full w-full max-w-7xl mx-auto flex flex-col pt-4 p-8 gap-4 overflow-hidden">
      <PageHeader
        title="Volunteers"
        subtitle={`${Object.keys(volunteerStatsMap).length} volunteers`}
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
                  allowsSorting={column.type !== "actions"}
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
                        <TableCell className="text-default-700">
                          {value || <span className="text-default-400">-</span>}
                        </TableCell>
                      );
                    }
                    if (columnKey === "observerClass") {
                      return (
                        <TableCell className="text-right tabular-nums text-default-900">{item.observerClass}</TableCell>
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
                    if (columnKey === "actions") {
                      return (
                        <TableCell className="text-right">
                          <Button
                            size="sm"
                            variant="flat"
                            color="primary"
                            isDisabled={!isLoggedIn || !isOnline}
                            onPress={() => handleOpenEditModal(item)}
                          >
                            Edit
                          </Button>
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
          Edit Volunteer <>{editingCode}</>
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
                handleSaveVolunteer();
              }
            }}
          />
          <Select
            label="Observer Class"
            {...modalInputProps}
            selectedKeys={[String(editingObserverClass)]}
            onSelectionChange={(keys) => {
              const value = Number(Array.from(keys)[0]);
              setEditingObserverClass(value === 1 || value === 2 || value === 3 ? value : 3);
            }}
          >
            <SelectItem key="1">Class 1</SelectItem>
            <SelectItem key="2">Class 2</SelectItem>
            <SelectItem key="3">Class 3</SelectItem>
          </Select>
        </ModalBodyShell>
        <ModalFooterShell>
          <Button {...modalCancelButtonProps} onPress={() => setIsEditModalOpen(false)}>
            Cancel
          </Button>
          <Button {...modalPrimaryButtonProps} onPress={handleSaveVolunteer}>
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
