import { Input, Spinner } from "@heroui/react";
import { useEffect, useState } from "react";
import { useData } from "../../../services/useData";
import type { Capture } from "../../../helper/helper";
import CapturesTable from "../Programs/Captures/CapturesTable";

export default function Search() {
  const { fetchCapturesByBandId, fetchAllCaptures } = useData();
  const [bandId, setBandId] = useState("");
  const [allCaptures, setAllCaptures] = useState<Capture[]>([]);
  const [filteredCaptures, setFilteredCaptures] = useState<Capture[]>([]);
  const [isLoadingAll, setIsLoadingAll] = useState(true);
  const [searchedBandId, setSearchedBandId] = useState<string | null>(null);

  // Check if bandId is complete (format: 2980-85665 = 4 digits + hyphen + 5 digits = 10 chars)
  const isComplete = bandId.length === 10;
  const isSearching = isComplete && bandId !== searchedBandId;

  // Fetch all captures on mount
  useEffect(() => {
    let cancelled = false;

    fetchAllCaptures().then((result) => {
      if (!cancelled) {
        setAllCaptures(result);
        setIsLoadingAll(false);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [fetchAllCaptures]);

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
  const isLoading = isLoadingAll || isSearching;

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
            <Spinner size="sm" /> {isLoadingAll ? "Loading captures..." : "Searching..."}
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
