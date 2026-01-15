import { useMemo, useState } from "react";
import { Modal, ModalContent, ModalHeader, ModalBody, ModalFooter, Button } from "@heroui/react";
import { MagnifyingGlassIcon } from "@heroicons/react/24/outline";
import { useData } from "../../services/useData";
import { findConflicts } from "../../types/conflicts";
import CaptureHistoryModal from "./CaptureHistoryModal";

interface ErrorsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function ErrorsModal({ isOpen, onClose }: ErrorsModalProps) {
  const { birdEventsMap, bandIdToBirdEventIdsMap, magicTable } = useData();
  const [selectedBandId, setSelectedBandId] = useState<string | null>(null);
  const [selectedBirdEventId, setSelectedBirdEventId] = useState<string | null>(null);
  const [isCaptureHistoryModalOpen, setIsCaptureHistoryModalOpen] = useState(false);

  // Find all conflicts
  const conflicts = useMemo(() => {
    const allConflicts = findConflicts(bandIdToBirdEventIdsMap, birdEventsMap, magicTable);
    // Sort by updatedAt (most recent first)
    return allConflicts.sort((a, b) => {
      const aTime = parseInt(a.birdEvent.updatedAt || "0", 10);
      const bTime = parseInt(b.birdEvent.updatedAt || "0", 10);
      return bTime - aTime; // Descending order (newest first)
    });
  }, [bandIdToBirdEventIdsMap, birdEventsMap, magicTable]);

  const handleConflictClick = (conflict: { birdEvent: { id: string; band?: { id: string } }; reason: string }) => {
    if (conflict.birdEvent.band) {
      setSelectedBandId(conflict.birdEvent.band.id);
      setSelectedBirdEventId(conflict.birdEvent.id);
      setIsCaptureHistoryModalOpen(true);
    }
  };

  return (
    <>
      <Modal isDismissable isOpen={isOpen} onClose={onClose} className={`!max-w-[calc(100%-8rem)]`} scrollBehavior="inside">
        <ModalContent>
          <ModalHeader className="flex flex-col gap-1">
            <div className="flex justify-between items-center">
              <div>
                <h2 className="text-xl">Data Errors</h2>
                <p className="text-sm text-default-900 font-light">{conflicts.length} conflicts found</p>
              </div>
            </div>
          </ModalHeader>

          <ModalBody>
            <div className="flex flex-col gap-2">
              {conflicts.map((conflict, index) => (
                <div
                  key={`${conflict.birdEvent.id}-${index}`}
                  className="p-3 border border-default-200 rounded-lg hover:bg-default-100 cursor-pointer transition-colors"
                  onClick={() => handleConflictClick(conflict)}
                >
                  <div className="flex items-center gap-3 text-sm">
                    <MagnifyingGlassIcon className="w-4 h-4 text-default-900 flex-shrink-0" />
                    <span className="font-bold text-default-900 w-20 flex-shrink-0">
                      {conflict.birdEvent.band?.displayBandGroupId}{conflict.birdEvent.band?.last2digits}
                    </span>
                    <span className="text-default-900 w-32 flex-shrink-0">
                      {conflict.birdEvent.date} {conflict.birdEvent.time}
                    </span>
                    <span className="text-default-900 w-12 flex-shrink-0 font-bold">
                      {conflict.birdEvent.species}
                    </span>
                    <span className="font-semibold text-danger-600 flex-1">{conflict.reason}</span>
                  </div>
                </div>
              ))}
              {conflicts.length === 0 && (
                <div className="text-center text-default-500 py-8">No conflicts found</div>
              )}
            </div>
          </ModalBody>

          <ModalFooter className="gap-4 p-8 pt-4">
            <Button color="primary" onPress={onClose}>
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
