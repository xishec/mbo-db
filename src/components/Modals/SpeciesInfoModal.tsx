import { Button } from "@heroui/react";
import { useMemo } from "react";
import PyleAndFunFacts from "../Helper/Info/PyleAndFunFacts";
import { useAppStore } from "../../stores/useAppStore";
import { SPECIES_MAP } from "../../types/species";
import ModalShell, { ModalBodyShell, ModalFooterShell, ModalHeaderShell } from "./ModalShell";
import {
  modalPrimaryButtonProps,
} from "./modalDefaults";

interface SpeciesInfoModalProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  speciesCode: string;
}

export default function SpeciesInfoModal({ isOpen, onOpenChange, speciesCode }: SpeciesInfoModalProps) {
  const speciesInfoMap = useAppStore((s) => s.speciesInfoMap);
  const magicTable = useAppStore((s) => s.magicTable);
  const species = SPECIES_MAP[speciesCode];

  const pyleSpeciesRange = useMemo(() => {
    if (!speciesCode || speciesCode.length !== 4 || !magicTable || !magicTable.pyle) return null;
    return magicTable.pyle[speciesCode] || null;
  }, [speciesCode, magicTable]);

  return (
    <ModalShell
      modalProps={{
        isDismissable: false,
        isOpen,
        onOpenChange,
        size: "5xl",
        scrollBehavior: "inside",
      }}
    >
      {(onClose) => (
        <>
          <ModalHeaderShell>
            <h2 className="text-xl font-bold">Species Information: {speciesCode}</h2>
            {species && (
              <div className="flex flex-col gap-1 mt-2 text-sm font-normal">
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
            )}
          </ModalHeaderShell>
          <ModalBodyShell>
            {speciesCode.length === 4 && pyleSpeciesRange && speciesInfoMap[speciesCode] && (
              <PyleAndFunFacts
                speciesCode={speciesCode}
                pyleSpeciesRange={pyleSpeciesRange}
                speciesInfo={speciesInfoMap[speciesCode]}
                disabled
              />
            )}
          </ModalBodyShell>
          <ModalFooterShell>
            <Button {...modalPrimaryButtonProps} onPress={onClose}>
              Close
            </Button>
          </ModalFooterShell>
        </>
      )}
    </ModalShell>
  );
}
