import type { BirdEvent, BirdEventsMap, BandIdToBirdEventIdsMap, MagicTable, SpeciesRange } from ".";
import { SPECIES_MAP } from "./species";

export type ErrorSeverity = "danger" | "warning";

export const BIRD_EVENT_ERROR_TYPE_CONFIG = {
  "sex-change": { label: "Sex Changes" },
  "species-change": { label: "Species Changes" },
  recapture: { label: "Quick Recaptures" },
  fat: { label: "Fat Range" },
  weight: { label: "Weight Range" },
  wing: { label: "Wing Range" },
  "age-consistency": { label: "Age Consistency" },
  "age-sequence": { label: "Age Sequence" },
  "age-season": { label: "Age Season" },
} as const;

export type BirdEventErrorType = keyof typeof BIRD_EVENT_ERROR_TYPE_CONFIG;

export interface BirdEventError {
  id: string;
  errorType: BirdEventErrorType;
  birdEvent: BirdEvent;
  reason: string;
  severity: ErrorSeverity;
}

type SexLabel = "male" | "female" | "unknown";

export interface MeasurementRanges {
  weightLower: number;
  weightUpper: number;
  wingLower: number;
  wingUpper: number;
}

const AGE_U = 0;
const AGE_AHY = 1;
const AGE_HY = 2;
const AGE_L = 4;
const AGE_SY = 5;
const AGE_ASY = 6;
const AGE_TY = 7;
const AGE_ATY = 8;

const AGE_STAGE: Partial<Record<number, number>> = {
  [AGE_L]: 0,
  [AGE_HY]: 0,
  [AGE_AHY]: 0,
  [AGE_SY]: 1,
  [AGE_ASY]: 1,
  [AGE_TY]: 2,
  [AGE_ATY]: 2,
};

const AGE_LABELS: Record<number, string> = {
  [AGE_U]: "U",
  [AGE_AHY]: "AHY",
  [AGE_HY]: "HY",
  [AGE_L]: "L",
  [AGE_SY]: "SY",
  [AGE_ASY]: "ASY",
  [AGE_TY]: "TY",
  [AGE_ATY]: "ATY",
};

// 4->2->5->1->6->1->6...
const AGE_SEQUENCE_ALLOWED_NEXT: Record<string, Set<string>> = {
  "4": new Set(["4", "2", "5", "1", "6"]),
  "2": new Set(["2", "5", "1", "6"]),
  "5": new Set(["5", "1", "6"]),
  "1": new Set(["1", "6"]),
  "6": new Set(["6", "1"]),
};

/**
 * Get sex label from sex code
 */
function getSexLabel(sexCode: string): SexLabel {
  return sexCode === "4" ? "male" : sexCode === "5" ? "female" : "unknown";
}

/**
 * Extract sex-specific ranges from SpeciesRange
 */
export function getRangesForSex(speciesRange: SpeciesRange | undefined, sexCode: string): MeasurementRanges | null {
  if (!speciesRange) return null;

  if (sexCode === "5") {
    // Female
    return {
      weightLower: speciesRange.fWeightLower,
      weightUpper: speciesRange.fWeightUpper,
      wingLower: speciesRange.fWingLower,
      wingUpper: speciesRange.fWingUpper,
    };
  } else if (sexCode === "4") {
    // Male
    return {
      weightLower: speciesRange.mWeightLower,
      weightUpper: speciesRange.mWeightUpper,
      wingLower: speciesRange.mWingLower,
      wingUpper: speciesRange.mWingUpper,
    };
  } else {
    // Unknown
    return {
      weightLower: speciesRange.unknownWeightLower,
      weightUpper: speciesRange.unknownWeightUpper,
      wingLower: speciesRange.unknownWingLower,
      wingUpper: speciesRange.unknownWingUpper,
    };
  }
}

/**
 * Sanitize string to be safe for Firebase paths
 * Firebase paths cannot contain: . # $ [ ]
 */
