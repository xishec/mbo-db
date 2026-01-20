import { Button } from "@heroui/react";
import { useMemo } from "react";
import { useData } from "../../services/useData";
import BirdEventsTable from "../PageContent/Programs/Captures/BirdEventsTable";
import PyleAndFunFacts from "../Helper/Info/PyleAndFunFacts";
import { findErrorsInEvents } from "../../types/birdEventErrors";
import ValidationMessages from "../Helper/ValidationMessages";
import BirdInfoCard from "../Helper/Info/BirdInfoCard";
import { formatSpanDays } from "../Helper/Info/formatSpanDays";
import { modalPrimaryButtonProps } from "./modalDefaults";
import ModalShell, { ModalBodyShell, ModalFooterShell, ModalHeaderShell } from "./ModalShell";

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
    let captureSpan = "n/a";
    let captureSpanDays = 0;
    if (hasRecaptures) {
      const spanMs = latestDate.getTime() - earliestDate.getTime();
      captureSpanDays = Math.floor(spanMs / (1000 * 60 * 60 * 24));
      captureSpan = formatSpanDays(captureSpanDays, false);
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
    <ModalShell
      modalProps={{
        isDismissable: true,
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
              History of band : <span className="font-bold">{bandId}</span>
            </div>
          </ModalHeaderShell>
          <ModalBodyShell>
            {birdInfo && <BirdInfoCard bandId={bandId} birdInfo={birdInfo} />}
            {birdInfo && pyleSpeciesRange && (
              <PyleAndFunFacts
                speciesCode={birdInfo.species}
                pyleSpeciesRange={pyleSpeciesRange}
                speciesInfo={speciesInfoMap[birdInfo.species]}
                currentBandId={bandId}
              />
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
