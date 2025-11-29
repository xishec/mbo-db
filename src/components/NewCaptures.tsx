import {
  Autocomplete,
  AutocompleteItem,
  Pagination,
  Spinner,
  Table,
  TableBody,
  TableCell,
  TableColumn,
  TableHeader,
  TableRow,
  type SortDescriptor,
} from "@heroui/react";
import { onValue, ref } from "firebase/database";
import { useMemo, useState, useEffect, useCallback } from "react";
import { db } from "../firebase";
import { type CapturesMap, type Capture, type Program, generateCaptureTableId } from "../types/types";

const CAPTURE_COLUMNS: { key: keyof Capture; label: string }[] = [
  { key: "bandGroupId", label: "Band Group" },
  { key: "bandLastTwoDigits", label: "Band" },
  { key: "species", label: "Species" },
  { key: "wing", label: "Wing" },
  { key: "age", label: "Age" },
  { key: "howAged", label: "How Aged" },
  { key: "howSexed", label: "How Sexed" },
  { key: "sex", label: "Sex" },
  { key: "fat", label: "Fat" },
  { key: "weight", label: "Weight" },
  { key: "date", label: "Date" },
  { key: "time", label: "Time" },
  { key: "bander", label: "Bander" },
  { key: "scribe", label: "Scribe" },
  { key: "net", label: "Net" },
  { key: "notes", label: "Notes" },
];

export default function NewCaptures({ program }: { program: Program }) {
  const [capturesMap, setCapturesMap] = useState<CapturesMap>(new Map());
  const [selectedBandGroupId, setSelectedBandGroupId] = useState<string>("All");
  const [isLoadingCaptures, setIsLoadingCaptures] = useState(true);
  const [sortDescriptor, setSortDescriptor] = useState<SortDescriptor>();
  const [page, setPage] = useState(1);
  const rowsPerPage = 50;

  // Extract bandGroupId from captureId (captureId format: ${date}-${bandGroupId}${lastTwoDigits})
  const extractBandGroupId = (captureId: string): string => {
    // Remove the date prefix (YYYY-MM-DD-) and the last two digits
    const withoutDate = captureId.replace(/^\d{4}-\d{2}-\d{2}-/, "");
    return withoutDate.slice(0, -2);
  };

  // Compute unique band group IDs from program.newCaptureIds
  const bandGroupIds = useMemo(() => {
    const bandGroupSet = new Set<string>();
    for (const captureId of program.newCaptureIds) {
      bandGroupSet.add(extractBandGroupId(captureId));
    }
    return ["All", ...Array.from(bandGroupSet).sort()];
  }, [program.newCaptureIds]);

  // Fetch captures from RTDB for all newCaptureIds
  useEffect(() => {
    const captureIds = Array.from(program.newCaptureIds);

    if (captureIds.length === 0) {
      setCapturesMap(new Map());
      setIsLoadingCaptures(false);
      return;
    }

    setIsLoadingCaptures(true);
    const newCapturesMap: CapturesMap = new Map();
    let loadedCount = 0;

    const unsubscribes = captureIds.map((captureId) => {
      const captureRef = ref(db, `capturesMap/${captureId}`);
      return onValue(captureRef, (snapshot) => {
        if (snapshot.exists()) {
          const rawCapture = snapshot.val() as Capture;
          newCapturesMap.set(captureId, rawCapture);
        }
        loadedCount++;
        if (loadedCount >= captureIds.length) {
          setCapturesMap(new Map(newCapturesMap));
          setIsLoadingCaptures(false);
        }
      });
    });

    return () => unsubscribes.forEach((unsubscribe) => unsubscribe());
  }, [program.newCaptureIds]);

  // Get captures filtered by selected band group
  const captures = useMemo(() => {
    const allCaptures = Array.from(capturesMap.values());

    if (selectedBandGroupId === "All") {
      return allCaptures;
    }

    return allCaptures.filter((capture) => capture.bandGroupId === selectedBandGroupId);
  }, [capturesMap, selectedBandGroupId]);

  // Sort captures based on sortDescriptor
  const sortedCaptures = useMemo(() => {
    if (!sortDescriptor?.column) return captures;

    return [...captures].sort((a, b) => {
      const column = sortDescriptor.column as keyof Capture;
      const first = a[column];
      const second = b[column];
      let cmp = (parseInt(String(first)) || first) < (parseInt(String(second)) || second) ? -1 : 1;

      if (sortDescriptor.direction === "descending") {
        cmp *= -1;
      }

      return cmp;
    });
  }, [captures, sortDescriptor]);

  // Calculate pagination
  const pages = Math.ceil(sortedCaptures.length / rowsPerPage);
  const paginatedCaptures = useMemo(() => {
    const start = (page - 1) * rowsPerPage;
    const end = start + rowsPerPage;
    return sortedCaptures.slice(start, end);
  }, [page, sortedCaptures]);

  const handleSortChange = useCallback((descriptor: SortDescriptor) => {
    setSortDescriptor(descriptor);
    setPage(1); // Reset to first page when sorting changes
  }, []);

  return (
    <div className="flex flex-col gap-4 items-center w-full">
      <div className="w-full max-w-6xl">
        <Autocomplete
          labelPlacement="outside"
          label="Select Band Group"
          placeholder="Search band groups..."
          selectedKey={selectedBandGroupId}
          onSelectionChange={(key) => setSelectedBandGroupId((key as string) ?? "All")}
          className="max-w-md"
        >
          {bandGroupIds.map((id) => (
            <AutocompleteItem key={id}>{id}</AutocompleteItem>
          ))}
        </Autocomplete>
      </div>

      {isLoadingCaptures ? (
        <div className="p-4 flex items-center gap-2">
          <Spinner size="sm" /> Loading captures...
        </div>
      ) : (
        <Table
          isHeaderSticky
          aria-label="Captures table"
          sortDescriptor={sortDescriptor}
          onSortChange={handleSortChange}
          bottomContent={
            pages > 1 ? (
              <div className="flex w-full justify-center">
                <Pagination
                  isCompact
                  showControls
                  showShadow
                  color="primary"
                  page={page}
                  total={pages}
                  onChange={setPage}
                />
              </div>
            ) : null
          }
        >
          <TableHeader columns={CAPTURE_COLUMNS}>
            {(column) => (
              <TableColumn key={column.key} allowsSorting className="whitespace-nowrap">
                {column.label}
              </TableColumn>
            )}
          </TableHeader>
          <TableBody items={paginatedCaptures} emptyContent="Select a band group to view captures">
            {(item) => (
              <TableRow key={item.id}>
                {(columnKey) => {
                  if (columnKey === "lastTwoDigits") {
                    return <TableCell className="whitespace-nowrap">{generateCaptureTableId(item)}</TableCell>;
                  } else {
                    return <TableCell className="whitespace-nowrap">{item[columnKey as keyof Capture]}</TableCell>;
                  }
                }}
              </TableRow>
            )}
          </TableBody>
        </Table>
      )}
    </div>
  );
}
