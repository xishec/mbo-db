import { useState, useEffect } from "react";
import {
  Modal,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
  Button,
  Input,
  Textarea,
  Chip,
  Divider,
} from "@heroui/react";
import type { DET, ObserverHours, NetHours, Injury, Released, Census, Weather } from "../../types/DET";
import { PencilIcon, PlusIcon } from "@heroicons/react/24/outline";
import { fetchWeatherForDate } from "../../services/weatherService";
import DETObserverHoursModal from "./DETObserverHoursModal";
import DETNetHoursModal from "./DETNetHoursModal";
import DETSpeciesModal from "./DETSpeciesModal";
import DETInjuriesModal from "./DETInjuriesModal";
import DETReleasedModal from "./DETReleasedModal";
import DETCensusModal from "./DETCensusModal";

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
  const [newVisitor, setNewVisitor] = useState("");
  const [isLoadingWeather, setIsLoadingWeather] = useState(false);

  // Modal states for complex objects
  const [isObserverHoursModalOpen, setIsObserverHoursModalOpen] = useState(false);
  const [isNetHoursModalOpen, setIsNetHoursModalOpen] = useState(false);
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
    setNewVisitor("");
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
  const addVisitor = () => {
    if (newVisitor.trim()) {
      setVisitors([...visitors, newVisitor.trim()]);
      setNewVisitor("");
    }
  };

  const removeVisitor = (index: number) => {
    setVisitors(visitors.filter((_, i) => i !== index));
  };

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
                <div className="flex flex-col gap-6">
                  {error && <div className="bg-danger-50 text-danger-500 p-3 rounded-lg text-sm">{error}</div>}

                  {/* Basic Information */}
                  <div className="space-y-4">
                    <h3 className="text-lg font-semibold">Basic Information</h3>
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
                        label="Bander in sCharge"
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

                  <Divider />

                  {/* Observer Hours */}
                  <div className="flex justify-between items-center border rounded-lg p-3">
                    <div>
                      <p className="font-medium">Observer Hours</p>
                      <p className="text-sm text-gray-600">
                        Total: {observerHours.total} hours | Observers: {observerHours.observers?.length || 0}
                      </p>
                    </div>
                    <Button
                      startContent={<PencilIcon className="h-4 w-4" />}
                      onPress={() => setIsObserverHoursModalOpen(true)}
                      color="primary"
                      variant="flat"
                    >
                      Edit
                    </Button>
                  </div>

                  <Divider />

                  {/* Net Hours */}
                  <div className="space-y-2">
                    <div className="flex justify-between items-center">
                      <h3 className="text-lg font-semibold">Net Hours</h3>
                      <Button
                        startContent={<PencilIcon className="h-4 w-4" />}
                        onPress={() => setIsNetHoursModalOpen(true)}
                        color="primary"
                        variant="flat"
                      >
                        Edits
                      </Button>
                    </div>
                    <div className="text-sm text-gray-600">
                      Total: {netHours.total} | Hummingbird Trap: {netHours.hummingbirdTrapTotal} | Nets:{" "}
                      {netHours.nets.length}
                    </div>
                  </div>

                  <Divider />

                  {/* Visitors */}
                  <div className="space-y-2">
                    <h3 className="text-lg font-semibold">Visitors</h3>
                    <div className="flex gap-2">
                      <Input
                        label="Add Visitor"
                        value={newVisitor}
                        onValueChange={setNewVisitor}
                        variant="bordered"
                        size="sm"
                        className="flex-1"
                        onKeyPress={(e) => e.key === "Enter" && addVisitor()}
                      />
                      <Button
                        startContent={<PlusIcon className="h-4 w-4" />}
                        onPress={addVisitor}
                        color="primary"
                        className="self-end"
                        size="sm"
                      >
                        Add
                      </Button>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {visitors.map((visitor, index) => (
                        <Chip key={index} onClose={() => removeVisitor(index)} variant="flat" color="primary">
                          {visitor}
                        </Chip>
                      ))}
                      {visitors.length === 0 && <p className="text-sm text-gray-500">No visitors added</p>}
                    </div>
                  </div>

                  <Divider />

                  {/* Species Counts */}
                  <div className="space-y-4">
                    <h3 className="text-lg font-semibold">Species Counts</h3>
                    {[
                      { title: "Observed Species", data: observedSpeciesCount, setter: setIsObservedSpeciesModalOpen },
                      { title: "Banded Species", data: bandedSpeciesCount, setter: setIsBandedSpeciesModalOpen },
                      { title: "Repeat Species", data: repeatSpeciesCount, setter: setIsRepeatSpeciesModalOpen },
                      { title: "Return Species", data: returnSpeciesCount, setter: setIsReturnSpeciesModalOpen },
                      { title: "DET Species", data: DETSpeciesCount, setter: setIsDETSpeciesModalOpen },
                    ].map(({ title, data, setter }) => (
                      <div key={title} className="flex justify-between items-center border rounded-lg p-3">
                        <div>
                          <p className="font-medium">{title}</p>
                          <p className="text-sm text-gray-600">{getSpeciesCountSummary(data)}</p>
                        </div>
                        <Button
                          startContent={<PencilIcon className="h-4 w-4" />}
                          onPress={() => setter(true)}
                          size="sm"
                          color="primary"
                          variant="flat"
                        >
                          Edit
                        </Button>
                      </div>
                    ))}
                  </div>

                  <Divider />

                  {/* Injuries */}
                  <div className="space-y-2">
                    <div className="flex justify-between items-center">
                      <h3 className="text-lg font-semibold">Injuries</h3>
                      <Button
                        startContent={<PencilIcon className="h-4 w-4" />}
                        onPress={() => setIsInjuriesModalOpen(true)}
                        size="sm"
                        color="primary"
                        variant="flat"
                      >
                        Edit
                      </Button>
                    </div>
                    <div className="text-sm text-gray-600">
                      {injuries.length} injury record{injuries.length !== 1 ? "s" : ""}
                    </div>
                  </div>

                  <Divider />

                  {/* Released */}
                  <div className="space-y-2">
                    <div className="flex justify-between items-center">
                      <h3 className="text-lg font-semibold">Released</h3>
                      <Button
                        startContent={<PencilIcon className="h-4 w-4" />}
                        onPress={() => setIsReleasedModalOpen(true)}
                        size="sm"
                        color="primary"
                        variant="flat"
                      >
                        Edit
                      </Button>
                    </div>
                    <div className="text-sm text-gray-600">
                      {released.length} released record{released.length !== 1 ? "s" : ""}
                    </div>
                  </div>

                  <Divider />

                  {/* Census */}
                  <div className="space-y-2">
                    <div className="flex justify-between items-center">
                      <h3 className="text-lg font-semibold">Census</h3>
                      <Button
                        startContent={<PencilIcon className="h-4 w-4" />}
                        onPress={() => setIsCensusModalOpen(true)}
                        size="sm"
                        color="primary"
                        variant="flat"
                      >
                        Edit
                      </Button>
                    </div>
                    <div className="text-sm text-gray-600">
                      Censuser: {census.censuser || "—"} | Species: {getSpeciesCountSummary(census.speciesCount)}
                    </div>
                  </div>

                  <Divider />

                  {/* Weather */}
                  <div className="space-y-4">
                    <h3 className="text-lg font-semibold">
                      Weather {isLoadingWeather && <span className="text-sm text-gray-500">(Loading...)</span>}
                    </h3>
                    <div className="grid grid-cols-3 gap-4">
                      <Input
                        label="Temperature (°C)"
                        type="number"
                        value={weather?.temperature ? String(weather.temperature) : ""}
                        onValueChange={(val) =>
                          setWeather({ ...(weather || {}), temperature: val ? Number(val) : undefined })
                        }
                        variant="bordered"
                      />
                      <Input
                        label="Min Temperature (°C)"
                        type="number"
                        value={weather?.temperatureMin ? String(weather.temperatureMin) : ""}
                        onValueChange={(val) =>
                          setWeather({ ...(weather || {}), temperatureMin: val ? Number(val) : undefined })
                        }
                        variant="bordered"
                      />
                      <Input
                        label="Max Temperature (°C)"
                        type="number"
                        value={weather?.temperatureMax ? String(weather.temperatureMax) : ""}
                        onValueChange={(val) =>
                          setWeather({ ...(weather || {}), temperatureMax: val ? Number(val) : undefined })
                        }
                        variant="bordered"
                      />
                      <Input
                        label="Cloud Coverage (%)"
                        type="number"
                        value={weather?.cloudCoverage ? String(weather.cloudCoverage) : ""}
                        onValueChange={(val) =>
                          setWeather({ ...(weather || {}), cloudCoverage: val ? Number(val) : undefined })
                        }
                        variant="bordered"
                      />
                      <Input
                        label="Precipitation (mm)"
                        type="number"
                        value={weather?.precipitation ? String(weather.precipitation) : ""}
                        onValueChange={(val) =>
                          setWeather({ ...(weather || {}), precipitation: val ? Number(val) : undefined })
                        }
                        variant="bordered"
                      />
                      <Input
                        label="Wind Speed (km/h)"
                        type="number"
                        value={weather?.windSpeed ? String(weather.windSpeed) : ""}
                        onValueChange={(val) =>
                          setWeather({ ...(weather || {}), windSpeed: val ? Number(val) : undefined })
                        }
                        variant="bordered"
                      />
                      <Input
                        label="Wind Direction"
                        value={weather?.windDirection || ""}
                        onValueChange={(val) => setWeather({ ...(weather || {}), windDirection: val || undefined })}
                        variant="bordered"
                        placeholder="N, NE, E, SE, S, SW, W, NW"
                      />
                      <Input
                        label="Humidity (%)"
                        type="number"
                        value={weather?.humidity ? String(weather.humidity) : ""}
                        onValueChange={(val) =>
                          setWeather({ ...(weather || {}), humidity: val ? Number(val) : undefined })
                        }
                        variant="bordered"
                      />
                      <Textarea
                        label="Description"
                        value={weather?.description || ""}
                        onValueChange={(val) => setWeather({ ...(weather || {}), description: val || undefined })}
                        variant="bordered"
                        placeholder="Clear, Cloudy, Rain, etc."
                        minRows={2}
                      />
                    </div>
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
    </>
  );
}
