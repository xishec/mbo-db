import { Button, Card, CardBody, Input, Select, SelectItem, Table, TableBody, TableCell, TableColumn, TableHeader, TableRow } from "@heroui/react";
import { useMemo, useState } from "react";
import { birdEventsStore, useBirdEventsVersion } from "../../services/birdEventsStore";
import { useAppStore } from "../../stores/useAppStore";
import { isActiveBirdEvent } from "../../stores/derive";
import { getSpeciesDisplayCode, resolveSpeciesKey, SPECIES_MAP } from "../../types/species";
import BirdEventsTable from "./Programs/Captures/BirdEventsTable";
import PageHeader from "./PageHeader";

interface SpeciesResult {
  key: string;
  code: string;
  name: string;
  eventCount: number;
}

function normalizeLocation(location?: string): string {
  return location?.trim().toUpperCase() ?? "";
}

export default function Locations() {
  const version = useBirdEventsVersion();
  const bandResetsMap = useAppStore((state) => state.bandResetsMap);
  const speciesAliasesMap = useAppStore((state) => state.speciesAliasesMap);
  const [selectedLocations, setSelectedLocations] = useState<Set<string>>(new Set());
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  const events = useMemo(() => {
    return Array.from(birdEventsStore.getAll().values()).filter(
      (event) => isActiveBirdEvent(event, bandResetsMap) && event.programId.trim().toUpperCase() !== "NONE"
    );
  }, [version, bandResetsMap]);

  const locations = useMemo(() => {
    return Array.from(new Set(events.map((event) => normalizeLocation(event.location)).filter(Boolean))).sort((left, right) =>
      left.localeCompare(right)
    );
  }, [events]);

  const results = useMemo<SpeciesResult[]>(() => {
    const counts = new Map<string, number>();

    for (const event of events) {
      const location = normalizeLocation(event.location);
      if (!location) continue;
      if (selectedLocations.size > 0 && !selectedLocations.has(location)) continue;
      if (startDate && event.date < startDate) continue;
      if (endDate && event.date > endDate) continue;

      const speciesKey = resolveSpeciesKey(event.species, speciesAliasesMap);
      counts.set(speciesKey, (counts.get(speciesKey) ?? 0) + 1);
    }

    return Array.from(counts, ([key, eventCount]) => {
      const species = SPECIES_MAP[key];
      return {
        key,
        code: getSpeciesDisplayCode(key, speciesAliasesMap),
        name: species?.speciesDescriptionMBO || species?.speciesDescriptionCMMN || key,
        eventCount,
      };
    })
      .sort((left, right) => right.eventCount - left.eventCount || left.name.localeCompare(right.name))
      .slice(0, 10);
  }, [endDate, events, selectedLocations, speciesAliasesMap, startDate]);

  const eventsWithoutLocation = useMemo(
    () => events.filter((event) => !normalizeLocation(event.location)),
    [events]
  );

  const clearFilters = () => {
    setSelectedLocations(new Set());
    setStartDate("");
    setEndDate("");
  };

  const hasActiveFilters = selectedLocations.size > 0 || Boolean(startDate || endDate);

  return (
    <div className="mx-auto flex h-full w-full max-w-7xl flex-col gap-4 p-8 pt-4">
      <PageHeader title="Locations" subtitle="Compare the most frequently captured species across locations." />

      <Card shadow="sm">
        <CardBody className="gap-3 p-4">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-sm font-semibold text-default-900">Filters</h2>
            <Button size="sm" variant="light" color="primary" onPress={clearFilters} isDisabled={!hasActiveFilters}>
              Clear filters
            </Button>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Select
              className="sm:col-span-2"
              label="Locations"
              placeholder="All locations"
              selectionMode="multiple"
              selectedKeys={selectedLocations}
              onSelectionChange={(keys) => setSelectedLocations(new Set(Array.from(keys, String)))}
            >
              {locations.map((location) => (
                <SelectItem key={location}>{location}</SelectItem>
              ))}
            </Select>
            <Input label="Start date" type="date" value={startDate} onValueChange={setStartDate} />
            <Input label="End date" type="date" value={endDate} onValueChange={setEndDate} />
          </div>
        </CardBody>
      </Card>

      <div>
        <h2 className="text-lg font-semibold text-default-900">Top 10 species</h2>
        <p className="text-sm text-default-600">
          {selectedLocations.size > 0 ? `${selectedLocations.size} location${selectedLocations.size === 1 ? "" : "s"} selected` : "All locations"}
          {startDate || endDate ? ` · ${startDate || "Any date"} to ${endDate || "Any date"}` : ""}
        </p>
      </div>

      <Table aria-label="Top species by location" removeWrapper>
        <TableHeader>
          <TableColumn>RANK</TableColumn>
          <TableColumn>SPECIES</TableColumn>
          <TableColumn>CODE</TableColumn>
          <TableColumn align="end">CAPTURE EVENTS</TableColumn>
        </TableHeader>
        <TableBody items={results} emptyContent="No capture events match the selected filters.">
          {(result) => (
            <TableRow key={result.key}>
              <TableCell>{results.indexOf(result) + 1}</TableCell>
              <TableCell>{result.name}</TableCell>
              <TableCell className="font-mono">{result.code}</TableCell>
              <TableCell className="text-right tabular-nums">{result.eventCount}</TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>

      <div className="mt-4">
        <h2 className="text-lg font-semibold text-default-900">Captures without a location</h2>
        <p className="text-sm text-default-600">
          {eventsWithoutLocation.length} capture{eventsWithoutLocation.length === 1 ? "" : "s"} need a location.
        </p>
      </div>

      <BirdEventsTable
        birdEvents={eventsWithoutLocation}
        maxTableHeight={500}
        sortDescriptors={[
          { column: "date", direction: "descending" },
          { column: "time", direction: "descending" },
        ]}
        allowInspectHistory
      />
    </div>
  );
}
