import { Table, TableBody, TableCell, TableColumn, TableHeader, TableRow, Input, Button } from "@heroui/react";
import { useMemo, useState } from "react";
import { useData } from "../../services/useData";
import { useCascadingSort, cascadingSort } from "../../hooks/useCascadingSort";
import ModalShell, { ModalBodyShell, ModalFooterShell, ModalHeaderShell } from "../Modals/ModalShell";
import { modalInputProps, modalCancelButtonProps, modalPrimaryButtonProps } from "../Modals/modalDefaults";
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

export default function Volunteers() {
  const { volunteersMap, isLoggedIn, isOnline, updateVolunteerName, addVolunteer } = useData();
  const { sortDescriptors, handleSortChange, resetSort } = useCascadingSort([
    { column: "totalBanded", direction: "descending" },
  ]);
  const [search, setSearch] = useState("");
  const [editingCode, setEditingCode] = useState<string | null>(null);
  const [editingName, setEditingName] = useState("");
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [newCode, setNewCode] = useState("");
  const [newFullName, setNewFullName] = useState("");
  const [addError, setAddError] = useState("");

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
    <div className="h-full w-full max-w-7xl mx-auto flex flex-col items-center pt-4 p-8 gap-4">
      <div className="w-full">
        <PageHeader
          title="Volunteers"
          subtitle={`${Object.keys(volunteersMap).length} volunteers`}
          actions={
            <div className="flex items-center gap-2">
              {sortDescriptors.length > 0 && (
                <button
                  type="button"
                  onClick={resetSort}
                  className="text-sm font-medium text-primary hover:text-primary-600"
                >
                  Reset sort
                </button>
              )}
              {isLoggedIn && (
                <Button
                  color="secondary"
                  isDisabled={!isOnline}
                  onPress={() => {
                    setNewCode("");
                    setNewFullName("");
                    setAddError("");
                    setIsAddModalOpen(true);
                  }}
                >
                  Add Volunteer
                </Button>
              )}
            </div>
          }
        />
      </div>

      <div className="w-full">
        <Input
          placeholder="Search by code or name..."
          variant="bordered"
          size="md"
          value={search}
          onValueChange={setSearch}
          className="max-w-xs"
        />
      </div>

      <div className="w-full pb-[200px]">
        <div className="overflow-hidden rounded-medium border border-default-200">
          <Table
            aria-label="Volunteers table"
            isVirtualized
            maxTableHeight={800}
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
          isDismissable: true,
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
          isOpen: isAddModalOpen,
          onOpenChange: setIsAddModalOpen,
          placement: "top-center",
        }}
      >
        <ModalHeaderShell>Add Volunteer</ModalHeaderShell>
        <ModalBodyShell>
          {addError && <div className="bg-danger-50 text-danger-500 p-3 rounded-lg text-sm">{addError}</div>}
          <Input
            label="Code"
            placeholder="2-3 letter code (e.g. SNL)"
            {...modalInputProps}
            value={newCode}
            onValueChange={(v) => {
              setNewCode(v.toUpperCase());
              setAddError("");
            }}
            maxLength={3}
            autoFocus
          />
          <Input
            label="Full Name"
            placeholder="Enter full name"
            {...modalInputProps}
            value={newFullName}
            onValueChange={setNewFullName}
            onKeyDown={(e) => {
              if (e.key === "Enter" && newCode.length >= 2) {
                addVolunteer(newCode, newFullName)
                  .then(() => setIsAddModalOpen(false))
                  .catch((err) => setAddError(err instanceof Error ? err.message : "Failed"));
              }
            }}
          />
        </ModalBodyShell>
        <ModalFooterShell>
          <Button {...modalCancelButtonProps} onPress={() => setIsAddModalOpen(false)}>
            Cancel
          </Button>
          <Button
            {...modalPrimaryButtonProps}
            isDisabled={newCode.length < 2}
            onPress={() => {
              addVolunteer(newCode, newFullName)
                .then(() => setIsAddModalOpen(false))
                .catch((err) => setAddError(err instanceof Error ? err.message : "Failed"));
            }}
          >
            Add
          </Button>
        </ModalFooterShell>
      </ModalShell>
    </div>
  );
}
