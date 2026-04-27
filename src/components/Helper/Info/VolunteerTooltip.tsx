import { Tooltip } from "@heroui/react";
import type { ReactNode } from "react";
import { useData } from "../../../services/useData";

interface VolunteerTooltipProps {
  volunteerCode: string;
  disabled?: boolean;
  children?: ReactNode;
}

export default function VolunteerTooltip({ volunteerCode, disabled = false, children }: VolunteerTooltipProps) {
  const { volunteersMap } = useData();
  const volunteer = volunteersMap?.[volunteerCode];
  const content = children ?? volunteerCode;

  if (disabled || !volunteer) {
    return <span>{content}</span>;
  }

  const tooltipContent = (
    <div className="flex max-w-md flex-col gap-1 text-sm">
      <div>
        <span className="font-semibold">{volunteer.fullName || "?"}</span>
      </div>
      <div>
        <span>Banded:</span> {volunteer.totalBanded} <span>Scribed:</span> {volunteer.totalScribed}
      </div>
    </div>
  );

  return (
    <Tooltip content={tooltipContent} placement="right" closeDelay={50} className="max-w-md">
      <span className="cursor-pointer hover:underline">{content}</span>
    </Tooltip>
  );
}
