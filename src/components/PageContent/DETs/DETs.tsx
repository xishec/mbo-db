import { useState } from "react";
import { useAppStore, useActions } from "../../../stores/useAppStore";
import type { DET } from "../../../types/DET";
import { Card, CardBody, CardHeader, Chip, Button } from "@heroui/react";
import SpeciesTooltip from "../../Helper/Info/SpeciesTooltip";
import WeatherDisplay from "../../Helper/WeatherDisplay";
import PageHeader from "../PageHeader";
import { fetchWeatherForDate } from "../../../services/weatherService";
import AddDETModal from "../../Modals/DET/AddDETModal";
import { ChevronLeftIcon, ChevronRightIcon, PencilIcon } from "@heroicons/react/24/outline";
import { getSpeciesDisplayCode, resolveSpeciesKey } from "../../../types/species";

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

function toDateString(year: number, month: number, day: number): string {
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

export default function DETs() {
  const DETsMap = useAppStore((s) => s.DETsMap);
  const isAdmin = useAppStore((s) => s.isAdmin);
  const speciesAliasesMap = useAppStore((s) => s.speciesAliasesMap);
  const { saveDET } = useActions();
  const [selectedDET, setSelectedDET] = useState<DET | null>(null);
  const [isLoadingWeather, setIsLoadingWeather] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editedDET, setEditedDET] = useState<DET | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<"create" | "edit">("create");
  const [visibleMonth, setVisibleMonth] = useState(() => {
    const today = new Date();
    return new Date(today.getFullYear(), today.getMonth(), 1);
  });
  const [selectedDate, setSelectedDate] = useState<string | null>(null);

  // Get available dates as a Set for quick lookup
  const availableDatesSet = new Set(Object.keys(DETsMap));

  const handleDateChange = async (dateStr: string) => {
    // Cancel edit mode when changing dates
    if (isEditing) {
      setIsEditing(false);
      setEditedDET(null);
    }

    setSelectedDate(dateStr);
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

  const changeMonth = (offset: number) => {
    setVisibleMonth((current) => new Date(current.getFullYear(), current.getMonth() + offset, 1));
  };

  const monthYear = `${visibleMonth.getFullYear()}-${String(visibleMonth.getMonth() + 1).padStart(2, "0")}`;

  const calendarDays = (() => {
    const year = visibleMonth.getFullYear();
    const month = visibleMonth.getMonth();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const firstDay = new Date(year, month, 1).getDay();
    return [
      ...Array.from({ length: firstDay }, () => null),
      ...Array.from({ length: daysInMonth }, (_, index) => index + 1),
    ];
  })();

  const handleMonthInputChange = (value: string) => {
    const [year, month] = value.split("-").map(Number);
    if (year && month) setVisibleMonth(new Date(year, month - 1, 1));
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
    const normalizedSpeciesCount = Object.entries(speciesCount || {}).reduce<Record<string, number>>(
      (acc, [species, count]) => {
        const speciesKey = resolveSpeciesKey(species, speciesAliasesMap);
        acc[speciesKey] = (acc[speciesKey] ?? 0) + Number(count);
        return acc;
      },
      {}
    );
    const hasSpecies = Object.keys(normalizedSpeciesCount).length > 0;
    return (
      <div>
        <p className="text-sm text-gray-600 mb-2">
          {title}: {getSpeciesCountSummary(normalizedSpeciesCount)}
        </p>
        {hasSpecies ? (
          <div className="flex flex-wrap gap-2">
            {Object.entries(normalizedSpeciesCount).map(([speciesKey, count]) => (
              <SpeciesTooltip key={speciesKey} speciesCode={speciesKey}>
                <Chip variant="flat" color={chipColor} size="sm">
                  {getSpeciesDisplayCode(speciesKey, speciesAliasesMap)}: {count}
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
            <div className="rounded-medium border border-default-100 py-2 px-3">
              <WeatherDisplay weather={selectedDET.weather} isLoading={isLoadingWeather} />
            </div>
          </div>

          {/* Observer Hours */}
          <div>
            <p className="text-small font-semibold mb-2">Observer Hours</p>
            <div className="rounded-medium border border-default-100 py-2 px-3">
              <p className="text-sm text-gray-600">
                Total: {selectedDET.observerHours?.total || 0} hours | Observers:{" "}
                {selectedDET.observerHours?.observers?.length || 0}
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
            <div className="rounded-medium border border-default-100 py-2 px-3">
              <p className="text-sm text-gray-600">
                Total: {selectedDET.netHours?.total || "0"} | Hummingbird Trap:{" "}
                {selectedDET.netHours?.hummingbirdTrapTotal || "0"} | Nets: {selectedDET.netHours?.nets?.length || 0}
              </p>
              {selectedDET.netHours?.nets && selectedDET.netHours.nets.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-2">
                  {selectedDET.netHours.nets.map((net, idx) => (
                    <Chip key={idx} variant="bordered" color="primary" size="sm">
                      {net.id}: {net.total}
                    </Chip>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Species Data */}
          <div>
            <p className="text-small font-semibold mb-2">Species Data</p>
            <div className="rounded-medium border border-default-100 py-2 px-3">
              <div className="space-y-3">
                {renderSpeciesCategory("Observed", selectedDET.observedSpeciesCount, "primary", "No observed species")}
                {renderSpeciesCategory("Census", selectedDET.censusSpeciesCount || {}, "primary", "No census species")}
                {renderSpeciesCategory("Banded", selectedDET.bandedSpeciesCount || {}, "primary", "No banded species")}
                {renderSpeciesCategory("Repeats", selectedDET.repeatSpeciesCount, "primary", "No repeat species")}
                {renderSpeciesCategory("Return", selectedDET.returnSpeciesCount, "primary", "No return species")}
                {renderSpeciesCategory("DET", selectedDET.DETSpeciesCount, "primary", "No DET species")}
              </div>
            </div>
          </div>

          {/* Narrative */}
          <div>
            <p className="text-small font-semibold mb-2">Narrative</p>
            <div className="rounded-medium border border-default-100 py-2 px-3">
              <p className="text-sm text-gray-600 whitespace-pre-wrap">{selectedDET.narrative || "—"}</p>
            </div>
          </div>

          {/* Deviations */}
          <div>
            <p className="text-small font-semibold mb-2">Deviations</p>
            <div className="rounded-medium border border-default-100 py-2 px-3">
              <p className="text-sm text-gray-600 whitespace-pre-wrap">{selectedDET.deviations || "—"}</p>
            </div>
          </div>

          {/* Visitors */}
          <div>
            <p className="text-small font-semibold mb-2">Visitors</p>
            <div className="rounded-medium border border-default-100 py-2 px-3">
              <p className="text-sm text-gray-600 whitespace-pre-wrap">
                {textFieldToString(selectedDET.visitors) || "—"}
              </p>
            </div>
          </div>

          {/* Station Management */}
          <div>
            <p className="text-small font-semibold mb-2">Station Management</p>
            <div className="rounded-medium border border-default-100 py-2 px-3">
              <p className="text-sm text-gray-600 whitespace-pre-wrap">{selectedDET.stationManagement || "—"}</p>
            </div>
          </div>

          {/* Injuries */}
          <div>
            <p className="text-small font-semibold mb-2">Injuries</p>
            <div className="rounded-medium border border-default-100 py-2 px-3">
              <p className="text-sm text-gray-600 whitespace-pre-wrap">
                {textFieldToString(selectedDET.injuries) || "No injuries recorded"}
              </p>
            </div>
          </div>

          {/* Released */}
          <div>
            <p className="text-small font-semibold mb-2">Released</p>
            <div className="rounded-medium border border-default-100 py-2 px-3">
              <p className="text-sm text-gray-600 whitespace-pre-wrap">
                {textFieldToString(selectedDET.released) || "No birds released"}
              </p>
            </div>
          </div>
        </CardBody>
      </Card>
    </div>
  );

  return (
    <div className="h-full w-full max-w-7xl mx-auto flex flex-col pt-4 p-8 gap-4">
      <PageHeader
        title="Daily Effort Tables"
        subtitle={`${availableDatesSet.size} DET entries available`}
        actions={
          isAdmin ? (
            <Button color="secondary" onPress={handleAddNew}>
              Add DET
            </Button>
          ) : null
        }
      />

      <div className="w-full mb-4 flex gap-4 items-start">
        <Card className="" shadow="sm">
          <CardBody className="p-4 gap-3">
            <div className="flex items-center justify-between gap-2">
              <Button isIconOnly size="sm" variant="light" aria-label="Previous month" onPress={() => changeMonth(-1)}>
                <ChevronLeftIcon className="h-5 w-5" />
              </Button>
              <input
                aria-label="Select month"
                className="min-w-36 rounded-medium border border-default-200 px-2 py-1 text-center text-sm font-medium"
                type="month"
                value={monthYear}
                onChange={(event) => handleMonthInputChange(event.target.value)}
              />
              <Button isIconOnly size="sm" variant="light" aria-label="Next month" onPress={() => changeMonth(1)}>
                <ChevronRightIcon className="h-5 w-5" />
              </Button>
            </div>

            <div className="grid grid-cols-7 gap-1 text-center text-xs text-default-500">
              {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day) => (
                <div key={day} className="py-1">
                  {day}
                </div>
              ))}
            </div>

            <div className="grid grid-cols-7 gap-1">
              {calendarDays.map((day, index) => {
                if (!day) return <div key={`empty-${index}`} className="h-9" />;

                const dateStr = toDateString(visibleMonth.getFullYear(), visibleMonth.getMonth() + 1, day);
                const hasDET = availableDatesSet.has(dateStr);
                const isSelected = selectedDate === dateStr;

                return (
                  <button
                    key={dateStr}
                    type="button"
                    className={[
                      "h-9 rounded-medium text-sm transition-colors",
                      hasDET ? "font-medium text-default-900 hover:bg-default-100" : "text-default-400 hover:bg-default-50",
                      isSelected ? "bg-secondary text-white hover:bg-secondary" : "",
                    ].join(" ")}
                    onClick={() => handleDateChange(dateStr)}
                  >
                    {day}
                  </button>
                );
              })}
            </div>
          </CardBody>
        </Card>

        {DETDisplay || (
          <div className="flex-1 text-center text-gray-500">
            <p className="text-lg">
              {selectedDate ? `No DET information for ${selectedDate}` : "Please select a date to view DET information"}
            </p>
          </div>
        )}
      </div>

      <AddDETModal
        isOpen={isModalOpen}
        onOpenChange={() => setIsModalOpen(!isModalOpen)}
        onSave={handleModalSave}
        existingDET={modalMode === "edit" ? editedDET : null}
        defaultDate={modalMode === "create" ? selectedDate : null}
        mode={modalMode}
      />
    </div>
  );
}
