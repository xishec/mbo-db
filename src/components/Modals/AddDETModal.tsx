import { useState, useEffect } from "react";
import { Modal, ModalContent, ModalHeader, ModalBody, ModalFooter, Button, Input, Textarea } from "@heroui/react";
import type { DET, ObserverHours, NetHours, Injury, Released, Census, Weather } from "../../types/DET";
import { PencilIcon } from "@heroicons/react/24/outline";
import { fetchWeatherForDate } from "../../services/weatherService";
import DETObserverHoursModal from "./DETObserverHoursModal";
import DETNetHoursModal from "./DETNetHoursModal";
import DETSpeciesModal from "./DETSpeciesModal";
import DETInjuriesModal from "./DETInjuriesModal";
import DETReleasedModal from "./DETReleasedModal";
import DETCensusModal from "./DETCensusModal";
import DETVisitorsModal from "./DETVisitorsModal";

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
  const [census, setCensus] = useState<Census>({ speciesCount: {} });
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
  const [isObservedSpeciesModalOpen, setIsObservedSpeciesModalOpen] = useState(false);
  const [isBandedSpeciesModalOpen, setIsBandedSpeciesModalOpen] = useState(false);
  const [isRepeatSpeciesModalOpen, setIsRepeatSpeciesModalOpen] = useState(false);
  const [isReturnSpeciesModalOpen, setIsReturnSpeciesModalOpen] = useState(false);
  const [isDETSpeciesModalOpen, setIsDETSpeciesModalOpen] = useState(false);
  const [isInjuriesModalOpen, setIsInjuriesModalOpen] = useState(false);
  const [isReleasedModalOpen, setIsReleasedModalOpen] = useState(false);
  const [isCensusModalOpen, setIsCensusModalOpen] = useState(false);

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
      setCensus(existingDET.census || { speciesCount: {} });
      setBandedSpeciesCount(existingDET.bandedSpeciesCount || {});
      setRepeatSpeciesCount(existingDET.repeatSpeciesCount || {});
      setReturnSpeciesCount(existingDET.returnSpeciesCount || {});
      setDETSpeciesCount(existingDET.DETSpeciesCount || {});
      setWeather(existingDET.weather);
    } else if (mode === "create") {
      // Reset form for new DET
      setDate("");
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
      setCensus({ speciesCount: {} });
      setBandedSpeciesCount({});
      setRepeatSpeciesCount({});
      setReturnSpeciesCount({});
      setDETSpeciesCount({});
      setWeather(undefined);
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
        observedSpeciesCount,
        census,
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
      <Modal isOpen={isOpen} onOpenChange={onOpenChange} size="5xl" scrollBehavior="inside">
        <ModalContent>
          {(onClose) => (
            <>
              <ModalHeader className="flex flex-col gap-1">
                {mode === "create" ? "Add New DET" : "Edit DET"}
              </ModalHeader>
              <ModalBody>
                <div className="flex flex-col gap-4">
                  {error && <div className="bg-danger-50 text-danger-500 p-3 rounded-lg text-sm">{error}</div>}

                  {/* Basic Information */}
                  <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <Input
                        label="Date"
                        type="date"
                        value={date}
                        onValueChange={setDate}
                        isRequired
                        isDisabled={mode === "edit"}
                        variant="bordered"
                        description={
                          isLoadingWeather ? "Loading weather data..." : weather ? "Weather data loaded" : ""
                        }
                      />
                      <Input
                        label="Program ID"
                        value={programId}
                        onValueChange={setProgramId}
                        isRequired
                        variant="bordered"
                        placeholder="e.g., FALL2024"
                      />
                      <Input
                        label="Location"
                        value={location}
                        onValueChange={setLocation}
                        isRequired
                        variant="bordered"
                        placeholder="e.g., MBO"
                      />
                      <Input
                        label="Coverage Code"
                        type="number"
                        value={coverageCode}
                        onValueChange={setCoverageCode}
                        isRequired
                        variant="bordered"
                        placeholder="e.g., 1"
                      />
                      <Input
                        label="Bander in Charge"
                        value={banderInCharge}
                        onValueChange={setBanderInCharge}
                        variant="bordered"
                        placeholder="SLS"
                      />
                      <div className="grid grid-cols-2 gap-4">
                        <Input
                          label="Start Time"
                          type="time"
                          value={start}
                          onValueChange={setStart}
                          variant="bordered"
                        />
                        <Input label="End Time" type="time" value={end} onValueChange={setEnd} variant="bordered" />
                      </div>
                    </div>
                    <Textarea
                      label="Narrative"
                      value={narrative}
                      onValueChange={setNarrative}
                      variant="bordered"
                      minRows={3}
                      placeholder="Daily narrative..."
                    />
                    <Textarea
                      label="Deviations"
                      value={deviations}
                      onValueChange={setDeviations}
                      variant="bordered"
                      minRows={3}
                      placeholder="Any deviations from protocol..."
                    />
                    <Textarea
                      label="Station Management"
                      value={stationManagement}
                      onValueChange={setStationManagement}
                      variant="bordered"
                      minRows={3}
                      placeholder="Station management notes..."
                    />
                  </div>

                  {/* Observer Hours */}
                  <div className="flex justify-between items-center border rounded-medium border-medium border-default-200 py-2 px-3">
                    <div>
                      <p className="text-xs text-default-600">Observer Hours</p>
                      <p className="text-sm text-gray-600 pt-2">
                        Total: {observerHours.total} hours | Observers: {observerHours.observers?.length || 0}
                      </p>
                    </div>
                    <Button
                      startContent={<PencilIcon className="h-4 w-4" />}
                      onPress={() => setIsObserverHoursModalOpen(true)}
                      color="primary"
                      variant="light"
                    >
                      Edit
                    </Button>
                  </div>

                  {/* Net Hours */}
                  <div className="flex justify-between items-center border rounded-medium border-medium border-default-200 py-2 px-3">
                    <div>
                      <p className="text-xs text-default-600">Net Hours</p>
                      <p className="text-sm text-gray-600 pt-2">
                        Total: {netHours.total} | Hummingbird Trap: {netHours.hummingbirdTrapTotal} | Nets:{" "}
                        {netHours.nets.length}
                      </p>
                    </div>
                    <Button
                      startContent={<PencilIcon className="h-4 w-4" />}
                      onPress={() => setIsNetHoursModalOpen(true)}
                      color="primary"
                      variant="light"
                    >
                      Edit
                    </Button>
                  </div>

                  {/* Visitors */}
                  <div className="flex justify-between items-center border rounded-medium border-medium border-default-200 py-2 px-3">
                    <div>
                      <p className="text-xs text-default-600">Visitors</p>
                      <p className="text-sm text-gray-600 pt-2">
                        {visitors.length} visitor{visitors.length !== 1 ? "s" : ""}
                      </p>
                    </div>
                    <Button
                      startContent={<PencilIcon className="h-4 w-4" />}
                      onPress={() => setIsVisitorsModalOpen(true)}
                      color="primary"
                      variant="light"
                    >
                      Edit
                    </Button>
                  </div>

                  {/* Species Counts */}
                  <div className="space-y-4">
                    {[
                      { title: "Observed Species", data: observedSpeciesCount, setter: setIsObservedSpeciesModalOpen },
                      { title: "Banded Species", data: bandedSpeciesCount, setter: setIsBandedSpeciesModalOpen },
                      { title: "Repeat Species", data: repeatSpeciesCount, setter: setIsRepeatSpeciesModalOpen },
                      { title: "Return Species", data: returnSpeciesCount, setter: setIsReturnSpeciesModalOpen },
                      { title: "DET Species", data: DETSpeciesCount, setter: setIsDETSpeciesModalOpen },
                    ].map(({ title, data, setter }) => (
                      <div
                        key={title}
                        className="flex justify-between items-center border rounded-medium border-medium border-default-200 py-2 px-3"
                      >
                        <div>
                          <p className="text-xs text-default-600">{title}</p>
                          <p className="text-sm text-gray-600 pt-2">{getSpeciesCountSummary(data)}</p>
                        </div>
                        <Button
                          startContent={<PencilIcon className="h-4 w-4" />}
                          onPress={() => setter(true)}
                          color="primary"
                          variant="light"
                        >
                          Edit
                        </Button>
                      </div>
                    ))}
                  </div>

                  {/* Injuries */}
                  <div className="flex justify-between items-center border rounded-medium border-medium border-default-200 py-2 px-3">
                    <div>
                      <p className="text-xs text-default-600">Injuries</p>
                      <p className="text-sm text-gray-600 pt-2">
                        {injuries.length} injury record{injuries.length !== 1 ? "s" : ""}
                      </p>
                    </div>
                    <Button
                      startContent={<PencilIcon className="h-4 w-4" />}
                      onPress={() => setIsInjuriesModalOpen(true)}
                      color="primary"
                      variant="light"
                    >
                      Edit
                    </Button>
                  </div>

                  {/* Released */}
                  <div className="flex justify-between items-center border rounded-medium border-medium border-default-200 py-2 px-3">
                    <div>
                      <p className="text-xs text-default-600">Released</p>
                      <p className="text-sm text-gray-600 pt-2">
                        {released.length} released record{released.length !== 1 ? "s" : ""}
                      </p>
                    </div>
                    <Button
                      startContent={<PencilIcon className="h-4 w-4" />}
                      onPress={() => setIsReleasedModalOpen(true)}
                      color="primary"
                      variant="light"
                    >
                      Edit
                    </Button>
                  </div>

                  {/* Census */}
                  <div className="flex justify-between items-center border rounded-medium border-medium border-default-200 py-2 px-3">
                    <div>
                      <p className="text-xs text-default-600">Census</p>
                      <p className="text-sm text-gray-600 pt-2">
                        Censuser: {census.censuser || "—"} | Species: {getSpeciesCountSummary(census.speciesCount)}
                      </p>
                    </div>
                    <Button
                      startContent={<PencilIcon className="h-4 w-4" />}
                      onPress={() => setIsCensusModalOpen(true)}
                      color="primary"
                      variant="light"
                    >
                      Edit
                    </Button>
                  </div>

                  {/* Weather */}
                  <div className="border rounded-medium border-medium border-default-200 py-2 px-3">
                    <p className="text-xs text-default-600 mb-2">
                      Weather {isLoadingWeather && <span className="text-gray-500">(Loading...)</span>}
                    </p>
                    {weather ? (
                      <div className="grid grid-cols-3 gap-x-6 gap-y-2 text-sm text-gray-600">
                        {weather.temperature !== undefined && (
                          <div>
                            <span className="font-medium">Temperature:</span> {weather.temperature}°C
                          </div>
                        )}
                        {weather.temperatureMin !== undefined && (
                          <div>
                            <span className="font-medium">Min Temp:</span> {weather.temperatureMin}°C
                          </div>
                        )}
                        {weather.temperatureMax !== undefined && (
                          <div>
                            <span className="font-medium">Max Temp:</span> {weather.temperatureMax}°C
                          </div>
                        )}
                        {weather.cloudCoverage !== undefined && (
                          <div>
                            <span className="font-medium">Cloud Coverage:</span> {weather.cloudCoverage}%
                          </div>
                        )}
                        {weather.precipitation !== undefined && (
                          <div>
                            <span className="font-medium">Precipitation:</span> {weather.precipitation} mm
                          </div>
                        )}
                        {weather.windSpeed !== undefined && (
                          <div>
                            <span className="font-medium">Wind Speed:</span> {weather.windSpeed} km/h
                          </div>
                        )}
                        {weather.windDirection && (
                          <div>
                            <span className="font-medium">Wind Direction:</span> {weather.windDirection}
                          </div>
                        )}
                        {weather.humidity !== undefined && (
                          <div>
                            <span className="font-medium">Humidity:</span> {weather.humidity}%
                          </div>
                        )}
                        {weather.description && (
                          <div className="col-span-3">
                            <span className="font-medium">Description:</span> {weather.description}
                          </div>
                        )}
                      </div>
                    ) : (
                      <p className="text-sm text-gray-500">No weather data available</p>
                    )}
                  </div>
                </div>
              </ModalBody>
              <ModalFooter>
                <Button color="default" variant="flat" onPress={onClose} isDisabled={isSaving}>
                  Cancel
                </Button>
                <Button color="primary" onPress={handleSave} isLoading={isSaving}>
                  {mode === "create" ? "Create DET" : "Save Changes"}
                </Button>
              </ModalFooter>
            </>
          )}
        </ModalContent>
      </Modal>

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

      <DETSpeciesModal
        isOpen={isObservedSpeciesModalOpen}
        onOpenChange={() => setIsObservedSpeciesModalOpen(!isObservedSpeciesModalOpen)}
        speciesCount={observedSpeciesCount}
        onSave={setObservedSpeciesCount}
        title="Edit Observed Species Count"
      />

      <DETSpeciesModal
        isOpen={isBandedSpeciesModalOpen}
        onOpenChange={() => setIsBandedSpeciesModalOpen(!isBandedSpeciesModalOpen)}
        speciesCount={bandedSpeciesCount}
        onSave={setBandedSpeciesCount}
        title="Edit Banded Species Count"
      />

      <DETSpeciesModal
        isOpen={isRepeatSpeciesModalOpen}
        onOpenChange={() => setIsRepeatSpeciesModalOpen(!isRepeatSpeciesModalOpen)}
        speciesCount={repeatSpeciesCount}
        onSave={setRepeatSpeciesCount}
        title="Edit Repeat Species Count"
      />

      <DETSpeciesModal
        isOpen={isReturnSpeciesModalOpen}
        onOpenChange={() => setIsReturnSpeciesModalOpen(!isReturnSpeciesModalOpen)}
        speciesCount={returnSpeciesCount}
        onSave={setReturnSpeciesCount}
        title="Edit Return Species Count"
      />

      <DETSpeciesModal
        isOpen={isDETSpeciesModalOpen}
        onOpenChange={() => setIsDETSpeciesModalOpen(!isDETSpeciesModalOpen)}
        speciesCount={DETSpeciesCount}
        onSave={setDETSpeciesCount}
        title="Edit DET Species Count"
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

      <DETCensusModal
        isOpen={isCensusModalOpen}
        onOpenChange={() => setIsCensusModalOpen(!isCensusModalOpen)}
        census={census}
        onSave={setCensus}
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
