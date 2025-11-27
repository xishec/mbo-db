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
} from "@heroui/react";
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
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const programNames = useMemo(
    () => (programs ? Array.from(programs.keys()) : []),
    [programs]
  );
  const selectedEntries = useMemo(() => {
    if (!programs || !selectedKey) return null;
    return programs.get(selectedKey) || null;
  }, [programs, selectedKey]);
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
    <div className="p-4 flex flex-col gap-6">
      <Select
        label="Programs"
        className="w-full"
        selectedKeys={selectedKey ? [selectedKey] : []}
        onSelectionChange={(keys) => {
          const first = Array.from(keys)[0];
          setSelectedKey(first ? String(first) : null);
        }}
        disallowEmptySelection
      >
        {programNames.map((name) => (
          <SelectItem key={name}>{name}</SelectItem>
        ))}
      </Select>
      {selectedKey && (
        <div className="rounded-medium border border-default-200 p-4 bg-default-50 dark:bg-default-100">
          <h3 className="text-lg font-semibold mb-2">Program: {selectedKey}</h3>
          <p className="text-sm mb-3">Band IDs: {selectedBandIds.length}</p>
          <BandsTable bandIds={selectedBandIds} />
        </div>
      )}
    </div>
  );
}

function BandsTable({ bandIds }: { bandIds: string[] }) {
  const pageSize = 50;
  const [bandCaptures, setBandCaptures] = useState<Map<string, Capture[]>>(
    new Map()
  );
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
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

  const totalPages =
    bandCaptures.size === 0 ? 0 : Math.ceil(bandCaptures.size / pageSize);
  const allRows = useMemo(() => {
    return Array.from(bandCaptures.entries()).map(([bandId, captures]) => ({
      key: bandId,
      bandId,
      count: captures?.length ?? 0,
    }));
  }, [bandCaptures]);
  const paginatedRows = useMemo(() => {
    if (page < 1) return [];
    const start = (page - 1) * pageSize;
    return allRows.slice(start, start + pageSize);
  }, [allRows, page, pageSize]);

  const columns = [
    { key: "bandId", label: "Band" },
    { key: "count", label: "# Captures" },
  ];
  interface RowItem {
    key: string;
    bandId: string;
    count: number;
  }

  return (
    <div className="flex flex-col gap-2">
      {error && <div className="text-danger text-sm">Error: {error}</div>}
      <Table
        aria-label="Band captures table with pagination"
        removeWrapper
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
            <TableColumn key={column.key}>{column.label}</TableColumn>
          )}
        </TableHeader>
        <TableBody
          items={paginatedRows}
          emptyContent={
            isLoading ? <Spinner size="sm" /> : "No bands for program"
          }
          loadingState={
            isLoading && bandCaptures.size === 0 ? "loading" : "idle"
          }
        >
          {(item) => (
            <TableRow key={item.key}>
              {(columnKey) => (
                <TableCell>
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
