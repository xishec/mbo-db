import {
  Select,
  SelectItem,
  Spinner,
  Table,
  TableHeader,
  TableColumn,
  TableBody,
  TableRow,
  TableCell,
  Pagination,
  getKeyValue,
  Input,
  Chip,
  Button,
} from "@heroui/react";
import type { SortDescriptor } from "@heroui/react";
import { useMemo, useState, useEffect, useRef, useCallback } from "react";
import { get, ref } from "firebase/database";
import { db } from "../firebase";
import type { Capture } from "../types/Capture";
import type { Programs } from "../types/Programs";
import type { Years } from "../types/Years";
import { NUMERIC_FIELDS } from "../constants/constants";
import { TABLE_COLUMNS } from "../constants/constants";

interface CapturesProps {
  programs: Programs | null;
  years: Years | null;
  isLoading: boolean;
}

export default function Captures({
  programs,
  years,
  isLoading,
}: CapturesProps) {
  const [selectedYear, setSelectedYear] = useState<number | "all">("all");
  const [selectedProgram, setSelectedProgram] = useState<string | null>(null);

  // Filter program names by selected year
  const programNames = useMemo(() => {
    if (!programs) return [];
    const all = Array.from(programs.keys());
    if (selectedYear === "all") return all;
    const allowed = years?.get(selectedYear);
    if (!allowed) return [];
    const allowedSet = new Set(Array.from(allowed.values()));
    return all.filter((p) => allowedSet.has(p));
  }, [programs, selectedYear, years]);

  const selectedEntries = useMemo(() => {
    if (!programs || !selectedProgram) return null;
    return programs.get(selectedProgram) || null;
  }, [programs, selectedProgram]);
  
  const selectedBandIds = useMemo(
    () => (selectedEntries ? Array.from(selectedEntries.values()) : []),
    [selectedEntries]
  );

  const yearOptions = useMemo(() => {
    const opts: JSX.Element[] = [<SelectItem key="all">All years</SelectItem>];
    Array.from(years?.keys() || [])
      .sort((a, b) => b - a)
      .forEach((y) => {
        opts.push(<SelectItem key={String(y)}>{String(y)}</SelectItem>);
      });
    return opts;
  }, [years]);

  if (isLoading) {
    return (
      <div className="p-4 flex items-center gap-2">
        <Spinner size="sm" /> Loading programs...
      </div>
    );
  }

  if (!programs || programNames.length === 0) {
    return <div className="p-4">No programs available.</div>;
  }

  return (
    <div className="p-4 flex flex-col gap-3">
      {/* Top filters row: Years + Programs */}
      <div className="flex items-center gap-3 w-full">
        <Select
          size="sm"
          label="Years"
          className="w-full max-w-[220px]"
          selectedKeys={
            selectedYear === "all" ? ["all"] : [String(selectedYear)]
          }
          onSelectionChange={(keys) => {
            const first = Array.from(keys)[0];
            const next = first === "all" ? "all" : Number(first);
            setSelectedYear(next);
            // Reset selected program if it becomes invalid under new year
            if (selectedProgram && !programNames.includes(selectedProgram)) {
              setSelectedProgram(null);
            }
          }}
          disallowEmptySelection
        >
          {yearOptions}
        </Select>
        <Select
          size="sm"
          label="Programs"
          className="w-full"
          selectedKeys={selectedProgram ? [selectedProgram] : []}
          onSelectionChange={(keys) => {
            const first = Array.from(keys)[0];
            setSelectedProgram(first ? String(first) : null);
          }}
          disallowEmptySelection
        >
          {programNames.map((name) => (
            <SelectItem key={name}>{name}</SelectItem>
          ))}
        </Select>
      </div>
      {selectedProgram && (
        <BandsTable
          selectedProgram={selectedProgram}
          bandIds={selectedBandIds}
        />
      )}
    </div>
  );
}

