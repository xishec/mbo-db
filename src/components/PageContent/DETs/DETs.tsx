import { useState } from "react";
import { useData } from "../../../services/useData";
import type { DET } from "../../../types/DET";
import { Calendar, Card, CardBody, CardHeader, Chip, Button } from "@heroui/react";
import type { DateValue } from "@internationalized/date";
import SpeciesTooltip from "../../Helper/Info/SpeciesTooltip";
import { fetchWeatherForDate } from "../../../services/weatherService";
import AddDETModal from "../../Modals/AddDETModal";
import { PencilIcon } from "@heroicons/react/24/outline";

export default function DETs() {
  const { DETsMap, isAdmin, saveDET } = useData();
  const [selectedDET, setSelectedDET] = useState<DET | null>(null);
  const [isLoadingWeather, setIsLoadingWeather] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editedDET, setEditedDET] = useState<DET | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<"create" | "edit">("create");

  // Get available dates as a Set for quick lookup
  const availableDatesSet = new Set(Object.keys(DETsMap));

  const handleDateChange = async (value: DateValue | null) => {
    // Cancel edit mode when changing dates
    if (isEditing) {
      setIsEditing(false);
      setEditedDET(null);
    }

    if (!value) {
      setSelectedDET(null);
      return;
    }

    // Convert the date value to YYYY-MM-DD format
    const dateStr = `${value.year}-${String(value.month).padStart(2, "0")}-${String(value.day).padStart(2, "0")}`;
    const det = availableDatesSet.has(dateStr) ? DETsMap[dateStr] : null;

    if (det && !det.weather) {
      // Fetch weather data if not already present
      setIsLoadingWeather(true);
      const weather = await fetchWeatherForDate(dateStr);
      if (weather) {
        // Create a new DET object with weather data
        setSelectedDET({ ...det, weather });
      } else {
        setSelectedDET(det);
      }
      setIsLoadingWeather(false);
    } else {
      setSelectedDET(det);
    }
  };

  // Function to check if a date is unavailable
  const isDateUnavailable = (date: DateValue) => {
    const dateStr = `${date.year}-${String(date.month).padStart(2, "0")}-${String(date.day).padStart(2, "0")}`;
    return !availableDatesSet.has(dateStr);
  };

  // Edit mode handlers
  const handleEdit = () => {
    if (selectedDET) {
      setEditedDET({ ...selectedDET });
      setModalMode("edit");
      setIsModalOpen(true);
    }
  };

  const handleAddNew = () => {
    setEditedDET(null);
    setModalMode("create");
    setIsModalOpen(true);
  };

  const handleModalSave = async (det: DET) => {
    await saveDET(det);
    if (modalMode === "edit") {
      setSelectedDET(det);
    }
  };

  // Helper function to get species count summary
  const getSpeciesCountSummary = (count: Record<string, number>) => {
    const total = Object.values(count || {}).reduce((sum, val) => sum + val, 0);
    const speciesCount = Object.keys(count || {}).length;
    return `${speciesCount} species, ${total} individuals`;
  };

  // Helper function to render a species category section
  const renderSpeciesCategory = (
    title: string,
    speciesCount: Record<string, number>,
    chipColor: "default" | "success" | "warning" | "secondary" | "primary",
    emptyMessage: string
  ) => {
    const hasSpecies = Object.keys(speciesCount || {}).length > 0;
    return (
      <div>
        <p className="text-sm text-gray-600 mb-2">
          {title}: {getSpeciesCountSummary(speciesCount)}
        </p>
        {hasSpecies ? (
          <div className="flex flex-wrap gap-2">
            {Object.entries(speciesCount || {}).map(([species, count]) => (
              <SpeciesTooltip key={species} speciesCode={species}>
                <Chip variant="flat" color={chipColor} size="sm">
                  {species}: {count}
                </Chip>
              </SpeciesTooltip>
            ))}
          </div>
        ) : (
          <p className="text-xs text-gray-400">{emptyMessage}</p>
        )}
      </div>
    );
  };

  const DETDisplay = selectedDET && (
    <div className="flex-1">
      <Card className="" shadow="sm">
        {/* Header */}
        <CardHeader className="flex gap-3 justify-between items-start">
          <div className="flex flex-col flex-1">
            <p className="text-2xl font-semibold">DET for {selectedDET.date}</p>
          </div>
          {isAdmin && (
            <Button isIconOnly size="sm" variant="light" onPress={handleEdit}>
              <PencilIcon className="h-5 w-5" />
            </Button>
          )}
        </CardHeader>

        <CardBody className="py-4 space-y-4">
          {/* Basic Information */}
          <div className="space-y-4">
            <p className="text-small font-semibold">Basic Information</p>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-small text-gray-600 mb-1">Date</p>
                <p className="font-medium">{selectedDET.date}</p>
              </div>
              <div>
                <p className="text-small text-gray-600 mb-1">Program ID</p>
                <p className="font-medium">{selectedDET.programId}</p>
              </div>
              <div>
                <p className="text-small text-gray-600 mb-1">Location</p>
                <p className="font-medium">{selectedDET.location}</p>
              </div>
              <div>
                <p className="text-small text-gray-600 mb-1">Coverage Code</p>
                <p className="font-medium">{selectedDET.coverageCode}</p>
              </div>
              <div>
                <p className="text-small text-gray-600 mb-1">Bander in Charge</p>
                <p className="font-medium">{selectedDET.banderInCharge || <span className="text-gray-400">—</span>}</p>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-small text-gray-600 mb-1">Start Time</p>
                  <p className="font-medium">{selectedDET.start || <span className="text-gray-400">—</span>}</p>
                </div>
                <div>
                  <p className="text-small text-gray-600 mb-1">End Time</p>
                  <p className="font-medium">{selectedDET.end || <span className="text-gray-400">—</span>}</p>
                </div>
              </div>
              <div>
                <p className="text-small text-gray-600 mb-1">Censuser</p>
                <p className="font-medium">{selectedDET.censuser || <span className="text-gray-400">—</span>}</p>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-small text-gray-600 mb-1">Census Start</p>
                  <p className="font-medium">{selectedDET.censusStart || <span className="text-gray-400">—</span>}</p>
                </div>
                <div>
                  <p className="text-small text-gray-600 mb-1">Census End</p>
                  <p className="font-medium">{selectedDET.censusEnd || <span className="text-gray-400">—</span>}</p>
                </div>
              </div>
            </div>
          </div>

          {/* Weather */}
          <div>
            <p className="text-small font-semibold mb-2">Weather at MBO</p>
            <div className="border rounded-medium border border-default-100 py-2 px-3">
              {isLoadingWeather ? (
                <p className="text-sm text-gray-600">Loading weather data...</p>
              ) : selectedDET.weather ? (
                <div className="text-sm text-gray-600 space-y-1">
                  {selectedDET.weather.temperatureMin !== undefined && selectedDET.weather.temperatureMax !== undefined && (
                    <p>
                      Temperature: {selectedDET.weather.temperatureMin.toFixed(1)}°C - {selectedDET.weather.temperatureMax.toFixed(1)}°C
                    </p>
                  )}
                  {selectedDET.weather.cloudCoverage !== undefined && (
                    <p>Cloud Coverage: {selectedDET.weather.cloudCoverage.toFixed(0)}%</p>
                  )}
                  {selectedDET.weather.precipitation !== undefined && (
                    <p>Precipitation: {selectedDET.weather.precipitation.toFixed(1)} mm</p>
                  )}
                  {selectedDET.weather.windSpeed !== undefined && (
                    <p>
                      Wind: {selectedDET.weather.windSpeed.toFixed(1)} km/h
                      {selectedDET.weather.windDirection && ` ${selectedDET.weather.windDirection}`}
                    </p>
                  )}
                  {(!selectedDET.weather.temperatureMin && !selectedDET.weather.temperatureMax && !selectedDET.weather.cloudCoverage && !selectedDET.weather.precipitation && !selectedDET.weather.windSpeed) && (
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
            <p className="text-small font-semibold mb-2">Observer Hours</p>
            <div className="border rounded-medium border border-default-100 py-2 px-3">
              <p className="text-sm text-gray-600">
                Total: {selectedDET.observerHours?.total || 0} hours | Observers: {selectedDET.observerHours?.observers?.length || 0}
              </p>
              {selectedDET.observerHours?.observers && selectedDET.observerHours.observers.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-2">
                  {selectedDET.observerHours.observers.map((observer, idx) => (
                    <Chip key={idx} variant="flat" color="secondary" size="sm">
                      {observer.name}: {observer.totalHours.toFixed(1)}h
                    </Chip>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Net Hours */}
          <div>
            <p className="text-small font-semibold mb-2">Net Hours</p>
            <div className="border rounded-medium border border-default-100 py-2 px-3">
              <p className="text-sm text-gray-600">
                Total: {selectedDET.netHours?.total || "0"} | Hummingbird Trap: {selectedDET.netHours?.hummingbirdTrapTotal || "0"} | Nets:{" "}
                {selectedDET.netHours?.nets?.length || 0}
              </p>
              {selectedDET.netHours?.nets && selectedDET.netHours.nets.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-2">
                  {selectedDET.netHours.nets.map((net, idx) => (
                    <Chip key={idx} variant="flat" color="primary" size="sm">
                      {net.id}: {net.total}
                    </Chip>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Species Data */}
          <div>
            <p className="text-small font-semibold mb-2">Species Data (Obs, Cns, Ret, DET)</p>
            <div className="border rounded-medium border border-default-100 py-2 px-3">
              <div className="space-y-3">
                {renderSpeciesCategory("Observed", selectedDET.observedSpeciesCount, "default", "No observed species")}
                {renderSpeciesCategory("Census", selectedDET.censusSpeciesCount || {}, "primary", "No census species")}
                {renderSpeciesCategory("Return", selectedDET.returnSpeciesCount, "primary", "No return species")}
                {renderSpeciesCategory("DET", selectedDET.DETSpeciesCount, "warning", "No DET species")}
              </div>
            </div>
          </div>

          {/* Narrative */}
          <div>
            <p className="text-small font-semibold mb-2">Narrative</p>
            <div className="border rounded-medium border border-default-100 py-2 px-3">
              <p className="text-sm text-gray-600 whitespace-pre-wrap">{selectedDET.narrative || "—"}</p>
            </div>
          </div>

          {/* Deviations */}
          <div>
            <p className="text-small font-semibold mb-2">Deviations</p>
            <div className="border rounded-medium border border-default-100 py-2 px-3">
              <p className="text-sm text-gray-600 whitespace-pre-wrap">{selectedDET.deviations || "—"}</p>
            </div>
          </div>

          {/* Visitors */}
          <div>
            <p className="text-small font-semibold mb-2">Visitors</p>
            <div className="border rounded-medium border border-default-100 py-2 px-3">
              <p className="text-sm text-gray-600 mb-2">
                {selectedDET.visitors?.length || 0} visitor{selectedDET.visitors?.length !== 1 ? "s" : ""}
              </p>
              {selectedDET.visitors && selectedDET.visitors.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {selectedDET.visitors.map((visitor, idx) => (
                    <Chip key={idx} variant="flat" color="default" size="sm">
                      {visitor}
                    </Chip>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Station Management */}
          <div>
            <p className="text-small font-semibold mb-2">Station Management</p>
            <div className="border rounded-medium border border-default-100 py-2 px-3">
              <p className="text-sm text-gray-600 whitespace-pre-wrap">{selectedDET.stationManagement || "—"}</p>
            </div>
          </div>

          {/* Injuries */}
          <div>
            <p className="text-small font-semibold mb-2">Injuries</p>
            <div className="border rounded-medium border border-default-100 py-2 px-3">
              <p className="text-sm text-gray-600 mb-2">
                {selectedDET.injuries?.length || 0} injury record{selectedDET.injuries?.length !== 1 ? "s" : ""}
              </p>
              {selectedDET.injuries && selectedDET.injuries.length > 0 ? (
                <div className="space-y-3">
                  {selectedDET.injuries.map((injury, idx) => (
                    <div key={idx} className="border-b border-default-100 pb-2 last:border-b-0 last:pb-0">
                      <div className="grid grid-cols-3 gap-3 text-sm">
                        <div>
                          <p className="text-xs text-gray-500 mb-1">Species</p>
                          <SpeciesTooltip speciesCode={injury.specie}>
                            <p className="font-medium cursor-pointer hover:text-blue-600">{injury.specie}</p>
                          </SpeciesTooltip>
                        </div>
                        <div>
                          <p className="text-xs text-gray-500 mb-1">Band ID</p>
                          <p className="font-medium">{injury.bandId || <span className="text-gray-400">—</span>}</p>
                        </div>
                        <div>
                          <p className="text-xs text-gray-500 mb-1">Net</p>
                          <p className="font-medium">{injury.net || <span className="text-gray-400">—</span>}</p>
                        </div>
                      </div>
                      <div className="mt-2">
                        <p className="text-xs text-gray-500 mb-1">Description</p>
                        <p className="text-sm">{injury.description}</p>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-gray-500">No injuries recorded</p>
              )}
            </div>
          </div>

          {/* Released */}
          <div>
            <p className="text-small font-semibold mb-2">Released</p>
            <div className="border rounded-medium border border-default-100 py-2 px-3">
              <p className="text-sm text-gray-600 mb-2">
                {selectedDET.released?.length || 0} released record{selectedDET.released?.length !== 1 ? "s" : ""}
              </p>
              {selectedDET.released && selectedDET.released.length > 0 ? (
                <div className="space-y-3">
                  {selectedDET.released.map((bird, idx) => (
                    <div key={idx} className="border-b border-default-100 pb-2 last:border-b-0 last:pb-0">
                      <div className="grid grid-cols-4 gap-3 text-sm">
                        <div>
                          <p className="text-xs text-gray-500 mb-1">Species</p>
                          <SpeciesTooltip speciesCode={bird.specie}>
                            <p className="font-medium cursor-pointer hover:text-blue-600">{bird.specie}</p>
                          </SpeciesTooltip>
                        </div>
                        <div>
                          <p className="text-xs text-gray-500 mb-1">Age</p>
                          <p className="font-medium">{bird.age || <span className="text-gray-400">—</span>}</p>
                        </div>
                        <div>
                          <p className="text-xs text-gray-500 mb-1">How Aged</p>
                          <p className="font-medium">{bird.howAged || <span className="text-gray-400">—</span>}</p>
                        </div>
                        <div>
                          <p className="text-xs text-gray-500 mb-1">Sex</p>
                          <p className="font-medium">{bird.sex || <span className="text-gray-400">—</span>}</p>
                        </div>
                      </div>
                      <div className="grid grid-cols-3 gap-3 mt-2 text-sm">
                        <div>
                          <p className="text-xs text-gray-500 mb-1">How Sexed</p>
                          <p className="font-medium">{bird.howSexed || <span className="text-gray-400">—</span>}</p>
                        </div>
                        <div>
                          <p className="text-xs text-gray-500 mb-1">Net</p>
                          <p className="font-medium">{bird.net || <span className="text-gray-400">—</span>}</p>
                        </div>
                        <div>
                          <p className="text-xs text-gray-500 mb-1">Description</p>
                          <p className="font-medium">{bird.description || <span className="text-gray-400">—</span>}</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-gray-500">No birds released</p>
              )}
            </div>
          </div>
        </CardBody>
      </Card>
    </div>
  );

  return (
    <div className="p-4 max-w-7xl mx-auto">
      <div className="mb-6 flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold">Daily Effort Tables</h1>
          <p className="text-xs text-gray-500">{availableDatesSet.size} DET entries available</p>
        </div>
        {isAdmin && (
          <Button color="primary" onPress={handleAddNew}>
            Add DET
          </Button>
        )}
      </div>

      <div className="mb-4 flex gap-4 items-start">
        <Card className="" shadow="sm">
          <CardBody className="p-0">
            <Calendar
              aria-label="Select DET date"
              showMonthAndYearPickers
              isDateUnavailable={isDateUnavailable}
              onChange={handleDateChange}
              classNames={{
                base: "bg-white",
                title: "text-default-900",
                headerWrapper: "py-4",
                gridHeaderCell: "text-default-900 font-normal",
                header: "bg-default-000",
                gridHeader: "shadow-none",
              }}
            />
          </CardBody>
        </Card>

        {DETDisplay || (
          <div className="flex-1 text-center text-gray-500">
            <p className="text-lg">Please select a date from the calendar to view DET information</p>
          </div>
        )}
      </div>

      <AddDETModal
        isOpen={isModalOpen}
        onOpenChange={() => setIsModalOpen(!isModalOpen)}
        onSave={handleModalSave}
        existingDET={modalMode === "edit" ? editedDET : null}
        mode={modalMode}
      />
    </div>
  );
}
