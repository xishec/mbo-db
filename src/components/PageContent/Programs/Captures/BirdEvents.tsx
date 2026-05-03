import { Button, Spinner, useDisclosure, Tab, Tabs, Select, SelectItem } from "@heroui/react";
import { memo, useState, useMemo, useCallback } from "react";
import { useAppStore, useIsLoggedIn } from "../../../../stores/useAppStore";
import { birdEventsStore, useBirdEventsVersion } from "../../../../services/birdEventsStore";
import AddBirdEventModal from "../../../Modals/AddBirdEventModal";
import { Band, BandSize, getBandGroupMapKey, type BirdEvent } from "../../../../types";
import BirdEventsTable from "./BirdEventsTable";
import { PlusIcon } from "@heroicons/react/24/outline";

// Memoized wrappers for HeroUI Select. HeroUI Select itself isn't memoized
// and re-renders (~25ms each) whenever its parent commits, even with stable
// props — adds up to ~2.5s of render work across a post-save cascade. These
// thin wrappers short-circuit the render when the actual props haven't
// changed (reference equality on items/selectedKeys/onChange).
type PageSelectItem = { key: string; label: string };
const MemoPageSelect = memo(function MemoPageSelect(props: {
  items: PageSelectItem[];
  selectedKeys: string[];
  onChange: (selected: string | undefined) => void;
}) {
  return (
    <Select
      placeholder="Select page"
      variant="bordered"
      items={props.items}
      selectedKeys={props.selectedKeys}
      onSelectionChange={(keys) => props.onChange(Array.from(keys)[0] as string | undefined)}
      size="md"
      className="max-w-[200px]"
      maxListboxHeight={9999}
      classNames={{
        trigger: "min-h-unit-10 h-unit-10",
        value: "text-sm",
      }}
    >
      {(item) => <SelectItem key={item.key}>{item.label}</SelectItem>}
    </Select>
  );
});

