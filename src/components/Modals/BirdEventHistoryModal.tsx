import { useMemo, useState } from "react";
import { Modal, ModalContent, ModalHeader, ModalBody, ModalFooter, Button, Chip } from "@heroui/react";
import { useData } from "../../services/useData";
import CaptureHistoryModal from "./CaptureHistoryModal";
import { formatUpdatedAt } from "../PageContent/Programs/Captures/helpers";
import { MagnifyingGlassIcon } from "@heroicons/react/16/solid";
import SpeciesTooltip from "../Helper/SpeciesTooltip";
import { modalBodyClass, modalFooterClass, modalHeaderClass, modalPrimaryButtonProps } from "./modalDefaults";

enum ModificationType {
  Addition = "Added",
  Modification = "Modified",
}

interface BirdEventHistoryModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function BirdEventHistoryModal({ isOpen, onClose }: BirdEventHistoryModalProps) {
  const { birdEventsMap } = useData();
  const [selectedBandId, setSelectedBandId] = useState<string | null>(null);
  const [selectedBirdEventId, setSelectedBirdEventId] = useState<string | null>(null);
  const [isCaptureHistoryModalOpen, setIsCaptureHistoryModalOpen] = useState(false);

  // Get the 10 most recent bird events based on updatedAt timestamp
  const birdEvents = useMemo(() => {
    const allBirdEvents = Object.values(birdEventsMap);

    // Filter out events without valid updatedAt and sort by timestamp (descending - newest first)
    return allBirdEvents
      .filter((event) => event.updatedAt && !isNaN(Number(event.updatedAt)))
      .sort((a, b) => {
        // updatedAt is stored as a string timestamp, convert directly to number
        const dateA = Number(a.updatedAt);
        const dateB = Number(b.updatedAt);
        return dateB - dateA;
      })
      .slice(0, 10);
  }, [birdEventsMap]);

  const handleEventClick = (event: (typeof birdEvents)[0]) => {
    if (event.band) {
      setSelectedBandId(event.band.id);
      setSelectedBirdEventId(event.id);
      setIsCaptureHistoryModalOpen(true);
    }
  };

  const getModificationType = (event: (typeof birdEvents)[0]): ModificationType => {
    if (event.previousEventId) {
      return ModificationType.Modification;
    }
    return ModificationType.Addition;
  };

  return (
    <>
      <Modal
        isDismissable
        isOpen={isOpen}
        onClose={onClose}
        className={`!max-w-[calc(100%-8rem)]`}
        scrollBehavior="inside"
      >
        <ModalContent>
          <ModalHeader className={modalHeaderClass}>
            <div className="flex justify-between items-center">
              <div>
                <h2 className="text-xl">Recent History</h2>
                <p className="text-sm text-default-900 font-light">Showing the 10 most recently updated bird events</p>
              </div>
            </div>
          </ModalHeader>

          <ModalBody className={modalBodyClass}>
            <div className="flex flex-col gap-2">
              {birdEvents.map((event) => (
                <div key={event.id} className="flex flex-row gap-2">
                  <div
                    className="flex-grow h-10 px-3 border border-default-200 rounded-medium hover:bg-default-100 cursor-pointer transition-colors flex items-center"
                    onClick={() => handleEventClick(event)}
                  >
                    <div className="grid grid-cols-[25px_100px_170px_80px_100px_170px] gap-3 text-sm w-full items-center">
                      <MagnifyingGlassIcon className="w-4 h-4 text-default-900 flex-shrink-0" />
                      <span className="font-bold text-default-900">
                        {event.band?.bandGroupId}
                        {event.band?.last2digits}
                      </span>
                      <span className="text-default-900">
                        {event.date} {event.time}
                      </span>
                      <span className="text-default-900 font-bold">
                        <SpeciesTooltip speciesCode={event.species}>{event.species}</SpeciesTooltip>
                      </span>
                      <Chip
                        size="sm"
                        variant="flat"
                        color={getModificationType(event) === ModificationType.Modification ? "warning" : "success"}
                      >
                        {getModificationType(event)}
                      </Chip>
                      <span className="text-default-900">{formatUpdatedAt(event.updatedAt)}</span>
                    </div>
                  </div>
                </div>
              ))}
              {birdEvents.length === 0 && <div className="text-center text-default-500 py-8">No bird events found</div>}
            </div>
          </ModalBody>

          <ModalFooter className={modalFooterClass}>
            <Button {...modalPrimaryButtonProps} onPress={onClose}>
              Close
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>

      <CaptureHistoryModal
        isOpen={isCaptureHistoryModalOpen}
        onOpenChange={setIsCaptureHistoryModalOpen}
        bandId={selectedBandId}
        birdEventIdToHighlight={selectedBirdEventId || undefined}
      />
    </>
  );
}
