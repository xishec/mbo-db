import { useState } from "react";
import { useData } from "../../../services/useData";
import type { DET } from "../../../types/DET";
import { Calendar, Card, CardBody, CardHeader, Divider, Chip } from "@heroui/react";
import type { DateValue } from "@internationalized/date";
import SpeciesPopover from "../../SpeciesPopover";

export default function DETs() {
  const { DETsMap } = useData();
  const [selectedDET, setSelectedDET] = useState<DET | null>(null);

  // Get available dates as a Set for quick lookup
  const availableDatesSet = new Set(Object.keys(DETsMap));

  const handleDateChange = (value: DateValue | null) => {
    if (!value) {
      setSelectedDET(null);
      return;
    }

    // Convert the date value to YYYY-MM-DD format
    const dateStr = `${value.year}-${String(value.month).padStart(2, "0")}-${String(value.day).padStart(2, "0")}`;
    setSelectedDET(availableDatesSet.has(dateStr) ? DETsMap[dateStr] : null);
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
      {/* // Additional Information Card */}
      <Card className="">
        <CardHeader>
          <p className="text-lg font-semibold">Additional Information</p>
        </CardHeader>
        <Divider />
        <CardBody className="gap-3">
          <div>
            <p className="text-sm text-gray-500">Injuries</p>
            <p className="font-medium">{selectedDET.injuries?.length || "None"}</p>
          </div>
          <div>
            <p className="text-sm text-gray-500">Released</p>
            <p className="font-medium">{selectedDET.released?.length || "None"}</p>
          </div>
          <div>
            <p className="text-sm text-gray-500">Visitors</p>
            <p className="font-medium">{selectedDET.visitors?.length || "None"}</p>
          </div>
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

        {DETDisplay}
      </div>

      {!selectedDET && (
        <div className="text-center text-gray-500 py-12">
          <p className="text-lg">Please select a date from the calendar to view DET information</p>
        </div>
      )}
    </div>
  );
}
