import { useState, useEffect, useMemo } from "react";
import { Button, Input, Textarea } from "@heroui/react";
import type { DET, ObserverHours, NetHours, Injury, Released, Weather } from "../../../types/DET";
import { BirdEventType } from "../../../types";
import { PencilIcon } from "@heroicons/react/24/outline";
import { fetchWeatherForDate } from "../../../services/weatherService";
import { useData } from "../../../services/useData";
import WeatherDisplay from "../../Helper/WeatherDisplay";
import DETObserverHoursModal from "./DETObserverHoursModal";
import DETNetHoursModal from "./DETNetHoursModal";
import DETUnifiedSpeciesModal from "./DETUnifiedSpeciesModal";
import DETInjuriesModal from "./DETInjuriesModal";
import DETReleasedModal from "./DETReleasedModal";
import DETVisitorsModal from "./DETVisitorsModal";
import ModalShell, { ModalBodyShell, ModalFooterShell, ModalHeaderShell } from "../ModalShell";
import {
  modalInputProps,
  modalCancelButtonProps,
  modalPrimaryButtonProps,
} from "../modalDefaults";

interface AddDETModalProps {
  isOpen: boolean;
  onOpenChange: () => void;
  onSave: (det: DET) => Promise<void>;
  existingDET?: DET | null;
  mode: "create" | "edit";
}

