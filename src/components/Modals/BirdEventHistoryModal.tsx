import { useMemo, useState, useEffect } from "react";
import { Modal, ModalContent, ModalHeader, ModalBody, ModalFooter, Button } from "@heroui/react";
import BirdEventsTable from "../PageContent/Programs/Captures/BirdEventsTable";
import { getBirdEventHistory, clearBirdEventHistory, type BirdEventHistoryEntry } from "../../services/indexedDB";

interface BirdEventHistoryModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function BirdEventHistoryModal({ isOpen, onClose }: BirdEventHistoryModalProps) {
  const [historyEntries, setHistoryEntries] = useState<BirdEventHistoryEntry[]>([]);
  const [isClearing, setIsClearing] = useState(false);

  // Load history when modal opens
  useEffect(() => {
    if (!isOpen) return;

    loadHistory();
  }, [isOpen]);

  const loadHistory = async () => {
    try {
      const entries = await getBirdEventHistory();
      setHistoryEntries(entries);
    } catch (error) {
      console.error("Failed to load bird event history:", error);
    }
  };

  const handleClearHistory = async () => {
    if (!confirm("Are you sure you want to clear all bird event history? This cannot be undone.")) {
      return;
    }

    setIsClearing(true);
    try {
      await clearBirdEventHistory();
      setHistoryEntries([]);
    } catch (error) {
      console.error("Failed to clear history:", error);
    } finally {
      setIsClearing(false);
    }
  };

  // Convert history entries to bird events for display, with latest event highlighted
  const birdEvents = useMemo(() => {
    return historyEntries.sort((a, b) => b.timestamp - a.timestamp).map((entry) => entry.birdEvent);
  }, [historyEntries]);

  return (
    <Modal isOpen={isOpen} onClose={onClose} className={`!max-w-[calc(100%-8rem)]`} scrollBehavior="inside">
      <ModalContent>
        <ModalHeader className="flex flex-col gap-1">
          <div className="flex justify-between items-center">
            <div>
              <h2 className="text-xl font-bold">Bird Event History</h2>
              <p className="text-sm text-default-500">
                Local history of all bird events added or modified in this session
              </p>
            </div>
          </div>
        </ModalHeader>

        <ModalBody>
          {historyEntries.length === 0 ? (
            <div className="flex justify-center items-center py-8">
              <p className="text-default-500">No bird events in history</p>
            </div>
          ) : (
            <>
              <div className="flex justify-between items-center mb-2">
                <h3 className="text-md font-semibold">All Events ({historyEntries.length})</h3>
                <Button size="sm" color="danger" variant="flat" onPress={handleClearHistory} isLoading={isClearing}>
                  Clear History
                </Button>
              </div>

              <BirdEventsTable birdEvents={birdEvents} maxTableHeight={600} sortDescriptors={[]} allowInspectBandId />
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
