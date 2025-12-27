import { Modal, ModalBody, ModalContent, ModalFooter, ModalHeader, Button } from "@heroui/react";
import { useMemo } from "react";
import { useData } from "../../../../../services/useData";
import BirdEventsTable from "../BirdEventsTable";

interface InspectCaptureModalProps {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  bandId: string | null;
}

export default function InspectCaptureModal({ isOpen, onOpenChange, bandId }: InspectCaptureModalProps) {
  const { bandIdToBirdEventIdsMap, birdEventsMap } = useData();

  const birdEvents = useMemo(() => {
    if (!bandId) return [];
    const eventIds = bandIdToBirdEventIdsMap[bandId] || [];
    return eventIds.map((id) => birdEventsMap[id]).filter(Boolean);
  }, [bandId, bandIdToBirdEventIdsMap, birdEventsMap]);

  return (
    <Modal isOpen={isOpen} onOpenChange={onOpenChange} size="5xl" scrollBehavior="inside">
      <ModalContent>
        {(onClose) => (
          <>
            <ModalHeader className="flex flex-col gap-1">Inspect Band {bandId}</ModalHeader>
            <ModalBody>
              {birdEvents.length > 0 ? (
                <BirdEventsTable
                  captures={birdEvents}
                  maxTableHeight={500}
                  sortColumn="bandGroup"
                  sortDirection="descending"
                  disableActions
                />
              ) : (
                <p>No captures found for this band.</p>
              )}
            </ModalBody>
            <ModalFooter>
              <Button color="primary" onPress={onClose}>
                Close
              </Button>
            </ModalFooter>
          </>
        )}
      </ModalContent>
    </Modal>
  );
}
