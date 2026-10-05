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
  const panelClassName = "w-full";

  return (
    <div className="flex flex-col gap-4">
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
