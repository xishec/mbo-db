import { Input, Progress } from "@heroui/react";
import { useEffect, useState } from "react";
import { useData } from "../../services/useData";
import type { Capture } from "../../helper/helper";
import CapturesTable from "./Programs/Captures/CapturesTable";

export default function Search() {
  const { fetchCapturesByBandId, allCaptures, isLoadingAllCaptures } = useData();
  const [bandId, setBandId] = useState("");
  const [filteredCaptures, setFilteredCaptures] = useState<Capture[]>([]);
  const [searchedBandId, setSearchedBandId] = useState<string | null>(null);

  // Check if bandId is complete (format: 2980-85665 = 4 digits + hyphen + 5 digits = 10 chars)
  const isComplete = bandId.length === 10;
  const isSearching = isComplete && bandId !== searchedBandId;

  // Fetch captures when bandId is complete
  useEffect(() => {
    if (!isComplete) {
      setSearchedBandId(null);
      return;
    }

    let cancelled = false;

    fetchCapturesByBandId(bandId).then((result) => {
      if (!cancelled) {
        setFilteredCaptures(result);
        setSearchedBandId(bandId);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [bandId, isComplete, fetchCapturesByBandId]);

  // Determine which captures to display
  const displayCaptures = isComplete ? filteredCaptures : allCaptures;
  const isLoading = isLoadingAllCaptures || isSearching;

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
          <div className="w-full max-w-md flex flex-col gap-2">
            <Progress
              size="sm"
              isIndeterminate
              aria-label={isLoadingAllCaptures ? "Loading captures..." : "Searching..."}
              color="secondary"
            />
            <p className="text-sm text-default-500">
              {isLoadingAllCaptures ? "Loading all captures..." : "Searching..."}
            </p>
          </div>
        )}

        {!isLoading && displayCaptures.length > 0 && (
          <div className="w-full">
            <h3 className="text-lg font-normal mb-2">
              {isComplete ? (
                <>Results for band <span className="font-bold">{bandId}</span>:</>
              ) : (
                <>All captures ({displayCaptures.length}):</>
              )}
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
      </div>
    </div>
  );
}
