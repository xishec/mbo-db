import { Button } from "@heroui/react";
import { useMemo } from "react";
import { useData } from "../../services/useData";
import BirdEventsTable from "../PageContent/Programs/Captures/BirdEventsTable";
import type { BirdEvent } from "../../types";
import { modalPrimaryButtonProps } from "./modalDefaults";
import ModalShell, { ModalBodyShell, ModalFooterShell, ModalHeaderShell } from "./ModalShell";

interface ModificationHistoryModalProps {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  birdEvent: BirdEvent;
}

export default function ModificationHistoryModal({ isOpen, onOpenChange, birdEvent }: ModificationHistoryModalProps) {
  const { birdEventsMap } = useData();

  const birdEvents = useMemo(() => {
    // The referenced event may be missing from the live map (e.g. just
    // replaced by an offline modify) — bail out rather than crash.
    const event = birdEventsMap[birdEvent.id] ?? birdEvent;
    if (!event) return [] as BirdEvent[];

    const events: BirdEvent[] = [event];
    const seen = new Set<string>([event.id]);
    let currentEvent: BirdEvent | undefined = event;

    // Recursively follow the previousEventId chain (cycle-safe).
    while (currentEvent?.previousEventId && !seen.has(currentEvent.previousEventId)) {
      const previousEvent: BirdEvent | undefined = birdEventsMap[currentEvent.previousEventId];
      if (!previousEvent) break;
      seen.add(previousEvent.id);
      events.push(previousEvent);
      currentEvent = previousEvent;
    }

    return events.sort((a, b) => (a.updatedAt ?? "").localeCompare(b.updatedAt ?? ""));
  }, [birdEvent, birdEventsMap]);

  return (
    <ModalShell
      modalProps={{
        isDismissable: false,
        isOpen,
        onOpenChange,
        className: "!max-w-[calc(100%-8rem)]",
        scrollBehavior: "inside",
      }}
    >
      {(onClose) => (
        <>
            <ModalHeaderShell>
              <div className="flex flex-row items-center gap-1">
                Modification history of band <span className="font-bold">{birdEvent.band?.id}</span>
              </div>
            </ModalHeaderShell>
            <ModalBodyShell>
              {birdEvents.length > 0 ? (
                <BirdEventsTable
                  birdEvents={birdEvents}
                  maxTableHeight={400}
                  sortDescriptors={[]}
                  showHistory
                  hiddenColumns={["actions", "bandGroup", "bandLastTwoDigits"]}
                />
              ) : (
                <p>No history found for this band.</p>
              )}
            </ModalBodyShell>
            <ModalFooterShell>
              <Button {...modalPrimaryButtonProps} onPress={onClose}>
                Close
              </Button>
            </ModalFooterShell>
        </>
      )}
    </ModalShell>
  );
}
