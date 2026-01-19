import { useMemo, useState, useEffect } from "react";
import { Modal, ModalContent, ModalHeader, ModalBody, ModalFooter, Button } from "@heroui/react";
import BirdEventsTable from "../PageContent/Programs/Captures/BirdEventsTable";
import { getQueuedEvents } from "../../services/indexedDB";
import type { PendingEvent } from "../../types";
import { modalBodyClass, modalFooterClass, modalHeaderClass, modalPrimaryButtonProps } from "./modalDefaults";
import { stopModalPropagation } from "./modalInteractions";

interface SyncQueueModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function SyncQueueModal({ isOpen, onClose }: SyncQueueModalProps) {
  const [queuedEvents, setQueuedEvents] = useState<PendingEvent[]>([]);

  // Load queued events when modal opens
  useEffect(() => {
    if (!isOpen) return;

    getQueuedEvents().then(setQueuedEvents).catch(console.error);
  }, [isOpen]);

  // Convert pending events to bird events for display (filter out DET events)
  const birdEvents = useMemo(() => {
    return queuedEvents
      .filter((pending): pending is PendingEvent & { type: "bird-event" } => pending.type === "bird-event")
      .map((pending) => pending.pendingEvent);
  }, [queuedEvents]);

  return (
    <Modal onClick={stopModalPropagation} isDismissable isOpen={isOpen} onClose={onClose} size="5xl" scrollBehavior="inside">
      <ModalContent onClick={stopModalPropagation}>
        <ModalHeader className={modalHeaderClass}>
          <div className="flex justify-between items-center">
            <div>
              <h2 className="text-xl">Sync Queue</h2>
              <p className="text-sm text-default-600 font-light">
                {queuedEvents.length} pending item{queuedEvents.length !== 1 ? "s" : ""} waiting to sync to Firebase
              </p>
            </div>
          </div>
        </ModalHeader>

        <ModalBody className={modalBodyClass}>
          {birdEvents.length === 0 ? (
            <div className="flex justify-center items-center py-8">
              <p className="text-default-500">No pending events in queue</p>
            </div>
          ) : (
            <BirdEventsTable
              birdEvents={birdEvents}
              maxTableHeight={600}
            />
          )}
        </ModalBody>

        <ModalFooter className={modalFooterClass}>
          <Button {...modalPrimaryButtonProps} onPress={onClose}>
            Close
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
}
