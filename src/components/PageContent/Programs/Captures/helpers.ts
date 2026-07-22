import { type CaptureFormData, BirdEventType } from "../../../../types";
import { DEFAULT_BIRD_STATUS } from "../../../../types/birdStatus";
import { getLocalDateString } from "../../../../utils/dateUtils";

import type { CaptureColumn } from "../../../../types";

// Re-export for consumers that import from helpers
export { getRangesForSex as getApplicableRange } from "../../../../types/birdEventErrors";
export type { MeasurementRanges as ApplicableRange } from "../../../../types/birdEventErrors";

export const TABLE_COLUMNS: CaptureColumn[] = [
  { key: "actions", type: "", label: "Actions", tableClassName: "w-[75px]", inputClassName: "w-[75px]" },
  { key: "programId", type: "text", label: "Program", tableClassName: "w-[150px]", inputClassName: "w-[150px]" },
  {
    key: "net",
    type: "text",
    label: "Net",
    maxLength: 2,
    minLength: 2,
    tableClassName: "w-[50px]",
    inputClassName: "w-[75px]",
  },
  {
    key: "bandGroup",
    type: "number",
    label: "Band Group",
    maxLength: 7,
    minLength: 7,
    tableClassName: "w-[100px]",
    inputClassName: "w-[125px]",
  },
  {
    key: "bandLastTwoDigits",
    type: "number",
    label: "Digit",
    maxLength: 2,
    minLength: 2,
    tableClassName: "w-[75px]",
    inputClassName: "w-[75px]",
  },
  {
    key: "species",
    type: "text",
    label: "Species",
    maxLength: 4,
    minLength: 4,
    tableClassName: "w-[75px]",
    inputClassName: "w-[100px]",
  },
  { key: "birdEventType", type: "text", label: "Event Type", tableClassName: "w-[100px]", inputClassName: "w-[150px]" },
  { key: "date", type: "text", label: "Date", maxLength: 10, tableClassName: "w-[100px]", inputClassName: "" },
  { key: "time", type: "text", label: "Time", maxLength: 5, tableClassName: "w-[100px]", inputClassName: "" },
  {
    key: "wing",
    type: "number",
    label: "Wing",
    maxLength: 4,
    minLength: 2,
    tableClassName: "w-[75px]",
    inputClassName: "w-[75px]",
  },
  {
    key: "age",
    type: "number",
    label: "Age",
    maxLength: 1,
    minLength: 1,
    tableClassName: "w-[50px]",
    inputClassName: "w-[50px]",
  },
  {
    key: "howAged",
    type: "number",
    label: "How Aged",
    maxLength: 1,
    minLength: 1,
    tableClassName: "w-[50px]",
    inputClassName: "w-[50px]",
  },
  {
    key: "sex",
    type: "number",
    label: "Sex",
    maxLength: 1,
    minLength: 1,
    tableClassName: "w-[50px]",
    inputClassName: "w-[50px]",
  },
  {
    key: "howSexed",
    type: "number",
    label: "How Sexed",
    maxLength: 1,
    minLength: 1,
    tableClassName: "w-[50px]",
    inputClassName: "w-[50px]",
  },
  {
    key: "fat",
    type: "number",
    label: "Fat",
    maxLength: 1,
    minLength: 1,
    tableClassName: "w-[50px]",
    inputClassName: "w-[50px]",
  },
  {
    key: "weight",
    type: "number",
    label: "Weight",
    maxLength: 5,
    minLength: 2,
    tableClassName: "w-[75px]",
    inputClassName: "w-[75px]",
  },
  {
    key: "bander",
    type: "text",
    label: "Bander",
    maxLength: 3,
    minLength: 2,
    tableClassName: "w-[75px]",
    inputClassName: "w-[75px]",
  },
  {
    key: "scribe",
    type: "text",
    label: "Scribe",
    maxLength: 3,
    minLength: 2,
    tableClassName: "w-[75px]",
    inputClassName: "w-[75px]",
  },
  {
    key: "birdStatus",
    type: "number",
    label: "Status",
    maxLength: 3,
    minLength: 3,
    tableClassName: "w-[75px]",
    inputClassName: "w-[75px]",
  },
  { key: "updatedAt", type: "", label: "Updated", tableClassName: "w-[125px]" },
  { key: "notes", type: "text", label: "Notes", tableClassName: "w-[1000px]", inputClassName: "w-[75px]" },
];


