import { TABLE_COLUMNS } from "../../PageContent/Programs/Captures/helpers";
import type { CaptureColumn } from "../../../types";

const EXCLUDED_KEYS = new Set([
  "actions",
  "updatedAt",
  "notes",
  "date",
  "time",
  "bander",
  "scribe",
  "birdStatus",
]);

interface MeasurementRowProps {
  renderTableCell: (column: CaptureColumn) => React.ReactNode;
}

export default function MeasurementRow({ renderTableCell }: MeasurementRowProps) {
  return (
    <div className="flex gap-1">
      {TABLE_COLUMNS.filter((column) => !EXCLUDED_KEYS.has(column.key)).map((column) => (
        <div
          key={column.key}
          className="flex flex-col gap-1 shrink-0"
          style={{ width: column.inputClassName?.match(/w-\[(\d+px)\]/)?.[1] ?? "auto" }}
        >
          <span className="text-xs text-default-900 font-medium px-1 truncate">
            {column.key === "howAged" || column.key === "howSexed" ? "How" : column.label}
          </span>
          {renderTableCell(column)}
        </div>
      ))}
    </div>
  );
}
