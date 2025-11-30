import { Autocomplete, AutocompleteItem, Spinner, Switch } from "@heroui/react";
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

  const [selectedBandGroupId, setSelectedBandGroupId] = useState<string | null>(null);
  const [showOtherPrograms, setShowOtherPrograms] = useState(false);

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
    return capturesByBandGroup.get(effectiveBandGroupId) ?? [];
  }, [effectiveBandGroupId, capturesByBandGroup]);

  if (isLoadingCaptures && capturesByBandGroup.size === 0) {
    return (
      <div className="p-4 flex items-center gap-2">
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
          size="sm"
          radius="md"
          className="max-w-xs"
        >
          {bandGroupOptions.map((bandGroupId) => (
            <AutocompleteItem key={bandGroupId}>{bandGroupId}</AutocompleteItem>
          ))}
        </Autocomplete>
        <Switch
          isSelected={showOtherPrograms}
          onValueChange={setShowOtherPrograms}
          size="sm"
        >
          Show other programs
        </Switch>
      </div>

      {effectiveBandGroupId ? (
        <CapturesTable
          program={selectedProgram ?? ""}
          captures={captures}
          maxTableHeight={800}
          sortColumn="bandLastTwoDigits"
          sortDirection="ascending"
          showOtherPrograms={showOtherPrograms}
        />
      ) : (
        <div className="p-4 text-default-500">Select a band group to view captures</div>
      )}
    </div>
  );
}
