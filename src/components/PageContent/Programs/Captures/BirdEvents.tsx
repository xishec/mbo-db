import { Button, Spinner, useDisclosure, Tab, Tabs, Select, SelectItem } from "@heroui/react";
import { useState, useMemo, useCallback } from "react";
import { useData } from "../../../../services/useData";
import AddBirdEventModal from "../../../Modals/AddBirdEventModal";
import { Band, BandSize, getBandGroupMapKey } from "../../../../types";
import BirdEventsTable from "./BirdEventsTable";
import { PlusIcon } from "@heroicons/react/24/outline";

const NETS = [
  "A1",
  "A2",
  "B2",
  "B3",
  "C1",
  "C2",
  "D1",
  "D2",
  "D3",
  "D4",
  "E1",
  "E2",
  "H1",
  "H2",
  "N1",
  "N3",
  "other",
] as const;

export default function BirdEvents() {
  const { isOpen, onOpen, onOpenChange } = useDisclosure();
  const { selectedProgram, isLoading, bandSizeToBandIdMap, isLoggedIn, bandGroupsMap, birdEventsMap } = useData();
  const [selectedNet, setSelectedNet] = useState<string>("");
  // Three-state logic: undefined = auto-select default, null = show empty table, string = show this band group
  const [selectedBandGroupId, setSelectedBandGroupId] = useState<string | null | undefined>(undefined);
  const [modalBandSize, setModalBandSize] = useState<BandSize>(BandSize.Size0a);
  const [showRecaptures, setShowRecaptures] = useState(false);

  if (!selectedProgram) {
    return null;
  }

  if (isLoading) {
    return (
      <div className="p-4 flex items-center gap-4">
        <Spinner size="sm" /> Loading program...
      </div>
    );
  }

  // Map band group ID to its band size label
  const bandGroupToBandSize = useMemo(() => {
    const map: Record<string, BandSize> = {};
    for (const [size, bandId] of Object.entries(bandSizeToBandIdMap)) {
      if (!bandId || bandId.length < 7) continue;
      const band = new Band(bandId.slice(0, 4), bandId.slice(4, 9));
      map[getBandGroupMapKey(band)] = size as BandSize;
    }
    return map;
  }, [bandSizeToBandIdMap]);

  // Map band size to band group ID
  const bandSizeToBandGroup = useMemo(() => {
    const map: Record<string, string> = {};
    for (const [bandGroupId, bandSize] of Object.entries(bandGroupToBandSize)) {
      map[bandSize] = bandGroupId;
    }
    return map;
  }, [bandGroupToBandSize]);

  // Get sorted band group IDs for the selected program
  const bandGroupIds = useMemo(() => {
    const ids = selectedProgram?.bandGroupIds ?? [];
    const sizeOrder = Object.values(BandSize);
    return ids.sort((a, b) => {
      const sizeA = bandGroupToBandSize[a];
      const sizeB = bandGroupToBandSize[b];
      const orderA = sizeA ? sizeOrder.indexOf(sizeA) : sizeOrder.length;
      const orderB = sizeB ? sizeOrder.indexOf(sizeB) : sizeOrder.length;
      if (orderA !== orderB) return orderA - orderB;
      return a.localeCompare(b);
    });
  }, [selectedProgram, bandGroupToBandSize]);

  // Pre-calculate counts and next available digits for all band groups (including those from settings)
  const bandGroupInfo = useMemo(() => {
    const info: Record<string, { count: number; nextDigits: string }> = {};

    // First, process all band groups from current program
    for (const bandGroupId of bandGroupIds) {
      const bandGroup = bandGroupsMap[bandGroupId];
      if (bandGroup) {
        const validEvents = bandGroup.newCaptureIds
          .map((id) => birdEventsMap[id])
          .filter((event) => event && event.modifiedEventId == null);

        const count = validEvents.length;

        // Find the highest last2digits used
        let maxDigits = -1;
        for (const event of validEvents) {
          const digits = parseInt(event.band.last2digits, 10);
          if (!isNaN(digits) && digits > maxDigits) {
            maxDigits = digits;
          }
        }

        // Calculate next: 01->02, 99->00
        let nextDigits = "01";
        if (maxDigits >= 0) {
          const next = maxDigits === 99 ? 0 : maxDigits + 1;
          nextDigits = next.toString().padStart(2, "0");
        }

        info[bandGroupId] = { count, nextDigits };
      } else {
        info[bandGroupId] = { count: 0, nextDigits: "01" };
      }
    }

    // Add band groups from settings that aren't in current program
    for (const [size, bandGroupId] of Object.entries(bandSizeToBandGroup)) {
      if (!info[bandGroupId]) {
        const bandId = bandSizeToBandIdMap[size as BandSize];
        let nextDigits = "01";
        if (bandId && bandId.length === 9) {
          const band = new Band(bandId.slice(0, 4), bandId.slice(4, 9));
          nextDigits = band.last2digits;
        }
        info[bandGroupId] = { count: 0, nextDigits };
      }
    }

    return info;
  }, [bandGroupIds, bandGroupsMap, birdEventsMap, bandSizeToBandGroup, bandSizeToBandIdMap]);

  // Get other band groups (have captures but no band size assigned in settings)
  const otherBandGroups = useMemo(() => {
    const other: string[] = [];
    for (const id of bandGroupIds) {
      const hasNoBandSize = !bandGroupToBandSize[id];
      const hasCaptures = (bandGroupInfo[id]?.count ?? 0) > 0;
      if (hasNoBandSize && hasCaptures) {
        other.push(id);
      }
    }
    return other;
  }, [bandGroupIds, bandGroupToBandSize, bandGroupInfo]);

  // Determine which band group to display
  const displayBandGroupId = useMemo(() => {
    // User explicitly selected something (including null for empty band group)
    if (selectedBandGroupId !== undefined) {
      return selectedBandGroupId;
    }
    // Default to first non-Other band group
    for (const size of Object.values(BandSize)) {
      const bandGroupId = bandSizeToBandGroup[size];
      if (bandGroupId && size !== BandSize.Other) {
        return bandGroupId;
      }
    }
    return bandGroupIds[0] ?? null;
  }, [selectedBandGroupId, bandGroupIds, bandSizeToBandGroup]);

  // Get captures for the displayed band group
  const captures = useMemo(() => {
    if (!displayBandGroupId) return [];
    const bandGroup = bandGroupsMap[displayBandGroupId];
    return bandGroup?.newCaptureIds.map((id) => birdEventsMap[id]).filter(Boolean) ?? [];
  }, [displayBandGroupId, bandGroupsMap, birdEventsMap]);

  // Get recaptures for the current program
  const recaptures = useMemo(() => {
    if (!selectedProgram?.recaptureIds) return [];
    return selectedProgram.recaptureIds.map((id) => birdEventsMap[id]).filter(Boolean);
  }, [selectedProgram, birdEventsMap]);

  const handleNetTabChange = useCallback((key: React.Key) => {
    const netValue = key as string;
    if (netValue === "other") {
      setSelectedNet("");
    } else {
      setSelectedNet(netValue);
    }
  }, []);

  // Sort descriptors for captures (by band digits) and recaptures (by date/time)
  const captureSortDescriptors = useMemo(
    () => [{ column: "bandLastTwoDigits" as const, direction: "ascending" as const }],
    []
  );

  const recaptureSortDescriptors = useMemo(
    () => [
      { column: "date" as const, direction: "ascending" as const },
      { column: "time" as const, direction: "ascending" as const },
    ],
    []
  );

  const handleBandGroupSelect = useCallback((bandGroupId: string | null) => {
    setSelectedBandGroupId(bandGroupId);
    setShowRecaptures(false);
  }, []);

  const handleRecapturesSelect = useCallback(() => {
    setShowRecaptures(true);
    setSelectedBandGroupId(undefined);
  }, []);

  const handleBandGroupAdd = useCallback(
    (bandGroupId: string) => {
      const bandSize = bandGroupToBandSize[bandGroupId];
      if (bandSize) {
        setSelectedBandGroupId(bandGroupId);
        setShowRecaptures(false);
        setModalBandSize(bandSize);
        onOpen();
      }
    },
    [bandGroupToBandSize, onOpen]
  );

  return (
    <div className="w-full flex flex-col items-center gap-8">
      <AddBirdEventModal
        isOpen={isOpen}
        onOpenChange={onOpenChange}
        bandSize={modalBandSize}
        isNewCapture={true}
        defaultNet={selectedNet}
      />

      <div className="w-full flex flex-col gap-4">
        {isLoggedIn && (
          <div className="flex items-center gap-3">
            <span>Net:</span>
            <Tabs
              color="secondary"
              size="md"
              selectedKey={selectedNet || undefined}
              onSelectionChange={handleNetTabChange}
              classNames={{
                tabContent: "!text-foreground group-data-[selected=true]:!text-secondary-foreground",
              }}
            >
              {NETS.map((net) => (
                <Tab key={net} title={net} />
              ))}
            </Tabs>
          </div>
        )}

        <div className="flex items-center gap-3 flex-wrap">
          <span>Page:</span>
          <Select
            placeholder="Select page"
            variant="bordered"
            selectedKeys={
              showRecaptures
                ? ["recaptures"]
                : displayBandGroupId
                  ? [displayBandGroupId]
                  : displayBandGroupId === null
                    ? ["other"]
                    : []
            }
            onSelectionChange={(keys) => {
              const selected = Array.from(keys)[0] as string | undefined;
              if (selected === "recaptures") {
                handleRecapturesSelect();
              } else if (selected === "other") {
                handleBandGroupSelect(null);
              } else if (selected) {
                handleBandGroupSelect(selected);
              }
            }}
            size="md"
            className="max-w-[200px]"
            classNames={{
              trigger: "min-h-unit-10 h-unit-10",
              value: "text-sm",
            }}
          >
            <>
              {Object.values(BandSize)
                .filter((size) => size !== BandSize.Other)
                .filter((size) => bandSizeToBandGroup[size])
                .map((size) => {
                  const bandGroupId = bandSizeToBandGroup[size]!;
                  const { nextDigits } = bandGroupInfo[bandGroupId] ?? { count: 0, nextDigits: "01" };
                  const label = `${size} - ${bandGroupId}-${nextDigits}`;

                  return <SelectItem key={bandGroupId}>{label}</SelectItem>;
                })}
              <SelectItem key="other">Other Size</SelectItem>
              <SelectItem key="recaptures">Recaptures</SelectItem>
            </>
          </Select>
          <Button
            color="secondary"
            variant="solid"
            onPress={() => {
              if (showRecaptures || displayBandGroupId === null) {
                setModalBandSize(BandSize.Other);
                onOpen();
              } else if (displayBandGroupId) {
                handleBandGroupAdd(displayBandGroupId);
              }
            }}
            className="min-w-[60px] mr-[185px]"
          >
            <PlusIcon className="w-5 h-5" />
          </Button>
          {otherBandGroups.length > 0 && (
            <>
              <span>Other bands:</span>
              <Select
                placeholder="Other band groups"
                variant="bordered"
                selectedKeys={otherBandGroups.includes(displayBandGroupId || "") ? [displayBandGroupId || ""] : []}
                onSelectionChange={(keys) => {
                  const selected = Array.from(keys)[0] as string | undefined;
                  if (selected) {
                    setSelectedBandGroupId(selected);
                    setShowRecaptures(false);
                  }
                }}
                size="md"
                className="max-w-[250px]"
                classNames={{
                  trigger: "min-h-unit-10 h-unit-10",
                  value: "text-sm",
                }}
              >
                {otherBandGroups.map((bandGroupId) => {
                  const { count } = bandGroupInfo[bandGroupId] ?? { count: 0 };

                  return (
                    <SelectItem key={bandGroupId} endContent={<span className="text-xs opacity-60">{count} used</span>}>
                      {bandGroupId}
                    </SelectItem>
                  );
                })}
              </Select>
            </>
          )}
        </div>
      </div>

      {showRecaptures || displayBandGroupId !== undefined ? (
        <BirdEventsTable
          programId={selectedProgram?.id}
          birdEvents={showRecaptures ? recaptures : captures}
          maxTableHeight={600}
          sortDescriptors={showRecaptures ? recaptureSortDescriptors : captureSortDescriptors}
          showOtherPrograms={true}
          allowInspectBandId
          scrollToEnd
        />
      ) : (
        <div className="p-4">No band groups available</div>
      )}
    </div>
  );
}
