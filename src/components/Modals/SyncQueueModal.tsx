import { useMemo, useState, useEffect } from "react";
import { Button } from "@heroui/react";
import BirdEventsTable from "../PageContent/Programs/Captures/BirdEventsTable";
import { getQueuedEvents } from "../../services/indexedDB";
import type { PendingEvent } from "../../types";
import { modalPrimaryButtonProps } from "./modalDefaults";
import ModalShell, { ModalBodyShell, ModalFooterShell, ModalHeaderShell } from "./ModalShell";

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
    <ModalShell
      modalProps={{
        isDismissable: true,
        isOpen,
        onClose,
        size: "5xl",
        scrollBehavior: "inside",
      }}
    >
        <ModalHeaderShell>
          <div className="flex justify-between items-center">
            <div>
              <h2 className="text-xl">Sync Queue</h2>
              <p className="text-sm text-default-600 font-light">
                {queuedEvents.length} pending item{queuedEvents.length !== 1 ? "s" : ""} waiting to sync to Firebase
              </p>
            </div>
          </div>
        </ModalHeaderShell>

        <ModalBodyShell>
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
        </ModalBodyShell>

        <ModalFooterShell>
          <Button {...modalPrimaryButtonProps} onPress={onClose}>
            Close
          </Button>
        </ModalFooterShell>
    </ModalShell>
  );
}
