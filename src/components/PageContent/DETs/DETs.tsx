import { useState } from "react";
import { useData } from "../../../services/useData";
import type { DET } from "../../../types/DET";
import {
  Calendar,
  Card,
  CardBody,
  CardHeader,
  Divider,
  Chip,
  Table,
  TableHeader,
  TableColumn,
  TableBody,
  TableRow,
  TableCell,
} from "@heroui/react";
import type { DateValue } from "@internationalized/date";

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
        <CardHeader>
          <p className="text-lg font-semibold">Net Hours</p>
        </CardHeader>
        <Divider />
        <CardBody>
          {selectedDET.netHours?.nets && selectedDET.netHours.nets.length > 0 ? (
            <div className="space-y-2">
              <Table aria-label="Net hours table" removeWrapper>
                <TableHeader>
                  <TableColumn>NET ID</TableColumn>
                  <TableColumn>HOURS</TableColumn>
                  <TableColumn>TOTAL</TableColumn>
                </TableHeader>
                <TableBody>
                  {selectedDET.netHours.nets.map((net, idx) => (
                    <TableRow key={idx}>
                      <TableCell>{net.id}</TableCell>
                      <TableCell>{net.hours || "—"}</TableCell>
                      <TableCell>{net.total}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              <Divider />
              <div className="flex justify-between items-center pt-2">
                <p className="font-semibold">Total Net Hours:</p>
                <Chip color="success" variant="flat" size="lg">
                  {selectedDET.netHours.total}
                </Chip>
              </div>
            </div>
          ) : (
            <p className="text-gray-500">No net hours recorded</p>
          )}
        </CardBody>
      </Card>
      {/* // Observer Hours Card */}
      <Card className="">
        <CardHeader>
          <p className="text-lg font-semibold">Observer Hours</p>
        </CardHeader>
        <Divider />
        <CardBody>
          <div className="flex justify-between items-center">
            <p className="text-sm text-gray-500">Total Observer Hours</p>
            <Chip color="primary" variant="flat" size="lg">
              {selectedDET.observerHours.total}
            </Chip>
          </div>
        </CardBody>
      </Card>
      {/* // Species Counts Card */}
      <Card className="">
        <CardHeader>
          <p className="text-lg font-semibold">Species Counts</p>
        </CardHeader>
        <Divider />
        <CardBody className="gap-3">
          <div>
            <p className="text-sm font-medium mb-1">Observed</p>
            <Chip variant="flat">{Object.keys(selectedDET.observedSpeciesCount || {}).length} species</Chip>
          </div>
          <div>
            <p className="text-sm font-medium mb-1">Banded</p>
            <Chip variant="flat" color="success">
              {Object.keys(selectedDET.bandedSpeciesCount || {}).length} species
            </Chip>
          </div>
          <div>
            <p className="text-sm font-medium mb-1">DET</p>
            <Chip variant="flat" color="warning">
              {Object.keys(selectedDET.DETSpeciesCount || {}).length} species
            </Chip>
          </div>
          <div>
            <p className="text-sm font-medium mb-1">Repeats</p>
            <Chip variant="flat" color="secondary">
              {Object.keys(selectedDET.repeatSpeciesCount || {}).length} species
            </Chip>
          </div>
          <div>
            <p className="text-sm font-medium mb-1">Returns</p>
            <Chip variant="flat" color="primary">
              {Object.keys(selectedDET.returnSpeciesCount || {}).length} species
            </Chip>
          </div>
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
