import { useState, useEffect, useMemo, useCallback, type ChangeEvent } from "react";
import { Button, Input, Select, SelectItem, Textarea } from "@heroui/react";
import {
  DET_SPECIES_CODES_SET,
  type DET,
  type Net,
  type ObserverHours,
  type NetHours,
  type Weather,
} from "../../../types/DET";
import { BirdEventType } from "../../../types";
import { useAppStore } from "../../../stores/useAppStore";
import { loadDETCalendar, type DETCalendarEntry } from "../../../services/detCalendarService";
import { fetchWeatherForDateTimeRange } from "../../../services/weatherService";
import { birdEventsStore, useBirdEventsVersion } from "../../../services/birdEventsStore";
import WeatherDisplay from "../../Helper/WeatherDisplay";
import { getLocalDateString } from "../../../utils/dateUtils";
import { parseCsv } from "../../../utils/csv";
import { showPersistentErrorToast } from "../../../utils/toast";
import DETObserverHoursSection from "./DETObserverHoursSection";
import DETNetHoursSection from "./DETNetHoursSection";
import DETSpeciesDataSection from "./DETSpeciesDataSection";
import ModalShell, { ModalBodyShell, ModalFooterShell, ModalHeaderShell } from "../ModalShell";
import { modalInputProps, modalCancelButtonProps, modalPrimaryButtonProps } from "../modalDefaults";
import { resolveSpeciesKey, SPECIES_MAP } from "../../../types/species";
import { isActiveBirdEvent } from "../../../stores/derive";

interface AddDETModalProps {
  isOpen: boolean;
  onOpenChange: () => void;
  onSave: (det: DET) => Promise<void>;
  existingDET?: DET | null;
  defaultDate?: string | null;
  mode: "create" | "edit";
}

function textFieldToString(value: unknown): string {
  if (typeof value === "string") return value;
  if (!Array.isArray(value)) return "";

  return value
    .map((item) => {
      if (typeof item === "string") return item;
      if (item && typeof item === "object") {
        return Object.values(item)
          .filter((part) => typeof part === "string" && part.trim())
          .join(" - ");
      }
      return "";
    })
    .filter(Boolean)
    .join("\n");
}

function cloneCount(count?: Record<string, number>): Record<string, number> {
  return { ...(count || {}) };
}

function normalizeSpeciesName(name: string): string {
  return name.trim().toLowerCase().replace(/\s+/g, " ");
}

const CENSUS_SPECIES_NAME_ALIASES: Record<string, string> = {
  "northern flicker": "yellow-shafted flicker",
};

interface UnmatchedCensusSpecies {
  name: string;
  count: number;
  code: string;
}

function importCensusSpeciesCounts(csv: string): {
  counts: Record<string, number>;
  unmatchedSpecies: Array<Omit<UnmatchedCensusSpecies, "code">>;
  invalidSpecies: string[];
} {
  const rows = parseCsv(csv);
  const speciesByName = new Map<string, string>();

  Object.entries(SPECIES_MAP).forEach(([code, species]) => {
    [species.speciesDescriptionMBO, species.speciesDescriptionCMMN].forEach((name) => {
      if (name) speciesByName.set(normalizeSpeciesName(name), code);
    });
  });

  const counts: Record<string, number> = {};
  const unmatchedByName = new Map<string, Omit<UnmatchedCensusSpecies, "code">>();
  const invalidSpecies: string[] = [];
  const dataRows =
    normalizeSpeciesName(rows[0]?.[0] ?? "") === "species" && normalizeSpeciesName(rows[0]?.[1] ?? "") === "count"
      ? rows.slice(1)
      : rows;

  dataRows.forEach((row) => {
    const speciesName = row[0]?.trim();
    const count = Number(row[1]);
    if (!speciesName) return;
    if (!Number.isFinite(count) || count <= 0) {
      invalidSpecies.push(speciesName);
      return;
    }

    const normalizedName = normalizeSpeciesName(speciesName);
    const aliasedName = CENSUS_SPECIES_NAME_ALIASES[normalizedName];
    const nameWithoutDirectionalPrefix = normalizedName.replace(/^(eastern|northern|southern|western)\s+/, "");
    const speciesCode =
      speciesByName.get(normalizedName) ??
      (aliasedName ? speciesByName.get(aliasedName) : undefined) ??
      speciesByName.get(nameWithoutDirectionalPrefix);

    if (!speciesCode) {
      const existing = unmatchedByName.get(normalizedName);
      unmatchedByName.set(normalizedName, { name: speciesName, count: (existing?.count ?? 0) + count });
      return;
    }

    counts[speciesCode] = (counts[speciesCode] ?? 0) + count;
  });

  return { counts, unmatchedSpecies: Array.from(unmatchedByName.values()), invalidSpecies };
}