function BandsTable({
  selectedProgram,
  bandIds,
}: {
  selectedProgram: string;
  bandIds: string[];
}) {
  const pageSize = 50;
  const [bandCaptures, setBandCaptures] = useState<Map<string, Capture[]>>(
    new Map()
  );
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [sortDescriptor, setSortDescriptor] = useState<SortDescriptor>({
    column: "bandId",
    direction: "ascending",
  });
  // Advanced filters state
  interface AdvancedFilter {
    id: string;
    column: string;
    operator: string;
    value: string;
  }
  const [filters, setFilters] = useState<AdvancedFilter[]>([]);
  const [draftColumn, setDraftColumn] = useState<string | null>(null);
  const [draftOperator, setDraftOperator] = useState<string | null>(null);
  const [draftValue, setDraftValue] = useState<string>("");
  const cacheRef = useRef<Map<string, Capture[]>>(new Map());

  useEffect(() => {
    setBandCaptures(new Map());
    setError(null);
    setPage(1);
    cacheRef.current = new Map();
    if (bandIds.length === 0) return;
    let cancelled = false;
    (async () => {
      setIsLoading(true);
      try {
        const next = new Map<string, Capture[]>();
        const concurrency = 25;
        let idx = 0;
        const fetchOne = async (bandId: string) => {
          const snap = await get(ref(db, `bands/${bandId}`));
          if (snap.exists()) {
            const captures = snap.val() as Capture[];
            next.set(bandId, captures);
            cacheRef.current.set(bandId, captures);
          } else {
            next.set(bandId, []);
            cacheRef.current.set(bandId, []);
          }
        };
        const tasks: Promise<void>[] = [];
        while (idx < bandIds.length) {
          const chunk = bandIds.slice(idx, idx + concurrency);
          tasks.push(
            Promise.all(chunk.map((id) => fetchOne(id))).then(() => {})
          );
          idx += concurrency;
        }
        await Promise.all(tasks);
        if (!cancelled) setBandCaptures(next);
      } catch (e) {
        if (!cancelled) setError((e as Error).message);
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [bandIds]);

  // Flatten all captures rows
  const allCaptureRows = useMemo(() => {
    const rows: Array<Capture & { key: string; bandId: string }> = [];
    for (const [bandId, captures] of bandCaptures.entries()) {
      captures.forEach((capture, idx) => {
        const prog = capture.Program ? capture.Program.trim() : undefined;
        if (prog === selectedProgram) {
          rows.push({ ...capture, key: `${bandId}-${idx}`, bandId });
        }
      });
    }
    return rows;
  }, [bandCaptures, selectedProgram]);

  interface RowItem extends Capture {
    key: string;
    bandId: string;
  }

  // Operators
  const baseOperators = [
    { key: "eq", label: "=" },
    { key: "neq", label: "≠" },
    { key: "contains", label: "contains" },
    { key: "starts", label: "starts" },
    { key: "ends", label: "ends" },
    { key: "gt", label: ">" },
    { key: "gte", label: ">=" },
    { key: "lt", label: "<" },
    { key: "lte", label: "<=" },
    { key: "exists", label: "exists" },
    { key: "notexists", label: "not exists" },
  ];

  const evaluateFilter = useCallback(
    (row: RowItem, f: AdvancedFilter): boolean => {
      const rawVal = (row as unknown as { [key: string]: unknown })[f.column];
      const valStr =
        rawVal === undefined || rawVal === null ? "" : String(rawVal);
      switch (f.operator) {
        case "exists":
          return valStr !== "";
        case "notexists":
          return valStr === "";
        case "eq":
          return valStr === f.value;
        case "neq":
          return valStr !== f.value;
        case "contains":
          return valStr.toLowerCase().includes(f.value.toLowerCase());
        case "starts":
          return valStr.toLowerCase().startsWith(f.value.toLowerCase());
        case "ends":
          return valStr.toLowerCase().endsWith(f.value.toLowerCase());
        case "gt":
        case "gte":
        case "lt":
        case "lte": {
          const numVal = Number(valStr);
          const numFilter = Number(f.value);
          if (Number.isNaN(numVal) || Number.isNaN(numFilter)) return false;
          if (f.operator === "gt") return numVal > numFilter;
          if (f.operator === "gte") return numVal >= numFilter;
          if (f.operator === "lt") return numVal < numFilter;
          if (f.operator === "lte") return numVal <= numFilter;
          return false;
        }
        default:
          return true;
      }
    },
    []
  );
  const sortedRows = useMemo(() => {
    // Start from all capture rows for current program
    let base: RowItem[] = allCaptureRows as RowItem[];
    // Apply advanced filters if any
    if (filters.length) {
      base = base.filter((r) => filters.every((f) => evaluateFilter(r, f)));
    }
    const { column, direction } = sortDescriptor;
    if (!column) return base;
    const collator = new Intl.Collator(undefined, {
      numeric: true,
      sensitivity: "base",
    });
    const rowsCopy = [...base];
    rowsCopy.sort((a, b) => {
      const aVal = (a as unknown as { [key: string]: unknown })[
        column as string
      ];
      const bVal = (b as unknown as { [key: string]: unknown })[
        column as string
      ];
      const aStr = aVal == null ? "" : String(aVal);
      const bStr = bVal == null ? "" : String(bVal);
      const cmp = collator.compare(aStr, bStr);
      return direction === "descending" ? -cmp : cmp;
    });
    return rowsCopy;
  }, [allCaptureRows, sortDescriptor, filters, evaluateFilter]);

  const totalPages =
    sortedRows.length === 0 ? 0 : Math.ceil(sortedRows.length / pageSize);
  const paginatedRows = useMemo(() => {
    if (page < 1) return [];
    const start = (page - 1) * pageSize;
    return sortedRows.slice(start, start + pageSize);
  }, [sortedRows, page, pageSize]);

  useEffect(() => {
    setPage(1);
  }, [filters]);

  const columns = TABLE_COLUMNS;

  return (
    <div className="flex flex-col gap-3">
      {error && <div className="text-danger text-sm">Error: {error}</div>}
      <div className="flex flex-col gap-3 py-2 w-full">
        {/* Line 1: filter controls */}
        <div className="flex items-center gap-2 w-full">
          <Select
            size="sm"
            variant="bordered"
            label="Filter column"
            selectedKeys={draftColumn ? [draftColumn] : []}
            onSelectionChange={(keys) => {
              const first = Array.from(keys)[0];
              setDraftColumn(first ? String(first) : null);
              setDraftOperator(null);
              setDraftValue("");
            }}
            className="min-w-[150px]"
          >
            {columns.map((c) => (
              <SelectItem key={c.key}>{c.label}</SelectItem>
            ))}
          </Select>
          <Select
            size="sm"
            variant="bordered"
            label="Operator"
            selectedKeys={draftOperator ? [draftOperator] : []}
            onSelectionChange={(keys) => {
              const first = Array.from(keys)[0];
              setDraftOperator(first ? String(first) : null);
            }}
            className="min-w-[120px]"
            isDisabled={!draftColumn}
          >
            {baseOperators.map((op) => {
              const isNumeric = draftColumn
                ? NUMERIC_FIELDS.has(draftColumn)
                : false;
              const numericOnly = ["gt", "gte", "lt", "lte"];
              const disable = !isNumeric && numericOnly.includes(op.key);
              return (
                <SelectItem key={op.key} isDisabled={disable}>
                  {op.label}
                </SelectItem>
              );
            })}
          </Select>
          <Input
            size="sm"
            label="Value"
            variant="bordered"
            value={draftValue}
            onValueChange={setDraftValue}
            className="min-w-[140px]"
            isDisabled={
              !draftOperator || ["exists", "notexists"].includes(draftOperator)
            }
          />
          <Button
            color="primary"
            variant="solid"
            isDisabled={
              !draftColumn ||
              !draftOperator ||
              (!["exists", "notexists"].includes(draftOperator) &&
                draftValue.trim() === "")
            }
            onPress={() => {
              if (!draftColumn || !draftOperator) return;
              if (
                !["exists", "notexists"].includes(draftOperator) &&
                draftValue.trim() === ""
              )
                return;
              const newFilter: AdvancedFilter = {
                id: `${draftColumn}-${draftOperator}-${Date.now()}`,
                column: draftColumn,
                operator: draftOperator,
                value: draftValue.trim(),
              };
              setFilters((prev) => [...prev, newFilter]);
              setDraftValue("");
              setDraftOperator(null);
              setDraftColumn(null);
            }}
          >
            Add
          </Button>
        </div>
        {/* Line 2: chips + count */}
        <div className="flex w-full justify-between items-center gap-2 flex-wrap">
          <div className="flex gap-2 flex-wrap">
            {filters.map((f) => {
              const labelMap: Record<string, string> = {
                eq: "=",
                neq: "≠",
                contains: "contains",
                starts: "starts",
                ends: "ends",
                gt: ">",
                gte: ">=",
                lt: "<",
                lte: "<=",
                exists: "exists",
                notexists: "not exists",
              };
              const colLabel =
                columns.find((c) => c.key === f.column)?.label || f.column;
              const valuePart = ["exists", "notexists"].includes(f.operator)
                ? ""
                : ` ${f.value}`;
              return (
                <Chip
                  key={f.id}
                  variant="flat"
                  color="primary"
                  onClose={() =>
                    setFilters((prev) => prev.filter((x) => x.id !== f.id))
                  }
                >
                  {colLabel} {labelMap[f.operator]}
                  {valuePart}
                </Chip>
              );
            })}
          </div>
          <div className="text-sm opacity-70 ml-auto">
            Showing {paginatedRows.length} of {sortedRows.length} filtered
            (Total {allCaptureRows.length})
          </div>
        </div>
      </div>
      <Table
        aria-label="Band captures table with pagination and sorting"
        sortDescriptor={sortDescriptor}
        onSortChange={setSortDescriptor}
        bottomContent={
          totalPages > 0 ? (
            <div className="flex w-full justify-center py-2">
              <Pagination
                isCompact
                showControls
                showShadow
                page={page}
                total={totalPages}
                onChange={setPage}
                color="primary"
              />
            </div>
          ) : null
        }
      >
        <TableHeader columns={columns}>
          {(column) => (
            <TableColumn
              key={column.key}
              allowsSorting
              className={
                column.key === "bandId" ? "whitespace-nowrap" : undefined
              }
            >
              {column.label}
            </TableColumn>
          )}
        </TableHeader>
        <TableBody
          items={paginatedRows}
          emptyContent={isLoading ? <Spinner size="sm" /> : "No captures"}
          loadingState={
            isLoading && bandCaptures.size === 0 ? "loading" : "idle"
          }
        >
          {(item) => (
            <TableRow key={item.key}>
              {(columnKey) => (
                <TableCell
                  className={
                    columnKey === "bandId" ? "whitespace-nowrap" : undefined
                  }
                >
                  {getKeyValue(item as RowItem, columnKey as string)}
                </TableCell>
              )}
            </TableRow>
          )}
        </TableBody>
      </Table>
    </div>
  );
}