type OtherBandsItem = { key: string; label: string; count: number };
const MemoOtherBandsSelect = memo(function MemoOtherBandsSelect(props: {
  items: OtherBandsItem[];
  selectedKeys: string[];
  onChange: (selected: string) => void;
}) {
  return (
    <Select
      placeholder="Other band groups"
      variant="bordered"
      items={props.items}
      selectedKeys={props.selectedKeys}
      onSelectionChange={(keys) => {
        const selected = Array.from(keys)[0] as string | undefined;
        if (selected) props.onChange(selected);
      }}
      size="md"
      className="max-w-[250px]"
      classNames={{
        trigger: "min-h-unit-10 h-unit-10",
        value: "text-sm",
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
  const selectedProgram = useAppStore((s) => s.selectedProgram);
  const isLoading = useAppStore((s) => s.isLoading);
  const isSyncing = useAppStore((s) => s.isSyncing);
  const isSaving = useAppStore((s) => s.isSaving);
  const bandSizeToBandIdMap = useAppStore((s) => s.bandSizeToBandIdMap);
  const bandGroupsMap = useAppStore((s) => s.bandGroupsMap);
  const isLoggedIn = useIsLoggedIn();
  const birdEventsVersion = useBirdEventsVersion();
  const [selectedNet, setSelectedNet] = useState<string>("");
  // Three-state logic: undefined = auto-select default, null = show empty table, string = show this band group
  const [selectedBandGroupId, setSelectedBandGroupId] = useState<string | null | undefined>(undefined);
  // Track the size the user picked so the selection survives a strip rollover
  // (when finishing a strip advances bandSizeToBandGroup to a new band group id,
  // the user still wants to be viewing the same size).
  const [selectedBandSize, setSelectedBandSize] = useState<BandSize | null>(null);
  const [modalBandSize, setModalBandSize] = useState<BandSize>(BandSize.Size0a);
  const [showRecaptures, setShowRecaptures] = useState(false);

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
          .map((id) => birdEventsStore.get(id))
          .filter((event): event is BirdEvent => !!event && event.modifiedEventId == null);

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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bandGroupIds, bandGroupsMap, birdEventsVersion, bandSizeToBandGroup, bandSizeToBandIdMap]);

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

  // Build page select items as a unified array to avoid React Aria collection issues.
  // Label shows the PHYSICAL next band id from bandSizeToBandIdMap (the value the
  // Add modal will prefill) — not `${groupKey}-${nextDigit}`, which is misleading
  // when the next band is -00: strip "3060423" ends with physical band "3060424-00",
  // so the label must say "3060424-00", not "3060423-00".
  const pageSelectItems = useMemo(() => {
    const items: { key: string; label: string }[] = [];
    Object.values(BandSize)
      .filter((size) => size !== BandSize.Other)
      .filter((size) => bandSizeToBandGroup[size])
      .forEach((size) => {
        const bandGroupId = bandSizeToBandGroup[size]!;
        const nextFullId = bandSizeToBandIdMap[size as BandSize];
        const labelBand =
          nextFullId && nextFullId.length === 9
            ? `${nextFullId.slice(0, 7)}-${nextFullId.slice(7, 9)}`
            : `${bandGroupId}-${(bandGroupInfo[bandGroupId]?.nextDigits ?? "01")}`;
        items.push({ key: bandGroupId, label: `${size} - ${labelBand}` });
      });
    items.push({ key: "other", label: "Other Size" });
    items.push({ key: "recaptures", label: "Recaptures" });
    return items;
  }, [bandSizeToBandGroup, bandGroupInfo, bandSizeToBandIdMap]);

  // Determine which band group to display.
  //
  // Priority:
  //   1. If user picked a size (selectedBandSize), follow that size's current
  //      band group. This survives strip rollovers: after finishing the -00
  //      band of a strip, bandSizeToBandGroup advances to the next group key
  //      but the selected size is unchanged, so the dropdown stays selected.
  //   2. Explicit null selection → show empty table.
  //   3. Explicit band group id → use it (covers "Other bands" selections).
  //   4. Default → first non-Other size's band group, or first id in program.
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
    return bandGroupIds[0] ?? null;
  }, [selectedBandSize, selectedBandGroupId, bandGroupIds, bandSizeToBandGroup]);

  // Stable selectedKeys reference to prevent unnecessary React Aria re-computation
  const pageSelectedKeys = useMemo(() => {
    if (showRecaptures) return ["recaptures"];
    if (displayBandGroupId) return [displayBandGroupId];
    if (displayBandGroupId === null) return ["other"];
    return [];
  }, [showRecaptures, displayBandGroupId]);

  // Get captures for the displayed band group
  const captures = useMemo(() => {
    if (!displayBandGroupId) return [];
    const bandGroup = bandGroupsMap[displayBandGroupId];
    return (
      bandGroup?.newCaptureIds
        .map((id) => birdEventsStore.get(id))
        .filter((ev): ev is BirdEvent => !!ev) ?? []
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [displayBandGroupId, bandGroupsMap, birdEventsVersion]);

  // Get recaptures for the current program
  const recaptures = useMemo(() => {
    if (!selectedProgram?.recaptureIds) return [];
    return selectedProgram.recaptureIds
      .map((id) => birdEventsStore.get(id))
      .filter((ev): ev is BirdEvent => !!ev);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedProgram, birdEventsVersion]);

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

  const handleBandGroupSelect = useCallback(
    (bandGroupId: string | null) => {
      setSelectedBandGroupId(bandGroupId);
      // Remember the size so the selection survives strip rollover. null here
      // clears the size-based tracking (e.g. "Other Size" selected).
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
      else if (selected === "other") handleBandGroupSelect(null);
      else if (selected) handleBandGroupSelect(selected);
    },
    [handleBandGroupSelect, handleRecapturesSelect]
  );

  // Stable handler for the Other bands Select.
  const handleOtherBandsSelectChange = useCallback(
    (selected: string) => {
      setSelectedBandGroupId(selected);
      // "Other bands" groups aren't mapped to a size — clear the size
      // tracking so the size-based lookup doesn't override.
      setSelectedBandSize(null);
      setShowRecaptures(false);
    },
    []
  );

  const otherBandsItems = useMemo(
    () =>
      otherBandGroups.map((bandGroupId) => ({
        key: bandGroupId,
        label: bandGroupId,
        count: bandGroupInfo[bandGroupId]?.count ?? 0,
      })),
    [otherBandGroups, bandGroupInfo]
  );

  const otherBandsSelectedKeys = useMemo(
    () =>
      displayBandGroupId && otherBandGroups.includes(displayBandGroupId) ? [displayBandGroupId] : [],
    [otherBandGroups, displayBandGroupId]
  );

  const handleBandGroupAdd = useCallback(
    (bandGroupId: string) => {
      const bandSize = bandGroupToBandSize[bandGroupId];
      if (bandSize) {
        setSelectedBandGroupId(bandGroupId);
        setSelectedBandSize(bandSize);
        setShowRecaptures(false);
        setModalBandSize(bandSize);
        onOpen();
      }
    },
    [bandGroupToBandSize, onOpen]
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
          <span>Active bands:</span>
          <MemoPageSelect
            items={pageSelectItems}
            selectedKeys={pageSelectedKeys}
            onChange={handlePageSelectChange}
          />
          {(() => {
            // Disabled when nothing is actionable:
            //  - no page selected (displayBandGroupId === undefined)
            //  - selected band group has no known size (handleBandGroupAdd would no-op)
            //  - app is loading or syncing
            const isSizedGroup =
              displayBandGroupId != null && !!bandGroupToBandSize[displayBandGroupId];
            const addEnabled =
              !isLoading && !isSyncing && !isSaving &&
              (showRecaptures || displayBandGroupId === null || isSizedGroup);
            return (
              <Button
                color="secondary"
                variant="solid"
                isDisabled={!addEnabled}
                onPress={() => {
                  if (showRecaptures || displayBandGroupId === null) {
                    setModalBandSize(BandSize.Other);
                    onOpen();
                  } else if (displayBandGroupId) {
                    handleBandGroupAdd(displayBandGroupId);
                  }
                }}
                className="min-w-[60px] mr-[110px]"
              >
                <PlusIcon className="w-5 h-5" />
              </Button>
            );
          })()}
          {otherBandGroups.length > 0 && (
            <>
              <span>Other bands:</span>
              <MemoOtherBandsSelect
                items={otherBandsItems}
                selectedKeys={otherBandsSelectedKeys}
                onChange={handleOtherBandsSelectChange}
              />
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
