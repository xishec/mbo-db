import { Card, CardBody } from "@heroui/react";
import { useState } from "react";
import type { SpeciesInfo } from "../../../types";
import { formatSpanDays } from "./formatSpanDays";
import SpeciesTooltip from "./SpeciesTooltip";
import CaptureHistoryModal from "../../Modals/CaptureHistoryModal";

interface SpeciesFunFactsProps {
  speciesCode: string;
  speciesInfo: SpeciesInfo | null;
  currentBandId?: string | null; // Band ID currently being viewed
  disabled?: boolean;
  className?: string;
}

export default function SpeciesFunFacts({
  speciesCode,
  speciesInfo,
  currentBandId = null,
  disabled = false,
  className,
}: SpeciesFunFactsProps) {
  const containerClassName = className ? `flex flex-col h-full ${className}` : "flex flex-col h-full";
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedBandId, setSelectedBandId] = useState<string | null>(null);
  const [eventIdToHighlight, setEventIdToHighlight] = useState<string | undefined>(undefined);

  const handleStatClick = (bandId: string, eventId?: string) => {
    // Prevent opening modal if it's the current bird.
    if (bandId === currentBandId) {
      return;
    }
    setSelectedBandId(bandId);
    setEventIdToHighlight(eventId);
    setIsModalOpen(true);
  };

  const statItemClass = "text-xs rounded p-2 -m-2 transition-colors";

  const getStatItemClass = (bandId: string) =>
    bandId === currentBandId
      ? `${statItemClass} cursor-not-allowed text-default-500`
      : `${statItemClass} cursor-pointer hover:bg-default-100`;

  const renderCurrentBirdNote = (bandId: string) =>
    bandId === currentBandId ? <span className="text-xs ml-2">(current bird, not clickable)</span> : null;

  if (!speciesInfo) {
    return (
      <div className={`${containerClassName} border border-default-200 rounded-medium p-3`}>
        <h4 className="text-sm font-bold mb-2">
          Species Info:{" "}
          <span className="font-normal">
            <SpeciesTooltip speciesCode={speciesCode} disabled={disabled} />
          </span>
        </h4>
        <p className="text-sm text-default-400">No data available</p>
      </div>
    );
  }

  const formatRate = (rate: number): string => {
    if (rate === 0) return "N/A";
    return `${rate.toFixed(2)}x average`;
  };

  const biggest = speciesInfo.biggest;
  const fattest = speciesInfo.fattest;
  const dummiest = speciesInfo.dummiest;
  const oldest = speciesInfo.oldest;

  return (
    <>
      <div className={containerClassName}>
        <h4 className="text-sm mb-2">
          <SpeciesTooltip speciesCode={speciesCode} disabled={disabled} /> records - {speciesInfo.totalCaptures} captures
        </h4>
        <Card className="flex-1 flex flex-col" shadow="sm">
          <CardBody className="gap-2 p-4 flex-1">
            <div className="grid grid-cols-2 gap-4">
              <div
                className={getStatItemClass(biggest.band.id)}
                onClick={() => handleStatClick(biggest.band.id, biggest.id)}
              >
                <div className="font-semibold text-default-900 mb-1">Biggest</div>
                <div className="text-default-700">
                  {biggest.wing} mm
                  {renderCurrentBirdNote(biggest.band.id)}
                </div>
              </div>
              <div
                className={getStatItemClass(fattest.band.id)}
                onClick={() => handleStatClick(fattest.band.id, fattest.id)}
              >
                <div className="font-semibold text-default-900 mb-1">Fattest</div>
                <div className="text-default-700">
                  Fat {fattest.fat}, {fattest.weight}g
                  {renderCurrentBirdNote(fattest.band.id)}
                </div>
              </div>
              <div
                className={getStatItemClass(dummiest.band.id)}
                onClick={() => handleStatClick(dummiest.band.id)}
              >
                <div className="font-semibold text-default-900 mb-1">Dummiest</div>
                <div className="text-default-700">
                  {speciesInfo.dummiestCount} time{speciesInfo.dummiestCount !== 1 ? "s" : ""}
                  {renderCurrentBirdNote(dummiest.band.id)}
                </div>
              </div>
              {speciesInfo.oldest && speciesInfo.oldestSpanDays >= 0 ? (
                <div
                  className={getStatItemClass(oldest?.band.id ?? "")}
                  onClick={() => oldest && handleStatClick(oldest.band.id)}
                >
                  <div className="font-semibold text-default-900 mb-1">Oldest</div>
                  <div className="text-default-700">
                    {formatSpanDays(speciesInfo.oldestSpanDays, false)}
                    {oldest ? renderCurrentBirdNote(oldest.band.id) : null}
                  </div>
                </div>
              ) : (
                <div className="text-xs">
                  <div className="font-semibold text-default-900 mb-1">Oldest Individual</div>
                  <div className="text-default-700">n/a</div>
                </div>
              )}
              <div className="text-xs">
                <div className="font-semibold text-default-900 mb-1">Favorite Bander</div>
                <div className="text-default-700">
                  {speciesInfo.favoriteBander || "N/A"}
                  {speciesInfo.favoriteBander && speciesInfo.favoriteBanderRate > 0 && (
                    <span className="ml-1">({formatRate(speciesInfo.favoriteBanderRate)})</span>
                  )}
                </div>
              </div>
              <div className="text-xs">
                <div className="font-semibold text-default-900 mb-1">Favorite Net</div>
                <div className="text-default-700">
                  {speciesInfo.favoriteNet || "N/A"}
                  {speciesInfo.favoriteNet && speciesInfo.favoriteNetRate > 0 && (
                    <span className="ml-1">({formatRate(speciesInfo.favoriteNetRate)})</span>
                  )}
                </div>
              </div>
            </div>
          </CardBody>
        </Card>
      </div>
      <CaptureHistoryModal
        isOpen={isModalOpen}
        onOpenChange={setIsModalOpen}
        bandId={selectedBandId}
        birdEventIdToHighlight={eventIdToHighlight}
      />
    </>
  );
}
