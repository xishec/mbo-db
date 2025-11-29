import {
  Autocomplete,
  AutocompleteItem,
  Button,
  Pagination,
  Select,
  SelectItem,
  Spinner,
  Table,
  TableBody,
  TableCell,
  TableColumn,
  TableHeader,
  TableRow,
  useDisclosure,
  type SortDescriptor,
} from "@heroui/react";
import { onValue, ref } from "firebase/database";
import { useCallback, useEffect, useMemo, useState } from "react";
import { db } from "../firebase";
import { type Capture, type CapturesMap, type Program, type ProgramsMap, generateCaptureTableId } from "../types/types";
import AddCaptureModal from "./AddCaptureModal";

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

type CaptureType = "new" | "re";

const CAPTURE_TYPE_OPTIONS: { key: CaptureType; label: string }[] = [
  { key: "new", label: "New Captures" },
  { key: "re", label: "Re Captures" },
];

export default function Captures({ selectedProgram }: { selectedProgram: string }) {
  const [programsMap, setProgramsMap] = useState<ProgramsMap>(new Map());
  const [isLoading, setIsLoading] = useState(true);
  const [captureType, setCaptureType] = useState<CaptureType>("new");
  const [capturesMap, setCapturesMap] = useState<CapturesMap>(new Map());
  const [selectedBandGroupId, setSelectedBandGroupId] = useState<string>("All");
  const [isLoadingCaptures, setIsLoadingCaptures] = useState(true);
  const [sortDescriptors, setSortDescriptors] = useState<SortDescriptor[]>([]);
  const [page, setPage] = useState(1);
  const rowsPerPage = 50;
  const { isOpen, onOpen, onOpenChange } = useDisclosure();

  // Fetch programs map
  useEffect(() => {
    const programsMapRef = ref(db, "programsMap");

    const unsubscribe = onValue(programsMapRef, (snapshot) => {
      if (snapshot.exists()) {
        const rawProgramsMap = snapshot.val() as ProgramsMap;
        const newProgramsMap: ProgramsMap = new Map(
          Object.entries(rawProgramsMap).map(([name, program]) => [
            name,
            {
              name: name,
              newCaptureIds: new Set(program.newCaptureIds ?? []),
              reCaptureIds: new Set(program.reCaptureIds ?? []),
            },
          ])
        );
        setProgramsMap(newProgramsMap);
      }
      setIsLoading(false);
    });
    return unsubscribe;
  }, []);

  const program: Program | undefined = useMemo(
    () => programsMap.get(selectedProgram ?? ""),
    [programsMap, selectedProgram]
  );

  // Get the relevant capture IDs based on capture type
  const captureIds = useMemo(() => {
    if (!program) return new Set<string>();
    return captureType === "new" ? program.newCaptureIds : program.reCaptureIds;
  }, [program, captureType]);

  // Extract bandGroupId from captureId (captureId format: ${date}-${bandGroupId}${lastTwoDigits})
  const extractBandGroupId = (captureId: string): string => {
    const withoutDate = captureId.replace(/^\d{4}-\d{2}-\d{2}-/, "");
    return withoutDate.slice(0, -2);
  };

  // Compute unique band group IDs from captureIds
  const bandGroupIds = useMemo(() => {
    const bandGroupSet = new Set<string>();
    for (const captureId of captureIds) {
      bandGroupSet.add(extractBandGroupId(captureId));
    }
    return ["All", ...Array.from(bandGroupSet).sort()];
  }, [captureIds]);

  // Fetch captures from RTDB
  useEffect(() => {
    const captureIdArray = Array.from(captureIds);

    if (captureIdArray.length === 0) {
      setCapturesMap(new Map());
      setIsLoadingCaptures(false);
      return;
    }

    setIsLoadingCaptures(true);
    const newCapturesMap: CapturesMap = new Map();
    let loadedCount = 0;

    const unsubscribes = captureIdArray.map((captureId) => {
      const captureRef = ref(db, `capturesMap/${captureId}`);
      return onValue(captureRef, (snapshot) => {
        if (snapshot.exists()) {
          const rawCapture = snapshot.val() as Capture;
          newCapturesMap.set(captureId, rawCapture);
        }
        loadedCount++;
        if (loadedCount >= captureIdArray.length) {
          setCapturesMap(new Map(newCapturesMap));
          setIsLoadingCaptures(false);
        }
      });
    });

    return () => unsubscribes.forEach((unsubscribe) => unsubscribe());
  }, [captureIds]);

  // Reset band group selection when capture type changes
  useEffect(() => {
    setSelectedBandGroupId("All");
    setPage(1);
  }, [captureType]);

  // Get captures filtered by selected band group
  const captures = useMemo(() => {
    const allCaptures = Array.from(capturesMap.values());

    if (selectedBandGroupId === "All") {
      return allCaptures;
    }

    return allCaptures.filter((capture) => capture.bandGroupId === selectedBandGroupId);
  }, [capturesMap, selectedBandGroupId]);

  // Sort captures based on multiple sortDescriptors (cascading sort)
  const sortedCaptures = useMemo(() => {
    if (sortDescriptors.length === 0) return captures;

    return [...captures].sort((a, b) => {
      for (const descriptor of sortDescriptors) {
        const column = descriptor.column as keyof Capture;
        const first = a[column];
        const second = b[column];

        const firstVal = parseInt(String(first)) || first;
        const secondVal = parseInt(String(second)) || second;

        const cmp = firstVal < secondVal ? -1 : firstVal > secondVal ? 1 : 0;

        if (cmp !== 0) {
          return descriptor.direction === "descending" ? -cmp : cmp;
        }
      }
      return 0;
    });
  }, [captures, sortDescriptors]);

  // Calculate pagination
  const pages = Math.ceil(sortedCaptures.length / rowsPerPage);
  const paginatedCaptures = useMemo(() => {
    const start = (page - 1) * rowsPerPage;
    const end = start + rowsPerPage;
    return sortedCaptures.slice(start, end);
  }, [page, sortedCaptures]);

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
    setPage(1);
  }, []);

  const primarySortDescriptor = sortDescriptors[0];

  if (!selectedProgram) {
    return null;
  }

  if (isLoading) {
    return (
      <div className="p-4 flex items-center gap-2">
        <Spinner size="sm" /> Loading captures...
      </div>
    );
  }

  return (
    <div className="w-full flex flex-col items-center gap-4">
      <AddCaptureModal isOpen={isOpen} onOpenChange={onOpenChange} />

      <div className="w-full max-w-6xl flex items-end justify-between gap-4">
        <div className="flex items-end gap-4">
          <Select
            label="Capture Type"
            labelPlacement="outside"
            variant="bordered"
            selectedKeys={[captureType]}
            onSelectionChange={(keys) => {
              const selected = Array.from(keys)[0] as CaptureType;
              if (selected) setCaptureType(selected);
            }}
          >
            {CAPTURE_TYPE_OPTIONS.map((option) => (
              <SelectItem key={option.key}>{option.label}</SelectItem>
            ))}
          </Select>
          <Autocomplete
            labelPlacement="outside"
            variant="bordered"
            label="Select Band Group"
            placeholder="Search band groups..."
            selectedKey={selectedBandGroupId}
            onSelectionChange={(key) => setSelectedBandGroupId((key as string) ?? "All")}
          >
            {bandGroupIds.map((id) => (
              <AutocompleteItem key={id}>{id}</AutocompleteItem>
            ))}
          </Autocomplete>
        </div>
        <Button color="secondary" onPress={onOpen}>
          Add Capture
        </Button>
      </div>

      {isLoadingCaptures ? (
        <div className="p-4 flex items-center gap-2">
          <Spinner size="sm" /> Loading captures...
        </div>
      ) : (
        <Table
          isHeaderSticky
          aria-label="Captures table"
          sortDescriptor={primarySortDescriptor}
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
          <TableBody items={paginatedCaptures} emptyContent="No captures found">
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
