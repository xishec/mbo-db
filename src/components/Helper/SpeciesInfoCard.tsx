import { Card, CardBody } from "@heroui/react";
import type { SpeciesInfo } from "../../types";
import SpeciesPopover from "./SpeciesPopover";

interface SpeciesInfoCardProps {
  speciesCode: string;
  speciesInfo: SpeciesInfo | null;
}

export default function SpeciesInfoCard({ speciesCode, speciesInfo }: SpeciesInfoCardProps) {
  if (!speciesInfo) {
    return (
      <div className="flex-1 border border-default-200 rounded-medium p-3">
        <h4 className="text-sm font-bold mb-2">
          Species Info: <span className="font-normal"><SpeciesPopover speciesCode={speciesCode}>{speciesCode}</SpeciesPopover></span>
        </h4>
        <p className="text-sm text-default-400">No data available</p>
      </div>
    );
  }

  const formatDate = (date: string) => {
    return new Date(date).toLocaleDateString();
  };

  return (
    <div className="flex-1">
      <h4 className="text-sm mb-2">
        <SpeciesPopover speciesCode={speciesCode}>{speciesCode}</SpeciesPopover> records
      </h4>
      <Card>
        <CardBody className="gap-2 p-3">
          <div className="text-xs">
            <div className="font-semibold text-default-600 mb-1">Biggest Wing</div>
            <div className="text-default-700">
              {speciesInfo.biggest.wing}mm on {formatDate(speciesInfo.biggest.date)}
            </div>
          </div>
          <div className="text-xs">
            <div className="font-semibold text-default-600 mb-1">Fattest</div>
            <div className="text-default-700">
              Fat {speciesInfo.fattest.fat}, {speciesInfo.fattest.weight}g on {formatDate(speciesInfo.fattest.date)}
            </div>
          </div>
          <div className="text-xs">
            <div className="font-semibold text-default-600 mb-1">Most Captures</div>
            <div className="text-default-700">
              {speciesInfo.dummiest.band.id} ({speciesInfo.dummiestCount} event{speciesInfo.dummiestCount !== 1 ? "s" : ""})
            </div>
          </div>
          <div className="text-xs">
            <div className="font-semibold text-default-600 mb-1">Oldest Individual</div>
            <div className="text-default-700">
              {speciesInfo.oldest && speciesInfo.oldestSpanDays >= 0
                ? `${speciesInfo.oldest.band.id} - ${speciesInfo.oldestSpanDays} day${speciesInfo.oldestSpanDays !== 1 ? "s" : ""} span`
                : "n/a"}
            </div>
          </div>
          <div className="text-xs">
            <div className="font-semibold text-default-600 mb-1">Favorite Bander</div>
            <div className="text-default-700">{speciesInfo.favoriteBander || "N/A"}</div>
          </div>
        </CardBody>
      </Card>
    </div>
  );
}
