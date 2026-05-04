import { Tooltip } from "@heroui/react";
import { useState, type ReactNode } from "react";
import { SPECIES_MAP } from "../../../types/species";
import SpeciesInfoModal from "../../Modals/SpeciesInfoModal";

interface SpeciesTooltipProps {
  speciesCode: string;
  disabled?: boolean;
  // allow for custom content to be passed in, like chips for DETs
  children?: ReactNode;
}

export default function SpeciesTooltip({ speciesCode, disabled = false, children }: SpeciesTooltipProps) {
  const species = SPECIES_MAP[speciesCode];
  const [isModalOpen, setIsModalOpen] = useState(false);
  const content = children ?? speciesCode;

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsModalOpen(true);
  };

  const tooltipContent = species ? (
    <div className="flex flex-col gap-1 text-sm">
      <div>
        <span className="font-semibold">English:</span> {species.speciesDescriptionMBO}
      </div>
      <div>
        <span className="font-semibold">French:</span> {species.speciesFrench}
      </div>
      <div>
        <span className="font-semibold">Scientific:</span> <span className="italic">{species.speciesScientific}</span>
      </div>
    </div>
  ) : (
    <div className="flex flex-col gap-1 text-sm">
      <div>
        <span>Unknown</span>
      </div>
    </div>
  );

  return (
    <>
      {disabled ? (
        <span>{content}</span>
      ) : (
        <Tooltip content={tooltipContent} placement="right" closeDelay={50} className="max-w-xs">
          <span className="cursor-pointer hover:underline" onClick={handleClick}>
            {content}
          </span>
        </Tooltip>
      )}
      <SpeciesInfoModal isOpen={isModalOpen} onOpenChange={setIsModalOpen} speciesCode={speciesCode} />
    </>
  );
}
