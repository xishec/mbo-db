import { Tooltip } from "@heroui/react";
import { useState } from "react";
import { SPECIES_MAP } from "../../types/species";
import SpeciesInfoModal from "../Modals/SpeciesInfoModal";

interface SpeciesTooltipProps {
  speciesCode: string;
  children: React.ReactNode;
  showInfoCardOnClick?: boolean; // If true, clicking will show SpeciesInfoCard modal (default: true)
}

export default function SpeciesTooltip({ speciesCode, children, showInfoCardOnClick = true }: SpeciesTooltipProps) {
  const species = SPECIES_MAP[speciesCode];
  const [isModalOpen, setIsModalOpen] = useState(false);

  if (!species) {
    return <>{children}</>;
  }

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (showInfoCardOnClick) {
      setIsModalOpen(true);
    }
  };

  const tooltipContent = (
    <div className="flex flex-col gap-1">
      <div className="text-sm">
        <span className="font-semibold">English:</span> {species.speciesDescriptionMBO}
      </div>
      <div className="text-sm">
        <span className="font-semibold">French:</span> {species.speciesFrench}
      </div>
      <div className="text-sm">
        <span className="font-semibold">Scientific:</span> <span className="italic">{species.speciesScientific}</span>
      </div>
    </div>
  );

  return (
    <>
      <Tooltip
        content={tooltipContent}
        placement="right"
        closeDelay={50}
        className="max-w-xs"
      >
        <span 
          className={showInfoCardOnClick ? "cursor-pointer hover:underline" : "cursor-help"}
          onClick={handleClick}
        >
          {children}
        </span>
      </Tooltip>
      {showInfoCardOnClick && (
        <SpeciesInfoModal
          isOpen={isModalOpen}
          onOpenChange={setIsModalOpen}
          speciesCode={speciesCode}
        />
      )}
    </>
  );
}
