import {
  Autocomplete,
  AutocompleteItem,
  Button,
  Card,
  CardBody,
  Input,
  Select,
  SelectItem,
  Table,
  TableBody,
  TableCell,
  TableColumn,
  TableHeader,
  TableRow,
} from "@heroui/react";
import { ArrowDownTrayIcon } from "@heroicons/react/24/outline";
import { useMemo, useRef, useState } from "react";
import { useRemainingHeight } from "../../hooks/useRemainingHeight";
import { useAppStore } from "../../stores/useAppStore";
import { getSpeciesDisplayCode, resolveSpeciesKey, SPECIES_MAP } from "../../types/species";
import { stringifyCsv } from "../../utils/csv";
import { getAllDETs } from "../../utils/detIdentity";
import PageHeader from "./PageHeader";

type SearchSource = "any" | "observed" | "census" | "det";

interface SearchResult {
  key: string;
  date: string;
  programId: string;
  programName: string;
  location: string;
  observed: number;
  census: number;
  det: number;
}

const SOURCES: Array<{ key: SearchSource; label: string }> = [
  { key: "observed", label: "Observed" },
  { key: "census", label: "Census" },
  { key: "det", label: "DET estimate" },
  { key: "any", label: "Any source" },
];

function formatDate(date: string): string {
  const parsed = new Date(`${date}T12:00:00`);
  if (Number.isNaN(parsed.getTime())) return date;
  return parsed.toLocaleDateString("en-CA", { year: "numeric", month: "long", day: "numeric" });
}

function getSpeciesCount(
  counts: Record<string, number> | undefined,
  selectedSpeciesKey: string,
  speciesAliasesMap: Record<string, string>
): number {
  return Object.entries(counts ?? {}).reduce((total, [code, count]) => {
    return resolveSpeciesKey(code, speciesAliasesMap) === selectedSpeciesKey ? total + (Number(count) || 0) : total;
  }, 0);
}

