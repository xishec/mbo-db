import { Input } from "@heroui/react";
import { TABLE_COLUMNS } from "../../PageContent/Programs/Captures/helpers";
import { modalInputProps } from "../modalDefaults";
import type { CaptureColumn, CaptureFormData } from "../../../types";

const INCLUDED_KEYS = new Set(["bander", "scribe", "birdStatus"]);

const inputCls =
  "text-sm text-start [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none";

interface SessionRowProps {
  formData: CaptureFormData;
  setFormData: React.Dispatch<React.SetStateAction<CaptureFormData>>;
  isSaving: boolean;
  useCurrentTime: boolean;
  registerRef: (key: string, el: HTMLInputElement | null) => void;
  getTabIndex: (key: string) => number;
  focusNext: (key: string) => void;
  renderTableCell: (column: CaptureColumn) => React.ReactNode;
}

export default function SessionRow({
  formData,
  setFormData,
  isSaving,
  useCurrentTime,
  registerRef,
  getTabIndex,
  focusNext,
  renderTableCell,
}: SessionRowProps) {
  const dateParts = formData.date.split("-");
  const timeParts = formData.time.split(":");
  const disabled = isSaving || useCurrentTime;

  const subs = [
    {
      key: "date",
      label: "YYYY",
      w: "w-[75px]",
      value: dateParts[0] ?? "",
      maxLen: 4,
      onUpdate: (v: string) =>
        setFormData((p) => ({
          ...p,
          date: `${v}-${dateParts[1] ?? ""}-${dateParts[2] ?? ""}`.replace(/-+$/, ""),
        })),
    },
    {
      key: "date-month",
      label: "MM",
      w: "w-[50px]",
      value: dateParts[1] ?? "",
      maxLen: 2,
      onUpdate: (v: string) =>
        setFormData((p) => ({
          ...p,
          date: `${dateParts[0] ?? ""}-${v}-${dateParts[2] ?? ""}`.replace(/-+$/, ""),
        })),
    },
    {
      key: "date-day",
      label: "DD",
      w: "w-[50px]",
      value: dateParts[2] ?? "",
      maxLen: 2,
      onUpdate: (v: string) =>
        setFormData((p) => ({
          ...p,
          date: `${dateParts[0] ?? ""}-${dateParts[1] ?? ""}-${v}`,
        })),
    },
    {
      key: "time",
      label: "HH",
      w: "w-[50px]",
      value: timeParts[0] ?? "",
      maxLen: 2,
      onUpdate: (v: string) =>
        setFormData((p) => ({ ...p, time: `${v}:${timeParts[1] ?? ""}` })),
    },
    {
      key: "time-minute",
      label: "MM",
      w: "w-[50px]",
      value: timeParts[1] ?? "",
      maxLen: 2,
      onUpdate: (v: string) =>
        setFormData((p) => ({ ...p, time: `${timeParts[0] ?? ""}:${v}` })),
    },
  ];

  const notesColumn = TABLE_COLUMNS.find((c) => c.key === "notes");

  return (
    <div className="flex gap-1">
      {subs.map((s) => (
        <div key={s.key} className={`flex flex-col gap-1 shrink-0 ${s.w}`}>
          <span className="text-xs text-default-900 font-medium px-1 text-start">{s.label}</span>
          <Input
            ref={(el: HTMLInputElement | null) => registerRef(s.key, el)}
            {...modalInputProps}
            maxLength={s.maxLen}
            value={s.value}
            isDisabled={disabled}
            classNames={{ input: inputCls }}
            tabIndex={getTabIndex(s.key)}
            onFocus={(e) => (e.target as HTMLInputElement).select()}
            onChange={(e) => {
              const v = e.target.value.replace(/\D/g, "").slice(0, s.maxLen);
              s.onUpdate(v);
              if (v.length === s.maxLen) focusNext(s.key);
            }}
          />
        </div>
      ))}
      {TABLE_COLUMNS.filter((column) => INCLUDED_KEYS.has(column.key)).map((column) => (
        <div
          key={column.key}
          className="flex flex-col gap-1 shrink-0"
          style={{ width: column.inputClassName?.match(/w-\[(\d+px)\]/)?.[1] ?? "auto" }}
        >
          <span className="text-xs text-default-900 font-medium px-1 truncate">{column.label}</span>
          {renderTableCell(column)}
        </div>
      ))}
      {notesColumn && (
        <div className="flex flex-col gap-1 flex-1 min-w-0">
          <span className="text-xs text-default-900 font-medium px-1">Notes</span>
          {renderTableCell(notesColumn)}
        </div>
      )}
    </div>
  );
}
