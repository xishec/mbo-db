import { Spinner, Tab, Tabs, Select, SelectItem } from "@heroui/react";
import { memo, useState, useMemo, useCallback, useEffect } from "react";
import { useAppStore } from "../../../../stores/useAppStore";
import { birdEventsStore, useBirdEventsVersion } from "../../../../services/birdEventsStore";
import { BandSize, BirdEventType, getBandGroupMapKey, type BirdEvent } from "../../../../types";
import BirdEventsTable from "./BirdEventsTable";
import { isActiveBirdEvent } from "../../../../stores/derive";

type BandGroupItem = { key: string; label: string; count: number };
const MemoBandGroupSelect = memo(function MemoBandGroupSelect(props: {
  items: BandGroupItem[];
  selectedKeys: string[];
  onChange: (selected: string) => void;
}) {
  return (
    <Select
      aria-label="Band group"
      placeholder="Band groups"
      variant="bordered"
      items={props.items}
      selectedKeys={props.selectedKeys}
      onSelectionChange={(keys) => {
        const selected = Array.from(keys)[0] as string | undefined;
        if (selected) props.onChange(selected);
      }}
      size="md"
      className="w-[320px]"
      classNames={{
        trigger: "min-h-unit-10 h-unit-10",
        value: "text-sm",
        listboxWrapper: "max-h-[600px]",
      }}
    >
      {(item) => (
        <SelectItem key={item.key} endContent={<span className="text-xs opacity-60">{item.count} used</span>}>
          {item.label}
        </SelectItem>
      )}
    </Select>
  );
});

