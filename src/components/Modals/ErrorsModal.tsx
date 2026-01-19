import { useMemo, useState } from "react";
import { Button } from "@heroui/react";
import { MagnifyingGlassIcon, XMarkIcon } from "@heroicons/react/24/outline";
import { useData } from "../../services/useData";
import { findBirdEventErrors } from "../../types/birdEventErrors";
import CaptureHistoryModal from "./CaptureHistoryModal";
import ExportButton from "../Helper/ExportButton";
import SpeciesTooltip from "../Helper/SpeciesTooltip";
import { modalPrimaryButtonProps } from "./modalDefaults";
import ModalShell, { ModalBodyShell, ModalFooterShell, ModalHeaderShell } from "./ModalShell";

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
      <ModalShell
        modalProps={{
          isDismissable: true,
          isOpen,
          onClose,
          className: "!max-w-[calc(100%-8rem)]",
          scrollBehavior: "inside",
        }}
      >
          <ModalHeaderShell>
            <div className="flex justify-between items-center">
              <div>
                <h2 className="text-xl">Data Errors</h2>
                <p className="text-sm text-default-900 font-light">
                  {errors.length} severe errors found
                  {dismissedCount > 0 && <span> ({dismissedCount} dismissed)</span>}
                </p>
              </div>
            </div>
          </ModalHeaderShell>

          <ModalBodyShell>
            <div className="flex flex-col gap-2">
              {errors.map((error) => (
                <div key={error.id} className="flex flex-row gap-2">
                  <div
                    className="flex-grow h-10 px-3 border border-default-200 rounded-medium hover:bg-default-100 cursor-pointer transition-colors flex items-center"
                    onClick={() => handleErrorClick(error)}
                  >
                    <div className="grid grid-cols-[auto_100px_170px_80px_1fr] gap-3 text-sm w-full items-center">
                      <MagnifyingGlassIcon className="w-4 h-4 text-default-900" />
                      <span className="font-bold text-default-900">
                        {error.birdEvent.band?.bandGroupId}
                        {error.birdEvent.band?.last2digits}
                      </span>
                      <span className="text-default-900">
                        {error.birdEvent.date} {error.birdEvent.time}
                      </span>
                      <span className="text-default-900 font-bold">
                        <SpeciesTooltip speciesCode={error.birdEvent.species} />
                      </span>
                      <span className={`font-semibold ${error.severity === "danger" ? "text-danger-600" : "text-warning-600"}`}>
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
          </ModalBodyShell>

          <ModalFooterShell>
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
            <Button {...modalPrimaryButtonProps} onPress={onClose}>
              Close
            </Button>
          </ModalFooterShell>
      </ModalShell>

      <CaptureHistoryModal
        isOpen={isCaptureHistoryModalOpen}
        onOpenChange={setIsCaptureHistoryModalOpen}
        bandId={selectedBandId}
        birdEventIdToHighlight={selectedBirdEventId || undefined}
      />
    </>
  );
}