function sanitizeForFirebasePath(str: string): string {
  return str
    .replace(/\s+/g, "-")
    .replace(/[.#$[\]]/g, "")
    .replace(/[()]/g, "");
}

function isAgeValidationExcluded(speciesCode: string): boolean {
  if (!speciesCode) return false;
  if (speciesCode === "NSWO") return true;
  const speciesFrench = SPECIES_MAP[speciesCode]?.speciesFrench ?? "";
  return speciesFrench.toLowerCase().includes("pic");
}

function normalizeAgeCode(ageCode: string): number {
  const parsedAge = Number.parseInt(ageCode, 10);

  if (!Number.isInteger(parsedAge)) return AGE_U;
  if (parsedAge === 3) return AGE_U;
  if (parsedAge < AGE_U || parsedAge > AGE_ATY) return AGE_U;

  return parsedAge;
}

function formatAgeCode(ageCode: number): string {
  return AGE_LABELS[ageCode] ?? "U";
}

function getCaptureYear(date: string): number | null {
  if (!date) return null;

  const [year] = date.split("-");
  const parsedYear = Number.parseInt(year, 10);

  return Number.isInteger(parsedYear) ? parsedYear : null;
}

function getEventTimestamp(date: string, time?: string): number | null {
  if (!date) return null;

  const timestamp = Date.parse(`${date}T${time || "00:00"}`);
  return Number.isNaN(timestamp) ? null : timestamp;
}

function formatYearSpan(years: number): string {
  return `${years} year${years <= 1 ? "" : "s"}`;
}

function isAgeConsistentWithRecord(
  currentAge: number,
  currentYear: number,
  otherAge: number,
  otherYear: number
): boolean {
  const yearDelta = otherYear - currentYear;

  if (currentAge === AGE_U) {
    switch (yearDelta) {
      case 1:
        return otherAge !== AGE_L && otherAge !== AGE_HY;
      case 2:
        return otherAge !== AGE_L && otherAge !== AGE_HY && otherAge !== AGE_SY;
      default:
        if (yearDelta >= 3) {
          return otherAge !== AGE_L && otherAge !== AGE_HY && otherAge !== AGE_SY && otherAge !== AGE_TY;
        }
        return true;
    }
  }

  if (currentAge === AGE_L || currentAge === AGE_HY || currentAge === AGE_SY || currentAge === AGE_TY) {
    const ageStage = (AGE_STAGE[currentAge] ?? 0) + yearDelta;

    if (ageStage <= -1) return false;
    if (ageStage === 0) return otherAge === AGE_U || otherAge === AGE_L || otherAge === AGE_HY;
    if (ageStage === 1) return otherAge === AGE_U || otherAge === AGE_SY || otherAge === AGE_AHY;
    if (ageStage === 2)
      return otherAge === AGE_U || otherAge === AGE_TY || otherAge === AGE_AHY || otherAge === AGE_ASY;

    return otherAge === AGE_U || otherAge === AGE_AHY || otherAge === AGE_ASY || otherAge === AGE_ATY;
  }

  if (currentAge === AGE_AHY || currentAge === AGE_ASY || currentAge === AGE_ATY) {
    const ageStage = (AGE_STAGE[currentAge] ?? 0) + yearDelta;

    if (ageStage === 0) return otherAge !== AGE_L && otherAge !== AGE_HY;
    if (ageStage === 1) return otherAge !== AGE_L && otherAge !== AGE_HY && otherAge !== AGE_SY;
    if (ageStage >= 2) {
      return otherAge !== AGE_L && otherAge !== AGE_HY && otherAge !== AGE_SY && otherAge !== AGE_TY;
    }
  }

  return true;
}

function getAgeConsistencyConflict(
  currentAgeCode: string,
  currentDate: string,
  relatedEvents: BirdEvent[]
): { otherEvent: BirdEvent; reason: string } | null {
  const currentYear = getCaptureYear(currentDate);
  if (currentYear === null) return null;

  const currentAge = normalizeAgeCode(currentAgeCode);

  for (const event of relatedEvents) {
    const otherYear = getCaptureYear(event.date);
    if (otherYear === null) continue;

    const otherAge = normalizeAgeCode(event.age);
    if (!isAgeConsistentWithRecord(currentAge, currentYear, otherAge, otherYear)) {
      const yearDelta = currentYear - otherYear;
      return {
        otherEvent: event,
        reason: `Age can't be ${otherAge} (${formatAgeCode(otherAge)}) ${formatYearSpan(yearDelta)} after ${currentAge} (${formatAgeCode(currentAge)}).`,
      };
    }
  }

  return null;
}

function getAgeSequenceConflict(
  currentAgeCode: string,
  relatedEvents: BirdEvent[]
): { previousEvent: BirdEvent; reason: string } | null {
  if (!currentAgeCode || currentAgeCode === "0" || currentAgeCode === "3") return null;

  let lastNonZeroAgeEvent: BirdEvent | null = null;

  for (const event of relatedEvents) {
    if (!event.age || event.age === "0" || event.age === "3") continue;
    lastNonZeroAgeEvent = event;
  }

  if (!lastNonZeroAgeEvent) return null;

  const allowedNext = AGE_SEQUENCE_ALLOWED_NEXT[lastNonZeroAgeEvent.age];
  if (!allowedNext || allowedNext.has(currentAgeCode)) return null;

  const lastAgeNumber = normalizeAgeCode(lastNonZeroAgeEvent.age);
  const currentAgeNumber = normalizeAgeCode(currentAgeCode);

  return {
    previousEvent: lastNonZeroAgeEvent,
    reason: `Age can't change from ${lastAgeNumber} (${formatAgeCode(lastAgeNumber)}) to ${currentAgeNumber} (${formatAgeCode(currentAgeNumber)}).`,
  };
}

function checkAgeConsistency(events: BirdEvent[]): BirdEventError[] {
  const errors: BirdEventError[] = [];
  const sortedEvents = [...events].sort((a, b) => {
    const aTimestamp = getEventTimestamp(a.date, a.time) ?? Number.POSITIVE_INFINITY;
    const bTimestamp = getEventTimestamp(b.date, b.time) ?? Number.POSITIVE_INFINITY;
    return aTimestamp - bTimestamp;
  });

  for (let index = 0; index < sortedEvents.length; index += 1) {
    const event = sortedEvents[index];
    const relatedEvents = sortedEvents.slice(0, index);
    const conflict = getAgeConsistencyConflict(event.age, event.date, relatedEvents);

    if (!conflict) continue;

    errors.push({
      id: `${event.id}-age-consistency-${sanitizeForFirebasePath(conflict.reason)}`,
      errorType: "age-consistency",
      birdEvent: event,
      reason: conflict.reason,
      severity: "danger",
    });
  }

  return errors;
}

function checkAgeSequenceOrder(events: BirdEvent[]): BirdEventError[] {
  const errors: BirdEventError[] = [];
  const sortedEvents = [...events].sort((a, b) => {
    const aTimestamp = getEventTimestamp(a.date, a.time) ?? Number.POSITIVE_INFINITY;
    const bTimestamp = getEventTimestamp(b.date, b.time) ?? Number.POSITIVE_INFINITY;
    return aTimestamp - bTimestamp;
  });

  for (let index = 0; index < sortedEvents.length; index += 1) {
    const event = sortedEvents[index];
    if (isAgeValidationExcluded(event.species)) continue;

    const relatedEvents = sortedEvents.slice(0, index);
    const conflict = getAgeSequenceConflict(event.age, relatedEvents);

    if (!conflict) continue;

    errors.push({
      id: `${event.id}-age-sequence-${sanitizeForFirebasePath(conflict.reason)}`,
      errorType: "age-sequence",
      birdEvent: event,
      reason: conflict.reason,
      severity: "danger",
    });
  }

  return errors;
}

/**
 * Returns the set of valid age codes for a given month.
 * Jan-Aug: 5/6, Apr-Sep: 4, Jul-Dec: 2/1, 0 anytime.
 */
function getAllowedAgesForMonth(month: number): Set<string> {
  const allowed = new Set<string>(["0"]);
  if (month >= 1 && month <= 8) { allowed.add("5"); allowed.add("6"); }
  if (month >= 7 && month <= 12) { allowed.add("2"); allowed.add("1"); }
  if (month >= 4 && month <= 9) { allowed.add("4"); }
  return allowed;
}

function getAgeSeasonReason(age: string, month: number): string | null {
  const allowedAges = getAllowedAgesForMonth(month);
  if (allowedAges.has(age)) return null;
  return `Age ${age} is not expected for month ${month} (Jan-Aug: 5/6, Apr-Sep: 4, Jul-Dec: 2/1, 0 anytime)`;
}

function checkAgeSeasonCompatibility(event: BirdEvent): BirdEventError | null {
  if (isAgeValidationExcluded(event.species)) return null;

  const age = event.age;
  if (!age || age === "0" || age === "3") return null;

  const month = new Date(event.date).getMonth() + 1;
  const reason = getAgeSeasonReason(age, month);
  if (!reason) return null;

  return {
    id: `${event.id}-age-season-${sanitizeForFirebasePath(reason)}`,
    errorType: "age-season",
    birdEvent: event,
    reason,
    severity: "warning",
  };
}

/**
 * Check if a measurement is outside the Pyle range (20% tolerance)
 * Note: Low wing measurements for age 4 birds are ignored (no error reported)
 * Returns error severity: 'danger' for Pyle violations
 */
function checkPyleMeasurementTolerance(
  value: number,
  pyleLower: number,
  pyleUpper: number,
  measurementType: "Weight" | "Wing",
  sexLabel: SexLabel,
  unit: "g" | "mm",
  age?: string
): string | null {
  if (value <= 0 || pyleLower <= 0) return null;

  // Ignore low wing measurements for age 4 birds entirely
  if (measurementType === "Wing" && age === "4" && value < pyleLower * 0.8) {
    return null;
  }

  const lowerBound = pyleLower * 0.8; // 20% below
  const upperBound = pyleUpper * 1.2; // 20% above

  if (value < lowerBound) {
    return `${measurementType} ${value}${unit} is 20% below Pyle ${sexLabel} range (${pyleLower}-${pyleUpper}${unit})`;
  } else if (value > upperBound) {
    return `${measurementType} ${value}${unit} is 20% above Pyle ${sexLabel} range (${pyleLower}-${pyleUpper}${unit})`;
  }

  return null;
}

/**
 * Check if fat value is within valid range (0-7)
 */
function checkFatValue(fat: number): string | null {
  if (fat < 0 || fat > 7) {
    return `Fat ${fat} is out of valid range (0-7)`;
  }
  return null;
}

/**
 * Check a single event for out-of-range measurements against Pyle ranges
 */
function checkEventMeasurements(event: BirdEvent, pyleRange?: SpeciesRange): BirdEventError[] {
  const errors: BirdEventError[] = [];
  const sexLabel = getSexLabel(event.sex);

  // Check fat value
  const fatReason = checkFatValue(event.fat);
  if (fatReason) {
    errors.push({
      id: `${event.id}-fat-${sanitizeForFirebasePath(fatReason)}`,
      errorType: "fat",
      birdEvent: event,
      reason: fatReason,
      severity: "danger",
    });
  }

  // Get sex-specific ranges
  const pyleRanges = getRangesForSex(pyleRange, event.sex);

  // Check Pyle range (danger level)
  if (pyleRanges) {
    const pyleWeightReason = checkPyleMeasurementTolerance(
      event.weight,
      pyleRanges.weightLower,
      pyleRanges.weightUpper,
      "Weight",
      sexLabel,
      "g",
      event.age
    );
    if (pyleWeightReason) {
      errors.push({
        id: `${event.id}-pyle-weight-${sanitizeForFirebasePath(pyleWeightReason)}`,
        errorType: "weight",
        birdEvent: event,
        reason: pyleWeightReason,
        severity: "danger",
      });
    }

    const pyleWingReason = checkPyleMeasurementTolerance(
      event.wing,
      pyleRanges.wingLower,
      pyleRanges.wingUpper,
      "Wing",
      sexLabel,
      "mm",
      event.age
    );
    if (pyleWingReason) {
      errors.push({
        id: `${event.id}-pyle-wing-${sanitizeForFirebasePath(pyleWingReason)}`,
        errorType: "wing",
        birdEvent: event,
        reason: pyleWingReason,
        severity: "danger",
      });
    }
  }

  return errors;
}

/**
 * Finds errors in an array of bird events.
 * Checks for sex changes (4 ↔ 5), species changes, recaptures within 12 hours, and out-of-normal measurements.
 */
export function findErrorsInEvents(events: BirdEvent[], magicTable?: MagicTable): BirdEventError[] {
  const errors: BirdEventError[] = [];

  // Check consecutive events for sex/species changes
  for (let i = 1; i < events.length; i++) {
    const currentEvent = events[i];
    const previousEvent = events[i - 1];

    const currentSex = currentEvent.sex;
    const previousSex = previousEvent.sex;
    const currentSpecies = currentEvent.species;
    const previousSpecies = previousEvent.species;

    if (previousSex === "4" && currentSex === "5") {
      errors.push({
        id: `${currentEvent.id}-sex-change-4-to-5`,
        errorType: "sex-change",
        birdEvent: currentEvent,
        reason: "Sex changed from 4 to 5",
        severity: "danger",
      });
    } else if (previousSex === "5" && currentSex === "4") {
      errors.push({
        id: `${currentEvent.id}-sex-change-5-to-4`,
        errorType: "sex-change",
        birdEvent: currentEvent,
        reason: "Sex changed from 5 to 4",
        severity: "danger",
      });
    } else if (currentSpecies !== previousSpecies) {
      errors.push({
        id: `${currentEvent.id}-species-change`,
        errorType: "species-change",
        birdEvent: currentEvent,
        reason: `Species changed from ${previousSpecies} to ${currentSpecies}`,
        severity: "danger",
      });
    }

    // Check for recapture within 12 hours
    const currentDateTime = new Date(`${currentEvent.date}T${currentEvent.time}`).getTime();
    const previousDateTime = new Date(`${previousEvent.date}T${previousEvent.time}`).getTime();
    const timeDiffHours = (currentDateTime - previousDateTime) / (1000 * 60 * 60);

    if (timeDiffHours < 12 && timeDiffHours >= 0) {
      errors.push({
        id: `${currentEvent.id}-same-day-recapture`,
        errorType: "recapture",
        birdEvent: currentEvent,
        reason: "Bird was recaptured within 12 hours - should be released without logging",
        severity: "danger",
      });
    }
  }

  // Check all events for out-of-normal measurements
  if (magicTable) {
    for (const event of events) {
      const pyleRange = magicTable.pyle?.[event.species];

      const measurementErrors = checkEventMeasurements(event, pyleRange);
      errors.push(...measurementErrors);
    }
  }

  errors.push(...checkAgeConsistency(events));
  errors.push(...checkAgeSequenceOrder(events));

  for (const event of events) {
    const ageSeasonError = checkAgeSeasonCompatibility(event);
    if (ageSeasonError) {
      errors.push(ageSeasonError);
    }
  }

  return errors;
}

/**
 * Scans through bands to find errors.
 * Returns bird events where sex changed from "4" to "5" or from "5" to "4" or species changed for the same band.
 */
export function findBirdEventErrors(
  bandIdToBirdEventIdsMap: BandIdToBirdEventIdsMap,
  birdEventsMap: BirdEventsMap,
  magicTable?: MagicTable
): BirdEventError[] {
  const errors: BirdEventError[] = [];

  // Iterate through each band
  for (const bandId in bandIdToBirdEventIdsMap) {
    if (bandId === "999999999") continue; // Skip test band

    const eventIds = bandIdToBirdEventIdsMap[bandId];
    // Filter out modified events (events that have been superseded by newer versions)
    const events = eventIds.map((id) => birdEventsMap[id]).filter((event) => event && !event.modifiedEventId);

    errors.push(...findErrorsInEvents(events, magicTable));
  }

  return errors;
}

/**
 * Validates a bird event being added/modified before saving.
 * Returns validation errors that should be displayed to the user.
 */
export function validateBirdEventForm(
  formData: {
    species: string;
    wing: string;
    weight: string;
    sex: string;
    age: string;
    date: string;
    time: string;
    fat: string;
  },
  pastBirdEvents: BirdEvent[],
  magicTable?: MagicTable
): { text: string; severity: ErrorSeverity }[] {
  const messages: { text: string; severity: ErrorSeverity }[] = [];
  const sexLabel = getSexLabel(formData.sex);

  const wingValue = formData.wing ? parseFloat(formData.wing) : 0;
  const weightValue = formData.weight ? parseFloat(formData.weight) : 0;
  const fatValue = formData.fat ? parseFloat(formData.fat) : 0;

  // Check fat value
  const fatReason = checkFatValue(fatValue);
  if (fatReason) {
    messages.push({ text: fatReason, severity: "danger" });
  }

  // Get species ranges
  const pyleRange = magicTable?.pyle?.[formData.species];

  // Get sex-specific ranges
  const pyleRanges = getRangesForSex(pyleRange, formData.sex);

  // Check Pyle ranges (danger)
  if (pyleRanges) {
    const pyleWingReason = checkPyleMeasurementTolerance(
      wingValue,
      pyleRanges.wingLower,
      pyleRanges.wingUpper,
      "Wing",
      sexLabel,
      "mm",
      formData.age
    );
    if (pyleWingReason) {
      messages.push({ text: pyleWingReason, severity: "danger" });
    }

    const pyleWeightReason = checkPyleMeasurementTolerance(
      weightValue,
      pyleRanges.weightLower,
      pyleRanges.weightUpper,
      "Weight",
      sexLabel,
      "g",
      formData.age
    );
    if (pyleWeightReason) {
      messages.push({ text: pyleWeightReason, severity: "danger" });
    }
  }

  // Check if sex matches existing captures
  if (pastBirdEvents.length > 0 && formData.sex.length > 0) {
    const capturesWithDefinedSex = pastBirdEvents.filter((capture) => ["4", "5"].includes(capture.sex));
    if (capturesWithDefinedSex.length > 0) {
      const allSexMatch = capturesWithDefinedSex.every((capture) => capture.sex === formData.sex);
      if (!allSexMatch) {
        const existingSexValues = [...new Set(capturesWithDefinedSex.map((c) => c.sex))].join(", ");
        messages.push({
          text: `Sex ${formData.sex} does not match existing captures (was ${existingSexValues})`,
          severity: "danger",
        });
      }
    }
  }

  // Check if bird is being recaptured within 12 hours
  if (pastBirdEvents.length > 0 && formData.date && formData.time) {
    const currentDateTime = new Date(`${formData.date}T${formData.time}`).getTime();
    const captureWithin12Hours = pastBirdEvents.some((capture) => {
      const captureDateTime = new Date(`${capture.date}T${capture.time}`).getTime();
      const timeDiffHours = (currentDateTime - captureDateTime) / (1000 * 60 * 60);
      return timeDiffHours >= 0 && timeDiffHours < 12;
    });
    if (captureWithin12Hours) {
      messages.push({
        text: "Bird was recaptured within 12 hours - should be released without logging",
        severity: "danger",
      });
    }
  }

  if (formData.age && formData.age !== "0" && formData.age !== "3" && formData.date && !isAgeValidationExcluded(formData.species)) {
    const month = new Date(formData.date).getMonth() + 1;
    const ageSeasonReason = getAgeSeasonReason(formData.age, month);
    if (ageSeasonReason) {
      messages.push({ text: ageSeasonReason, severity: "warning" });
    }
  }

  if (formData.age && formData.date) {
    const currentTimestamp = getEventTimestamp(formData.date, formData.time);
    const pastAgeEvents = pastBirdEvents.filter((event) => {
      const eventTimestamp = getEventTimestamp(event.date, event.time);
      if (currentTimestamp === null || eventTimestamp === null) return false;
      return eventTimestamp < currentTimestamp;
    });
    const ageConflict = getAgeConsistencyConflict(formData.age, formData.date, pastAgeEvents);
    if (ageConflict) {
      messages.push({
        text: ageConflict.reason,
        severity: "danger",
      });
    }

    if (!isAgeValidationExcluded(formData.species)) {
      const ageSequenceConflict = getAgeSequenceConflict(formData.age, pastAgeEvents);
      if (ageSequenceConflict) {
        messages.push({
          text: ageSequenceConflict.reason,
          severity: "danger",
        });
      }
    }
  }

  return messages;
}
