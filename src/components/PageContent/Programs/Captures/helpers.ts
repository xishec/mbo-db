import { type SpeciesRange, type CaptureFormData, BirdEventType } from "../../../../types";
import { DEFAULT_BIRD_STATUS } from "../../../../types/birdStatus";

import type { CaptureColumn } from "../../../../types";

export const TABLE_COLUMNS: CaptureColumn[] = [
  { key: "actions", type: "", label: "Actions", tableClassName: "w-[75px]", inputClassName: "w-[75px]" },
  { key: "programId", type: "text", label: "Program", tableClassName: "w-[150px]", inputClassName: "w-[150px]" },
  {
    key: "bandGroup",
    type: "number",
    label: "Band Group",
    maxLength: 7,
    minLength: 7,
    tableClassName: "w-[100px]",
    inputClassName: "w-[100px]",
  },
  {
    key: "bandLastTwoDigits",
    type: "number",
    label: "Band",
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
    tableClassName: "w-[100px]",
    inputClassName: "w-[100px]",
  },
  { key: "birdEventType", type: "text", label: "Event Type", tableClassName: "w-[100px]", inputClassName: "w-[125px]" },
  { key: "date", type: "date", label: "Date", tableClassName: "w-[100px]", inputClassName: "w-[150px]" },
  { key: "time", type: "time", label: "Time", tableClassName: "w-[100px]", inputClassName: "w-[150px]" },
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
    minLength: 3,
    tableClassName: "w-[75px]",
    inputClassName: "w-[75px]",
  },
  {
    key: "scribe",
    type: "text",
    label: "Scribe",
    maxLength: 3,
    minLength: 3,
    tableClassName: "w-[75px]",
    inputClassName: "w-[75px]",
  },
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
    key: "birdStatus",
    type: "number",
    label: "Status",
    maxLength: 3,
    minLength: 3,
    tableClassName: "w-[75px]",
    inputClassName: "w-[75px]",
  },
  { key: "updatedAt", type: "", label: "Updated", tableClassName: "w-[125px]" },
  { key: "notes", type: "text", label: "Notes", tableClassName: "w-[1000px]", inputClassName: "w-[1000px]" },
];

// Column order for re-captures (isNewCapture = false)
export const RE_CAPTURE_COLUMN_ORDER: string[] = [
  "programId",
  "birdEventType",
  "bander",
  "scribe",
  "date",
  "time",
  "net",
  "bandGroup",
  "bandLastTwoDigits",
  "species",
  "wing",
  "age",
  "howAged",
  "sex",
  "howSexed",
  "fat",
  "weight",
  "birdStatus",
  "notes",
];

export function getSortedColumns(isNewCapture: boolean, birdEventToModifyId?: string): CaptureColumn[] {
  if (isNewCapture || birdEventToModifyId) {
    return TABLE_COLUMNS;
  }

  return RE_CAPTURE_COLUMN_ORDER.map((key) => TABLE_COLUMNS.find((col) => col.key === key)).filter(
    (col): col is CaptureColumn => col !== undefined
  );
}

export interface ApplicableRange {
  weightLower: number;
  weightUpper: number;
  wingLower: number;
  wingUpper: number;
}

export function getApplicableRange(speciesRange: SpeciesRange | null, sex: string): ApplicableRange | null {
  if (!speciesRange) return null;

  if (sex === "4") {
    return {
      weightLower: speciesRange.mWeightLower,
      weightUpper: speciesRange.mWeightUpper,
      wingLower: speciesRange.mWingLower,
      wingUpper: speciesRange.mWingUpper,
    };
  }

  if (sex === "5") {
    return {
      weightLower: speciesRange.fWeightLower,
      weightUpper: speciesRange.fWeightUpper,
      wingLower: speciesRange.fWingLower,
      wingUpper: speciesRange.fWingUpper,
    };
  }

  // Use unknown range if available, otherwise use combined male/female range
  return {
    weightLower: speciesRange.unknownWeightLower || Math.min(speciesRange.mWeightLower, speciesRange.fWeightLower),
    weightUpper: speciesRange.unknownWeightUpper || Math.max(speciesRange.mWeightUpper, speciesRange.fWeightUpper),
    wingLower: speciesRange.unknownWingLower || Math.min(speciesRange.mWingLower, speciesRange.fWingLower),
    wingUpper: speciesRange.unknownWingUpper || Math.max(speciesRange.mWingUpper, speciesRange.fWingUpper),
  };
}

export function isInRange(value: number, lower: number, upper: number): boolean | null {
  if (lower === 0 && upper === 0) return null;
  if (value === 0) return false;
  return value >= lower && value <= upper;
}

export function getDefaultFormData(programId: string): CaptureFormData {
  const now = new Date();
  const date = now.toISOString().split("T")[0];
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
  };
}

export function formatFieldValue(field: keyof CaptureFormData, value: string): string {
  switch (field) {
    case "bandGroup": {
      return value.replace(/\D/g, "").slice(0, 8);
    }
    case "bandLastTwoDigits":
      return value.replace(/\D/g, "").slice(0, 2);
    case "species":
      return value
        .replace(/[^a-zA-Z]/g, "")
        .toUpperCase()
        .slice(0, 4);
    case "wing":
      return value.replace(/\D/g, "");
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
