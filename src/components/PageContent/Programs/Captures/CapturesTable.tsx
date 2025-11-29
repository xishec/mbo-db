import {
  Pagination,
  Table,
  TableBody,
  TableCell,
  TableColumn,
  TableHeader,
  TableRow,
  type SortDescriptor,
} from "@heroui/react";
import { useCallback, useMemo, useState } from "react";
import { type Capture, generateCaptureTableId } from "../../../../helper/helper";

const ROWS_PER_PAGE = 100;

const CAPTURE_COLUMNS: { key: keyof Capture; label: string }[] = [
  { key: "program", label: "Program" },
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

interface CapturesTableProps {
  program: string;
  captures: Capture[];
}

export default function CapturesTable({ program, captures }: CapturesTableProps) {
  const [sortDescriptors, setSortDescriptors] = useState<SortDescriptor[]>([
    { column: "bandLastTwoDigits", direction: "ascending" },
  ]);
  const [page, setPage] = useState(1);

  // Sort captures based on multiple sortDescriptors (cascading sort)
  const sortedCaptures = useMemo(() => {
    if (sortDescriptors.length === 0) return captures;

    return [...captures].sort((a, b) => {
      for (const descriptor of sortDescriptors) {
        const column = descriptor.column as keyof Capture;
        const first = a[column];
        const second = b[column];

        let cmp: number;

        // Special handling for bandLastTwoDigits: 00 should come after 99
        if (column === "bandLastTwoDigits") {
          const firstNum = parseInt(String(first), 10);
          const secondNum = parseInt(String(second), 10);
          // Treat 00 as 100 so it sorts last
          const firstVal = firstNum || 100;
          const secondVal = secondNum || 100;
          cmp = firstVal - secondVal;
        } else {
          const firstVal = parseInt(String(first)) || first;
          const secondVal = parseInt(String(second)) || second;
          cmp = firstVal < secondVal ? -1 : firstVal > secondVal ? 1 : 0;
        }

        if (cmp !== 0) {
          return descriptor.direction === "descending" ? -cmp : cmp;
        }
      }
      return 0;
    });
  }, [captures, sortDescriptors]);

  const totalPages = Math.ceil(sortedCaptures.length / ROWS_PER_PAGE);

  const paginatedCaptures = useMemo(() => {
    const start = (page - 1) * ROWS_PER_PAGE;
    const end = start + ROWS_PER_PAGE;
    return sortedCaptures.slice(start, end);
  }, [sortedCaptures, page]);

  const handleSortChange = useCallback((descriptor: SortDescriptor) => {
    setPage(1); // Reset to first page on sort change
    setSortDescriptors((prev) => {
      const existingIndex = prev.findIndex((d) => d.column === descriptor.column);

      if (existingIndex === 0) {
        const updated = [...prev];
        updated[0] = descriptor;
        return updated;
      } else if (existingIndex > 0) {
        const updated = prev.filter((d) => d.column !== descriptor.column);
        return [descriptor, ...updated];
      } else {
        return [descriptor, ...prev].slice(0, 3);
      }
    });
  }, []);

  const primarySortDescriptor = sortDescriptors[0];

  return (
    <div className="w-full flex flex-col gap-2">
      <div className="text-default-700 text-sm">
        {captures.length} {captures.length === 1 ? "capture" : "captures"}
      </div>
      <Table
        isHeaderSticky
        aria-label="Captures table"
        sortDescriptor={primarySortDescriptor}
        onSortChange={handleSortChange}
        bottomContent={
          totalPages > 1 ? (
            <div className="flex w-full justify-center">
              <Pagination
                isCompact
                showControls
                showShadow
                color="primary"
                page={page}
                total={totalPages}
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
      <TableBody items={paginatedCaptures} emptyContent="No captures found">
        {(item) => (
          <TableRow key={item.id} className={item.program !== program ? "opacity-20" : ""}>
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
    </div>
  );
}