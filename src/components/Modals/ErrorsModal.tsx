import { useMemo } from "react";
import { Modal, ModalContent, ModalHeader, ModalBody, ModalFooter, Button } from "@heroui/react";
import BirdEventsTable from "../PageContent/Programs/Captures/BirdEventsTable";
import { useData } from "../../services/useData";
import { findConflicts } from "../../types/conflicts";

interface ErrorsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function ErrorsModal({ isOpen, onClose }: ErrorsModalProps) {
  const { birdEventsMap, bandIdToBirdEventIdsMap, magicTable } = useData();

  // Find all bird events with sex conflicts (4 -> 5 or 5 -> 4) or species conflicts
  const conflictingBirdEvents = useMemo(() => {
    const conflicts = findConflicts(bandIdToBirdEventIdsMap, birdEventsMap, magicTable);
    return conflicts.map(c => c.birdEvent);
  }, [bandIdToBirdEventIdsMap, birdEventsMap, magicTable]);

  return (
    <Modal isDismissable isOpen={isOpen} onClose={onClose} className={`!max-w-[calc(100%-8rem)]`} scrollBehavior="inside">
      <ModalContent>
        <ModalHeader className="flex flex-col gap-1">
          <div className="flex justify-between items-center">
            <div>
              <h2 className="text-xl font-bold">Data Errors</h2>
              <p className="text-sm text-default-500">Conflicting Bird Events: Sex changed (4↔5) or Species changed</p>
            </div>
          </div>
        </ModalHeader>

        <ModalBody>
          <BirdEventsTable birdEvents={conflictingBirdEvents} maxTableHeight={600} allowInspectBandId />
        </ModalBody>

        <ModalFooter className="gap-4 p-8 pt-4">
          <Button color="primary" onPress={onClose}>
            Close
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
}