interface EventSpeciesCounts {
  banded: Record<string, number>;
  repeat: Record<string, number>;
  return_: Record<string, number>;
}

const DEFAULT_NET_IDS = [
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
];

function timeToMinutes(time: string): number | null {
  const [hours, minutes] = time.split(":").map(Number);
  if (!Number.isInteger(hours) || !Number.isInteger(minutes)) return null;
  return hours * 60 + minutes;
}

function scheduledNetHours(open: string, closed: string): NetHours {
  const openMinutes = timeToMinutes(open);
  const closedMinutes = timeToMinutes(closed);
  const hours =
    openMinutes !== null && closedMinutes !== null && closedMinutes > openMinutes
      ? Number(((closedMinutes - openMinutes) / 60).toFixed(2)).toString()
      : "0";
  const total = Number((Number(hours) * DEFAULT_NET_IDS.length).toFixed(2)).toString();
  const nets: Net[] = DEFAULT_NET_IDS.map((id) => ({
    id,
    open,
    closed,
    hours,
    multiplier: 1,
    total: hours,
  }));

  return {
    nets,
    hummingbirdTrapTotal: "0",
    total,
  };
}

export default function AddDETModal({
  isOpen,
  onOpenChange,
  onSave,
  existingDET,
  defaultDate,
  mode,
}: AddDETModalProps) {
  const birdEventsVersion = useBirdEventsVersion();
  const volunteersMap = useAppStore((state) => state.volunteersMap);
  const DETsMap = useAppStore((state) => state.DETsMap);
  const programsMap = useAppStore((state) => state.programsMap);

  // Basic fields
  const [date, setDate] = useState("");
  const [programId, setProgramId] = useState("");
  const [location, setLocation] = useState("");
  const [banderInCharge, setBanderInCharge] = useState("");
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");
  const [coverageCode, setCoverageCode] = useState("");
  const [narrative, setNarrative] = useState("");
  const [deviations, setDeviations] = useState("");
  const [stationManagement, setStationManagement] = useState("");

  // Complex objects
  const [observerHours, setObserverHours] = useState<ObserverHours>({ total: 0, observers: [] });
  const [netHours, setNetHours] = useState<NetHours>({ nets: [], hummingbirdTrapTotal: "0", total: "0" });
  const [visitors, setVisitors] = useState("");
  const [injuries, setInjuries] = useState("");
  const [released, setReleased] = useState("");
  const [observedSpeciesCount, setObservedSpeciesCount] = useState<Record<string, number>>({});
  const [censuser, setCensuser] = useState("");
  const [censusStart, setCensusStart] = useState("");
  const [censusEnd, setCensusEnd] = useState("");
  const [censusSpeciesCount, setCensusSpeciesCount] = useState<Record<string, number>>({});
  const [bandedSpeciesCount, setBandedSpeciesCount] = useState<Record<string, number>>({});
  const [repeatSpeciesCount, setRepeatSpeciesCount] = useState<Record<string, number>>({});
  const [returnSpeciesCount, setReturnSpeciesCount] = useState<Record<string, number>>({});
  const [DETSpeciesCount, setDETSpeciesCount] = useState<Record<string, number>>({});
  const [weather, setWeather] = useState<Weather | undefined>(undefined);
  const speciesAliasesMap = useAppStore((s) => s.speciesAliasesMap);
  const bandResetsMap = useAppStore((s) => s.bandResetsMap);

  const existingCustomSpeciesCodes = useMemo(() => {
    const codes = new Set<string>();
    [
      observedSpeciesCount,
      censusSpeciesCount,
      bandedSpeciesCount,
      repeatSpeciesCount,
      returnSpeciesCount,
      DETSpeciesCount,
    ].forEach((counts) => {
      Object.keys(counts).forEach((code) => {
        if (!DET_SPECIES_CODES_SET.has(code)) codes.add(code);
      });
    });
    return codes;
  }, [
    DETSpeciesCount,
    bandedSpeciesCount,
    censusSpeciesCount,
    observedSpeciesCount,
    repeatSpeciesCount,
    returnSpeciesCount,
  ]);

  const getSpeciesCountsFromEvents = useCallback(
    (eventDate: string): EventSpeciesCounts => {
      const banded: Record<string, number> = {};
      const repeat: Record<string, number> = {};
      const return_: Record<string, number> = {};
      for (const ev of birdEventsStore.getAll().values()) {
        if (!ev || ev.date !== eventDate || !isActiveBirdEvent(ev, bandResetsMap) || !ev.species) continue;
        const speciesKey = resolveSpeciesKey(ev.species, speciesAliasesMap);
        if (ev.birdEventType === BirdEventType.Banded || ev.birdEventType === BirdEventType.None) {
          banded[speciesKey] = (banded[speciesKey] ?? 0) + 1;
        } else if (ev.birdEventType === BirdEventType.Repeat) {
          repeat[speciesKey] = (repeat[speciesKey] ?? 0) + 1;
        } else if (ev.birdEventType === BirdEventType.Return) {
          return_[speciesKey] = (return_[speciesKey] ?? 0) + 1;
        }
      }
      return { banded, repeat, return_ };
    },
    [speciesAliasesMap, bandResetsMap]
  );

  const getProgramIdsForDate = useCallback(
    (eventDate: string): string[] => {
      const programIds = new Set<string>();
      for (const ev of birdEventsStore.getAll().values()) {
        if (!ev || ev.date !== eventDate || !isActiveBirdEvent(ev, bandResetsMap) || !ev.programId) continue;
        programIds.add(ev.programId);
      }
      return Array.from(programIds).sort((a, b) => a.localeCompare(b));
    },
    [bandResetsMap]
  );

  const programIdsForDate = useMemo(() => {
    if (!date) return [];
    return getProgramIdsForDate(date);
  }, [date, birdEventsVersion, getProgramIdsForDate]);

  useEffect(() => {
    if (mode !== "create" || !date) return;
    if (programIdsForDate.length === 0) {
      setProgramId("");
      return;
    }
    if (!programIdsForDate.includes(programId)) {
      setProgramId(programIdsForDate[0]);
    }
  }, [date, mode, programId, programIdsForDate]);

  // Auto-compute banded/repeat species from bird events for the selected date
  const computedFromEvents = useMemo(() => {
    if (!date)
      return {
        banded: {} as Record<string, number>,
        repeat: {} as Record<string, number>,
        return_: {} as Record<string, number>,
      };

    return getSpeciesCountsFromEvents(date);
  }, [date, birdEventsVersion, getSpeciesCountsFromEvents]);

  useEffect(() => {
    setBandedSpeciesCount(computedFromEvents.banded);
    setRepeatSpeciesCount(computedFromEvents.repeat);
    setReturnSpeciesCount(computedFromEvents.return_);
  }, [computedFromEvents]);

  // Auto-calculate coverage code
  useEffect(() => {
    // Census: 1 if conducted, 0 if not
    const hasCensus = !!censuser || Object.keys(censusSpeciesCount).length > 0;
    const censusPoints = hasCensus ? 1 : 0;

    // Banding: based on net hours total
    const netTotal = parseFloat(netHours.total) || 0;
    let bandingPoints = 0;
    if (netTotal >= 75) bandingPoints = 2;
    else if (netTotal >= 50) bandingPoints = 1.5;
    else if (netTotal >= 25) bandingPoints = 1;
    else if (netTotal >= 1) bandingPoints = 0.5;

    // Observations: Class 1 hours + 50% Class 2 hours
    const weightedHours = (observerHours.observers ?? []).reduce((sum, obs) => {
      if (obs.class === 1) return sum + obs.hoursObserved;
      if (obs.class === 2) return sum + obs.hoursObserved * 0.5;
      return sum;
    }, 0);
    let obsPoints = 0;
    if (weightedHours >= 9) obsPoints = 2;
    else if (weightedHours >= 6) obsPoints = 1.5;
    else if (weightedHours >= 3) obsPoints = 1;
    else if (weightedHours >= 0.5) obsPoints = 0.5;

    setCoverageCode(String(censusPoints + bandingPoints + obsPoints));
  }, [censuser, censusSpeciesCount, netHours, observerHours]);

  // UI state
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState("");
  const [censusCsvMessage, setCensusCsvMessage] = useState("");
  const [censusCsvHasWarning, setCensusCsvHasWarning] = useState(false);
  const [pendingCensusImport, setPendingCensusImport] = useState<{
    counts: Record<string, number>;
    unmatchedSpecies: UnmatchedCensusSpecies[];
    invalidSpecies: string[];
  } | null>(null);
  const [censusCodeError, setCensusCodeError] = useState("");
  const [isLoadingWeather, setIsLoadingWeather] = useState(false);
  const [detCalendar, setDetCalendar] = useState<Record<string, DETCalendarEntry>>({});

  // Prefill form when editing
  useEffect(() => {
    if (mode === "edit" && existingDET) {
      const eventCounts = getSpeciesCountsFromEvents(existingDET.date);
      setDate(existingDET.date);
      setProgramId(existingDET.programId);
      setLocation(existingDET.location);
      setBanderInCharge(existingDET.banderInCharge || "");
      setStart(existingDET.start || "");
      setEnd(existingDET.end || "");
      setCoverageCode(String(existingDET.coverageCode));
      setNarrative(existingDET.narrative);
      setDeviations(existingDET.deviations);
      setStationManagement(existingDET.stationManagement);
      setObserverHours(existingDET.observerHours || { total: 0, observers: [] });
      setNetHours(
        existingDET.netHours
          ? {
              nets: existingDET.netHours.nets || [],
              hummingbirdTrapTotal: existingDET.netHours.hummingbirdTrapTotal || "0",
              total: existingDET.netHours.total || "0",
            }
          : { nets: [], hummingbirdTrapTotal: "0", total: "0" }
      );
      setVisitors(textFieldToString(existingDET.visitors));
      setInjuries(textFieldToString(existingDET.injuries));
      setReleased(textFieldToString(existingDET.released));
      setObservedSpeciesCount(existingDET.observedSpeciesCount || {});
      setCensuser(existingDET.censuser || "");
      setCensusStart(existingDET.censusStart || "");
      setCensusEnd(existingDET.censusEnd || "");
      setCensusSpeciesCount(existingDET.censusSpeciesCount || {});
      setBandedSpeciesCount(eventCounts.banded);
      setRepeatSpeciesCount(eventCounts.repeat);
      setReturnSpeciesCount(eventCounts.return_);
      setDETSpeciesCount(existingDET.DETSpeciesCount || {});
      setWeather(existingDET.weather);
    } else if (mode === "create") {
      // Reset form for new DET
      const sourceDET = defaultDate ? DETsMap[defaultDate] : null;
      const nextDate = defaultDate || getLocalDateString();
      const eventCounts = getSpeciesCountsFromEvents(nextDate);
      const dateProgramIds = getProgramIdsForDate(nextDate);
      setDate(nextDate);
      setProgramId(dateProgramIds[0] || "");
      setLocation("MBO");
      setBanderInCharge("");
      setStart("");
      setEnd("");
      setCoverageCode("");
      setNarrative("");
      setDeviations("");
      setStationManagement("");
      setObserverHours({ total: 0, observers: [] });
      setNetHours({ nets: [], hummingbirdTrapTotal: "0", total: "0" });
      setVisitors("");
      setInjuries("");
      setReleased("");
      setObservedSpeciesCount(cloneCount(sourceDET?.observedSpeciesCount));
      setCensuser("");
      setCensusStart("");
      setCensusEnd("");
      setCensusSpeciesCount(cloneCount(sourceDET?.censusSpeciesCount));
      setBandedSpeciesCount(eventCounts.banded);
      setRepeatSpeciesCount(eventCounts.repeat);
      setReturnSpeciesCount(eventCounts.return_);
      setDETSpeciesCount(cloneCount(sourceDET?.DETSpeciesCount));
      setWeather(undefined);
    }
    setError("");
    setCensusCsvMessage("");
    setCensusCsvHasWarning(false);
    setPendingCensusImport(null);
    setCensusCodeError("");
  }, [mode, existingDET, defaultDate, DETsMap, getProgramIdsForDate, getSpeciesCountsFromEvents, isOpen]);

  const handleCensusCsvUpload = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;

    try {
      const { counts, unmatchedSpecies, invalidSpecies } = importCensusSpeciesCounts(await file.text());
      const importedCount = Object.keys(counts).length;
      if (importedCount === 0 && unmatchedSpecies.length === 0) {
        setCensusCsvHasWarning(true);
        setCensusCsvMessage("No valid species counts were found. The current census data was not changed.");
        return;
      }

      if (unmatchedSpecies.length > 0) {
        setPendingCensusImport({
          counts,
          unmatchedSpecies: unmatchedSpecies.map((species) => ({ ...species, code: "" })),
          invalidSpecies,
        });
        setCensusCodeError("");
        return;
      }

      setCensusSpeciesCount(counts);
      setCensusCsvHasWarning(invalidSpecies.length > 0);
      setCensusCsvMessage(
        invalidSpecies.length > 0
          ? `Imported ${importedCount} species and replaced the census data. Invalid counts: ${invalidSpecies.join(", ")}.`
          : `Imported ${importedCount} species and replaced the census data.`
      );
    } catch (uploadError) {
      console.error("Failed to import census CSV:", uploadError);
      setCensusCsvHasWarning(true);
      setCensusCsvMessage("The CSV could not be read. The current census data was not changed.");
    }
  };

  const applyCensusSpeciesCodes = () => {
    if (!pendingCensusImport) return;

    const normalizedCodes = pendingCensusImport.unmatchedSpecies.map((species) => species.code.trim().toUpperCase());
    if (normalizedCodes.some((code) => !code)) {
      setCensusCodeError("Enter a code for every species.");
      return;
    }
    if (new Set(normalizedCodes).size !== normalizedCodes.length) {
      setCensusCodeError("Each species needs a different code.");
      return;
    }
    if (normalizedCodes.some((code) => DET_SPECIES_CODES_SET.has(code))) {
      setCensusCodeError("Use a custom code that is not already in the main species tables.");
      return;
    }
    const unavailableCustomCodes = new Set([
      ...existingCustomSpeciesCodes,
      ...Object.keys(pendingCensusImport.counts).filter((code) => !DET_SPECIES_CODES_SET.has(code)),
    ]);
    const duplicatedExistingCode = normalizedCodes.find((code) => unavailableCustomCodes.has(code));
    if (duplicatedExistingCode) {
      setCensusCodeError(`Code ${duplicatedExistingCode} is already used by another bird.`);
      return;
    }

    const counts = { ...pendingCensusImport.counts };
    pendingCensusImport.unmatchedSpecies.forEach((species, index) => {
      const code = normalizedCodes[index];
      counts[code] = (counts[code] ?? 0) + species.count;
    });

    const importedCount = Object.keys(counts).length;
    setCensusSpeciesCount(counts);
    setCensusCsvHasWarning(pendingCensusImport.invalidSpecies.length > 0);
    setCensusCsvMessage(
      pendingCensusImport.invalidSpecies.length > 0
        ? `Imported ${importedCount} species and replaced the census data. Invalid counts: ${pendingCensusImport.invalidSpecies.join(", ")}.`
        : `Imported ${importedCount} species and replaced the census data.`
    );
    setPendingCensusImport(null);
    setCensusCodeError("");
  };

  useEffect(() => {
    if (!isOpen) return;

    let cancelled = false;
    loadDETCalendar()
      .then((calendar) => {
        if (!cancelled) setDetCalendar(calendar);
      })
      .catch((err) => {
        console.error("Failed to load DET calendar:", err);
      });

    return () => {
      cancelled = true;
    };
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen || mode !== "create" || !date) return;

    const calendarEntry = detCalendar[date];
    setStart(calendarEntry?.start ?? "");
    setEnd(calendarEntry?.end ?? "");
    setCensusStart(calendarEntry?.censusStart ?? "");
    setCensusEnd(calendarEntry?.censusEnd ?? "");
    setNetHours(
      calendarEntry?.start && calendarEntry?.end
        ? scheduledNetHours(calendarEntry.start, calendarEntry.end)
        : { nets: [], hummingbirdTrapTotal: "0", total: "0" }
    );
  }, [date, detCalendar, isOpen, mode]);

  // Auto-populate weather for the DET time window.
  useEffect(() => {
    if (!isOpen) return;
    if (!date || !start || !end) {
      setWeather(undefined);
      setIsLoadingWeather(false);
      return;
    }

    let cancelled = false;
    setIsLoadingWeather(true);
    fetchWeatherForDateTimeRange(date, start, end)
      .then((fetchedWeather) => {
        if (!cancelled) setWeather(fetchedWeather ?? undefined);
      })
      .catch((err) => {
        console.error("Failed to fetch weather:", err);
        if (!cancelled) setWeather(undefined);
      })
      .finally(() => {
        if (!cancelled) setIsLoadingWeather(false);
      });

    return () => {
      cancelled = true;
    };
  }, [date, end, isOpen, start]);

  const handleSave = async () => {
    setError("");

    // Validation
    if (!date) {
      setError("Date is required");
      return;
    }
    if (!programId) {
      setError("Program ID is required");
      return;
    }
    if (!location) {
      setError("Location is required");
      return;
    }
    if (start && end && end <= start) {
      setError("End Time must be after Start Time");
      return;
    }
    if (isLoadingWeather) {
      setError("Wait for weather data to finish loading");
      return;
    }
    if (mode === "create" && DETsMap[date]) {
      setError(`A DET already exists for ${date}. Close this form and use Edit instead.`);
      return;
    }

    try {
      setIsSaving(true);

      // Empty optional values are removed by the persistence layer before the Firebase write.
      const cleanedWeather = weather && Object.values(weather).some((val) => val !== undefined) ? weather : undefined;

      // Build complete DET object with all fields
      const det: DET = {
        date,
        programId,
        location,
        banderInCharge: banderInCharge || undefined,
        start: start || undefined,
        end: end || undefined,
        coverageCode: Number(coverageCode),
        narrative,
        deviations,
        stationManagement,
        observerHours,
        netHours,
        visitors,
        injuries,
        released,
        censuser: censuser || undefined,
        censusStart: censusStart || undefined,
        censusEnd: censusEnd || undefined,
        observedSpeciesCount,
        censusSpeciesCount,
        bandedSpeciesCount,
        repeatSpeciesCount,
        returnSpeciesCount,
        DETSpeciesCount,
        weather: cleanedWeather,
      };

      await onSave(det);
      onOpenChange(); // Close modal on success
    } catch (err) {
      showPersistentErrorToast("DET save failed", err, "Please try again.");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <>
      <ModalShell
        modalProps={{
          isOpen,
          onOpenChange,
          size: "full",
          isDismissable: false,
          isKeyboardDismissDisabled: true,
          scrollBehavior: "inside",
        }}
        contentProps={{
          className: "h-dvh max-h-dvh rounded-none",
        }}
      >
        {(onClose) => (
          <>
            <ModalHeaderShell>{mode === "create" ? "Add New DET" : "Edit DET"}</ModalHeaderShell>
            <ModalBodyShell>
              <div className="flex flex-col gap-4" data-csv-navigation-scope>
                {error && <div className="bg-danger-50 text-danger-500 p-3 rounded-lg text-sm">{error}</div>}

                {/* Basic Information */}
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <Input
                      label="Date"
                      {...modalInputProps}
                      type="date"
                      value={date}
                      onValueChange={setDate}
                      isRequired
                      isDisabled={mode === "edit"}
                      description={isLoadingWeather ? "Loading weather data..." : ""}
                    />
                    <Select
                      label="Program ID"
                      {...modalInputProps}
                      selectedKeys={programId ? [programId] : []}
                      onSelectionChange={(keys) => {
                        const selected = Array.from(keys)[0];
                        setProgramId(selected ? String(selected) : "");
                      }}
                      isRequired
                      placeholder={programIdsForDate.length > 0 ? "Select program" : "No programs for selected date"}
                    >
                      {programIdsForDate.map((id) => (
                        <SelectItem key={id}>{programsMap[id]?.displayName || id}</SelectItem>
                      ))}
                    </Select>
                    <Input
                      label="Location"
                      {...modalInputProps}
                      value={location}
                      onValueChange={setLocation}
                      isRequired
                      placeholder="e.g., MBO"
                    />
                    <Input
                      label="Coverage Code (auto)"
                      {...modalInputProps}
                      variant="flat"
                      type="number"
                      value={coverageCode}
                      isReadOnly
                    />
                    <Input
                      label="Bander in Charge"
                      {...modalInputProps}
                      value={banderInCharge}
                      onValueChange={setBanderInCharge}
                      placeholder="SLS"
                    />
                    <div className="grid grid-cols-2 gap-4">
                      <Input
                        label="Start Time"
                        {...modalInputProps}
                        value={start}
                        onValueChange={setStart}
                        placeholder="06:30"
                      />
                      <Input
                        label="End Time"
                        {...modalInputProps}
                        value={end}
                        onValueChange={setEnd}
                        placeholder="11:11"
                      />
                    </div>
                    <Input
                      label="Censuser"
                      {...modalInputProps}
                      value={censuser}
                      onValueChange={setCensuser}
                      placeholder="Censuser name"
                    />
                    <div className="grid grid-cols-2 gap-4">
                      <Input
                        label="Census Start"
                        {...modalInputProps}
                        value={censusStart}
                        onValueChange={setCensusStart}
                        placeholder="06:30"
                      />
                      <Input
                        label="Census End"
                        {...modalInputProps}
                        value={censusEnd}
                        onValueChange={setCensusEnd}
                        placeholder="11:11"
                      />
                    </div>
                  </div>
                </div>

                {/* Weather */}
                <div>
                  <p className="text-small pb-1">
                    Weather at MBO
                    {(start || end) && (
                      <span className="ml-2">
                        from {start || "—"} to {end || "—"}
                      </span>
                    )}
                  </p>
                  <div className="rounded-medium border border-default-100 py-2 px-3">
                    <WeatherDisplay weather={weather} isLoading={isLoadingWeather} />
                  </div>
                </div>

                <DETObserverHoursSection
                  observerHours={observerHours}
                  volunteersMap={volunteersMap}
                  onChange={setObserverHours}
                />

                <DETNetHoursSection netHours={netHours} onChange={setNetHours} />

                <Textarea
                  label="Narrative"
                  labelPlacement="outside"
                  value={narrative}
                  onValueChange={setNarrative}
                  variant="bordered"
                  minRows={3}
                  placeholder="Daily narrative..."
                />

                <Textarea
                  label="Deviations"
                  labelPlacement="outside"
                  value={deviations}
                  onValueChange={setDeviations}
                  variant="bordered"
                  minRows={3}
                  placeholder="Any deviations from protocol..."
                />

                <Textarea
                  label="Visitors"
                  labelPlacement="outside"
                  value={visitors}
                  onValueChange={setVisitors}
                  variant="bordered"
                  minRows={3}
                  placeholder="Visitor notes..."
                />

                <Textarea
                  label="Station Management"
                  labelPlacement="outside"
                  value={stationManagement}
                  onValueChange={setStationManagement}
                  variant="bordered"
                  minRows={3}
                  placeholder="Station management notes..."
                />

                <Textarea
                  label="Injuries"
                  labelPlacement="outside"
                  value={injuries}
                  onValueChange={setInjuries}
                  variant="bordered"
                  minRows={3}
                  placeholder="Injury notes..."
                />

                <Textarea
                  label="Released"
                  labelPlacement="outside"
                  value={released}
                  onValueChange={setReleased}
                  variant="bordered"
                  minRows={3}
                  placeholder="Released bird notes..."
                />

                <section>
                  <p className="text-small pb-1">Import Census CSV</p>
                  <div className="rounded-medium border border-default-200 px-3 py-3">
                    <input
                      aria-label="Upload census CSV"
                      className="block w-full text-sm text-default-700 file:mr-3 file:rounded-medium file:border-0 file:bg-default-100 file:px-3 file:py-2 file:text-sm file:font-medium file:text-default-700 hover:file:bg-default-200"
                      type="file"
                      accept=".csv,text/csv"
                      onChange={handleCensusCsvUpload}
                    />
                    <p className="mt-2 text-xs text-default-500">
                      Uses the Species and Count values from the first two columns. Importing replaces all census counts
                      below.
                    </p>
                    {censusCsvMessage && (
                      <p className={`mt-2 text-sm ${censusCsvHasWarning ? "text-warning-600" : "text-success-600"}`}>
                        {censusCsvMessage}
                      </p>
                    )}
                  </div>
                </section>

                <DETSpeciesDataSection
                  key={`${mode}-${existingDET?.date ?? defaultDate ?? "new"}-${isOpen}`}
                  observedSpeciesCount={observedSpeciesCount}
                  censusSpeciesCount={censusSpeciesCount}
                  bandedSpeciesCount={bandedSpeciesCount}
                  repeatSpeciesCount={repeatSpeciesCount}
                  returnSpeciesCount={returnSpeciesCount}
                  DETSpeciesCount={DETSpeciesCount}
                  onObservedChange={setObservedSpeciesCount}
                  onCensusChange={setCensusSpeciesCount}
                  onDETChange={setDETSpeciesCount}
                />
              </div>
            </ModalBodyShell>
            <ModalFooterShell>
              <Button {...modalCancelButtonProps} onPress={onClose} isDisabled={isSaving}>
                Cancel
              </Button>
              <Button {...modalPrimaryButtonProps} onPress={handleSave} isLoading={isSaving}>
                {mode === "create" ? "Create DET" : "Save Changes"}
              </Button>
            </ModalFooterShell>
          </>
        )}
      </ModalShell>
      <ModalShell
        modalProps={{
          isOpen: pendingCensusImport !== null,
          onOpenChange: () => {
            setPendingCensusImport(null);
            setCensusCodeError("");
          },
          size: "lg",
          isDismissable: false,
          isKeyboardDismissDisabled: true,
          scrollBehavior: "inside",
        }}
      >
        {(onClose) => (
          <>
            <ModalHeaderShell>Assign Custom Bird Codes</ModalHeaderShell>
            <ModalBodyShell>
              <p className="text-sm text-default-600">
                These CSV species were not found. Enter a custom code for each one; they will be added to OTHER.
              </p>
              {censusCodeError && (
                <div className="rounded-lg bg-danger-50 p-3 text-sm text-danger-500">{censusCodeError}</div>
              )}
              <div className="space-y-4">
                {pendingCensusImport?.unmatchedSpecies.map((species, index) => (
                  <Input
                    key={species.name}
                    {...modalInputProps}
                    label={`${species.name} (${species.count})`}
                    placeholder="Custom bird code"
                    value={species.code}
                    onValueChange={(code) => {
                      const normalizedCode = code.toUpperCase().replace(/[^A-Z0-9_-]/g, "");
                      setPendingCensusImport((current) => {
                        if (!current) return current;
                        const nextSpecies = current.unmatchedSpecies.map((item, itemIndex) =>
                          itemIndex === index ? { ...item, code: normalizedCode } : item
                        );
                        return { ...current, unmatchedSpecies: nextSpecies };
                      });
                      setCensusCodeError("");
                    }}
                  />
                ))}
              </div>
            </ModalBodyShell>
            <ModalFooterShell>
              <Button
                {...modalCancelButtonProps}
                onPress={() => {
                  setPendingCensusImport(null);
                  setCensusCodeError("");
                  onClose();
                }}
              >
                Cancel Import
              </Button>
              <Button {...modalPrimaryButtonProps} onPress={applyCensusSpeciesCodes}>
                Apply Codes
              </Button>
            </ModalFooterShell>
          </>
        )}
      </ModalShell>
    </>
  );
}
