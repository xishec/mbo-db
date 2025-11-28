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
} from "@heroui/react";
import { onValue, ref } from "firebase/database";
import { useMemo, useState, useEffect } from "react";
import { db } from "../firebase";
import type { BandGroupsMap, CapturesMap, Capture } from "../types/types";

const CAPTURE_COLUMNS: (keyof Capture)[] = [
  "id",
  "species",
  "bandPrefix",
  "bandSuffix",
  "date",
  "time",
  "age",
  "sex",
  "wing",
  "weight",
  "fat",
  "bander",
  "net",
  "notes",
];

export default function NewCaptures({ bandGroupIds }: { bandGroupIds: Set<string> }) {
  const [bandGroupsMap, setBandGroupsMap] = useState<BandGroupsMap>(new Map());
  const [capturesMap, setCapturesMap] = useState<CapturesMap>(new Map());
  const [selectedBandGroupId, setSelectedBandGroupId] = useState<string | null>(null);
  const [isLoadingBandGroups, setIsLoadingBandGroups] = useState(true);
  const [isLoadingCaptures, setIsLoadingCaptures] = useState(false);

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
        <Table isHeaderSticky aria-label="Captures table">
          <TableHeader>
            {CAPTURE_COLUMNS.map((col) => (
              <TableColumn key={col}>{col}</TableColumn>
            ))}
          </TableHeader>
          <TableBody items={captures} emptyContent="Select a band group to view captures">
            {(item) => (
              <TableRow key={item.id}>
                {CAPTURE_COLUMNS.map((col) => (
                  <TableCell key={col}>{String(item[col] ?? "")}</TableCell>
                ))}
              </TableRow>
            )}
          </TableBody>
        </Table>
      )}
    </div>
  );
}
