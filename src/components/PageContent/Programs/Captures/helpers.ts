import { type SpeciesRange, type CaptureFormData, CaptureType } from "../../../../types";

import type { CaptureColumn } from "../../../../types";

export const CAPTURE_COLUMNS: CaptureColumn[] = [
  { key: "programId", label: "Program", className: "min-w-[150px]" },
  { key: "bandGroup", label: "Band Group", maxLength: 8, minLength: 8 },
  { key: "bandLastTwoDigits", label: "Band", maxLength: 2, minLength: 2 },
  { key: "species", label: "Species", maxLength: 4, minLength: 4 },
  { key: "wing", label: "Wing", className: "min-w-[60px]", minLength: 1 },
  { key: "age", label: "Age", className: "min-w-[60px]", maxLength: 3, minLength: 3 },
  { key: "sex", label: "Sex", className: "min-w-[60px]", maxLength: 3, minLength: 3 },
  { key: "fat", label: "Fat", maxLength: 1, minLength: 1 },
  { key: "weight", label: "Weight", minLength: 1 },
  { key: "date", label: "Date", type: "date" },
  { key: "time", label: "Time", type: "time" },
  { key: "bander", label: "Bander", maxLength: 3, minLength: 3 },
  { key: "scribe", label: "Scribe", maxLength: 3, minLength: 3 },
  { key: "net", label: "Net", maxLength: 2, minLength: 2 },
  { key: "captureType", label: "Capture Type" },
  { key: "notes", label: "Notes", className: "min-w-[200px]" },
];

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

  return {
    weightLower: Math.min(speciesRange.mWeightLower, speciesRange.fWeightLower),
    weightUpper: Math.max(speciesRange.mWeightUpper, speciesRange.fWeightUpper),
    wingLower: Math.min(speciesRange.mWingLower, speciesRange.fWingLower),
    wingUpper: Math.max(speciesRange.mWingUpper, speciesRange.fWingUpper),
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
    sex: "",
    fat: "",
    weight: "",
    date,
    time,
    bander: "",
    scribe: "",
    net: "",
    captureType: CaptureType.None,
    notes: "",
  };
}

export function formatFieldValue(field: keyof CaptureFormData, value: string): string {
  switch (field) {
    case "bandGroup": {
      const digits = value.replace(/\D/g, "").slice(0, 7);
      return digits.length <= 4 ? digits : `${digits.slice(0, 4)}-${digits.slice(4)}`;
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
    case "age": {
      const digits = value.replace(/[^0-9]/g, "").slice(0, 2);
      return digits.length <= 1 ? digits : `${digits[0]} | ${digits[1]}`;
    }
    case "sex": {
      const chars = value
        .replace(/[^a-zA-Z0-9]/g, "")
        .toUpperCase()
        .slice(0, 2);
      return chars.length <= 1 ? chars : `${chars[0]} | ${chars[1]}`;
    }
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
