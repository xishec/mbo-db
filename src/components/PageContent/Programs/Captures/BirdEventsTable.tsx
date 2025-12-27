import { Table, TableBody, TableCell, TableColumn, TableHeader, TableRow, type SortDescriptor, Tooltip } from "@heroui/react";
import { useCallback, useMemo, useState } from "react";
import type { BirdEvent, CaptureFormData } from "../../../../types";
import { CAPTURE_COLUMNS } from "./helpers";
import EditCaptureModal from "./Modals/EditCaptureModal";
import InspectCaptureModal from "./Modals/InspectCaptureModal";

// Icon components
const EyeIcon = () => (
  <svg
    aria-hidden="true"
    fill="none"
    focusable="false"
    height="1em"
    role="presentation"
    viewBox="0 0 20 20"
    width="1em"
  >
    <path
      d="M12.9833 10C12.9833 11.65 11.65 12.9833 10 12.9833C8.35 12.9833 7.01666 11.65 7.01666 10C7.01666 8.35 8.35 7.01666 10 7.01666C11.65 7.01666 12.9833 8.35 12.9833 10Z"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={1.5}
    />
    <path
      d="M9.99999 16.8916C12.9417 16.8916 15.6833 15.1583 17.5917 12.1583C18.3417 10.9833 18.3417 9.00831 17.5917 7.83331C15.6833 4.83331 12.9417 3.09998 9.99999 3.09998C7.05833 3.09998 4.31666 4.83331 2.40833 7.83331C1.65833 9.00831 1.65833 10.9833 2.40833 12.1583C4.31666 15.1583 7.05833 16.8916 9.99999 16.8916Z"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={1.5}
    />
  </svg>
);

const EditIcon = () => (
  <svg
    aria-hidden="true"
    fill="none"
    focusable="false"
    height="1em"
    role="presentation"
    viewBox="0 0 20 20"
    width="1em"
  >
    <path
      d="M11.05 3.00002L4.20835 10.2417C3.95002 10.5167 3.70002 11.0584 3.65002 11.4334L3.34169 14.1334C3.23335 15.1084 3.93335 15.775 4.90002 15.6084L7.58335 15.15C7.95835 15.0834 8.48335 14.8084 8.74168 14.525L15.5834 7.28335C16.7667 6.03335 17.3 4.60835 15.4583 2.86668C13.625 1.14168 12.2334 1.75002 11.05 3.00002Z"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeMiterlimit={10}
      strokeWidth={1.5}
    />
    <path
      d="M9.90833 4.20831C10.2667 6.50831 12.1333 8.26665 14.45 8.49998"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeMiterlimit={10}
      strokeWidth={1.5}
    />
    <path
      d="M2.5 18.3333H17.5"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeMiterlimit={10}
      strokeWidth={1.5}
    />
  </svg>
);

// Helper to convert BirdEvent to table row format
function birdEventToRow(event: BirdEvent): CaptureFormData & { id: string } {
  return {
    id: event.id,
    programId: event.programId,
    bandGroup: event.band?.displayBandGroupId ?? "",
    bandLastTwoDigits: event.band?.last2digits ?? "",
    species: event.species,
    wing: String(event.wing || ""),
    age: event.age,
    howAged: event.howAged,
    sex: event.sex,
    howSexed: event.howSexed,
    fat: String(event.fat || ""),
    weight: String(event.weight || ""),
    date: event.date,
    time: event.time,
    bander: event.bander,
    scribe: event.scribe,
    net: event.net,
    captureType: event.birdEventType,
    notes: event.notes,
  };
}

type TableRow = CaptureFormData & { id: string };

interface BirdEventsTableProps {
  programId?: string;
  showOtherPrograms?: boolean;
  captures: BirdEvent[];
  maxTableHeight: number;
  sortColumn: keyof CaptureFormData;
  sortDirection: "ascending" | "descending";
}