export function isInRange(value: number, lower: number, upper: number): boolean | null {
  if (lower === 0 && upper === 0) return null;
  if (value === 0) return false;
  return value >= lower && value <= upper;
}

export function getDefaultFormData(programId: string): CaptureFormData {
  const now = new Date();
  const date = getLocalDateString(now);
  const time = now.toTimeString().slice(0, 5);

  return {
    programId: programId,
    bandGroup: "",
    bandLastTwoDigits: "",
    species: "",
    wing: "",
    age: "",
    howAged: "",
    sex: "",
    howSexed: "",
    fat: "",
    weight: "",
    date,
    time,
    bander: "",
    scribe: "",
    net: "",
    birdEventType: BirdEventType.None,
    birdStatus: DEFAULT_BIRD_STATUS,
    notes: "",
    reminder: undefined,
  };
}

export function formatFieldValue(field: keyof CaptureFormData, value: string): string {
  switch (field) {
    case "bandGroup": {
      return value.replace(/\D/g, "").slice(0, 7);
    }
    case "bandLastTwoDigits":
      return value.replace(/\D/g, "").slice(0, 2);
    case "species":
      return value
        .replace(/[^a-zA-Z]/g, "")
        .toUpperCase()
        .slice(0, 4);
    case "wing":
      return value.replace(/\D/g, "").slice(0, 4);
    case "age":
    case "howAged":
      return value.replace(/[^0-9]/g, "").slice(0, 1);
    case "sex":
    case "howSexed":
      return value
        .replace(/[^a-zA-Z0-9]/g, "")
        .toUpperCase()
        .slice(0, 1);
    case "fat":
      return value.replace(/\D/g, "").slice(0, 1);
    case "weight": {
      let formatted = value.replace(/[^0-9.]/g, "");
      const parts = formatted.split(".");
      if (parts.length > 2) {
        formatted = parts[0] + "." + parts.slice(1).join("");
      }
      if (parts.length === 2 && parts[1].length > 1) {
        formatted = parts[0] + "." + parts[1].slice(0, 1);
      }
      return formatted;
    }
    case "bander":
    case "scribe":
      return value
        .replace(/[^a-zA-Z]/g, "")
        .toUpperCase()
        .slice(0, 3);
    case "net":
      return value
        .replace(/[^a-zA-Z0-9]/g, "")
        .toUpperCase()
        .slice(0, 2);
    case "time":
      return value.slice(0, 5);
    case "date":
      return value.slice(0, 10);
    default:
      return value;
  }
}

// Helper to format updatedAt as "x days ago"
export function formatUpdatedAt(updatedAt: string | undefined): string {
  if (!updatedAt) return "";

  // updatedAt is stored as a timestamp string (milliseconds since epoch)
  const timestamp = parseInt(updatedAt, 10);

  // Check if the timestamp is valid
  if (isNaN(timestamp)) {
    return updatedAt; // Return the raw value if it can't be parsed
  }

  const updatedDate = new Date(timestamp);
  const now = new Date();
  const diffMs = now.getTime() - updatedDate.getTime();

  // Handle future dates
  if (diffMs < 0) return "Recently";

  const diffMinutes = Math.floor(diffMs / (1000 * 60));
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffMinutes < 1) return "Just now";
  if (diffMinutes < 60) return `${diffMinutes} ${diffMinutes === 1 ? "minute" : "minutes"} ago`;
  if (diffHours < 24) return `${diffHours} ${diffHours === 1 ? "hour" : "hours"} ago`;
  if (diffDays === 1) return "1 day ago";
  return `${diffDays} days ago`;
}
