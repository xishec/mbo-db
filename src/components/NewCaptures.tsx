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
import type { BandGroupsMap, CapturesMap, Capture, Program } from "../types/types";

const CAPTURE_COLUMNS: { key: keyof Capture; label: string }[] = [
  { key: "lastTwoDigits", label: "Band" },
  { key: "species", label: "Species" },
  { key: "wing", label: "Wing" },
  { key: "age", label: "Age" },
  { key: "howAged", label: "How Aged" },
  { key: "sex", label: "Sex" },
  { key: "howSexed", label: "How Sexed" },
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
  const [bandGroupsMap, setBandGroupsMap] = useState<BandGroupsMap>(new Map());
  const [capturesMap, setCapturesMap] = useState<CapturesMap>(new Map());
  const [selectedBandGroupId, setSelectedBandGroupId] = useState<string | null>(null);
  const [isLoadingBandGroups, setIsLoadingBandGroups] = useState(true);
  const [isLoadingCaptures, setIsLoadingCaptures] = useState(true);
  const [sortDescriptor, setSortDescriptor] = useState<SortDescriptor>();

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

  // Fetch CapturesMap from RTDB (only for selected band group's captureIds)
  useEffect(() => {
    if (!selectedBandGroupId) {
      return;
    }

    const bandGroup = bandGroupsMap.get(selectedBandGroupId);
    if (!bandGroup) {
      setIsLoadingCaptures(false);
      return;
    }

    const captureIds = Array.from(bandGroup.captureIds);
    if (captureIds.length === 0) {
      setCapturesMap(new Map());
      setIsLoadingCaptures(false);
      return;
    }

    setIsLoadingCaptures(true);
    const newCapturesMap: CapturesMap = new Map();

    const unsubscribes = captureIds.map((captureId) => {
      const captureRef = ref(db, `capturesMap/${captureId}`);
      return onValue(captureRef, (snapshot) => {
        if (snapshot.exists()) {
          const rawCapture = snapshot.val() as Capture;
          if (rawCapture.program === program.name) {
            newCapturesMap.set(captureId, rawCapture);
          }
        }
        setCapturesMap(new Map(newCapturesMap));
        setIsLoadingCaptures(false);
      });
    });

    return () => unsubscribes.forEach((unsubscribe) => unsubscribe());
  }, [selectedBandGroupId, bandGroupsMap, program]);

  // Filter bandGroupIds to only those passed from parent
  const filteredBandGroupIds = useMemo(() => {
    return Array.from(program.bandGroupIds).sort();
  }, [program.bandGroupIds]);

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
              <TableColumn key={column.key} allowsSorting>
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
