import type { SpeciesInfo, SpeciesRange } from "../../../types";
import SpeciesFunFacts from "./SpeciesFunFacts";
import PyleTable from "./PyleTable";

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
  const panelClassName = "flex-1";

  return (
    <div className="grid grid-cols-2 gap-4 items-stretch">
      <PyleTable
        title="Pyle"
        speciesCode={speciesCode}
        speciesRange={pyleSpeciesRange}
        disabled={disabled}
        className={panelClassName}
        withCard
      />
      <SpeciesFunFacts
        speciesCode={speciesCode}
        speciesInfo={speciesInfo}
        currentBandId={currentBandId}
        disabled={disabled}
        className={panelClassName}
      />
    </div>
  );
}
