import { useMemo, useState, useEffect } from "react";
import { Button, Chip } from "@heroui/react";
import { useData } from "../../services/useData";
import { getQueuedEvents, clearQueue } from "../../services/indexedDB";
import type { PendingEvent, BirdEvent } from "../../types";
import BirdEventsTable from "../PageContent/Programs/Captures/BirdEventsTable";
import SpeciesTooltip from "../Helper/Info/SpeciesTooltip";
import { modalPrimaryButtonProps } from "./modalDefaults";
import ModalShell, { ModalBodyShell, ModalFooterShell, ModalHeaderShell } from "./ModalShell";

interface ActivityModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function ActivityModal({ isOpen, onClose }: ActivityModalProps) {
  const { birdEventsMap, pendingCount, isOnline } = useData();
  const [queuedEvents, setQueuedEvents] = useState<PendingEvent[]>([]);
  const [confirmingClear, setConfirmingClear] = useState(false);
  const [clearing, setClearing] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    getQueuedEvents().then(setQueuedEvents).catch(console.error);
  }, [isOpen, pendingCount]);

  // Only walk the full birdEventsMap when the modal is open. Sorting 700K+
  // events on every save burns ~1200ms on slow CPUs — and nobody sees the
  // result unless the modal is actually showing.
  const recentBirdEvents = useMemo(() => {
    if (!isOpen) return [];
    return Object.values(birdEventsMap)
      .filter((event): event is BirdEvent => event !== undefined && !event.modifiedEventId)
      .sort((a, b) => parseInt(b.updatedAt) - parseInt(a.updatedAt))
      .slice(0, 100);
  }, [isOpen, birdEventsMap]);

  return (
    <ModalShell
      modalProps={{
        isDismissable: false,
        isOpen,
        onClose,
        className: "max-w-7xl",
        scrollBehavior: "inside",
      }}
    >
      <ModalHeaderShell>
        <div className="flex justify-between items-center w-full">
          <div>
            <h2 className="text-xl">Activity</h2>
            <p className="text-sm text-default-600 font-light">
              {isOnline ? "Online" : "Offline"}
              {pendingCount > 0 && ` · ${pendingCount} pending`}
            </p>
          </div>
          <div className="flex items-center gap-3"></div>
        </div>
      </ModalHeaderShell>

      <ModalBodyShell>
        {/* Pending sync section */}
        {queuedEvents.length > 0 && (
          <div className="mb-4">
            <p className="text-sm font-semibold mb-2">Pending Sync</p>
            <div className="flex flex-col gap-1">
              {queuedEvents.map((pending) => (
                <div
                  key={pending.id}
                  className="h-10 px-3 border border-warning-200 bg-warning-50 rounded-medium flex items-center gap-3 text-sm"
                >
                  <Chip size="sm" variant="flat" color="warning">
                    {pending.type === "bird-event" ? "Capture" : "DET"}
                  </Chip>
                  {pending.type === "bird-event" ? (
                    <>
                      <span className="font-bold">
                        {pending.pendingEvent.band?.bandGroupId}
                        {pending.pendingEvent.band?.last2digits}
                      </span>
                      <span className="font-bold">
                        <SpeciesTooltip speciesCode={pending.pendingEvent.species} />
                      </span>
                      <span className="text-default-700">
                        {pending.pendingEvent.date} {pending.pendingEvent.time}
                      </span>
                    </>
                  ) : (
                    <>
                      <span className="font-bold">{pending.det.date}</span>
                      <span className="text-default-700">{pending.det.programId}</span>
                    </>
                  )}
                  <span className="ml-auto text-xs text-warning-600">pending</span>
                </div>
              ))}
            </div>
            <div className="mt-2 flex items-center gap-2">
              {confirmingClear ? (
                <>
                  <span className="text-sm text-danger">
                    Discard {queuedEvents.length} pending event{queuedEvents.length !== 1 ? "s" : ""}? This cannot be
                    undone.
                  </span>
                  <Button
                    size="sm"
                    color="danger"
                    variant="flat"
                    isLoading={clearing}
                    onPress={async () => {
                      setClearing(true);
                      await clearQueue();
                      window.location.reload();
                    }}
                  >
                    Confirm
                  </Button>
                  <Button size="sm" variant="light" onPress={() => setConfirmingClear(false)}>
                    Cancel
                  </Button>
                </>
              ) : (
                <Button size="sm" color="danger" variant="light" onPress={() => setConfirmingClear(true)}>
                  Clear Queue
                </Button>
              )}
            </div>
          </div>
        )}

        {/* Recent bird events */}
        <div>
          <p className="text-sm font-semibold mb-2">Recent Activity (Last 100 Additions/Modifications)</p>
          {recentBirdEvents.length > 0 ? (
            <BirdEventsTable
              birdEvents={recentBirdEvents}
              maxTableHeight={400}
              allowInspectBandId
              sortDescriptors={[{ column: "updatedAt", direction: "descending" }]}
            />
          ) : (
            <div className="text-center text-default-700 py-8">No recent activity</div>
          )}
        </div>
      </ModalBodyShell>

      <ModalFooterShell>
        <Button {...modalPrimaryButtonProps} onPress={onClose}>
          Close
        </Button>
      </ModalFooterShell>
    </ModalShell>
  );
}
