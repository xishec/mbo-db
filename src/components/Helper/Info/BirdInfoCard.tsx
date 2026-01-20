import { formatSpanDays } from "./formatSpanDays";
import SpeciesTooltip from "./SpeciesTooltip";

interface BirdInfo {
  captureSpan: string;
  captureSpanDays: number;
  hasRecaptures: boolean;
  latestRecapture: "never" | "< 6 months" | "> 6 months";
  totalCaptures: number;
  species: string;
  earliestDate: string;
  latestDate: string;
}

interface BirdInfoCardProps {
  bandId: string | null;
  birdInfo: BirdInfo;
}

export default function BirdInfoCard({ bandId, birdInfo }: BirdInfoCardProps) {
  return (
    <div className="bg-default-100 rounded-medium p-4 mb-2">
      <h3 className="text-lg mb-3">Bird Information</h3>
      <div className="flex justify-between text-sm">
        <div>
          <span className="text-default-700">Band ID :</span> <span className="font-medium">{bandId}</span>
        </div>
        <div>
          <span className="text-default-700">Species :</span>{" "}
          <span className="font-medium">
            <SpeciesTooltip speciesCode={birdInfo.species} />
          </span>
        </div>
        <div>
          <span className="text-default-700">Total Captures :</span>{" "}
          <span className="font-medium">{birdInfo.totalCaptures}</span>
        </div>
        <div>
          <span className="text-default-700">Capture Span :</span>{" "}
          <span className="font-medium">{formatSpanDays(birdInfo.captureSpanDays)}</span>
        </div>
        <div>
          <span className="text-default-700">Latest Recapture :</span>{" "}
          {birdInfo.latestRecapture === "never" ? (
            <span className="font-medium">n/a</span>
          ) : birdInfo.latestRecapture === "< 6 months" ? (
            <span className="font-medium">{`< 6 months`}</span>
          ) : (
            <span className="font-medium">{`> 6 months`}</span>
          )}
        </div>
      </div>
    </div>
  );
}