export default function AddDETModal({ isOpen, onOpenChange, onSave, existingDET, mode }: AddDETModalProps) {
  const { birdEventsMap } = useData();

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
  const [visitors, setVisitors] = useState<string[]>([]);
  const [injuries, setInjuries] = useState<Injury[]>([]);
  const [released, setReleased] = useState<Released[]>([]);
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

  // Auto-compute banded/repeat species from bird events for the selected date
  const computedFromEvents = useMemo(() => {
    if (!date) return { banded: {} as Record<string, number>, repeat: {} as Record<string, number>, return_: {} as Record<string, number> };
    const banded: Record<string, number> = {};
    const repeat: Record<string, number> = {};
    const return_: Record<string, number> = {};
    for (const ev of Object.values(birdEventsMap)) {
      if (!ev || ev.date !== date || ev.modifiedEventId || !ev.species) continue;
      if (ev.birdEventType === BirdEventType.Banded || ev.birdEventType === BirdEventType.None) {
        banded[ev.species] = (banded[ev.species] ?? 0) + 1;
      } else if (ev.birdEventType === BirdEventType.Repeat) {
        repeat[ev.species] = (repeat[ev.species] ?? 0) + 1;
      } else if (ev.birdEventType === BirdEventType.Return) {
        return_[ev.species] = (return_[ev.species] ?? 0) + 1;
      }
    }
    return { banded, repeat, return_ };
  }, [date, birdEventsMap]);

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
  const [isLoadingWeather, setIsLoadingWeather] = useState(false);

  // Modal states for complex objects
  const [isObserverHoursModalOpen, setIsObserverHoursModalOpen] = useState(false);
  const [isNetHoursModalOpen, setIsNetHoursModalOpen] = useState(false);
  const [isVisitorsModalOpen, setIsVisitorsModalOpen] = useState(false);
  const [isUnifiedSpeciesModalOpen, setIsUnifiedSpeciesModalOpen] = useState(false);
  const [isInjuriesModalOpen, setIsInjuriesModalOpen] = useState(false);
  const [isReleasedModalOpen, setIsReleasedModalOpen] = useState(false);

  // Prefill form when editing
  useEffect(() => {
    if (mode === "edit" && existingDET) {
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
      setNetHours(existingDET.netHours ? { nets: existingDET.netHours.nets || [], hummingbirdTrapTotal: existingDET.netHours.hummingbirdTrapTotal || "0", total: existingDET.netHours.total || "0" } : { nets: [], hummingbirdTrapTotal: "0", total: "0" });
      setVisitors(existingDET.visitors || []);
      setInjuries(existingDET.injuries || []);
      setReleased(existingDET.released || []);
      setObservedSpeciesCount(existingDET.observedSpeciesCount || {});
      setCensuser(existingDET.censuser || "");
      setCensusStart(existingDET.censusStart || "");
      setCensusEnd(existingDET.censusEnd || "");
      setCensusSpeciesCount(existingDET.censusSpeciesCount || {});
      setBandedSpeciesCount(existingDET.bandedSpeciesCount || {});
      setRepeatSpeciesCount(existingDET.repeatSpeciesCount || {});
      setReturnSpeciesCount(existingDET.returnSpeciesCount || {});
      setDETSpeciesCount(existingDET.DETSpeciesCount || {});
      setWeather(existingDET.weather);
    } else if (mode === "create") {
      // Reset form for new DET
      const today = new Date().toISOString().split("T")[0];
      setDate(today);
      setProgramId("");
      setLocation("");
      setBanderInCharge("");
      setStart("");
      setEnd("");
      setCoverageCode("");
      setNarrative("");
      setDeviations("");
      setStationManagement("");
      setObserverHours({ total: 0, observers: [] });
      setNetHours({ nets: [], hummingbirdTrapTotal: "0", total: "0" });
      setVisitors([]);
      setInjuries([]);
      setReleased([]);
      setObservedSpeciesCount({});
      setCensuser("");
      setCensusStart("");
      setCensusEnd("");
      setCensusSpeciesCount({});
      setBandedSpeciesCount({});
      setRepeatSpeciesCount({});
      setReturnSpeciesCount({});
      setDETSpeciesCount({});
      setWeather(undefined);
      
      // Fetch weather for today when modal opens
      if (isOpen) {
        setIsLoadingWeather(true);
        fetchWeatherForDate(today)
          .then((fetchedWeather) => {
            if (fetchedWeather) {
              setWeather(fetchedWeather);
            }
          })
          .catch((err) => {
            console.error("Failed to fetch weather:", err);
          })
          .finally(() => {
            setIsLoadingWeather(false);
          });
      }
    }
    setError("");
  }, [mode, existingDET, isOpen]);

  // Auto-populate weather when date changes (only in create mode)
  useEffect(() => {
    if (date && mode === "create") {
      setIsLoadingWeather(true);
      fetchWeatherForDate(date)
        .then((fetchedWeather) => {
          if (fetchedWeather) {
            setWeather(fetchedWeather);
          }
        })
        .catch((err) => {
          console.error("Failed to fetch weather:", err);
        })
        .finally(() => {
          setIsLoadingWeather(false);
        });
    }
  }, [date, mode]);

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

    try {
      setIsSaving(true);

      // Clean up weather object - set to undefined if all fields are undefined
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
      setError(err instanceof Error ? err.message : "Failed to save DET");
    } finally {
      setIsSaving(false);
    }
  };

  // Helper functions
  const getSpeciesCountSummary = (count: Record<string, number>) => {
    const total = Object.values(count).reduce((sum, val) => sum + val, 0);
    const speciesCount = Object.keys(count).length;
    return `${speciesCount} species, ${total} individuals`;
  };

  return (
    <>
      <ModalShell
        modalProps={{
          isOpen,
          onOpenChange,
          size: "5xl",
          scrollBehavior: "inside",
        }}
      >
        {(onClose) => (
          <>
              <ModalHeaderShell>{mode === "create" ? "Add New DET" : "Edit DET"}</ModalHeaderShell>
              <ModalBodyShell>
                <div className="flex flex-col gap-4">
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
                        description={
                          isLoadingWeather ? "Loading weather data..." : weather ? "Weather data loaded" : ""
                        }
                      />
                      <Input
                        label="Program ID"
                        {...modalInputProps}
                        value={programId}
                        onValueChange={setProgramId}
                        isRequired
                        placeholder="e.g., FALL2024"
                      />
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
                          type="time"
                          value={start}
                          onValueChange={setStart}
                        />
                        <Input label="End Time" {...modalInputProps} type="time" value={end} onValueChange={setEnd} />
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
                          type="time"
                          value={censusStart}
                          onValueChange={setCensusStart}
                        />
                        <Input
                          label="Census End"
                          {...modalInputProps}
                          type="time"
                          value={censusEnd}
                          onValueChange={setCensusEnd}
                        />
                      </div>
                    </div>
                  </div>

                  {/* Weather */}
                  <div>
                    <p className="text-small pb-1">Weather at MBO</p>
                    <div className="rounded-medium border border-default-100 py-2 px-3">
                      <WeatherDisplay weather={weather} isLoading={isLoadingWeather} />
                    </div>
                  </div>

                  {/* Observer Hours */}
                  <div>
                    <p className="text-small pb-1">Observer Hours</p>
                    <div className="flex justify-between items-center rounded-medium border border-default-100 py-2 px-3">
                      <p className="text-sm text-gray-600">
                        Total: {observerHours.total} hours | Observers: {observerHours.observers?.length || 0}
                      </p>
                      <Button
                        startContent={<PencilIcon className="h-4 w-4" />}
                        onPress={() => setIsObserverHoursModalOpen(true)}
                        color="primary"
                        variant="light"
                      >
                        Edit
                      </Button>
                    </div>
                  </div>

                  {/* Net Hours */}
                  <div>
                    <p className="text-small pb-1">Net Hours</p>
                    <div className="flex justify-between items-center rounded-medium border border-default-100 py-2 px-3">
                      <p className="text-sm text-gray-600">
                        Total: {netHours.total} | Hummingbird Trap: {netHours.hummingbirdTrapTotal} | Nets:{" "}
                        {netHours.nets?.length || 0}
                      </p>
                      <Button
                        startContent={<PencilIcon className="h-4 w-4" />}
                        onPress={() => setIsNetHoursModalOpen(true)}
                        color="primary"
                        variant="light"
                      >
                        Edit
                      </Button>
                    </div>
                  </div>

                  {/* Unified Species Data Entry */}
                  <div>
                    <p className="text-small pb-1">Species Data (Obs, Cns, Ret, DET)</p>
                    <div className="flex justify-between items-center rounded-medium border border-default-100 py-2 px-3">
                      <div className="text-sm text-gray-600 space-y-1">
                        <p>Observed: {getSpeciesCountSummary(observedSpeciesCount)}</p>
                        <p>Census: {getSpeciesCountSummary(censusSpeciesCount)}</p>
                        <p>Banded: {getSpeciesCountSummary(bandedSpeciesCount)}</p>
                        <p>Repeats: {getSpeciesCountSummary(repeatSpeciesCount)}</p>
                        <p>Return: {getSpeciesCountSummary(returnSpeciesCount)}</p>
                        <p>DET: {getSpeciesCountSummary(DETSpeciesCount)}</p>
                      </div>
                      <Button
                        startContent={<PencilIcon className="h-4 w-4" />}
                        onPress={() => setIsUnifiedSpeciesModalOpen(true)}
                        color="primary"
                        variant="light"
                      >
                        Edit
                      </Button>
                    </div>
                  </div>

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

                  {/* Visitors */}
                  <div>
                    <p className="text-small pb-1">Visitors</p>
                    <div className="flex justify-between items-center rounded-medium border border-default-100 py-2 px-3">
                      <p className="text-sm text-gray-600">
                        {visitors.length} visitor{visitors.length !== 1 ? "s" : ""}
                      </p>
                      <Button
                        startContent={<PencilIcon className="h-4 w-4" />}
                        onPress={() => setIsVisitorsModalOpen(true)}
                        color="primary"
                        variant="light"
                      >
                        Edit
                      </Button>
                    </div>
                  </div>

                  <Textarea
                    label="Station Management"
                    labelPlacement="outside"
                    value={stationManagement}
                    onValueChange={setStationManagement}
                    variant="bordered"
                    minRows={3}
                    placeholder="Station management notes..."
                  />

                  {/* Injuries */}
                  <div>
                    <p className="text-small pb-1">Injuries</p>
                    <div className="flex justify-between items-center rounded-medium border border-default-100 py-2 px-3">
                      <p className="text-sm text-gray-600">
                        {injuries.length} injury record{injuries.length !== 1 ? "s" : ""}
                      </p>
                      <Button
                        startContent={<PencilIcon className="h-4 w-4" />}
                        onPress={() => setIsInjuriesModalOpen(true)}
                        color="primary"
                        variant="light"
                      >
                        Edit
                      </Button>
                    </div>
                  </div>

                  {/* Released */}
                  <div>
                    <p className="text-small pb-1">Released</p>
                    <div className="flex justify-between items-center rounded-medium border border-default-100 py-2 px-3">
                      <p className="text-sm text-gray-600">
                        {released.length} released record{released.length !== 1 ? "s" : ""}
                      </p>
                      <Button
                        startContent={<PencilIcon className="h-4 w-4" />}
                        onPress={() => setIsReleasedModalOpen(true)}
                        color="primary"
                        variant="light"
                      >
                        Edit
                      </Button>
                    </div>
                  </div>
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

      {/* Complex Object Modals */}
      <DETObserverHoursModal
        isOpen={isObserverHoursModalOpen}
        onOpenChange={() => setIsObserverHoursModalOpen(!isObserverHoursModalOpen)}
        observerHours={observerHours}
        onSave={setObserverHours}
      />

      <DETNetHoursModal
        isOpen={isNetHoursModalOpen}
        onOpenChange={() => setIsNetHoursModalOpen(!isNetHoursModalOpen)}
        netHours={netHours}
        onSave={setNetHours}
      />

      <DETUnifiedSpeciesModal
        isOpen={isUnifiedSpeciesModalOpen}
        onOpenChange={() => setIsUnifiedSpeciesModalOpen(!isUnifiedSpeciesModalOpen)}
        observedSpeciesCount={observedSpeciesCount}
        censusSpeciesCount={censusSpeciesCount}
        bandedSpeciesCount={bandedSpeciesCount}
        repeatSpeciesCount={repeatSpeciesCount}
        returnSpeciesCount={returnSpeciesCount}
        DETSpeciesCount={DETSpeciesCount}
        onSave={({ observedSpeciesCount, censusSpeciesCount, DETSpeciesCount }) => {
          setObservedSpeciesCount(observedSpeciesCount);
          setCensusSpeciesCount(censusSpeciesCount);
          setDETSpeciesCount(DETSpeciesCount);
        }}
      />

      <DETInjuriesModal
        isOpen={isInjuriesModalOpen}
        onOpenChange={() => setIsInjuriesModalOpen(!isInjuriesModalOpen)}
        injuries={injuries}
        onSave={setInjuries}
      />

      <DETReleasedModal
        isOpen={isReleasedModalOpen}
        onOpenChange={() => setIsReleasedModalOpen(!isReleasedModalOpen)}
        released={released}
        onSave={setReleased}
      />

      <DETVisitorsModal
        isOpen={isVisitorsModalOpen}
        onOpenChange={() => setIsVisitorsModalOpen(!isVisitorsModalOpen)}
        visitors={visitors}
        onSave={setVisitors}
      />
    </>
  );
}
