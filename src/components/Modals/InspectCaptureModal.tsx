import { Modal, ModalBody, ModalContent, ModalFooter, ModalHeader, Button } from "@heroui/react";
import { useMemo } from "react";
import { useData } from "../../services/useData";
import BirdEventsTable from "../PageContent/Programs/Captures/BirdEventsTable";

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
    <Modal
      isKeyboardDismissDisabled
      isOpen={isOpen}
      onOpenChange={onOpenChange}
      className={`!max-w-[calc(100%-4rem)]`}
      scrollBehavior="inside"
    >
      <ModalContent>
        {(onClose) => (
          <>
            <ModalHeader className="flex flex-row items-center gap-1 p-8 pb-0 font-normal">
              Inspect Band <span className="font-bold">{bandId}</span>
            </ModalHeader>
            <ModalBody className="gap-4 px-8 py-4">
              {birdEvents.length > 0 ? (
                <BirdEventsTable
                  captures={birdEvents}
                  maxTableHeight={500}
                  sortColumn="bandGroup"
                  sortDirection="descending"
                  disableInspect
                />
              ) : (
                <p>No captures found for this band.</p>
              )}
            </ModalBody>
            <ModalFooter className="gap-4 p-8 pt-0">
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
