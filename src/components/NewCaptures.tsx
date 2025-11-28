import {
  Autocomplete,
  AutocompleteItem,
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
import type { BandGroupsMap, CapturesMap, Capture } from "../types/types";

const CAPTURE_COLUMNS: { key: keyof Capture; label: string; className?: string }[] = [
  { key: "id", label: "ID", className: "min-w-[260px]" },
  { key: "species", label: "Species" },
  { key: "bandPrefix", label: "Band Prefix" },
  { key: "bandSuffix", label: "Band Suffix" },
  { key: "date", label: "Date" },
  { key: "time", label: "Time" },
  { key: "age", label: "Age" },
  { key: "sex", label: "Sex" },
  { key: "wing", label: "Wing" },
  { key: "weight", label: "Weight" },
  { key: "fat", label: "Fat" },
  { key: "bander", label: "Bander" },
  { key: "net", label: "Net" },
  { key: "notes", label: "Notes" },
];

export default function NewCaptures({ bandGroupIds }: { bandGroupIds: Set<string> }) {
  const [bandGroupsMap, setBandGroupsMap] = useState<BandGroupsMap>(new Map());
  const [capturesMap, setCapturesMap] = useState<CapturesMap>(new Map());
  const [selectedBandGroupId, setSelectedBandGroupId] = useState<string | null>(null);
  const [isLoadingBandGroups, setIsLoadingBandGroups] = useState(true);
  const [isLoadingCaptures, setIsLoadingCaptures] = useState(false);
  const [sortDescriptor, setSortDescriptor] = useState<SortDescriptor>({});

  // Fetch BandGroupsMap from RTDB
  useEffect(() => {
    const bandGroupsRef = ref(db, "bandGroupsMap");
    const unsubscribe = onValue(bandGroupsRef, (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.val();
        const newBandGroupsMap: BandGroupsMap = new Map();
        for (const [id, bandGroupData] of Object.entries(data) as [string, { id: string; captureIds: string[] }][]) {
          newBandGroupsMap.set(id, {
            id: bandGroupData.id,
            captureIds: new Set(bandGroupData.captureIds ?? []),
          });
        }
        setBandGroupsMap(newBandGroupsMap);
      }
      setIsLoadingBandGroups(false);
    });
    return unsubscribe;
  }, []);

  // Fetch CapturesMap from RTDB
  useEffect(() => {
    if (!selectedBandGroupId) {
      setCapturesMap(new Map());
      return;
    }

    setIsLoadingCaptures(true);
    const capturesRef = ref(db, "capturesMap");
    const unsubscribe = onValue(capturesRef, (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.val();
        const newCapturesMap: CapturesMap = new Map();
        for (const [id, captureData] of Object.entries(data) as [string, Capture][]) {
          newCapturesMap.set(id, captureData);
        }
        setCapturesMap(newCapturesMap);
      }
      setIsLoadingCaptures(false);
    });
    return unsubscribe;
  }, [selectedBandGroupId]);

  // Filter bandGroupIds to only those passed from parent
  const filteredBandGroupIds = useMemo(() => {
    return Array.from(bandGroupIds).sort();
  }, [bandGroupIds]);

  // Get captureIds for selected band group
  const captureIds = useMemo(() => {
    if (!selectedBandGroupId) return [];
    const bandGroup = bandGroupsMap.get(selectedBandGroupId);
    return bandGroup ? Array.from(bandGroup.captureIds) : [];
  }, [selectedBandGroupId, bandGroupsMap]);

  // Get captures for the selected band group
  const captures = useMemo(() => {
    return captureIds.map((id) => capturesMap.get(id)).filter((c): c is Capture => c !== undefined);
  }, [captureIds, capturesMap]);

  // Sort captures based on sortDescriptor
  const sortedCaptures = useMemo(() => {
    if (!sortDescriptor.column) return captures;

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

  const handleSortChange = useCallback((descriptor: SortDescriptor) => {
    setSortDescriptor(descriptor);
  }, []);

  if (isLoadingBandGroups) {
    return (
      <div className="p-4 flex items-center gap-2">
        <Spinner size="sm" /> Loading band groups...
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <Autocomplete
        labelPlacement="outside"
        label="Select Band Group"
        placeholder="Search band groups..."
        selectedKey={selectedBandGroupId}
        onSelectionChange={(key) => setSelectedBandGroupId(key as string | null)}
        className="max-w-md"
      >
        {filteredBandGroupIds.map((id) => (
          <AutocompleteItem key={id}>{id}</AutocompleteItem>
        ))}
      </Autocomplete>

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
        >
          <TableHeader columns={CAPTURE_COLUMNS}>
            {(column) => (
              <TableColumn key={column.key} allowsSorting className={column.className}>
                {column.label}
              </TableColumn>
            )}
          </TableHeader>
          <TableBody items={sortedCaptures} emptyContent="Select a band group to view captures">
            {(item) => (
              <TableRow key={item.id}>
                {(columnKey) => <TableCell>{String(item[columnKey as keyof Capture] ?? "")}</TableCell>}
              </TableRow>
            )}
          </TableBody>
        </Table>
      )}
    </div>
  );
}
