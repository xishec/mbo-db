import { Table, TableBody, TableCell, TableColumn, TableHeader, TableRow, Input, Button } from "@heroui/react";
import { useMemo, useRef, useState } from "react";
import { useData } from "../../services/useData";
import { useCascadingSort, cascadingSort } from "../../hooks/useCascadingSort";
import { useRemainingHeight } from "../../hooks/useRemainingHeight";
import ModalShell, { ModalBodyShell, ModalFooterShell, ModalHeaderShell } from "../Modals/ModalShell";
import { modalInputProps, modalCancelButtonProps, modalPrimaryButtonProps } from "../Modals/modalDefaults";
import PageHeader from "./PageHeader";

type Row = {
  code: string;
  fullName: string;
  totalBanded: number;
  totalScribed: number;
  // All original (case-preserving) codes folded into this row. Usually one;
  // multiple when a volunteer was entered with mixed casing (e.g. "VIP" vs
  // "vip") — we merge those into a single display row.
  codes: string[];
};

const COLUMNS = [
  { key: "code" as const, label: "Code", type: "string" as const, width: 100 },
  { key: "fullName" as const, label: "Full Name", type: "string" as const, width: 300 },
  { key: "totalBanded" as const, label: "Banded", type: "number" as const, align: "end" as const, width: 150 },
  { key: "totalScribed" as const, label: "Scribed", type: "number" as const, align: "end" as const, width: 150 },
];

const numericColumns = new Set<string>(COLUMNS.filter((c) => c.type === "number").map((c) => c.key));

export default function Volunteers() {
  const { volunteersMap, isLoggedIn, isOnline, updateVolunteerName } = useData();
  const { sortDescriptors, handleSortChange, resetSort } = useCascadingSort([
    { column: "totalBanded", direction: "descending" },
  ]);
  const [search, setSearch] = useState("");
  const [editingCode, setEditingCode] = useState<string | null>(null);
  const [editingCodes, setEditingCodes] = useState<string[]>([]);
  const [editingName, setEditingName] = useState("");
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const tableRef = useRef<HTMLDivElement>(null);
  const tableHeight = useRemainingHeight(tableRef);

  const saveEditedName = async () => {
    const trimmed = editingName.trim();
    for (const code of editingCodes) {
      try {
        await updateVolunteerName(code, trimmed);
      } catch {
        // updateVolunteerName already logs; keep going so other variants update.
      }
    }
    setIsEditModalOpen(false);
  };

  // Merge volunteers that differ only in case (e.g. "VIP" vs "vip") into a
  // single row keyed by the uppercase code. Historical data has these
  // inconsistencies because bander/scribe entry wasn't normalized.
  const mergedRows = useMemo<Row[]>(() => {
    const merged = new Map<string, Row>();
    for (const b of Object.values(volunteersMap)) {
      const key = b.code.toUpperCase();
      const existing = merged.get(key);
      if (existing) {
        existing.totalBanded += b.totalBanded;
        existing.totalScribed += b.totalScribed;
        if (!existing.fullName && b.fullName) existing.fullName = b.fullName;
        if (!existing.codes.includes(b.code)) existing.codes.push(b.code);
      } else {
        merged.set(key, {
          code: key,
          fullName: b.fullName || "",
          totalBanded: b.totalBanded,
          totalScribed: b.totalScribed,
          codes: [b.code],
        });
      }
    }
    return [...merged.values()];
  }, [volunteersMap]);

  const rows = useMemo<Row[]>(() => {
    if (!search) return mergedRows;
    const q = search.toLowerCase();
    return mergedRows.filter(
      (r) =>
        r.code.toLowerCase().includes(q) ||
        r.fullName.toLowerCase().includes(q) ||
        r.codes.some((c) => c.toLowerCase().includes(q))
    );
  }, [mergedRows, search]);

  const sortedRows = useMemo(() => cascadingSort(rows, sortDescriptors, numericColumns), [rows, sortDescriptors]);

  return (
    <div className="h-full w-full max-w-7xl mx-auto flex flex-col pt-4 p-8 gap-4 overflow-hidden">
      <PageHeader
        title="Volunteers"
        subtitle={`${mergedRows.length} volunteers`}
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
                              setEditingCodes(item.codes);
                              setEditingName(item.fullName);
                              setIsEditModalOpen(true);
                            }
                          }}
                        >
                          {value || <span className="text-default-400">-</span>}
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
              if (e.key === "Enter") saveEditedName();
            }}
          />
          {editingCodes.length > 1 && (
            <p className="text-xs text-default-500">
              Applies to {editingCodes.length} variants:{" "}
              <span className="font-mono">{editingCodes.join(", ")}</span>
            </p>
          )}
        </ModalBodyShell>
        <ModalFooterShell>
          <Button {...modalCancelButtonProps} onPress={() => setIsEditModalOpen(false)}>
            Cancel
          </Button>
          <Button {...modalPrimaryButtonProps} onPress={saveEditedName}>
            Save
          </Button>
        </ModalFooterShell>
      </ModalShell>

    </div>
  );
}
