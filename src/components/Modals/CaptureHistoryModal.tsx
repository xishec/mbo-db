import { Modal, ModalBody, ModalContent, ModalFooter, ModalHeader, Button } from "@heroui/react";
import { useMemo } from "react";
import { useData } from "../../services/useData";
import BirdEventsTable from "../PageContent/Programs/Captures/BirdEventsTable";
import SpeciesRangeTable from "../PageContent/Programs/Captures/SpeciesRangeTable";
import { findConflictsInEvents } from "../../types/conflicts";

interface CaptureHistoryModalProps {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  bandId: string | null;
  birdEventIdToHighlight?: string;
}

export default function CaptureHistoryModal({
  isOpen,
  onOpenChange,
  bandId,
  birdEventIdToHighlight,
}: CaptureHistoryModalProps) {
  const { bandIdToBirdEventIdsMap, birdEventsMap, magicTable } = useData();

  const birdEvents = useMemo(() => {
    if (!bandId) return [];
    const eventIds = bandIdToBirdEventIdsMap[bandId] || [];
    return eventIds
      .map((id) => birdEventsMap[id])
      .filter(Boolean)
      .filter((event) => event.modifiedEventId == null);
  }, [bandId, bandIdToBirdEventIdsMap, birdEventsMap]);

  const birdInfo = useMemo(() => {
    if (birdEvents.length === 0) return null;

    // Sort events by date (most recent first)
    const sortedEvents = [...birdEvents].sort((a, b) => {
      const dateCompare = b.date.localeCompare(a.date);
      if (dateCompare !== 0) return dateCompare;
      return b.time.localeCompare(a.time);
    });

    const mostRecentEvent = sortedEvents[0];
    const oldestEvent = sortedEvents[sortedEvents.length - 1];
    const hasRecaptures = birdEvents.length > 1;

    // Calculate dates upfront
    const mostRecentDate = new Date(mostRecentEvent.date);
    const oldestDate = new Date(oldestEvent.date);

    // Determine latest recapture status
    let latestRecapture: "never" | "< 6 months" | "> 6 months" = "never";
    if (hasRecaptures) {
      const sixMonthsAgo = new Date();
      sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
      latestRecapture = mostRecentDate >= sixMonthsAgo ? "< 6 months" : "> 6 months";
    }

    // Calculate capture span
    let captureSpan = "Single capture";
    if (hasRecaptures) {
      const spanMs = mostRecentDate.getTime() - oldestDate.getTime();
      const spanDays = Math.floor(spanMs / (1000 * 60 * 60 * 24));

      if (spanDays === 0) {
        captureSpan = "Same day";
      } else {
        captureSpan = `${spanDays} day${spanDays !== 1 ? "s" : ""}`;
      }
    }

    return {
      captureSpan,
      hasRecaptures,
      latestRecapture,
      totalCaptures: birdEvents.length,
      species: mostRecentEvent.species,
    };
  }, [birdEvents]);

  const pyleSpeciesRange = useMemo(() => {
    if (!birdInfo || birdInfo.species.length !== 4 || !magicTable || !magicTable.pyle) return null;
    return magicTable.pyle[birdInfo.species] || null;
  }, [birdInfo, magicTable]);

  const mboSpeciesRange = useMemo(() => {
    if (!birdInfo || birdInfo.species.length !== 4 || !magicTable || !magicTable.mbo) return null;
    return magicTable.mbo[birdInfo.species] || null;
  }, [birdInfo, magicTable]);

  const conflicts = useMemo(() => {
    return findConflictsInEvents(birdEvents);
  }, [birdEvents]);

  return (
    <Modal
      isKeyboardDismissDisabled
      isOpen={isOpen}
      onOpenChange={onOpenChange}
      className={`!max-w-[calc(100%-8rem)]`}
      scrollBehavior="inside"
    >
      <ModalContent>
        {(onClose) => (
          <>
            <ModalHeader className="flex flex-row items-center gap-1 p-8 pb-0 font-normal">
              History of band : <span className="font-bold">{bandId}</span>
            </ModalHeader>
            <ModalBody className="gap-4 px-8 py-4">
              {birdInfo && (
                <div className="bg-default-100 rounded-lg p-4 mb-2">
                  <h3 className="text-lg font-semibold mb-3">Bird Information</h3>
                  <div className="grid grid-cols-5 gap-4 text-sm">
                    <div>
                      <span className="text-default-700">Band ID :</span> <span className="font-medium">{bandId}</span>
                    </div>
                    <div>
                      <span className="text-default-700">Species :</span>{" "}
                      <span className="font-medium">{birdInfo.species}</span>
                    </div>
                    <div>
                      <span className="text-default-700">Total Captures :</span>{" "}
                      <span className="font-medium">{birdInfo.totalCaptures}</span>
                    </div>
                    <div>
                      <span className="text-default-700">Capture Span :</span>{" "}
                      <span className="font-medium">{birdInfo.captureSpan}</span>
                    </div>
                    <div>
                      <span className="text-default-700">Latest Recapture :</span>{" "}
                      {birdInfo.latestRecapture === "never" ? (
                        <span className="font-medium text-default-400">Never</span>
                      ) : birdInfo.latestRecapture === "< 6 months" ? (
                        <span className="font-medium">{`< 6 months`}</span>
                      ) : (
                        <span className="font-medium">{`> 6 months`}</span>
                      )}
                    </div>
                  </div>
                </div>
              )}
              {birdInfo && birdInfo.species.length === 4 && (pyleSpeciesRange || mboSpeciesRange) && (
                <div className="flex gap-4">
                  <SpeciesRangeTable title="Pyle" speciesCode={birdInfo.species} speciesRange={pyleSpeciesRange} />
                  <SpeciesRangeTable title="MBO" speciesCode={birdInfo.species} speciesRange={mboSpeciesRange} />
                </div>
              )}
              {conflicts.length > 0 && (
                <div className="text-sm bg-danger-50 border border-danger rounded-lg p-4">
                  <h4 className="font-semibold text-danger mb-2">Conflicts Detected :</h4>
                  <ul className="list-disc list-inside">
                    {conflicts.map((conflict, idx) => (
                      <li key={idx} className="text-danger">
                        {conflict.reason}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              {birdEvents.length > 0 ? (
                <BirdEventsTable
                  birdEvents={birdEvents}
                  maxTableHeight={500}
                  allowInspectHistory
                  hiddenColumns={["bandGroup", "bandLastTwoDigits"]}
                  birdEventIdToHighlight={birdEventIdToHighlight}
                />
              ) : (
                <p>No captures found for this band.</p>
              )}
            </ModalBody>
            <ModalFooter className="gap-4 p-8 pt-4">
              <Button color="primary" onPress={onClose}>
                Close
              </Button>
            </ModalFooter>
          </>
        )}
      </ModalContent>
    </Modal>
  );
}
