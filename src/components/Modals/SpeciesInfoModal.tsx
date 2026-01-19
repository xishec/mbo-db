import { Modal, ModalContent, ModalHeader, ModalBody, ModalFooter, Button } from "@heroui/react";
import { useMemo } from "react";
import SpeciesInfoCard from "../Helper/SpeciesInfoCard";
import SpeciesRangeTable from "../PageContent/Programs/Captures/SpeciesRangeTable";
import { useData } from "../../services/useData";
import { SPECIES_MAP } from "../../types/species";
import {
  modalHeaderClass,
  modalBodyClass,
  modalFooterClass,
  modalPrimaryButtonProps,
} from "./modalDefaults";

interface SpeciesInfoModalProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  speciesCode: string;
}

export default function SpeciesInfoModal({ isOpen, onOpenChange, speciesCode }: SpeciesInfoModalProps) {
  const { speciesInfoMap, magicTable } = useData();
  const species = SPECIES_MAP[speciesCode];

  const pyleSpeciesRange = useMemo(() => {
    if (!speciesCode || speciesCode.length !== 4 || !magicTable || !magicTable.pyle) return null;
    return magicTable.pyle[speciesCode] || null;
  }, [speciesCode, magicTable]);

  return (
    <Modal isDismissable isOpen={isOpen} onOpenChange={onOpenChange} size="5xl" scrollBehavior="inside">
      <ModalContent>
        {(onClose) => (
          <>
            <ModalHeader className={modalHeaderClass}>
              <h2 className="text-xl font-bold">Species Information: {speciesCode}</h2>
              {species && (
                <div className="flex flex-col gap-1 mt-2 text-sm">
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
            </ModalHeader>
            <ModalBody className={modalBodyClass}>
              {speciesCode.length === 4 && (
                <div className="flex gap-4">
                  {pyleSpeciesRange && (
                    <SpeciesRangeTable title="Pyle" speciesCode={speciesCode} speciesRange={pyleSpeciesRange} />
                  )}
                  <SpeciesInfoCard
                    speciesCode={speciesCode}
                    speciesInfo={speciesInfoMap[speciesCode] || null}
                  />
                </div>
              )}
            </ModalBody>
            <ModalFooter className={modalFooterClass}>
              <Button {...modalPrimaryButtonProps} onPress={onClose}>
                Close
              </Button>
            </ModalFooter>
          </>
        )}
      </ModalContent>
    </Modal>
  );
}