export default function BirdEventsTable({
  programId,
  captures,
  maxTableHeight,
  sortColumn,
  sortDirection,
  showOtherPrograms,
}: BirdEventsTableProps) {
  const [sortDescriptors, setSortDescriptors] = useState<SortDescriptor[]>([
    { column: sortColumn, direction: sortDirection },
  ]);
  const [selectedBirdEvent, setSelectedBirdEvent] = useState<BirdEvent | null>(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isInspectModalOpen, setIsInspectModalOpen] = useState(false);

  // Convert BirdEvents to table rows
  const rows = useMemo(() => captures.map(birdEventToRow), [captures]);

  // Filter captures based on showOtherPrograms
  const filteredRows = useMemo(() => {
    if (programId === undefined || showOtherPrograms === undefined) {
      return rows;
    }
    if (showOtherPrograms) {
      return rows;
    } else {
      return rows.filter((row) => row.programId === programId);
    }
  }, [rows, showOtherPrograms, programId]);

  // Sort captures based on multiple sortDescriptors (cascading sort)
  const sortedRows = useMemo(() => {
    if (sortDescriptors.length === 0) return filteredRows;

    return [...filteredRows].sort((a, b) => {
      for (const descriptor of sortDescriptors) {
        const column = descriptor.column as keyof TableRow;
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
          // String comparison works for date (YYYY-MM-DD), time, and other text columns
          cmp = String(first).localeCompare(String(second));
        }

        if (cmp !== 0) {
          return descriptor.direction === "descending" ? -cmp : cmp;
        }
      }
      return 0;
    });
  }, [filteredRows, sortDescriptors]);

  const handleSortChange = useCallback((descriptor: SortDescriptor) => {
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

  const handleInspect = useCallback((eventId: string) => {
    const event = captures.find((e) => e.id === eventId);
    if (event) {
      setSelectedBirdEvent(event);
      setIsInspectModalOpen(true);
    }
  }, [captures]);

  const handleEdit = useCallback((eventId: string) => {
    const event = captures.find((e) => e.id === eventId);
    if (event) {
      setSelectedBirdEvent(event);
      setIsEditModalOpen(true);
    }
  }, [captures]);

  const renderCell = useCallback((item: TableRow, columnKey: React.Key) => {
    const cellValue = item[columnKey as keyof TableRow];

    if (columnKey === "actions") {
      return (
        <div className="relative flex items-center gap-2">
          <Tooltip content="Inspect">
            <span 
              className="text-lg text-default-400 cursor-pointer active:opacity-50"
              onClick={() => handleInspect(item.id)}
            >
              <EyeIcon />
            </span>
          </Tooltip>
          <Tooltip content="Edit capture">
            <span 
              className="text-lg text-default-400 cursor-pointer active:opacity-50"
              onClick={() => handleEdit(item.id)}
            >
              <EditIcon />
            </span>
          </Tooltip>
        </div>
      );
    }

    return cellValue;
  }, [handleInspect, handleEdit]);

  const primarySortDescriptor = sortDescriptors[0];

  return (
    <>
      <div className="w-full flex flex-col gap-4">
        <div className="text-sm">
          {filteredRows.length} of {rows.length} {rows.length === 1 ? "capture" : "captures"}
        </div>
        <Table
          isHeaderSticky
          aria-label="Captures table"
          sortDescriptor={primarySortDescriptor}
          onSortChange={handleSortChange}
          isVirtualized
          maxTableHeight={maxTableHeight}
        >
          <TableHeader columns={CAPTURE_COLUMNS}>
            {(column) => (
              <TableColumn 
                key={column.key} 
                allowsSorting={column.key !== "actions"} 
                className={`whitespace-nowrap ${column.className ?? ""}`}
              >
                {column.label}
              </TableColumn>
            )}
          </TableHeader>
          <TableBody items={sortedRows} emptyContent="No captures found">
            {(item) => (
              <TableRow key={item.id} className={programId && item.programId !== programId ? "opacity-20" : ""}>
                {(columnKey) => (
                  <TableCell className="whitespace-nowrap">
                    {renderCell(item, columnKey)}
                  </TableCell>
                )}
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
      
      <EditCaptureModal 
        isOpen={isEditModalOpen} 
        onOpenChange={setIsEditModalOpen}
        birdEvent={selectedBirdEvent}
      />
      <InspectCaptureModal 
        isOpen={isInspectModalOpen} 
        onOpenChange={setIsInspectModalOpen}
        birdEvent={selectedBirdEvent}
      />
    </>
  );
}
