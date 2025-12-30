import { Autocomplete, AutocompleteItem, Spinner, Switch } from "@heroui/react";
import { useMemo, useState, useEffect, useRef } from "react";
import { useData } from "../../../../services/useData";
import BirdEventsTable from "./BirdEventsTable";

export default function NewCaptures() {
  const { selectedProgram, bandGroupsMap, birdEventsMap, isLoading } = useData();

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

  // Convert bandGroupToNewCaptures keys to sorted array for autocomplete
  const bandGroupOptions = useMemo(() => {
    return Object.keys(bandGroupToNewCaptures).sort();
  }, [bandGroupToNewCaptures]);

  const [selectedBandGroupId, setSelectedBandGroupId] = useState<string | null>(null);
  const [showOtherPrograms, setShowOtherPrograms] = useState(false);
  const prevBandGroupIdsRef = useRef<string[]>([]);

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

  // Get captures for the selected bandGroup from the cache
  const captures = useMemo(() => {
    if (!effectiveBandGroupId) return [];
    return bandGroupToNewCaptures[effectiveBandGroupId] ?? [];
  }, [effectiveBandGroupId, bandGroupToNewCaptures]);

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
        <Autocomplete
          label="Band Group"
          placeholder="Select a band group"
          variant="bordered"
          selectedKey={effectiveBandGroupId}
          onSelectionChange={(key) => setSelectedBandGroupId(key as string | null)}
          size="md"
          labelPlacement="outside"
          className="max-w-xs"
        >
          {bandGroupOptions.map((bandGroupId) => {
            const count = bandGroupToNewCaptures[bandGroupId]?.length ?? 0;
            return (
              <AutocompleteItem key={bandGroupId} endContent={`${count} used`}>
                {bandGroupId}
              </AutocompleteItem>
            );
          })}
        </Autocomplete>
        <Switch isSelected={showOtherPrograms} onValueChange={setShowOtherPrograms} size="md">
          Show all captures
        </Switch>
      </div>

      {effectiveBandGroupId ? (
        <BirdEventsTable
          programId={selectedProgram?.id}
          captures={captures}
          maxTableHeight={800}
          sortDescriptors={[{ column: "bandLastTwoDigits", direction: "ascending" }]}
          showOtherPrograms={showOtherPrograms}
        />
      ) : (
        <div className="p-4">Select a band group to view captures</div>
      )}
    </div>
  );
}
