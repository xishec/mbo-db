import { Autocomplete, AutocompleteItem, Spinner } from "@heroui/react";
import { useMemo, useState } from "react";
import { useProgramData } from "../../../../services/useProgramData";
import CapturesTable from "./CapturesTable";

export default function NewCaptures() {
  const { programData, selectedProgram } = useProgramData();
  const { program, capturesByBandGroup, isLoadingCaptures } = programData;

  // Convert bandGroupIds Set to sorted array for autocomplete
  const bandGroupOptions = useMemo(() => {
    return Array.from(program?.bandGroupIds ?? []).sort();
  }, [program?.bandGroupIds]);

  const [selectedBandGroupId, setSelectedBandGroupId] = useState<string | null>(
    bandGroupOptions[0] ?? null
  );

  // Update selection when bandGroupOptions changes (new program selected)
  useMemo(() => {
    if (bandGroupOptions.length > 0 && !bandGroupOptions.includes(selectedBandGroupId ?? "")) {
      setSelectedBandGroupId(bandGroupOptions[0]);
    }
  }, [bandGroupOptions, selectedBandGroupId]);

  // Get captures for the selected bandGroup from the cache
  const captures = useMemo(() => {
    if (!selectedBandGroupId) return [];
    return capturesByBandGroup.get(selectedBandGroupId) ?? [];
  }, [selectedBandGroupId, capturesByBandGroup]);

  if (isLoadingCaptures && capturesByBandGroup.size === 0) {
    return (
      <div className="p-4 flex items-center gap-2">
        <Spinner size="sm" /> Loading captures...
      </div>
    );
  }

  return (
    <div className="w-full flex flex-col gap-4">
      <Autocomplete
        label="Band Group"
        placeholder="Select a band group"
        variant="bordered"
        selectedKey={selectedBandGroupId}
        onSelectionChange={(key) => setSelectedBandGroupId(key as string | null)}
        size="sm"
        radius="md"
      >
        {bandGroupOptions.map((bandGroupId) => (
          <AutocompleteItem key={bandGroupId}>{bandGroupId}</AutocompleteItem>
        ))}
      </Autocomplete>

      {selectedBandGroupId ? (
        <CapturesTable program={selectedProgram ?? ""} captures={captures} />
      ) : (
        <div className="p-4 text-default-500">Select a band group to view captures</div>
      )}
    </div>
  );
}
