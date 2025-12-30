import { useMemo, useState, useEffect } from "react";
import {
  Modal,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
  Button,
} from "@heroui/react";
import BirdEventsTable from "../PageContent/Programs/Captures/BirdEventsTable";
import { getQueuedEvents } from "../../services/indexedDB";
import type { PendingEvent } from "../../types";

interface SyncQueueModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function SyncQueueModal({ isOpen, onClose }: SyncQueueModalProps) {
  const [queuedEvents, setQueuedEvents] = useState<PendingEvent[]>([]);

  // Load queued events when modal opens
  useEffect(() => {
    if (!isOpen) return;

    getQueuedEvents()
      .then(setQueuedEvents)
      .catch(console.error);
  }, [isOpen]);

  // Convert pending events to bird events for display
  const birdEvents = useMemo(() => {
    return queuedEvents.map((pending) => pending.pendingEvent);
  }, [queuedEvents]);

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      size="5xl"
      scrollBehavior="inside"
    >
      <ModalContent>
        <ModalHeader className="flex flex-col gap-1">
          <div className="flex justify-between items-center">
            <div>
              <h2 className="text-xl font-bold">Sync Queue</h2>
              <p className="text-sm text-default-500">
                Pending bird events waiting to sync to Firebase
              </p>
            </div>
          </div>
        </ModalHeader>

        <ModalBody>
          {birdEvents.length === 0 ? (
            <div className="flex justify-center items-center py-8">
              <p className="text-default-500">No pending events in queue</p>
            </div>
          ) : (
            <BirdEventsTable
              captures={birdEvents}
              maxTableHeight={600}
              sortDescriptors={[{ column: "date", direction: "descending" }]}
            />
          )}
        </ModalBody>

        <ModalFooter>
          <Button color="primary" onPress={onClose} size="sm">
            Close
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
}
