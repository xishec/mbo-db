import PyleTable from "../../Helper/Info/PyleTable";
import SpeciesFunFacts from "../../Helper/Info/SpeciesFunFacts";
import type { SpeciesRange, SpeciesInfo } from "../../../types";

interface SpeciesInfoPanelProps {
  speciesCode: string;
  pyleSpeciesRange: SpeciesRange | null;
  speciesInfo: SpeciesInfo | null;
}

export default function SpeciesInfoPanel({ speciesCode, pyleSpeciesRange, speciesInfo }: SpeciesInfoPanelProps) {
  if (speciesCode.length !== 4) return null;
  return (
    <div className="grid grid-cols-2 gap-4">
      {pyleSpeciesRange && (
        <PyleTable title="Pyle" speciesCode={speciesCode} speciesRange={pyleSpeciesRange} withCard />
      )}
      <SpeciesFunFacts speciesCode={speciesCode} speciesInfo={speciesInfo} />
    </div>
  );
}
