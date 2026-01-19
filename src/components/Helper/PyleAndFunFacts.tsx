import type { SpeciesInfo, SpeciesRange } from "../../types";
import SpeciesFunFacts from "./SpeciesFunFacts";
import SpeciesRangeTable from "../PageContent/Programs/Captures/SpeciesRangeTable";

interface PyleAndFunFactsProps {
  speciesCode: string;
  pyleSpeciesRange: SpeciesRange;
  speciesInfo: SpeciesInfo;
  currentBandId?: string | null;
  disabled?: boolean;
}

export default function PyleAndFunFacts({
  speciesCode,
  pyleSpeciesRange,
  speciesInfo,
  currentBandId = null,
  disabled = false,
}: PyleAndFunFactsProps) {
  return (
    <div className="flex gap-4">
      {pyleSpeciesRange && (
        <SpeciesRangeTable
          title="Pyle"
          speciesCode={speciesCode}
          speciesRange={pyleSpeciesRange}
          disabled={disabled}
        />
      )}
      <SpeciesFunFacts
        speciesCode={speciesCode}
        speciesInfo={speciesInfo}
        currentBandId={currentBandId}
        disabled={disabled}
      />
    </div>
  );
}
