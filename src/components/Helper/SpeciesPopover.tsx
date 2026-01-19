import { Popover, PopoverTrigger, PopoverContent } from "@heroui/react";
import { SPECIES_MAP } from "../../types/species";

interface SpeciesPopoverProps {
  speciesCode: string;
  children: React.ReactNode;
}

export default function SpeciesPopover({ speciesCode, children }: SpeciesPopoverProps) {
  const species = SPECIES_MAP[speciesCode];

  if (!species) {
    return <>{children}</>;
  }

  return (
    <Popover placement="right" showArrow offset={10}>
      <PopoverTrigger>
        <span className="cursor-help">{children}</span>
      </PopoverTrigger>
      <PopoverContent className="p-3">
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
      </PopoverContent>
    </Popover>
  );
}
