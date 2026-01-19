import { useState, useEffect } from "react";
import { Button, Input, Textarea } from "@heroui/react";
import type { DET, ObserverHours, NetHours, Injury, Released, Weather } from "../../types/DET";
import { PencilIcon } from "@heroicons/react/24/outline";
import { fetchWeatherForDate } from "../../services/weatherService";
import DETObserverHoursModal from "./DETObserverHoursModal";
import DETNetHoursModal from "./DETNetHoursModal";
import DETUnifiedSpeciesModal from "./DETUnifiedSpeciesModal";
import DETInjuriesModal from "./DETInjuriesModal";
import DETReleasedModal from "./DETReleasedModal";
import DETVisitorsModal from "./DETVisitorsModal";
import ModalShell, { ModalBodyShell, ModalFooterShell, ModalHeaderShell } from "./ModalShell";
import {
        modalInputProps,
  modalCancelButtonProps,
  modalPrimaryButtonProps,
} from "./modalDefaults";

interface AddDETModalProps {
  isOpen: boolean;
  onOpenChange: () => void;
  onSave: (det: DET) => Promise<void>;
  existingDET?: DET | null;
  mode: "create" | "edit";
}

export default function AddDETModal({ isOpen, onOpenChange, onSave, existingDET, mode }: AddDETModalProps) {
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
      setNetHours(existingDET.netHours || { nets: [], hummingbirdTrapTotal: "0", total: "0" });
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
    if (!coverageCode || isNaN(Number(coverageCode))) {
      setError("Valid coverage code is required");
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
                        label="Coverage Code"
                        {...modalInputProps}
                        type="number"
                        value={coverageCode}
                        onValueChange={setCoverageCode}
                        isRequired
                        placeholder="e.g., 1"
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
                    <div className="border rounded-medium border border-default-100 py-2 px-3">
                      {isLoadingWeather ? (
                        <p className="text-sm text-gray-600">Loading weather data...</p>
                      ) : weather ? (
                        <div className="text-sm text-gray-600 space-y-1">
                          {weather.temperatureMin !== undefined && weather.temperatureMax !== undefined && (
                            <p>
                              Temperature: {weather.temperatureMin.toFixed(1)}°C - {weather.temperatureMax.toFixed(1)}°C
                            </p>
                          )}
                          {weather.cloudCoverage !== undefined && (
                            <p>Cloud Coverage: {weather.cloudCoverage.toFixed(0)}%</p>
                          )}
                          {weather.precipitation !== undefined && (
                            <p>Precipitation: {weather.precipitation.toFixed(1)} mm</p>
                          )}
                          {weather.windSpeed !== undefined && (
                            <p>
                              Wind: {weather.windSpeed.toFixed(1)} km/h
                              {weather.windDirection && ` ${weather.windDirection}`}
                            </p>
                          )}
                          {(!weather.temperatureMin && !weather.temperatureMax && !weather.cloudCoverage && !weather.precipitation && !weather.windSpeed) && (
                            <p className="text-gray-400">No weather data available</p>
                          )}
                        </div>
                      ) : (
                        <p className="text-sm text-gray-600">No weather data available</p>
                      )}
                    </div>
                  </div>

                  {/* Observer Hours */}
                  <div>
                    <p className="text-small pb-1">Observer Hours</p>
                    <div className="flex justify-between items-center border rounded-medium border border-default-100 py-2 px-3">
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
                    <div className="flex justify-between items-center border rounded-medium border border-default-100 py-2 px-3">
                      <p className="text-sm text-gray-600">
                        Total: {netHours.total} | Hummingbird Trap: {netHours.hummingbirdTrapTotal} | Nets:{" "}
                        {netHours.nets.length}
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
                    <div className="flex justify-between items-center border rounded-medium border border-default-100 py-2 px-3">
                      <div className="text-sm text-gray-600 space-y-1">
                        <p>Observed: {getSpeciesCountSummary(observedSpeciesCount)}</p>
                        <p>Census: {getSpeciesCountSummary(censusSpeciesCount)}</p>
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
                    <div className="flex justify-between items-center border rounded-medium border border-default-100 py-2 px-3">
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
                    <div className="flex justify-between items-center border rounded-medium border border-default-100 py-2 px-3">
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
                    <div className="flex justify-between items-center border rounded-medium border border-default-100 py-2 px-3">
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
        returnSpeciesCount={returnSpeciesCount}
        DETSpeciesCount={DETSpeciesCount}
        onSave={({ observedSpeciesCount, censusSpeciesCount, returnSpeciesCount, DETSpeciesCount }) => {
          setObservedSpeciesCount(observedSpeciesCount);
          setCensusSpeciesCount(censusSpeciesCount);
          setReturnSpeciesCount(returnSpeciesCount);
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
