import { Modal, ModalBody, ModalContent, ModalFooter, ModalHeader, Button } from "@heroui/react";
import { useMemo } from "react";
import { useData } from "../../services/useData";
import BirdEventsTable from "../PageContent/Programs/Captures/BirdEventsTable";

interface CaptureHistoryModalProps {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  bandId: string | null;
  birdEventIdToHighlight?: string;
}

export default function CaptureHistoryModal({
  isOpen,
  onOpenChange,
  bandId,
  birdEventIdToHighlight,
}: CaptureHistoryModalProps) {
  const { bandIdToBirdEventIdsMap, birdEventsMap } = useData();

  const birdEvents = useMemo(() => {
    if (!bandId) return [];
    const eventIds = bandIdToBirdEventIdsMap[bandId] || [];
    return eventIds
      .map((id) => birdEventsMap[id])
      .filter(Boolean)
      .filter((event) => event.modifiedEventId == null);
  }, [bandId, bandIdToBirdEventIdsMap, birdEventsMap]);

  return (
    <Modal
      isKeyboardDismissDisabled
      isOpen={isOpen}
      onOpenChange={onOpenChange}
      className={`!max-w-[calc(100%-8rem)]`}
      scrollBehavior="inside"
    >
      <ModalContent>
        {(onClose) => (
          <>
            <ModalHeader className="flex flex-row items-center gap-1 p-8 pb-0 font-normal">
              History of band : <span className="font-bold">{bandId}</span>
            </ModalHeader>
            <ModalBody className="gap-4 px-8 py-4">
              {birdEvents.length > 0 ? (
                <BirdEventsTable
                  birdEvents={birdEvents}
                  maxTableHeight={500}
                  allowInspectHistory
                  hiddenColumns={["bandGroup", "bandLastTwoDigits"]}
                  birdEventIdToHighlight={birdEventIdToHighlight}
                />
              ) : (
                <p>No captures found for this band.</p>
              )}
            </ModalBody>
            <ModalFooter className="gap-4 p-8 pt-4">
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
