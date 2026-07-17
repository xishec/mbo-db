import { Button } from "@heroui/react";
import { useMemo } from "react";
import PyleAndFunFacts from "../Helper/Info/PyleAndFunFacts";
import { useAppStore } from "../../stores/useAppStore";
import { resolveSpeciesKey, SPECIES_MAP } from "../../types/species";
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
  const speciesAliasesMap = useAppStore((s) => s.speciesAliasesMap);
  const resolvedSpeciesCode = resolveSpeciesKey(speciesCode, speciesAliasesMap);
  const species = SPECIES_MAP[resolvedSpeciesCode];

  const pyleSpeciesRange = useMemo(() => {
    if (!resolvedSpeciesCode || resolvedSpeciesCode.length !== 4 || !magicTable || !magicTable.pyle) return null;
    return magicTable.pyle[resolvedSpeciesCode] || null;
  }, [resolvedSpeciesCode, magicTable]);

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
            <h2 className="text-xl font-bold">Species Information: {resolvedSpeciesCode}</h2>
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
            {resolvedSpeciesCode.length === 4 && pyleSpeciesRange && speciesInfoMap[resolvedSpeciesCode] && (
              <PyleAndFunFacts
                speciesCode={resolvedSpeciesCode}
                pyleSpeciesRange={pyleSpeciesRange}
                speciesInfo={speciesInfoMap[resolvedSpeciesCode]}
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
