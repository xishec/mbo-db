import type { SpeciesRange } from "../../../../../helper/helper";
import type { CaptureFormData } from "./types";

export interface ApplicableRange {
  weightLower: number;
  weightUpper: number;
  wingLower: number;
  wingUpper: number;
}

/**
 * Get the applicable range bounds based on sex
 * sex "4" = male, sex "5" = female, otherwise use combined bounds (widest range)
 */
export function getApplicableRange(
  speciesRange: SpeciesRange | null,
  sex: string
): ApplicableRange | null {
  if (!speciesRange) return null;

  if (sex === "4") {
    return {
      weightLower: speciesRange.mWeightLower,
      weightUpper: speciesRange.mWeightUpper,
      wingLower: speciesRange.mWingLower,
      wingUpper: speciesRange.mWingUpper,
    };
  } else if (sex === "5") {
    return {
      weightLower: speciesRange.fWeightLower,
      weightUpper: speciesRange.fWeightUpper,
      wingLower: speciesRange.fWingLower,
      wingUpper: speciesRange.fWingUpper,
    };
  } else {
    return {
      weightLower: Math.min(speciesRange.mWeightLower, speciesRange.fWeightLower),
      weightUpper: Math.max(speciesRange.mWeightUpper, speciesRange.fWeightUpper),
      wingLower: Math.min(speciesRange.mWingLower, speciesRange.fWingLower),
      wingUpper: Math.max(speciesRange.mWingUpper, speciesRange.fWingUpper),
    };
  }
}

/**
 * Check if a value is within range
 * Returns null if no valid range data, true if in range, false if out of range
 */
export function isInRange(value: number, lower: number, upper: number): boolean | null {
  if (lower === 0 && upper === 0) return null;
  if (value === 0) return false;
  return value >= lower && value <= upper;
}

/**
 * Get default form data with current date/time
 */
export function getDefaultFormData(program: string): CaptureFormData {
  const now = new Date();
  const date = now.toISOString().split("T")[0];
  const time = now.toTimeString().slice(0, 5);

  return {
    program,
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
    notes: "",
  };
}

/**
 * Format input value based on field type
 */
export function formatFieldValue(field: keyof CaptureFormData, value: string): string {
  switch (field) {
    case "bandGroup": {
      const digits = value.replace(/\D/g, "").slice(0, 7);
      return digits.length <= 4 ? digits : `${digits.slice(0, 4)}-${digits.slice(4)}`;
    }
    case "bandLastTwoDigits":
      return value.replace(/\D/g, "").slice(0, 2);
    case "species":
      return value.replace(/[^a-zA-Z]/g, "").toUpperCase().slice(0, 4);
    case "wing":
      return value.replace(/\D/g, "");
    case "age": {
      const digits = value.replace(/[^0-9]/g, "").slice(0, 2);
      if (digits.length <= 1) return digits;
      return `${digits[0]} | ${digits[1]}`;
    }
    case "sex": {
      const chars = value.replace(/[^a-zA-Z0-9]/g, "").toUpperCase().slice(0, 2);
      if (chars.length <= 1) return chars;
      return `${chars[0]} | ${chars[1]}`;
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
      return value.replace(/[^a-zA-Z]/g, "").toUpperCase().slice(0, 3);
    case "net":
      return value.replace(/[^a-zA-Z0-9]/g, "").toUpperCase().slice(0, 2);
    default:
      return value;
  }
}
