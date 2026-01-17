import { useState } from "react";
import { useData } from "../../../services/useData";
import type { DET } from "../../../types/DET";
import { Calendar, Card, CardBody, CardHeader, Divider, Chip } from "@heroui/react";
import type { DateValue } from "@internationalized/date";
import SpeciesPopover from "../../SpeciesPopover";
import { fetchWeatherForDate } from "../../../services/weatherService";

export default function DETs() {
  const { DETsMap } = useData();
  const [selectedDET, setSelectedDET] = useState<DET | null>(null);
  const [isLoadingWeather, setIsLoadingWeather] = useState(false);

  // Get available dates as a Set for quick lookup
  const availableDatesSet = new Set(Object.keys(DETsMap));

  const handleDateChange = async (value: DateValue | null) => {
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

  // Render species count section
  const renderSpeciesSection = (
    title: string,
    speciesCount: Record<string, number>,
    chipColor: "default" | "success" | "warning" | "secondary" | "primary",
    emptyMessage: string
  ) => {
    const total = Object.values(speciesCount || {}).reduce((sum, count) => sum + count, 0);
    const totalSpecies = Object.keys(speciesCount || {}).length;
    return (
      <div>
        <div className="flex justify-between items-center mb-2">
          <p className="text-sm font-medium">
            {title}: {totalSpecies} species, {total} individuals
          </p>
        </div>
        {Object.keys(speciesCount || {}).length > 0 ? (
          <div className="flex flex-wrap gap-2">
            {Object.entries(speciesCount || {}).map(([species, count]) => (
              <SpeciesPopover key={species} speciesCode={species}>
                <Chip variant="flat" color={chipColor}>
                  {species}: {count}
                </Chip>
              </SpeciesPopover>
            ))}
          </div>
        ) : (
          <p className="text-sm text-gray-500">{emptyMessage}</p>
        )}
      </div>
    );
  };

  const DETDisplay = selectedDET && (
    <div className="flex-1 space-y-4">
      {/* // DET Overview Card */}
      <Card className="">
        <CardHeader className="flex gap-3">
          <div className="flex flex-col">
            <p className="text-2xl font-semibold">DET for {selectedDET.date}</p>
            <div className="flex gap-2 mt-2">
              <Chip color="primary" variant="flat">
                {selectedDET.programId}
              </Chip>
              <Chip color="secondary" variant="flat">
                {selectedDET.location}
              </Chip>
              <Chip color="default" variant="flat">
                Coverage: {selectedDET.coverageCode}
              </Chip>
            </div>
          </div>
        </CardHeader>
        <Divider />
        <CardBody className="gap-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-sm text-gray-500">Bander in Charge</p>
              <p className="font-medium">{selectedDET.banderInCharge || "—"}</p>
            </div>
            <div>
              <p className="text-sm text-gray-500">Time</p>
              <p className="font-medium">
                {selectedDET.start && selectedDET.end ? `${selectedDET.start} - ${selectedDET.end}` : "—"}
              </p>
            </div>
          </div>
        </CardBody>
      </Card>
      {/* // Net Hours Card */}
      <Card className="">
        <CardHeader className="flex justify-between items-center">
          <p className="text-lg font-semibold">Net Hours : {selectedDET.netHours.total} </p>
        </CardHeader>
        <Divider />
        <CardBody>
          {selectedDET.netHours?.nets && selectedDET.netHours.nets.length > 0 ? (
            <div className="flex flex-wrap gap-2">
              {selectedDET.netHours.nets.map((net, idx) => (
                <Chip key={idx} variant="flat" color="primary">
                  {net.id}: {net.total}
                </Chip>
              ))}
            </div>
          ) : (
            <p className="text-gray-500">No net hours recorded</p>
          )}
        </CardBody>
      </Card>
      {/* // Observer Hours Card */}
      <Card className="">
        <CardHeader className="flex justify-between items-center">
          <p className="text-lg font-semibold">Observer Hours : {selectedDET.observerHours.total}</p>
        </CardHeader>
        <Divider />
        <CardBody>
          {selectedDET.observerHours?.observers && selectedDET.observerHours.observers.length > 0 ? (
            <div className="flex flex-wrap gap-2">
              {selectedDET.observerHours.observers.map((observer, idx) => (
                <Chip key={idx} variant="flat" color="secondary">
                  {observer.name}: {observer.totalHours}
                </Chip>
              ))}
            </div>
          ) : (
            <p className="text-gray-500">No observer info</p>
          )}
        </CardBody>
      </Card>
      {/* // Weather Card */}
      <Card className="">
        <CardHeader>
          <p className="text-lg font-semibold">Weather at MBO</p>
          {isLoadingWeather && <span className="text-sm text-gray-500 ml-2">Loading...</span>}
        </CardHeader>
        <Divider />
        <CardBody>
          {selectedDET.weather ? (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div>
                <p className="text-sm text-gray-500">Temperature</p>
                <p className="font-medium">
                  {selectedDET.weather.temperatureMin !== undefined && selectedDET.weather.temperatureMax !== undefined ? (
                    `${selectedDET.weather.temperatureMin.toFixed(1)}°C - ${selectedDET.weather.temperatureMax.toFixed(1)}°C`
                  ) : (
                    <span className="text-gray-400">undefined</span>
                  )}
                </p>
              </div>
              <div>
                <p className="text-sm text-gray-500">Cloud Coverage</p>
                <p className="font-medium">
                  {selectedDET.weather.cloudCoverage !== undefined ? (
                    `${selectedDET.weather.cloudCoverage.toFixed(0)}%`
                  ) : (
                    <span className="text-gray-400">undefined</span>
                  )}
                </p>
              </div>
              <div>
                <p className="text-sm text-gray-500">Precipitation</p>
                <p className="font-medium">
                  {selectedDET.weather.precipitation !== undefined ? (
                    `${selectedDET.weather.precipitation.toFixed(1)} mm`
                  ) : (
                    <span className="text-gray-400">undefined</span>
                  )}
                </p>
              </div>
              <div>
                <p className="text-sm text-gray-500">Wind</p>
                <p className="font-medium">
                  {selectedDET.weather.windSpeed !== undefined ? (
                    <>
                      {selectedDET.weather.windSpeed.toFixed(1)} km/h
                      {selectedDET.weather.windDirection && ` ${selectedDET.weather.windDirection}`}
                    </>
                  ) : (
                    <span className="text-gray-400">undefined</span>
                  )}
                </p>
              </div>
            </div>
          ) : (
            <p className="text-gray-500">No weather data available</p>
          )}
        </CardBody>
      </Card>
      {/* // Species Counts Card */}
      <Card className="">
        <CardHeader>
          <p className="text-lg font-semibold">Species Counts</p>
        </CardHeader>
        <Divider />
        <CardBody className="gap-4">
          {renderSpeciesSection("Observed", selectedDET.observedSpeciesCount, "default", "No species observed")}
          {renderSpeciesSection("Banded", selectedDET.bandedSpeciesCount, "success", "No species banded")}
          {renderSpeciesSection("Repeats", selectedDET.repeatSpeciesCount, "secondary", "No repeat species")}
          {renderSpeciesSection("Returns", selectedDET.returnSpeciesCount, "primary", "No return species")}
          {renderSpeciesSection("DET", selectedDET.DETSpeciesCount, "warning", "No DET species")}
        </CardBody>
      </Card>
      {/* // Census Card */}
      <Card className="">
        <CardHeader>
          <p className="text-lg font-semibold">Census</p>
        </CardHeader>
        <Divider />
        <CardBody className="gap-3">
          <div className="grid grid-cols-3 gap-4">
            <div>
              <p className="text-sm text-gray-500">Censuser</p>
              <p className="font-medium">{selectedDET.census?.censuser || <span className="text-gray-400">-</span>}</p>
            </div>
            <div>
              <p className="text-sm text-gray-500">Start</p>
              <p className="font-medium">{selectedDET.census?.start || <span className="text-gray-400">-</span>}</p>
            </div>
            <div>
              <p className="text-sm text-gray-500">End</p>
              <p className="font-medium">{selectedDET.census?.end || <span className="text-gray-400">-</span>}</p>
            </div>
          </div>
          <div>
            {renderSpeciesSection(
              "Census Species",
              selectedDET.census?.speciesCount || {},
              "primary",
              "No census data"
            )}
          </div>
        </CardBody>
      </Card>
      {/* // Injuries Card */}
      <Card className="">
        <CardHeader>
          <p className="text-lg font-semibold">Injuries : {selectedDET.injuries?.length || 0}</p>
        </CardHeader>
        <Divider />
        <CardBody className="gap-3">
          {selectedDET.injuries && selectedDET.injuries.length > 0 ? (
            selectedDET.injuries.map((injury, idx) => (
              <div key={idx} className="border-b pb-2 last:border-b-0">
                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <p className="text-xs text-gray-500">Species</p>
                    <SpeciesPopover speciesCode={injury.specie}>
                      <p className="font-medium cursor-pointer hover:text-blue-600">{injury.specie}</p>
                    </SpeciesPopover>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500">Band ID</p>
                    <p className="font-medium">{injury.bandId || <span className="text-gray-400">undefined</span>}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500">Net</p>
                    <p className="font-medium">{injury.net || <span className="text-gray-400">undefined</span>}</p>
                  </div>
                </div>
                <div className="mt-2">
                  <p className="text-xs text-gray-500">Description</p>
                  <p className="text-sm">{injury.description}</p>
                </div>
              </div>
            ))
          ) : (
            <p className="text-gray-500">No injuries recorded</p>
          )}
        </CardBody>
      </Card>
      {/* // Released Card */}
      <Card className="">
        <CardHeader>
          <p className="text-lg font-semibold">Released : {selectedDET.released?.length || 0}</p>
        </CardHeader>
        <Divider />
        <CardBody className="gap-3">
          {selectedDET.released && selectedDET.released.length > 0 ? (
            selectedDET.released.map((bird, idx) => (
              <div key={idx} className="border-b pb-2 last:border-b-0">
                <div className="grid grid-cols-4 gap-2">
                  <div>
                    <p className="text-xs text-gray-500">Species</p>
                    <SpeciesPopover speciesCode={bird.specie}>
                      <p className="font-medium cursor-pointer hover:text-blue-600">{bird.specie}</p>
                    </SpeciesPopover>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500">Age</p>
                    <p className="font-medium">{bird.age || <span className="text-gray-400">undefined</span>}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500">How Aged</p>
                    <p className="font-medium">{bird.howAged || <span className="text-gray-400">undefined</span>}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500">Sex</p>
                    <p className="font-medium">{bird.sex || <span className="text-gray-400">undefined</span>}</p>
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-2 mt-2">
                  <div>
                    <p className="text-xs text-gray-500">How Sexed</p>
                    <p className="font-medium">{bird.howSexed || <span className="text-gray-400">undefined</span>}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500">Net</p>
                    <p className="font-medium">{bird.net || <span className="text-gray-400">undefined</span>}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500">Description</p>
                    <p className="font-medium">
                      {bird.description || <span className="text-gray-400">undefined</span>}
                    </p>
                  </div>
                </div>
              </div>
            ))
          ) : (
            <p className="text-gray-500">No birds released</p>
          )}
        </CardBody>
      </Card>
      {/* // Visitors Card */}
      <Card className="">
        <CardHeader>
          <p className="text-lg font-semibold">Visitors : {selectedDET.visitors?.length || 0}</p>
        </CardHeader>
        <Divider />
        <CardBody>
          {selectedDET.visitors && selectedDET.visitors.length > 0 ? (
            <div className="flex flex-wrap gap-2">
              {selectedDET.visitors.map((visitor, idx) => (
                <Chip key={idx} variant="flat" color="default">
                  {visitor}
                </Chip>
              ))}
            </div>
          ) : (
            <p className="text-gray-500">No visitors recorded</p>
          )}
        </CardBody>
      </Card>
      {/* // Notes Card */}
      <Card className="">
        <CardHeader>
          <p className="text-lg font-semibold">Notes</p>
        </CardHeader>
        <Divider />
        <CardBody className="gap-3">
          <div>
            <p className="text-sm font-medium mb-1">Narrative</p>
            <p className="text-sm text-gray-700">{selectedDET.narrative || "—"}</p>
          </div>
          <div>
            <p className="text-sm font-medium mb-1">Deviations</p>
            <p className="text-sm text-gray-700">{selectedDET.deviations || "—"}</p>
          </div>
          <div>
            <p className="text-sm font-medium mb-1">Station Management</p>
            <p className="text-sm text-gray-700">{selectedDET.stationManagement || "—"}</p>
          </div>
        </CardBody>
      </Card>
    </div>
  );

  return (
    <div className="p-8 max-w-7xl mx-auto">
      <div className="mb-8">
        <h1 className="text-4xl font-bold mb-2">Daily Effort Table (DETs)</h1>
        <p className="text-sm text-gray-500">{availableDatesSet.size} DET entries available</p>
      </div>

      <div className="mb-6 flex gap-8 items-start">
        <Card className="">
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
    </div>
  );
}