export default function DETSearch() {
  const DETsByDateMap = useAppStore((state) => state.DETsByDateMap);
  const programsMap = useAppStore((state) => state.programsMap);
  const speciesAliasesMap = useAppStore((state) => state.speciesAliasesMap);
  const [speciesKey, setSpeciesKey] = useState<string | null>(null);
  const [programId, setProgramId] = useState<string | null>(null);
  const [source, setSource] = useState<SearchSource>("observed");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const tableRef = useRef<HTMLDivElement>(null);
  const tableHeight = useRemainingHeight(tableRef);

  const dets = useMemo(() => getAllDETs(DETsByDateMap), [DETsByDateMap]);

  const speciesOptions = useMemo(() => {
    const keys = new Set<string>();
    for (const det of dets) {
      for (const counts of [det.observedSpeciesCount, det.censusSpeciesCount, det.DETSpeciesCount]) {
        Object.keys(counts ?? {}).forEach((code) => keys.add(resolveSpeciesKey(code, speciesAliasesMap)));
      }
    }

    return Array.from(keys)
      .map((key) => {
        const code = getSpeciesDisplayCode(key, speciesAliasesMap);
        const species = SPECIES_MAP[key];
        const name = species?.speciesDescriptionMBO || species?.speciesDescriptionCMMN || key;
        return { key, code, name, frenchName: species?.speciesFrench || "" };
      })
      .sort((left, right) => left.name.localeCompare(right.name));
  }, [dets, speciesAliasesMap]);

  const programOptions = useMemo(() => {
    const ids = new Set(dets.map((det) => det.programId));
    return Array.from(ids)
      .map((id) => ({ id, name: programsMap[id]?.displayName || id }))
      .sort((left, right) => left.name.localeCompare(right.name));
  }, [dets, programsMap]);

  const results = useMemo<SearchResult[]>(() => {
    if (!speciesKey) return [];

    return dets
      .filter((det) => !programId || det.programId === programId)
      .filter((det) => !startDate || det.date >= startDate)
      .filter((det) => !endDate || det.date <= endDate)
      .map((det) => {
        const observed = getSpeciesCount(det.observedSpeciesCount, speciesKey, speciesAliasesMap);
        const census = getSpeciesCount(det.censusSpeciesCount, speciesKey, speciesAliasesMap);
        const detCount = getSpeciesCount(det.DETSpeciesCount, speciesKey, speciesAliasesMap);
        return {
          key: `${det.date}__${det.programId}`,
          date: det.date,
          programId: det.programId,
          programName: programsMap[det.programId]?.displayName || det.programId,
          location: det.location,
          observed,
          census,
          det: detCount,
        };
      })
      .filter((result) => {
        if (source === "observed") return result.observed > 0;
        if (source === "census") return result.census > 0;
        if (source === "det") return result.det > 0;
        return result.observed > 0 || result.census > 0 || result.det > 0;
      })
      .sort((left, right) => right.date.localeCompare(left.date) || left.programId.localeCompare(right.programId));
  }, [dets, endDate, programId, programsMap, source, speciesAliasesMap, speciesKey, startDate]);

  const selectedSpecies = speciesOptions.find((option) => option.key === speciesKey);
  const hasActiveFilters = Boolean(speciesKey || programId || startDate || endDate || source !== "observed");

  const clearFilters = () => {
    setSpeciesKey(null);
    setProgramId(null);
    setSource("observed");
    setStartDate("");
    setEndDate("");
  };

  const exportResults = () => {
    if (results.length === 0) return;

    const csv = stringifyCsv([
      ["Date", "Program", "Program ID", "Location", "Observed", "Census", "DET"],
      ...results.map((result) => [
        result.date,
        result.programName,
        result.programId,
        result.location,
        String(result.observed),
        String(result.census),
        String(result.det),
      ]),
    ]);
    const speciesCode = selectedSpecies?.code || speciesKey || "results";
    const filename = `det_search_${speciesCode}_${new Date().toISOString().slice(0, 10)}.csv`;
    const url = URL.createObjectURL(new Blob([`\uFEFF${csv}`], { type: "text/csv;charset=utf-8" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="mx-auto flex h-full w-full max-w-7xl flex-col gap-4 p-8 pt-4">
      <PageHeader
        title="DET Search"
        subtitle="Find the dates when a species was observed, recorded on census, or included in a DET estimate."
      />

      <Card shadow="sm">
        <CardBody className="gap-3 p-4">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-sm font-semibold text-default-900">Filters</h2>
            <Button size="sm" variant="light" color="primary" onPress={clearFilters} isDisabled={!hasActiveFilters}>
              Clear filters
            </Button>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-12">
            <Autocomplete
              className="xl:col-span-4"
              label="Species"
              placeholder="Search by name or code"
              size="sm"
              selectedKey={speciesKey}
              onSelectionChange={(key) => setSpeciesKey(key ? String(key) : null)}
              isClearable
            >
              {speciesOptions.map((species) => (
                <AutocompleteItem key={species.key} textValue={`${species.name} (${species.code})`}>
                  <div className="min-w-0">
                    <div className="truncate">
                      <span className="font-medium">{species.name}</span>
                      <span className="ml-2 font-mono text-xs text-default-500">{species.code}</span>
                    </div>
                    {species.frenchName && species.frenchName !== species.name && (
                      <div className="truncate text-xs text-default-500">{species.frenchName}</div>
                    )}
                  </div>
                </AutocompleteItem>
              ))}
            </Autocomplete>

            <Autocomplete
              className="xl:col-span-2"
              label="Program"
              placeholder="All programs"
              size="sm"
              selectedKey={programId}
              onSelectionChange={(key) => setProgramId(key ? String(key) : null)}
              isClearable
            >
              {programOptions.map((program) => (
                <AutocompleteItem key={program.id} textValue={program.name}>
                  {program.name}
                </AutocompleteItem>
              ))}
            </Autocomplete>

            <Select
              className="xl:col-span-2"
              label="Source"
              size="sm"
              selectedKeys={[source]}
              onSelectionChange={(keys) => {
                const selected = Array.from(keys)[0];
                if (selected) setSource(String(selected) as SearchSource);
              }}
            >
              {SOURCES.map((option) => (
                <SelectItem key={option.key}>{option.label}</SelectItem>
              ))}
            </Select>

            <Input
              className="xl:col-span-2"
              label="From"
              type="date"
              size="sm"
              value={startDate}
              onValueChange={setStartDate}
            />
            <Input
              className="xl:col-span-2"
              label="To"
              type="date"
              size="sm"
              value={endDate}
              onValueChange={setEndDate}
            />
          </div>
        </CardBody>
      </Card>

      <div className="flex items-end justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold text-default-900">Results</h2>
          <p className="text-sm text-default-600">
            {speciesKey
              ? `${results.length} record${results.length === 1 ? "" : "s"} for ${selectedSpecies?.name || speciesKey}`
              : "Select a species to search the DET records."}
          </p>
        </div>
        <Button
          size="sm"
          color="primary"
          variant="flat"
          startContent={<ArrowDownTrayIcon className="h-4 w-4" />}
          onPress={exportResults}
          isDisabled={results.length === 0}
        >
          Export CSV
        </Button>
      </div>

      <div ref={tableRef} className="min-h-0">
        <Table
          aria-label="DET species search results"
          isHeaderSticky
          isVirtualized
          maxTableHeight={tableHeight}
          rowHeight={44}
          classNames={{
            base: "table-fixed",
            table: "table-fixed",
          }}
        >
          <TableHeader>
            <TableColumn className="whitespace-nowrap">Date</TableColumn>
            <TableColumn className="whitespace-nowrap">Program</TableColumn>
            <TableColumn className="whitespace-nowrap">Location</TableColumn>
            <TableColumn className="whitespace-nowrap" align="end">
              Observed
            </TableColumn>
            <TableColumn className="whitespace-nowrap" align="end">
              Census
            </TableColumn>
            <TableColumn className="whitespace-nowrap" align="end">
              DET
            </TableColumn>
          </TableHeader>
          <TableBody
            items={results}
            emptyContent={speciesKey ? "No matching DET records found." : "Select a species to begin."}
          >
            {(result) => (
              <TableRow key={result.key}>
                <TableCell>
                  <span className="whitespace-nowrap">{formatDate(result.date)}</span>
                </TableCell>
                <TableCell>
                  <div className="truncate" title={`${result.programName} (${result.programId})`}>
                    {result.programName}
                    {result.programName !== result.programId && (
                      <span className="ml-2 font-mono text-xs text-default-500">{result.programId}</span>
                    )}
                  </div>
                </TableCell>
                <TableCell>{result.location || "—"}</TableCell>
                <TableCell className="text-right tabular-nums">{result.observed || "—"}</TableCell>
                <TableCell className="text-right tabular-nums">{result.census || "—"}</TableCell>
                <TableCell className="text-right tabular-nums">{result.det || "—"}</TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
