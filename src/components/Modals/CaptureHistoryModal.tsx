import { Modal, ModalBody, ModalContent, ModalFooter, ModalHeader, Button } from "@heroui/react";
import { useMemo } from "react";
import { useData } from "../../services/useData";
import BirdEventsTable from "../PageContent/Programs/Captures/BirdEventsTable";
import SpeciesRangeTable from "../PageContent/Programs/Captures/SpeciesRangeTable";
import SpeciesInfoCard from "../Helper/SpeciesInfoCard";
import { findErrorsInEvents } from "../../types/birdEventErrors";
import ValidationMessages from "../Helper/ValidationMessages";
import SpeciesPopover from "../Helper/SpeciesPopover";
import { modalBodyClass, modalFooterClass, modalHeaderClass, modalPrimaryButtonProps } from "./modalDefaults";

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
  const { bandIdToBirdEventIdsMap, birdEventsMap, magicTable, speciesInfoMap } = useData();

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
    
    // Sort events chronologically for span calculation
    const chronologicalEvents = [...birdEvents].sort((a, b) => {
      const dateCompare = a.date.localeCompare(b.date);
      if (dateCompare !== 0) return dateCompare;
      return a.time.localeCompare(b.time);
    });
    
    const earliestEvent = chronologicalEvents[0];
    const latestEvent = chronologicalEvents[chronologicalEvents.length - 1];
    const hasRecaptures = birdEvents.length > 1;

    // Calculate dates upfront
    const mostRecentDate = new Date(mostRecentEvent.date);
    const earliestDate = new Date(earliestEvent.date);
    const latestDate = new Date(latestEvent.date);

    // Determine latest recapture status
    let latestRecapture: "never" | "< 6 months" | "> 6 months" = "never";
    if (hasRecaptures) {
      const sixMonthsAgo = new Date();
      sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
      latestRecapture = mostRecentDate >= sixMonthsAgo ? "< 6 months" : "> 6 months";
    }

    // Calculate capture span (from earliest to latest)
    let captureSpan = "Single capture";
    let captureSpanDays = 0;
    if (hasRecaptures) {
      const spanMs = latestDate.getTime() - earliestDate.getTime();
      captureSpanDays = Math.floor(spanMs / (1000 * 60 * 60 * 24));

      if (captureSpanDays === 0) {
        captureSpan = "Same day";
      } else if (captureSpanDays < 365) {
        captureSpan = `${captureSpanDays} day${captureSpanDays !== 1 ? "s" : ""}`;
      } else {
        const years = Math.floor(captureSpanDays / 365);
        const days = captureSpanDays % 365;
        if (days === 0) {
          captureSpan = `${years} year${years !== 1 ? "s" : ""}`;
        } else {
          captureSpan = `${years} year${years !== 1 ? "s" : ""}, ${days} day${days !== 1 ? "s" : ""}`;
        }
      }
    }

    return {
      captureSpan,
      captureSpanDays,
      hasRecaptures,
      latestRecapture,
      totalCaptures: birdEvents.length,
      species: mostRecentEvent.species,
      earliestDate: earliestEvent.date,
      latestDate: latestEvent.date,
    };
  }, [birdEvents]);

  const pyleSpeciesRange = useMemo(() => {
    if (!birdInfo || birdInfo.species.length !== 4 || !magicTable || !magicTable.pyle) return null;
    return magicTable.pyle[birdInfo.species] || null;
  }, [birdInfo, magicTable]);

  const errors = useMemo(() => {
    return findErrorsInEvents(birdEvents, magicTable);
  }, [birdEvents, magicTable]);

  return (
    <Modal
      isDismissable
      isOpen={isOpen}
      onOpenChange={onOpenChange}
      className={`!max-w-[calc(100%-8rem)]`}
      scrollBehavior="inside"
    >
      <ModalContent>
        {(onClose) => (
          <>
            <ModalHeader className={modalHeaderClass}>
              <div className="flex flex-row items-center gap-1">
                History of band : <span className="font-bold">{bandId}</span>
              </div>
            </ModalHeader>
            <ModalBody className={modalBodyClass}>
              {birdInfo && (
                <div className="bg-default-100 rounded-medium p-4 mb-2">
                  <h3 className="text-lg font-semibold mb-3">Bird Information</h3>
                  <div className="grid grid-cols-5 gap-4 text-sm">
                    <div>
                      <span className="text-default-700">Band ID :</span> <span className="font-medium">{bandId}</span>
                    </div>
                    <div>
                      <span className="text-default-700">Species :</span>{" "}
                      <span className="font-medium">
                        <SpeciesPopover speciesCode={birdInfo.species}>{birdInfo.species}</SpeciesPopover>
                      </span>
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
                        <span className="font-medium">None</span>
                      ) : birdInfo.latestRecapture === "< 6 months" ? (
                        <span className="font-medium">{`< 6 months`}</span>
                      ) : (
                        <span className="font-medium">{`> 6 months`}</span>
                      )}
                    </div>
                  </div>
                </div>
              )}
              {birdInfo && birdInfo.species.length === 4 && (
                <div className="flex gap-4">
                  {pyleSpeciesRange && (
                    <SpeciesRangeTable title="Pyle" speciesCode={birdInfo.species} speciesRange={pyleSpeciesRange} />
                  )}
                  <SpeciesInfoCard 
                    speciesCode={birdInfo.species} 
                    speciesInfo={speciesInfoMap[birdInfo.species] || null} 
                  />
                </div>
              )}
              <ValidationMessages
                messages={errors.map((e) => ({ text: e.reason, severity: e.severity }))}
                title="Errors Detected:"
              />
              {birdEvents.length > 0 ? (
                <BirdEventsTable
                  birdEvents={birdEvents}
                  maxTableHeight={300}
                  allowInspectHistory
                  hiddenColumns={["bandGroup", "bandLastTwoDigits"]}
                  birdEventIdToHighlight={birdEventIdToHighlight}
                />
              ) : (
                <p>No captures found for this band.</p>
              )}
            </ModalBody>
            <ModalFooter className={modalFooterClass}>
              <Button {...modalPrimaryButtonProps} onPress={onClose}>
                Close
              </Button>
            </ModalFooter>
          </>
        )}
      </ModalContent>
    </Modal>
  );
}
