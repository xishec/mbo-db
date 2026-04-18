import { useMemo, useState, useEffect } from "react";
import { Button, Chip } from "@heroui/react";
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

  useEffect(() => {
    if (!isOpen) return;
    getQueuedEvents().then(setQueuedEvents).catch(console.error);
  }, [isOpen]);

  const birdEvents = useMemo(
    () =>
      queuedEvents
        .filter((p): p is PendingEvent & { type: "bird-event" } => p.type === "bird-event")
        .map((p) => p.pendingEvent),
    [queuedEvents]
  );

  const detEvents = useMemo(
    () =>
      queuedEvents
        .filter((p): p is PendingEvent & { type: "det" } => p.type === "det"),
    [queuedEvents]
  );

  return (
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
        <div>
          <h2 className="text-xl">Sync Queue</h2>
          <p className="text-sm text-default-600 font-light">
            {queuedEvents.length} pending item{queuedEvents.length !== 1 ? "s" : ""} waiting to sync
          </p>
        </div>
      </ModalHeaderShell>

      <ModalBodyShell>
        {queuedEvents.length === 0 ? (
          <div className="flex justify-center items-center py-8">
            <p className="text-default-500">No pending events in queue</p>
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            {birdEvents.length > 0 && (
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-sm font-semibold">Bird Events</span>
                  <Chip size="sm" variant="flat" color="primary">{birdEvents.length}</Chip>
                </div>
                <BirdEventsTable birdEvents={birdEvents} maxTableHeight={400} />
              </div>
            )}

            {detEvents.length > 0 && (
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-sm font-semibold">DET Entries</span>
                  <Chip size="sm" variant="flat" color="secondary">{detEvents.length}</Chip>
                </div>
                <div className="flex flex-col gap-1">
                  {detEvents.map((pending) => (
                    <div
                      key={pending.id}
                      className="h-10 px-3 border border-default-200 rounded-medium flex items-center gap-3 text-sm"
                    >
                      <Chip size="sm" variant="flat" color="secondary">DET</Chip>
                      <span className="font-bold">{pending.det.date}</span>
                      <span className="text-default-500">{pending.det.programId}</span>
                      <span className="text-default-500">{pending.det.location}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
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
