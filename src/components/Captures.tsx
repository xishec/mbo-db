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
} from "@heroui/react";
import type { SortDescriptor } from "@heroui/react";
import { useMemo, useState, useEffect, useRef } from "react";
import { get, ref } from "firebase/database";
import { db } from "../firebase";
import type { Capture } from "../types/Capture";
import type { Programs } from "../types/Programs";

interface CapturesProps {
  programs?: Programs | null;
  isLoading?: boolean;
  error?: string | null;
}

export default function Captures({
  programs,
  isLoading,
  error,
}: CapturesProps) {
  const [selectedProgram, setSelectedProgram] = useState<string | null>(null);
  const programNames = useMemo(
    () => (programs ? Array.from(programs.keys()) : []),
    [programs]
  );
  const selectedEntries = useMemo(() => {
    if (!programs || !selectedProgram) return null;
    return programs.get(selectedProgram) || null;
  }, [programs, selectedProgram]);
  const selectedBandIds = useMemo(
    () => (selectedEntries ? Array.from(selectedEntries.values()) : []),
    [selectedEntries]
  );

  if (isLoading) {
    return (
      <div className="p-4 flex items-center gap-2">
        <Spinner size="sm" /> Loading programs...
      </div>
    );
  }
  if (error) {
    return <div className="p-4 text-danger">Error: {error}</div>;
  }
  if (!programs || programNames.length === 0) {
    return <div className="p-4">No programs available.</div>;
  }

  return (
    <div className="p-4 flex flex-col gap-3">
      <Select
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
  const [searchValue, setSearchValue] = useState("");
  const [speciesFilter, setSpeciesFilter] = useState<string | null>(null);
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

  // Flatten all captures into individual rows with bandId included
  const allCaptureRows = useMemo(() => {
    const rows: Array<Capture & { key: string; bandId: string }> = [];
    for (const [bandId, captures] of bandCaptures.entries()) {
      captures.forEach((capture, idx) => {
        if (capture.Program === selectedProgram) {
          rows.push({ ...capture, key: `${bandId}-${idx}`, bandId });
        }
      });
    }
    return rows;
  }, [bandCaptures, selectedProgram]);

  // Derive species list for filter (unique, sorted)
  const speciesOptions = useMemo(() => {
    const set = new Set<string>();
    allCaptureRows.forEach((r) => {
      if (r.Species) set.add(r.Species);
    });
    return Array.from(set.values()).sort();
  }, [allCaptureRows]);

  // Apply search & species filtering before sorting
  const filteredRows = useMemo(() => {
    if (!searchValue && !speciesFilter) return allCaptureRows;
    const query = searchValue.trim().toLowerCase();
    return allCaptureRows.filter((r) => {
      if (speciesFilter && r.Species !== speciesFilter) return false;
      if (!query) return true;
      const searchableKeys = Object.keys(r).filter((k) => k !== "key");
      return searchableKeys.some((k) => {
        const val = (r as unknown as { [key: string]: unknown })[k];
        return typeof val === "string" && val.toLowerCase().includes(query);
      });
    });
  }, [allCaptureRows, searchValue, speciesFilter]);

  const sortedRows = useMemo(() => {
    const { column, direction } = sortDescriptor;
    if (!column) return filteredRows;
    const collator = new Intl.Collator(undefined, {
      numeric: true,
      sensitivity: "base",
    });
    type RowItemLocal = Capture & { key: string; bandId: string };
    const rowsCopy: RowItemLocal[] = [...filteredRows];
    rowsCopy.sort((a, b) => {
      const aVal = a[column as keyof RowItemLocal];
      const bVal = b[column as keyof RowItemLocal];
      // Treat undefined/null as empty string for stable comparisons
      const aStr = aVal === undefined || aVal === null ? "" : String(aVal);
      const bStr = bVal === undefined || bVal === null ? "" : String(bVal);
      const cmp = collator.compare(aStr, bStr);
      return direction === "descending" ? -cmp : cmp;
    });
    return rowsCopy;
  }, [filteredRows, sortDescriptor]);

  const totalPages =
    sortedRows.length === 0 ? 0 : Math.ceil(sortedRows.length / pageSize);
  const paginatedRows = useMemo(() => {
    if (page < 1) return [];
    const start = (page - 1) * pageSize;
    return sortedRows.slice(start, start + pageSize);
  }, [sortedRows, page, pageSize]);

  // Reset page when filters/search change
  useEffect(() => {
    setPage(1);
  }, [searchValue, speciesFilter]);

  const columns = [
    { key: "bandId", label: "Band" },
    { key: "Disposition", label: "Disposition" },
    { key: "Species", label: "Species" },
    { key: "WingChord", label: "WingChord" },
    { key: "Age", label: "Age" },
    { key: "HowAged", label: "HowAged" },
    { key: "Sex", label: "Sex" },
    { key: "HowSexed", label: "HowSexed" },
    { key: "Fat", label: "Fat" },
    { key: "Weight", label: "Weight" },
    { key: "CaptureDate", label: "CaptureDate" },
    { key: "Bander", label: "Bander" },
    { key: "Scribe", label: "Scribe" },
    { key: "Net", label: "Net" },
    { key: "NotesForMBO", label: "NotesForMBO" },
    { key: "Location", label: "Location" },
    { key: "BirdStatus", label: "BirdStatus" },
    { key: "PresentCondition", label: "PresentCondition" },
    { key: "HowObtainedCode", label: "HowObtainedCode" },
    { key: "Program", label: "Program" },
    { key: "D18", label: "D18" },
    { key: "D20", label: "D20" },
    { key: "D22", label: "D22" },
  ];
  interface RowItem extends Capture {
    key: string;
    bandId: string;
  }

  return (
    <div className="flex flex-col gap-3">
      {error && <div className="text-danger text-sm">Error: {error}</div>}
      <div className="flex flex-col md:flex-row gap-3 md:items-end md:justify-between py-2">
        <Input
          isClearable
          label="Search"
          variant="bordered"
          placeholder="Search band, species, location..."
          value={searchValue}
          onClear={() => setSearchValue("")}
          onValueChange={setSearchValue}
          className="md:max-w-xs"
        />
        <Select
          label="Species"
          selectedKeys={speciesFilter ? [speciesFilter] : []}
          onSelectionChange={(keys) => {
            const first = Array.from(keys)[0];
            setSpeciesFilter(first ? String(first) : null);
          }}
          placeholder="All species"
          disallowEmptySelection={false}
          className="md:max-w-xs"
        >
          {speciesOptions.map((sp) => (
            <SelectItem key={sp}>{sp}</SelectItem>
          ))}
        </Select>
        <div className="text-sm text-right md:text-left opacity-70">
          Showing {paginatedRows.length} of {filteredRows.length} filtered
          (Total {allCaptureRows.length})
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
              className={column.key === "bandId" ? "whitespace-nowrap" : undefined}
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
                <TableCell className={columnKey === "bandId" ? "whitespace-nowrap" : undefined}>
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