export default function BirdEvents() {
  const selectedProgram = useAppStore((s) => s.selectedProgram);
  const isLoading = useAppStore((s) => s.isLoading);
  const bandGroupSizesMap = useAppStore((s) => s.bandGroupSizesMap);
  const bandGroupsMap = useAppStore((s) => s.bandGroupsMap);
  const birdEventsVersion = useBirdEventsVersion();
  const bandResetsMap = useAppStore((s) => s.bandResetsMap);
  // Three-state logic: undefined = auto-select default, null = show empty table, string = show this band group
  const [selectedBandGroupId, setSelectedBandGroupId] = useState<string | null | undefined>(undefined);
  // Track the size the user picked so the selection survives a strip rollover
  // (when finishing a strip advances bandSizeToBandGroup to a new band group id,
  // the user still wants to be viewing the same size).
  const [selectedBandSize, setSelectedBandSize] = useState<BandSize | null>(null);
  const [showRecaptures, setShowRecaptures] = useState(true);

  // Map band group ID to its band size label
  const bandGroupToBandSize = useMemo(() => {
    return bandGroupSizesMap;
  }, [bandGroupSizesMap]);

  // Group IDs for the selected program, ordered by band size.
  const bandGroupIds = useMemo(() => {
    const ids = [...(selectedProgram?.bandGroupIds ?? [])];
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

  // A program becomes historical on the day after its end date.
  const isPastProgramEnd = Boolean(
    selectedProgram?.endDate && selectedProgram.endDate < new Date().toLocaleDateString("en-CA")
  );

  // Map each size to the most recently used band group. The next-band map is
  // intentionally not used here: after a strip ends in -00, it points to the
  // next (empty) strip rather than the group that was actually used.
  const bandSizeToBandGroup = useMemo(() => {
    const map: Record<string, string> = {};
    const latestUsedAt: Record<string, number> = {};
    for (const event of birdEventsStore.getAll().values()) {
      if (
        !event?.band ||
        event.previousEventId ||
        !isActiveBirdEvent(event, bandResetsMap) ||
        (event.birdEventType !== BirdEventType.Banded && event.birdEventType !== BirdEventType.None)
      )
        continue;

      const bandGroupId = getBandGroupMapKey(event.band);
      const size = bandGroupToBandSize[bandGroupId];
      if (!size || size === BandSize.Other) continue;
      const usedAt = Number(event.updatedAt) || 0;
      if (latestUsedAt[size] === undefined || usedAt > latestUsedAt[size]) {
        latestUsedAt[size] = usedAt;
        map[size] = bandGroupId;
      }
    }

    // A newly assigned strip has no capture yet, but it should still have a
    // tab so it can be selected immediately (for example, a new 4s strip).
    for (const bandGroupId of selectedProgram?.bandGroupIds ?? []) {
      const size = bandGroupToBandSize[bandGroupId];
      if (size && size !== BandSize.Other && !map[size]) {
        map[size] = bandGroupId;
      }
    }

    return map;
  // birdEventsStore is external to React state; this version triggers recomputation when it changes.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    bandGroupToBandSize,
    bandResetsMap,
    birdEventsVersion,
    selectedProgram?.bandGroupIds,
  ]);

  useEffect(() => {
    setSelectedBandGroupId(undefined);
    setSelectedBandSize(null);
    setShowRecaptures(true);
  }, [selectedProgram?.id]);

  // Pre-calculate counts and next available digits for all band groups (including those from settings)
  const bandGroupInfo = useMemo(() => {
    const info: Record<string, { count: number; nextDigits: string }> = {};

    // First, process all band groups from current program
    for (const bandGroupId of bandGroupIds) {
      const bandGroup = bandGroupsMap[bandGroupId];
      if (bandGroup) {
        const validEvents = bandGroup.newCaptureIds
          .map((id) => birdEventsStore.get(id))
          .filter((event): event is BirdEvent => !!event && isActiveBirdEvent(event, bandResetsMap));

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

    return info;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bandGroupIds, bandGroupsMap, birdEventsVersion, bandResetsMap]);

  // Every group used by this program. Active programs exclude the group
  // already represented by each size tab; past programs show all of them.
  const dropdownBandGroups = useMemo(() => {
    const currentGroups = new Set(Object.values(bandSizeToBandGroup));
    return bandGroupIds.filter(
      (id) =>
        (bandGroupInfo[id]?.count ?? 0) > 0 &&
        (isPastProgramEnd || !currentGroups.has(id))
    );
  }, [bandGroupIds, bandGroupInfo, bandSizeToBandGroup, isPastProgramEnd]);

  const pageSelectItems = useMemo(() => {
    const items: { key: string; label: string; isDisabled?: boolean }[] = [];
    Object.values(BandSize)
      .filter((size) => size !== BandSize.Other)
      .forEach((size) => {
        const bandGroupId = bandSizeToBandGroup[size];
        items.push({ key: bandGroupId ?? `size:${size}`, label: size, isDisabled: !bandGroupId });
      });
    items.push({ key: "recaptures", label: "Recaptures" });
    return items;
  }, [bandSizeToBandGroup]);

  const visiblePageSelectItems = useMemo(
    () => (isPastProgramEnd ? pageSelectItems.filter((item) => item.key === "recaptures") : pageSelectItems),
    [isPastProgramEnd, pageSelectItems]
  );

  // Determine which band group to display.
  //
  // Priority:
  //   1. If user picked a size (selectedBandSize), follow that size's current
  //      band group. This survives strip rollovers: after finishing the -00
  //      band of a strip, bandSizeToBandGroup advances to the next group key
  //      but the selected size is unchanged, so the dropdown stays selected.
  //   2. Explicit band group id → use it (covers dropdown selections).
  //   3. Default → first current size group, or the first used group in a
  //      past program.
  const displayBandGroupId = useMemo(() => {
    if (selectedBandSize) {
      return bandSizeToBandGroup[selectedBandSize] ?? null;
    }
    if (selectedBandGroupId !== undefined) {
      return selectedBandGroupId;
    }
    for (const size of Object.values(BandSize)) {
      const bandGroupId = bandSizeToBandGroup[size];
      if (bandGroupId && size !== BandSize.Other) {
        return bandGroupId;
      }
    }
    return dropdownBandGroups[0] ?? null;
  }, [selectedBandSize, selectedBandGroupId, bandSizeToBandGroup, dropdownBandGroups]);

  // Stable selectedKeys reference to prevent unnecessary React Aria re-computation
  const pageSelectedKeys = useMemo(() => {
    if (showRecaptures) return ["recaptures"];
    if (displayBandGroupId && Object.values(bandSizeToBandGroup).includes(displayBandGroupId)) {
      return [displayBandGroupId];
    }
    return [];
  }, [showRecaptures, displayBandGroupId, bandSizeToBandGroup]);

  // Get captures for the displayed band group
  const captures = useMemo(() => {
    if (!displayBandGroupId) return [];
    const bandGroup = bandGroupsMap[displayBandGroupId];
    return (
      bandGroup?.newCaptureIds
        .map((id) => birdEventsStore.get(id))
        .filter((ev): ev is BirdEvent => !!ev && isActiveBirdEvent(ev, bandResetsMap)) ?? []
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [displayBandGroupId, bandGroupsMap, birdEventsVersion, bandResetsMap]);

  // Get recaptures for the current program
  const recaptures = useMemo(() => {
    if (!selectedProgram?.recaptureIds) return [];
    return selectedProgram.recaptureIds
      .map((id) => birdEventsStore.get(id))
      .filter((ev): ev is BirdEvent => !!ev && isActiveBirdEvent(ev, bandResetsMap));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedProgram, birdEventsVersion, bandResetsMap]);

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

  const handleBandGroupSelect = useCallback(
    (bandGroupId: string | null) => {
      setSelectedBandGroupId(bandGroupId);
      // Remember the size so the selection survives strip rollover.
      setSelectedBandSize(bandGroupId ? bandGroupToBandSize[bandGroupId] ?? null : null);
      setShowRecaptures(false);
    },
    [bandGroupToBandSize]
  );

  const handleRecapturesSelect = useCallback(() => {
    setShowRecaptures(true);
    setSelectedBandGroupId(undefined);
    setSelectedBandSize(null);
  }, []);

  // Stable handler for the Page Select so its memo'd wrapper can skip re-renders.
  const handlePageSelectChange = useCallback(
    (selected: string | undefined) => {
      if (selected === "recaptures") handleRecapturesSelect();
      else if (selected) handleBandGroupSelect(selected);
    },
    [handleBandGroupSelect, handleRecapturesSelect]
  );

  // Stable handler for the band-group dropdown.
  const handleBandGroupDropdownChange = useCallback(
    (selected: string) => {
      setSelectedBandGroupId(selected);
      // Dropdown groups can be older strips of an assigned size, so clear
      // size tracking rather than jumping back to the current strip.
      setSelectedBandSize(null);
      setShowRecaptures(false);
    },
    []
  );

  const dropdownBandGroupItems = useMemo(
    () =>
      dropdownBandGroups.map((bandGroupId) => ({
        key: bandGroupId,
        label: `${bandGroupToBandSize[bandGroupId] ?? "Other"} : ${bandGroupId}`,
        count: bandGroupInfo[bandGroupId]?.count ?? 0,
      })),
    [dropdownBandGroups, bandGroupInfo, bandGroupToBandSize]
  );

  const dropdownBandGroupSelectedKeys = useMemo(
    () =>
      displayBandGroupId && dropdownBandGroups.includes(displayBandGroupId) ? [displayBandGroupId] : [],
    [dropdownBandGroups, displayBandGroupId]
  );

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

  return (
    <div className="w-full flex flex-col items-center gap-8">
      <div className="w-full flex flex-col gap-4">
        <div className="flex w-full items-center justify-start gap-3">
          <div className="flex min-w-0 items-center gap-3">
            <Tabs
              color="secondary"
              size="md"
              selectedKey={pageSelectedKeys[0]}
              onSelectionChange={(key) => handlePageSelectChange(key as string)}
              classNames={{
                base: "min-w-0",
                tabList: "justify-start",
                tabContent: "!text-foreground group-data-[selected=true]:!text-secondary-foreground",
              }}
            >
              {visiblePageSelectItems.map((item) => (
                <Tab key={item.key} title={item.label} isDisabled={item.isDisabled} />
              ))}
            </Tabs>
          </div>
          {dropdownBandGroups.length > 0 && (
            <div className="flex shrink-0 items-center gap-3">
              <MemoBandGroupSelect
                items={dropdownBandGroupItems}
                selectedKeys={dropdownBandGroupSelectedKeys}
                onChange={handleBandGroupDropdownChange}
              />
            </div>
          )}
        </div>
      </div>

      {showRecaptures || displayBandGroupId !== undefined ? (
        <BirdEventsTable
          key={showRecaptures ? "recaptures" : "captures"}
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
