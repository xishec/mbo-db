import { Select, SelectItem } from "@heroui/react";
import { TABLE_COLUMNS } from "../../PageContent/Programs/Captures/helpers";
import type { CaptureColumn } from "../../../types";
import { Band, BandSize, getBandGroupMapKey } from "../../../types";

const EXCLUDED_KEYS = new Set([
  "actions",
  "updatedAt",
  "notes",
  "date",
  "time",
  "bander",
  "scribe",
  "birdStatus",
  "programId",
]);

interface MeasurementRowProps {
  renderTableCell: (column: CaptureColumn) => React.ReactNode;
  selectedBandSize?: BandSize;
  onBandSizeChange?: (size: BandSize) => void;
  isSaving?: boolean;
  bandSizeToBandIdMap?: Record<string, string>;
}

export default function MeasurementRow({
  renderTableCell,
  selectedBandSize,
  onBandSizeChange,
  isSaving,
  bandSizeToBandIdMap,
}: MeasurementRowProps) {
  return (
    <div className="flex gap-1">
      {/* Band Size dropdown */}
      {selectedBandSize !== undefined && onBandSizeChange && (
        <div className="flex flex-col gap-1 shrink-0" style={{ width: "200px" }}>
          <span className="text-xs text-default-900 font-medium px-1 truncate">Band Size</span>
          <Select
            variant="bordered"
            aria-label="Band Size"
            selectedKeys={[selectedBandSize]}
            onSelectionChange={(keys) => {
              const value = Array.from(keys)[0] as BandSize;
              onBandSizeChange(value);
            }}
            isDisabled={isSaving}
            classNames={{
            }}
          >
            {Object.values(BandSize).map((size) => {
              const bandId = bandSizeToBandIdMap?.[size];
              let description = "-";

              if (size !== BandSize.Other && bandId && bandId.length === 9) {
                const band = new Band(bandId.slice(0, 4), bandId.slice(4, 9));
                const bandGroupId = getBandGroupMapKey(band);
                description = `${bandGroupId}-${band.last2digits}`;
              }

              return (
                <SelectItem key={size} description={description}>
                  {size}
                </SelectItem>
              );
            })}
          </Select>
        </div>
      )}

      {TABLE_COLUMNS.filter((column) => !EXCLUDED_KEYS.has(column.key)).map((column) => {
        const cellContent = renderTableCell(column);
        if (cellContent === null) return null;

        return (
          <div
            key={column.key}
            className="flex flex-col gap-1 shrink-0"
            style={{ width: column.inputClassName?.match(/w-\[(\d+px)\]/)?.[1] ?? "auto" }}
          >
            <span className="text-xs text-default-900 font-medium px-1 truncate">
              {column.key === "howAged" || column.key === "howSexed" ? "How" : column.label}
            </span>
            {cellContent}
          </div>
        );
      })}
    </div>
  );
}
