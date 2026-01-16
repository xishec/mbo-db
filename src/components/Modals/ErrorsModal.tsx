import { useMemo, useState } from "react";
import { Modal, ModalContent, ModalHeader, ModalBody, ModalFooter, Button } from "@heroui/react";
import { MagnifyingGlassIcon, XMarkIcon } from "@heroicons/react/24/outline";
import { useData } from "../../services/useData";
import { findBirdEventErrors } from "../../types/birdEventErrors";
import CaptureHistoryModal from "./CaptureHistoryModal";
import ExportButton from "../ExportButton";

interface ErrorsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function ErrorsModal({ isOpen, onClose }: ErrorsModalProps) {
  const {
    birdEventsMap,
    bandIdToBirdEventIdsMap,
    magicTable,
    dismissedConflictsMap,
    dismissConflict,
    resetDismissedConflicts,
    isLoggedIn,
    isOnline,
  } = useData();
  const [selectedBandId, setSelectedBandId] = useState<string | null>(null);
  const [selectedBirdEventId, setSelectedBirdEventId] = useState<string | null>(null);
  const [isCaptureHistoryModalOpen, setIsCaptureHistoryModalOpen] = useState(false);

  // Find all errors
  const { errors, dismissedCount } = useMemo(() => {
    const allErrors = findBirdEventErrors(bandIdToBirdEventIdsMap, birdEventsMap, magicTable);
    // Filter out warnings - only keep severe errors
    const severeErrors = allErrors.filter((error) => error.severity === "danger");
    // Filter out dismissed errors
    const activeErrors = severeErrors.filter((error) => !dismissedConflictsMap[error.id]);
    // Calculate how many errors are actually being dismissed
    const dismissedCount = severeErrors.length - activeErrors.length;
    // Sort by updatedAt (most recent first)
    const sortedErrors = activeErrors.sort((a, b) => {
      const aTime = parseInt(a.birdEvent.updatedAt || "0", 10);
      const bTime = parseInt(b.birdEvent.updatedAt || "0", 10);
      return bTime - aTime; // Descending order (newest first)
    });
    return { errors: sortedErrors, dismissedCount };
  }, [bandIdToBirdEventIdsMap, birdEventsMap, magicTable, dismissedConflictsMap]);

  const handleErrorClick = (error: { birdEvent: { id: string; band?: { id: string } }; reason: string }) => {
    if (error.birdEvent.band) {
      setSelectedBandId(error.birdEvent.band.id);
      setSelectedBirdEventId(error.birdEvent.id);
      setIsCaptureHistoryModalOpen(true);
    }
  };

  const handleDismissError = async (errorId: string) => {
    try {
      await dismissConflict(errorId);
    } catch (error) {
      console.error("Failed to dismiss error:", error);
    }
  };

  const handleResetDismissedErrors = async () => {
    try {
      await resetDismissedConflicts();
    } catch (error) {
      console.error("Failed to reset dismissed errors:", error);
    }
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
          <ModalHeader className="flex flex-col gap-1">
            <div className="flex justify-between items-center">
              <div>
                <h2 className="text-xl">Data Errors</h2>
                <p className="text-sm text-default-900 font-light">
                  {errors.length} severe errors found
                  {dismissedCount > 0 && <span> ({dismissedCount} dismissed)</span>}
                </p>
              </div>
            </div>
          </ModalHeader>

          <ModalBody>
            <div className="flex flex-col gap-2">
              {errors.map((error) => (
                <div key={error.id} className="flex flex-row gap-2">
                  <div
                    className="flex-grow h-10 px-3 border border-default-200 rounded-medium hover:bg-default-100 cursor-pointer transition-colors flex items-center"
                    onClick={() => handleErrorClick(error)}
                  >
                    <div className="flex items-center gap-3 text-sm w-full">
                      <MagnifyingGlassIcon className="w-4 h-4 text-default-900 flex-shrink-0" />
                      <span className="font-bold text-default-900 flex-shrink-0">
                        {error.birdEvent.band?.displayBandGroupId}
                        {error.birdEvent.band?.last2digits}
                      </span>
                      <span className="text-default-900 flex-shrink-0">
                        {error.birdEvent.date} {error.birdEvent.time}
                      </span>
                      <span className="text-default-900 flex-shrink-0 font-bold">{error.birdEvent.species}</span>
                      <span className={`font-semibold flex-1 ${error.severity === "danger" ? "text-danger-600" : "text-warning-600"}`}>
                        {error.reason}
                      </span>
                    </div>
                  </div>
                  {isLoggedIn && isOnline && (
                    <Button
                      onPress={() => handleDismissError(error.id)}
                      color="danger"
                      variant="light"
                      isIconOnly
                    >
                      <XMarkIcon className="w-5 h-5" />
                    </Button>
                  )}
                </div>
              ))}
              {errors.length === 0 && <div className="text-center text-default-500 py-8">No severe errors found</div>}
            </div>
          </ModalBody>

          <ModalFooter className="gap-4 p-8 pt-4">
            {isLoggedIn && isOnline && dismissedCount > 0 && (
              <Button color="primary" variant="bordered" onPress={handleResetDismissedErrors}>
                Reset Dismissed Errors
              </Button>
            )}
            <ExportButton
              birdEvents={errors.map((error) => error.birdEvent)}
              filename="errors.csv"
              additionalComments={errors.reduce((acc, error) => {
                acc[error.birdEvent.id] = error.reason;
                return acc;
              }, {} as Record<string, string>)}
            />
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
