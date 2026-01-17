import { useState } from "react";
import { useData } from "../../../services/useData";
import type { DET } from "../../../types/DET";
import { Calendar } from "@heroui/react";
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

  return (
    <div className="p-8 max-w-7xl mx-auto">
      <h1 className="text-4xl font-bold mb-8">Daily Effort Table (DETs)</h1>

      <div className="mb-6 flex gap-8">
        <div>
          <label className="block text-sm font-medium mb-2">Select Date</label>
          <Calendar
            aria-label="Select DET date"
            showMonthAndYearPickers
            isDateUnavailable={isDateUnavailable}
            onChange={handleDateChange}
            classNames={{
              base: "bg-white shadow-md",
            }}
          />
          <p className="text-sm text-gray-500 mt-2">{availableDatesSet.size} DET entries available</p>
        </div>

        {selectedDET && (
          <div className="flex-1 bg-white shadow-md rounded-lg p-6">
            <h2 className="text-2xl font-semibold mb-4">DET for {selectedDET.date}</h2>
            <pre className="bg-gray-50 p-4 rounded-lg overflow-auto text-sm max-h-[600px]">
              {JSON.stringify(selectedDET, null, 2)}
            </pre>
          </div>
        )}
      </div>

      {!selectedDET && (
        <div className="text-center text-gray-500 py-12">
          <p className="text-lg">Please select a date from the calendar to view DET information</p>
        </div>
      )}
    </div>
  );
}
