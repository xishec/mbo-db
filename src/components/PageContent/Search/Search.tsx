import { Input, Spinner } from "@heroui/react";
import { useEffect, useState } from "react";
import { useProgramData } from "../../../services/useProgramData";
import type { Capture } from "../../../helper/helper";
import CapturesTable from "../Programs/Captures/CapturesTable";

export default function Search() {
  const { fetchCapturesByBandId } = useProgramData();
  const [bandId, setBandId] = useState("");
  const [captures, setCaptures] = useState<Capture[]>([]);
  const [searchedBandId, setSearchedBandId] = useState("");

  // Check if bandId is complete (format: 2980-85665 = 4 digits + hyphen + 5 digits = 10 chars)
  const isComplete = bandId.length === 10;
  const isLoading = isComplete && bandId !== searchedBandId;

  // Fetch captures when bandId is complete
  useEffect(() => {
    if (!isComplete) return;

    let cancelled = false;

    fetchCapturesByBandId(bandId).then((result) => {
      if (!cancelled) {
        setCaptures(result);
        setSearchedBandId(bandId);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [bandId, isComplete, fetchCapturesByBandId]);

  // Clear captures when bandId becomes incomplete
  const displayCaptures = isComplete ? captures : [];

  const handleBandIdChange = (value: string) => {
    // Remove all non-digits
    const digits = value.replace(/\D/g, "").slice(0, 9);
    // Format as 2980-85665 (4 digits - 5 digits)
    if (digits.length <= 4) {
      setBandId(digits);
    } else {
      setBandId(`${digits.slice(0, 4)}-${digits.slice(4)}`);
    }
  };

  return (
    <div className="h-full w-full flex flex-col items-center pt-4 p-8 gap-4">
      <div className="w-full flex flex-col gap-4">
        <Input
          label="Band ID"
          placeholder="e.g. 2980-85665"
          variant="bordered"
          value={bandId}
          onValueChange={handleBandIdChange}
          size="md"
          labelPlacement="outside"
          className="max-w-xs"
        />

        {isLoading && (
          <div className="p-4 flex items-center gap-4">
            <Spinner size="sm" /> Searching...
          </div>
        )}

        {!isLoading && isComplete && displayCaptures.length > 0 && (
          <div className="w-full">
            <h3 className="text-lg font-normal mb-2">
              Results for band <span className="font-bold">{bandId}</span>:
            </h3>
            <CapturesTable
              captures={displayCaptures}
              maxTableHeight={600}
              sortColumn="date"
              sortDirection="descending"
            />
          </div>
        )}

        {!isLoading && isComplete && displayCaptures.length === 0 && (
          <div className="p-4 text-default-500">No captures found for band {bandId}</div>
        )}

        {!isComplete && (
          <div className="p-4 text-default-500">Enter a complete 9-digit band ID to search</div>
        )}
      </div>
    </div>
  );
}
