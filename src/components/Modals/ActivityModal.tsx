import { useMemo, useState, useEffect } from "react";
import { Button, Chip, Switch } from "@heroui/react";
import { useData } from "../../services/useData";
import { getQueuedEvents } from "../../services/indexedDB";
import { logger, type LogEntry, LogLevel } from "../../services/logger";
import type { PendingEvent } from "../../types";
import CaptureHistoryModal from "./CaptureHistoryModal";
import { MagnifyingGlassIcon } from "@heroicons/react/16/solid";
import SpeciesTooltip from "../Helper/Info/SpeciesTooltip";
import { modalPrimaryButtonProps } from "./modalDefaults";
import ModalShell, { ModalBodyShell, ModalFooterShell, ModalHeaderShell } from "./ModalShell";

const ACTION_CATEGORIES = new Set([
  "AddBirdEvent",
  "AddProgram",
  "UpdateProgram",
  "SaveDET",
  "DismissConflict",
  "ResetDismissedConflicts",
  "UpdateBandSizeMap",
  "AddVolunteer",
  "UpdateVolunteerName",
  "SyncQueue",
]);

function getCategoryColor(category: string): "success" | "primary" | "secondary" | "warning" | "danger" | "default" {
  switch (category) {
    case "AddBirdEvent": return "success";
    case "AddProgram": return "primary";
    case "UpdateProgram": return "warning";
    case "SaveDET": return "secondary";
    case "DismissConflict":
    case "ResetDismissedConflicts": return "danger";
    case "AddVolunteer":
    case "UpdateVolunteerName": return "primary";
    case "SyncQueue": return "default";
    default: return "default";
  }
}

function getCategoryLabel(category: string): string {
  switch (category) {
    case "AddBirdEvent": return "Capture";
    case "AddProgram": return "New Program";
    case "UpdateProgram": return "Edit Program";
    case "SaveDET": return "DET";
    case "DismissConflict": return "Dismiss Error";
    case "ResetDismissedConflicts": return "Reset Errors";
    case "UpdateBandSizeMap": return "Band Size";
    case "AddVolunteer": return "New Volunteer";
    case "UpdateVolunteerName": return "Edit Volunteer";
    case "SyncQueue": return "Sync";
    default: return category;
  }
}

function formatTime(timestamp: number): string {
  const diff = Date.now() - timestamp;
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);

  if (minutes < 1) return "Just now";
  if (minutes < 60) return `${minutes}m ago`;
  if (hours < 24) return `${hours}h ago`;
  if (days === 1) return "1 day ago";
  return `${days} days ago`;
}

interface ActivityModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function ActivityModal({ isOpen, onClose }: ActivityModalProps) {
  const { birdEventsMap, pendingCount, isOnline, isAdmin, forceOffline, setForceOffline, syncQueue } = useData();
  const [logs, setLogs] = useState<LogEntry[]>(logger.getLogs());
  const [queuedEvents, setQueuedEvents] = useState<PendingEvent[]>([]);
  const [selectedBandId, setSelectedBandId] = useState<string | null>(null);
  const [selectedBirdEventId, setSelectedBirdEventId] = useState<string | null>(null);
  const [isCaptureHistoryModalOpen, setIsCaptureHistoryModalOpen] = useState(false);

  useEffect(() => {
    const unsubscribe = logger.subscribe(setLogs);
    return () => { unsubscribe(); };
  }, []);

  useEffect(() => {
    if (!isOpen) return;
    getQueuedEvents().then(setQueuedEvents).catch(console.error);
  }, [isOpen, pendingCount]);

  const recentActions = useMemo(() => {
    return logs
      .filter((log) => ACTION_CATEGORIES.has(log.category) && log.level === LogLevel.INFO)
      .slice(-50)
      .reverse();
  }, [logs]);

  const handleBirdEventClick = (log: LogEntry) => {
    const data = log.data as Record<string, string> | undefined;
    const eventId = data?.eventId;
    if (!eventId) return;

    const event = birdEventsMap[eventId];
    if (event?.band) {
      setSelectedBandId(event.band.id);
      setSelectedBirdEventId(eventId);
      setIsCaptureHistoryModalOpen(true);
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
          <div className="flex justify-between items-center w-full">
            <div>
              <h2 className="text-xl">Activity</h2>
              <p className="text-sm text-default-600 font-light">
                {isOnline ? "Online" : "Offline"}
                {pendingCount > 0 && ` · ${pendingCount} pending`}
              </p>
            </div>
            <div className="flex items-center gap-3">
              <Switch size="sm" isSelected={forceOffline} onValueChange={setForceOffline}>
                Force Offline
              </Switch>
              {isOnline && isAdmin && pendingCount > 0 && (
                <Button color="primary" variant="flat" size="sm" onPress={() => syncQueue()}>
                  Sync Now
                </Button>
              )}
            </div>
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
                        <span className="text-default-500">
                          {pending.pendingEvent.date} {pending.pendingEvent.time}
                        </span>
                      </>
                    ) : (
                      <>
                        <span className="font-bold">{pending.det.date}</span>
                        <span className="text-default-500">{pending.det.programId}</span>
                      </>
                    )}
                    <span className="ml-auto text-xs text-warning-600">pending</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Recent actions */}
          <div>
            {queuedEvents.length > 0 && <p className="text-sm font-semibold mb-2">Recent Actions</p>}
            <div className="flex flex-col gap-1">
              {recentActions.map((log) => {
                const data = log.data as Record<string, string> | undefined;
                const isBirdEvent = log.category === "AddBirdEvent" && data?.eventId;
                const event = isBirdEvent ? birdEventsMap[data.eventId] : null;

                return (
                  <div
                    key={log.id}
                    className={`h-10 px-3 border border-default-200 rounded-medium flex items-center gap-3 text-sm transition-colors ${
                      isBirdEvent ? "hover:bg-default-100 cursor-pointer" : ""
                    }`}
                    onClick={isBirdEvent ? () => handleBirdEventClick(log) : undefined}
                  >
                    {isBirdEvent && <MagnifyingGlassIcon className="w-4 h-4 text-default-400 flex-shrink-0" />}
                    <Chip size="sm" variant="flat" color={getCategoryColor(log.category)}>
                      {getCategoryLabel(log.category)}
                    </Chip>

                    {event ? (
                      <>
                        <span className="font-bold">
                          {event.band?.bandGroupId}{event.band?.last2digits}
                        </span>
                        <span className="font-bold">
                          <SpeciesTooltip speciesCode={event.species} />
                        </span>
                        <span className="text-default-500">{event.date} {event.time}</span>
                      </>
                    ) : (
                      <span className="text-default-700 truncate">{log.message}</span>
                    )}

                    <span className="ml-auto text-default-400 text-xs whitespace-nowrap">
                      {formatTime(log.timestamp)}
                    </span>
                  </div>
                );
              })}

              {recentActions.length === 0 && (
                <div className="text-center text-default-500 py-8">No recent activity</div>
              )}
            </div>
          </div>
        </ModalBodyShell>

        <ModalFooterShell>
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
