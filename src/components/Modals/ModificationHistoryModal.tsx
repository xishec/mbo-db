import { Modal, ModalBody, ModalContent, ModalFooter, ModalHeader, Button } from "@heroui/react";
import { useMemo } from "react";
import { useData } from "../../services/useData";
import BirdEventsTable from "../PageContent/Programs/Captures/BirdEventsTable";
import type { BirdEvent } from "../../types";

interface ModificationHistoryModalProps {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  birdEvent: BirdEvent;
}

export default function ModificationHistoryModal({ isOpen, onOpenChange, birdEvent }: ModificationHistoryModalProps) {
  const { birdEventsMap } = useData();

  const birdEvents = useMemo(() => {
    const event = birdEventsMap[birdEvent.id];
    const events: BirdEvent[] = [event];
    let currentEvent = event;

    // Recursively follow the previousEventId chain
    while (currentEvent.previousEventId) {
      const previousEvent = birdEventsMap[currentEvent.previousEventId];
      if (previousEvent) {
        events.push(previousEvent);
        currentEvent = previousEvent;
      } else {
        break;
      }
    }

    return events.sort((a, b) => a.id.localeCompare(b.id));
  }, [birdEvent.id, birdEventsMap]);

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
              Modification history of band <span className="font-bold">{birdEvent.band?.id}</span>
            </ModalHeader>
            <ModalBody className="gap-4 px-8 py-4">
              {birdEvents.length > 0 ? (
                <BirdEventsTable
                  birdEvents={birdEvents}
                  maxTableHeight={500}
                  sortDescriptors={[{ column: "date", direction: "ascending" }]}
                  showHistory
                />
              ) : (
                <p>No history found for this band.</p>
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
