import { useMemo } from "react";
import { Modal, ModalContent, ModalHeader, ModalBody, ModalFooter, Button } from "@heroui/react";
import BirdEventsTable from "../PageContent/Programs/Captures/BirdEventsTable";
import { useData } from "../../services/useData";

interface BirdEventHistoryModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function BirdEventHistoryModal({ isOpen, onClose }: BirdEventHistoryModalProps) {
  const { birdEventsMap } = useData();

  // Get the 10 most recent bird events based on updatedAt timestamp
  const birdEvents = useMemo(() => {
    const allBirdEvents = Object.values(birdEventsMap);
    
    // Sort by updatedAt timestamp (descending - newest first) and take top 10
    return allBirdEvents
      .sort((a, b) => {
        // updatedAt is stored as a string timestamp, convert directly to number
        const dateA = Number(a.updatedAt);
        const dateB = Number(b.updatedAt);
        return dateB - dateA;
      })
      .slice(0, 10);
  }, [birdEventsMap]);

  return (
    <Modal isOpen={isOpen} onClose={onClose} className={`!max-w-[calc(100%-8rem)]`} scrollBehavior="inside">
      <ModalContent>
        <ModalHeader className="flex flex-col gap-1">
          <div className="flex justify-between items-center">
            <div>
              <h2 className="text-xl font-bold">Bird Event History</h2>
              <p className="text-sm text-default-500">
                Showing the 10 most recently updated bird events
              </p>
            </div>
          </div>
        </ModalHeader>

        <ModalBody>
          {birdEvents.length === 0 ? (
            <div className="flex justify-center items-center py-8">
              <p className="text-default-500">No bird events found</p>
            </div>
          ) : (
            <>
              <div className="flex justify-between items-center mb-2">
                <h3 className="text-md font-semibold">Recent Events ({birdEvents.length})</h3>
              </div>

              <BirdEventsTable
                birdEvents={birdEvents}
                maxTableHeight={600}
                sortDescriptors={[]}
                allowInspectBandId
                hiddenColumns={[
                  "birdEventType",
                  "wing",
                  "age",
                  "howAged",
                  "sex",
                  "howSexed",
                  "fat",
                  "net",
                  "weight",
                  "notes",
                  "bander",
                  "scribe",
                  "birdStatus",
                  "date",
                  "time",
                ]}
              />
            </>
          )}
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
