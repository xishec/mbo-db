import { type SpeciesRange, type CaptureFormData, BirdEventType } from "../../../../types";
import { DEFAULT_BIRD_STATUS } from "../../../../types/birdStatus";

import type { CaptureColumn } from "../../../../types";

export const TABLE_COLUMNS: CaptureColumn[] = [
  { key: "actions", label: "Actions", tableClassName: "w-[75px]", inputClassName: "w-[75px]" },
  { key: "programId", label: "Program", tableClassName: "w-[150px]", inputClassName: "w-[150px]" },
  {
    key: "bandGroup",
    label: "Band Group",
    maxLength: 7,
    minLength: 7,
    tableClassName: "w-[100px]",
    inputClassName: "w-[100px]",
  },
  {
    key: "bandLastTwoDigits",
    label: "Band",
    maxLength: 2,
    minLength: 2,
    tableClassName: "w-[75px]",
    inputClassName: "w-[75px]",
  },
  {
    key: "species",
    label: "Species",
    maxLength: 4,
    minLength: 4,
    tableClassName: "w-[100px]",
    inputClassName: "w-[100px]",
  },
  { key: "birdEventType", label: "Event Type", tableClassName: "w-[100px]", inputClassName: "w-[125px]" },
  { key: "date", label: "Date", type: "date", tableClassName: "w-[100px]", inputClassName: "w-[150px]" },
  { key: "time", label: "Time", type: "time", tableClassName: "w-[100px]", inputClassName: "w-[150px]" },
  { key: "wing", label: "Wing", maxLength: 4, minLength: 2, tableClassName: "w-[75px]", inputClassName: "w-[75px]" },
  { key: "age", label: "Age", maxLength: 1, minLength: 1, tableClassName: "w-[50px]", inputClassName: "w-[50px]" },
  {
    key: "howAged",
    label: "How Aged",
    maxLength: 1,
    minLength: 1,
    tableClassName: "w-[50px]",
    inputClassName: "w-[50px]",
  },
  { key: "sex", label: "Sex", maxLength: 1, minLength: 1, tableClassName: "w-[50px]", inputClassName: "w-[50px]" },
  {
    key: "howSexed",
    label: "How Sexed",
    maxLength: 1,
    minLength: 1,
    tableClassName: "w-[50px]",
    inputClassName: "w-[50px]",
  },
  { key: "fat", label: "Fat", maxLength: 1, minLength: 1, tableClassName: "w-[50px]", inputClassName: "w-[50px]" },
  {
    key: "weight",
    label: "Weight",
    maxLength: 5,
    minLength: 2,
    tableClassName: "w-[75px]",
    inputClassName: "w-[75px]",
  },
  {
    key: "bander",
    label: "Bander",
    maxLength: 3,
    minLength: 3,
    tableClassName: "w-[75px]",
    inputClassName: "w-[75px]",
  },
  {
    key: "scribe",
    label: "Scribe",
    maxLength: 3,
    minLength: 3,
    tableClassName: "w-[75px]",
    inputClassName: "w-[75px]",
  },
  { key: "net", label: "Net", maxLength: 2, minLength: 2, tableClassName: "w-[50px]", inputClassName: "w-[75px]" },
  {
    key: "birdStatus",
    label: "Status",
    maxLength: 3,
    minLength: 3,
    tableClassName: "w-[75px]",
    inputClassName: "w-[75px]",
  },
  { key: "notes", label: "Notes", tableClassName: "w-[1000px]", inputClassName: "w-[1000px]" },
];

// Column order for re-captures (isNewCapture = false)
export const RE_CAPTURE_COLUMN_ORDER: string[] = [
  "actions",
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
