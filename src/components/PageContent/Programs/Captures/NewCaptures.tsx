import { Select, SelectItem, Chip, Spinner, Switch } from "@heroui/react";
import { useMemo, useState, useEffect, useRef } from "react";
import { useData } from "../../../../services/useData";
import { Band, BandSize, getBandGroupMapKey } from "../../../../types";
import BirdEventsTable from "./BirdEventsTable";

export default function NewCaptures({ activeBandGroupId }: { activeBandGroupId?: string | null }) {
  const { selectedProgram, bandGroupsMap, birdEventsMap, bandSizeToBandIdMap, isLoading } = useData();

  // Get band group IDs for the selected program
  const bandGroupIds = useMemo(() => {
    return selectedProgram?.bandGroupIds ?? [];
  }, [selectedProgram]);

  // Build bandGroupToNewCaptures from the data
  const bandGroupToNewCaptures = useMemo(() => {
    const result: Record<string, (typeof birdEventsMap)[string][]> = {};
    for (const bandGroupId of bandGroupIds) {
      const bandGroup = bandGroupsMap[bandGroupId];
      if (bandGroup) {
        result[bandGroupId] = bandGroup.newCaptureIds.map((id) => birdEventsMap[id]).filter(Boolean);
      }
    }
    return result;
  }, [bandGroupIds, bandGroupsMap, birdEventsMap]);

  // Map band group ID to its band size label
  const bandGroupToBandSize = useMemo(() => {
    const map: Record<string, string> = {};
    for (const [size, bandId] of Object.entries(bandSizeToBandIdMap)) {
      if (size === BandSize.Other || !bandId || bandId.length < 7) continue;
      // Band class expects: bandPrefix (4 chars) + bandSuffix (5 chars = 3 middle + 2 last)
      const bandPrefix = bandId.slice(0, 4);
      const bandSuffix = bandId.slice(4, 9);
      // Use getBandGroupMapKey to get the correct map key: 2991562-00 → "2991561"
      const band = new Band(bandPrefix, bandSuffix);
      map[getBandGroupMapKey(band)] = size;
    }
    return map;
  }, [bandSizeToBandIdMap]);

  // Convert bandGroupToNewCaptures keys to sorted array, ordered by band size then band group ID.
  // Include the hovered group even when it isn't assigned to the current program so the Select
  // can render a matching entry for an out-of-program band size suggestion.
  const bandGroupOptions = useMemo(() => {
    const sizeOrder = Object.values(BandSize);
    const groups = new Set(Object.keys(bandGroupToNewCaptures));
    if (activeBandGroupId) groups.add(activeBandGroupId);
    return [...groups].sort((a, b) => {
      const sizeA = bandGroupToBandSize[a];
      const sizeB = bandGroupToBandSize[b];
      const orderA = sizeA ? sizeOrder.indexOf(sizeA as BandSize) : sizeOrder.length;
      const orderB = sizeB ? sizeOrder.indexOf(sizeB as BandSize) : sizeOrder.length;
      if (orderA !== orderB) return orderA - orderB;
      return a.localeCompare(b);
    });
  }, [bandGroupToNewCaptures, bandGroupToBandSize, activeBandGroupId]);

  const [selectedBandGroupId, setSelectedBandGroupId] = useState<string | null>(null);
  const [showOtherPrograms, setShowOtherPrograms] = useState(true);
  const prevBandGroupIdsRef = useRef<string[]>([]);

  // Switch band group when parent requests (band size button click)
  useEffect(() => {
    if (activeBandGroupId) setSelectedBandGroupId(activeBandGroupId);
  }, [activeBandGroupId]);

  // Auto-select newly added band group
  useEffect(() => {
    const currentBandGroupIds = bandGroupOptions;
    const prevBandGroupIds = prevBandGroupIdsRef.current;

    // Check if a new band group was added
    if (currentBandGroupIds.length > prevBandGroupIds.length) {
      const newBandGroupId = currentBandGroupIds.find((id) => !prevBandGroupIds.includes(id));
      if (newBandGroupId) {
        setSelectedBandGroupId(newBandGroupId);
      }
    }

    // Update ref for next comparison
    prevBandGroupIdsRef.current = currentBandGroupIds;
  }, [bandGroupOptions]);

  // Derive effective selection: use selected if valid, otherwise default to first option
  const effectiveBandGroupId = useMemo(() => {
    if (selectedBandGroupId && bandGroupOptions.includes(selectedBandGroupId)) {
      return selectedBandGroupId;
    }
    return bandGroupOptions[0] ?? null;
  }, [selectedBandGroupId, bandGroupOptions]);

  // Get captures for the selected bandGroup. Fall back to the global bandGroupsMap
  // so an out-of-program group (e.g. a hovered band-size suggestion whose next band
  // belongs to a group that was banded under a different program) still shows its
  // captures when "Show all captures" is enabled.
  const captures = useMemo(() => {
    if (!effectiveBandGroupId) return [];
    const inProgram = bandGroupToNewCaptures[effectiveBandGroupId];
    if (inProgram) return inProgram;
    const bg = bandGroupsMap[effectiveBandGroupId];
    return bg ? bg.newCaptureIds.map((id) => birdEventsMap[id]).filter(Boolean) : [];
  }, [effectiveBandGroupId, bandGroupToNewCaptures, bandGroupsMap, birdEventsMap]);

  if (isLoading && Object.keys(bandGroupToNewCaptures).length === 0) {
    return (
      <div className="p-4 flex items-center gap-4">
        <Spinner size="sm" /> Loading captures...
      </div>
    );
  }

  return (
    <div className="w-full flex flex-col gap-4">
      <div className="flex items-center gap-4">
        <Select
          label="Band Group"
          placeholder="Select a band group"
          variant="bordered"
          selectedKeys={effectiveBandGroupId ? [effectiveBandGroupId] : []}
          onSelectionChange={(keys) => {
            const selected = Array.from(keys)[0] as string | undefined;
            setSelectedBandGroupId(selected ?? null);
          }}
          size="md"
          labelPlacement="outside"
          className="max-w-xs"
          renderValue={(items) => {
            const item = items[0];
            if (!item) return null;
            const bgId = String(item.key);
            const size = bandGroupToBandSize[bgId];
            const count = bandGroupToNewCaptures[bgId]?.filter((e) => e.modifiedEventId == null).length ?? 0;
            return (
              <div className="flex items-center gap-2">
                {size && <Chip size="sm" variant="flat" color="secondary">{size}</Chip>}
                <span>{bgId}</span>
                <span className="text-xs text-default-400 ml-auto">{count} used</span>
              </div>
            );
          }}
        >
          {bandGroupOptions.map((bandGroupId) => {
            const count =
              bandGroupToNewCaptures[bandGroupId]?.filter((birdEvent) => birdEvent.modifiedEventId == null).length ?? 0;
            if (count === 0 && bandGroupId !== activeBandGroupId) return null;
            const size = bandGroupToBandSize[bandGroupId];
            return (
              <SelectItem
                key={bandGroupId}
                startContent={size ? <Chip size="sm" variant="flat" color="secondary">{size}</Chip> : null}
                endContent={<span className="text-xs text-default-400">{count} used</span>}
              >
                {bandGroupId}
              </SelectItem>
            );
          })}
        </Select>
        <Switch
          isSelected={showOtherPrograms}
          onValueChange={setShowOtherPrograms}
          size="md"
          color="secondary"
          className="self-end mb-1.5"
        >
          Show all captures
        </Switch>
      </div>

      {effectiveBandGroupId ? (
        <BirdEventsTable
          programId={selectedProgram?.id}
          birdEvents={captures}
          maxTableHeight={600}
          sortDescriptors={[{ column: "bandLastTwoDigits", direction: "ascending" }]}
          showOtherPrograms={showOtherPrograms}
          allowInspectBandId
          scrollToEnd
        />
      ) : (
        <div className="p-4">Select a band group to view captures</div>
      )}
    </div>
  );
}
