import { Card, CardBody } from "@heroui/react";
import { useState } from "react";
import type { SpeciesInfo } from "../../types";
import SpeciesTooltip from "./SpeciesTooltip";
import CaptureHistoryModal from "../Modals/CaptureHistoryModal";

interface SpeciesInfoCardProps {
  speciesCode: string;
  speciesInfo: SpeciesInfo | null;
  currentBandId?: string | null; // Band ID currently being viewed
}

export default function SpeciesInfoCard({
  speciesCode,
  speciesInfo,
  currentBandId = null
}: SpeciesInfoCardProps) {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedBandId, setSelectedBandId] = useState<string | null>(null);
  const [eventIdToHighlight, setEventIdToHighlight] = useState<string | undefined>(undefined);

  const handleStatClick = (bandId: string, eventId?: string) => {
    // Prevent opening modal if it's the current bird
    if (bandId === currentBandId) {
      return;
    }
    setSelectedBandId(bandId);
    setEventIdToHighlight(eventId);
    setIsModalOpen(true);
  };

  if (!speciesInfo) {
    return (
      <div className="flex-1 border border-default-200 rounded-medium p-3">
        <h4 className="text-sm font-bold mb-2">
          Species Info: <span className="font-normal"><SpeciesTooltip speciesCode={speciesCode} showInfoCardOnClick={false}>{speciesCode}</SpeciesTooltip></span>
        </h4>
        <p className="text-sm text-default-400">No data available</p>
      </div>
    );
  }

  const formatRate = (rate: number): string => {
    if (rate === 0) return "N/A";
    return `${rate.toFixed(2)}x average`;
  };

  return (
    <>
      <div className="flex-1">
        <h4 className="text-sm mb-2">
          <SpeciesTooltip speciesCode={speciesCode} showInfoCardOnClick={false}>{speciesCode}</SpeciesTooltip> records
        </h4>
        <Card>
          <CardBody className="gap-2 p-3">
            <div className="grid grid-cols-2 gap-2">
              <div
                className="text-xs cursor-pointer hover:bg-default-100 rounded p-1 -m-1 transition-colors"
                onClick={() => speciesInfo.biggest.band.id !== currentBandId && handleStatClick(speciesInfo.biggest.band.id, speciesInfo.biggest.id)}
              >
                <div className="font-semibold text-default-900 mb-1">Biggest</div>
                <div className="text-default-700">
                  {speciesInfo.biggest.wing}mm by {speciesInfo.biggest.band.id}
                  {speciesInfo.biggest.band.id === currentBandId && <span className="text-xs ml-2">(current bird)</span>}
                </div>
              </div>
              <div
                className="text-xs cursor-pointer hover:bg-default-100 rounded p-1 -m-1 transition-colors"
                onClick={() => speciesInfo.fattest.band.id !== currentBandId && handleStatClick(speciesInfo.fattest.band.id, speciesInfo.fattest.id)}
              >
                <div className="font-semibold text-default-900 mb-1">Fattest</div>
                <div className="text-default-700">
                  Fat {speciesInfo.fattest.fat}, {speciesInfo.fattest.weight}g by {speciesInfo.fattest.band.id}
                  {speciesInfo.fattest.band.id === currentBandId && <span className="text-xs ml-2">(current bird)</span>}
                </div>
              </div>
              <div
                className="text-xs cursor-pointer hover:bg-default-100 rounded p-1 -m-1 transition-colors"
                onClick={() => speciesInfo.dummiest.band.id !== currentBandId && handleStatClick(speciesInfo.dummiest.band.id)}
              >
                <div className="font-semibold text-default-900 mb-1">Dummiest</div>
                <div className="text-default-700">
                  {speciesInfo.dummiestCount} time{speciesInfo.dummiestCount !== 1 ? "s" : ""} by {speciesInfo.dummiest.band.id}
                  {speciesInfo.dummiest.band.id === currentBandId && <span className="text-xs ml-2">(current bird)</span>}
                </div>
              </div>
              {speciesInfo.oldest && speciesInfo.oldestSpanDays >= 0 ? (
                <div
                  className="text-xs cursor-pointer hover:bg-default-100 rounded p-1 -m-1 transition-colors"
                  onClick={() => speciesInfo.oldest && speciesInfo.oldest.band.id !== currentBandId && handleStatClick(speciesInfo.oldest.band.id)}
                >
                  <div className="font-semibold text-default-900 mb-1">Oldest</div>
                  <div className="text-default-700">
                    {speciesInfo.oldestSpanDays} day{speciesInfo.oldestSpanDays !== 1 ? "s" : ""} by {speciesInfo.oldest.band.id}
                    {speciesInfo.oldest.band.id === currentBandId && <span className="text-xs ml-2">(current bird)</span>}
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
