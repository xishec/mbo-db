import { Tooltip } from "@heroui/react";
import type { ReactNode } from "react";
import { AGE_CODE_MAP } from "../../../types/ageCodes";

interface AgeTooltipProps {
  ageCode: string;
  disabled?: boolean;
  children?: ReactNode;
}

export default function AgeTooltip({ ageCode, disabled = false, children }: AgeTooltipProps) {
  const ageInfo = AGE_CODE_MAP[ageCode];
  const content = children ?? ageCode;

  if (disabled || !ageInfo) {
    return <span>{content}</span>;
  }

  const tooltipContent = (
    <div className="flex max-w-md flex-col gap-1 text-sm">
      <div>
        <span className="font-semibold">Meaning:</span> {ageInfo.alphaTranslation} ({ageInfo.alphaCode})
      </div>
      <div>
        <span className="font-semibold">Description:</span> {ageInfo.description}
      </div>
    </div>
  );

  return (
    <Tooltip content={tooltipContent} placement="right" closeDelay={50} className="max-w-md">
      <span className="cursor-pointer hover:underline">{content}</span>
    </Tooltip>
  );
}
