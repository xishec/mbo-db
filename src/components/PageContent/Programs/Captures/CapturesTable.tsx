import {
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
import { useCallback, useEffect, useMemo, useState } from "react";
import { db } from "../../../../firebase";
import {
  type BandGroup,
  type BandGroupsMap,
  type Capture,
  type CapturesMap,
  generateCaptureTableId,
} from "../../../../helper/helper";

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

interface CapturesTableProps {
  program: string;
  captures: Capture[];
}

export default function CapturesTable({ program, captures }: CapturesTableProps) {
  const [sortDescriptors, setSortDescriptors] = useState<SortDescriptor[]>([]);
  const [bandGroupsMap, setBandGroupsMap] = useState<BandGroupsMap>(new Map());
  const [relatedCapturesMap, setRelatedCapturesMap] = useState<CapturesMap>(new Map());
  const [isLoadingBandGroups, setIsLoadingBandGroups] = useState(true);
  const [isLoadingRelatedCaptures, setIsLoadingRelatedCaptures] = useState(false);

  // Fetch bandGroupsMap from RTDB
  useEffect(() => {
    const bandGroupsRef = ref(db, "bandGroupsMap");

    const unsubscribe = onValue(bandGroupsRef, (snapshot) => {
      if (snapshot.exists()) {
        const rawBandGroupsMap = snapshot.val() as Record<string, BandGroup>;
        const newBandGroupsMap: BandGroupsMap = new Map(
          Object.entries(rawBandGroupsMap).map(([id, bandGroup]) => [
            id,
            {
              id: id,
              captureIds: new Set(bandGroup.captureIds ?? []),
            },
          ])
        );
        setBandGroupsMap(newBandGroupsMap);
      }
      setIsLoadingBandGroups(false);
    });
    return unsubscribe;
  }, []);

  // Get unique bandGroupIds from captures, sorted
  const bandGroupIds = useMemo(() => {
    const bandGroupSet = new Set<string>();
    for (const capture of captures) {
      if (capture.bandGroupId) {
        bandGroupSet.add(capture.bandGroupId);
      }
    }
    return Array.from(bandGroupSet).sort();
  }, [captures]);

  // Fetch captures for all bandGroupIds
  useEffect(() => {
    if (isLoadingBandGroups || bandGroupIds.length === 0) {
      setRelatedCapturesMap(new Map());
      return;
    }

    // Collect all captureIds from all bandGroups
    const captureIdsToFetch = new Set<string>();
    for (const bandGroupId of bandGroupIds) {
      const bandGroup = bandGroupsMap.get(bandGroupId);
      if (bandGroup) {
        for (const captureId of bandGroup.captureIds) {
          captureIdsToFetch.add(captureId);
        }
      }
    }

    if (captureIdsToFetch.size === 0) {
      setRelatedCapturesMap(new Map());
      return;
    }

    setIsLoadingRelatedCaptures(true);
    const captureIdArray = Array.from(captureIdsToFetch);
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
          setRelatedCapturesMap(new Map(newCapturesMap));
          setIsLoadingRelatedCaptures(false);
        }
      });
    });

    return () => unsubscribes.forEach((unsubscribe) => unsubscribe());
  }, [bandGroupIds, bandGroupsMap, isLoadingBandGroups]);

  // Get captures to display for current bandGroupId
  const capturesToDisplay = useMemo(() => {
    return Array.from(relatedCapturesMap.values());
  }, [relatedCapturesMap]);

  // Sort captures based on multiple sortDescriptors (cascading sort)
  const sortedCaptures = useMemo(() => {
    if (sortDescriptors.length === 0) return capturesToDisplay;

    return [...capturesToDisplay].sort((a, b) => {
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
  }, [capturesToDisplay, sortDescriptors]);

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

  const primarySortDescriptor = sortDescriptors[0];

  // Get IDs of captures that don't belong to the current program
  const disabledKeys = useMemo(() => {
    return sortedCaptures.filter((capture) => capture.program !== program).map((capture) => capture.id);
  }, [sortedCaptures, program]);

  if (isLoadingBandGroups || isLoadingRelatedCaptures) {
    return (
      <div className="p-4 flex items-center gap-2">
        <Spinner size="sm" /> Loading captures...
      </div>
    );
  }

  return (
    <Table
      isHeaderSticky
      aria-label="Captures table"
      sortDescriptor={primarySortDescriptor}
      onSortChange={handleSortChange}
      disabledKeys={disabledKeys}
    >
      <TableHeader columns={CAPTURE_COLUMNS}>
        {(column) => (
          <TableColumn key={column.key} allowsSorting className="whitespace-nowrap">
            {column.label}
          </TableColumn>
        )}
      </TableHeader>
      <TableBody items={sortedCaptures} emptyContent="No captures found">
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
  );
}
