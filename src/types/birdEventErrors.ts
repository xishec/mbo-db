import type { BirdEvent, BirdEventsMap, BandIdToBirdEventIdsMap, MagicTable, SpeciesRange } from ".";

export type ErrorSeverity = "danger" | "warning";

export interface BirdEventError {
  id: string;
  birdEvent: BirdEvent;
  reason: string;
  severity: ErrorSeverity;
}

type SexLabel = "male" | "female" | "unknown";

interface MeasurementRanges {
  weightLower: number;
  weightUpper: number;
  wingLower: number;
  wingUpper: number;
}

/**
 * Get sex label from sex code
 */
function getSexLabel(sexCode: string): SexLabel {
  return sexCode === "4" ? "male" : sexCode === "5" ? "female" : "unknown";
}

/**
 * Extract sex-specific ranges from SpeciesRange
 */
function getRangesForSex(speciesRange: SpeciesRange | undefined, sexCode: string): MeasurementRanges | null {
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
 * Check if a measurement is outside the MBO range
 * Returns error severity: 'warning' for MBO violations
 */
function checkMBOMeasurementRange(
  value: number,
  mboLower: number,
  mboUpper: number,
  measurementType: "Weight" | "Wing",
  sexLabel: SexLabel,
  unit: "g" | "mm"
): string | null {
  if (value <= 0 || mboLower <= 0) return null;

  if (value < mboLower || value > mboUpper) {
    return `${measurementType} ${value}${unit} is outside of MBO ${sexLabel} range (${mboLower}-${mboUpper}${unit})`;
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
 * Check a single event for out-of-range measurements against both Pyle and MBO ranges
 */
function checkEventMeasurements(event: BirdEvent, pyleRange?: SpeciesRange, mboRange?: SpeciesRange): BirdEventError[] {
  const errors: BirdEventError[] = [];
  const sexLabel = getSexLabel(event.sex);

  // Check fat value
  const fatReason = checkFatValue(event.fat);
  if (fatReason) {
    errors.push({
      id: `${event.id}-fat-${sanitizeForFirebasePath(fatReason)}`,
      birdEvent: event,
      reason: fatReason,
      severity: "danger",
    });
  }

  // Get sex-specific ranges
  const pyleRanges = getRangesForSex(pyleRange, event.sex);
  const mboRanges = getRangesForSex(mboRange, event.sex);

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
        birdEvent: event,
        reason: pyleWingReason,
        severity: "danger",
      });
    }
  }

  // Check MBO range (warning level)
  if (mboRanges) {
    const mboWeightReason = checkMBOMeasurementRange(
      event.weight,
      mboRanges.weightLower,
      mboRanges.weightUpper,
      "Weight",
      sexLabel,
      "g"
    );
    if (mboWeightReason) {
      errors.push({
        id: `${event.id}-mbo-weight-${sanitizeForFirebasePath(mboWeightReason)}`,
        birdEvent: event,
        reason: mboWeightReason,
        severity: "warning",
      });
    }

    const mboWingReason = checkMBOMeasurementRange(
      event.wing,
      mboRanges.wingLower,
      mboRanges.wingUpper,
      "Wing",
      sexLabel,
      "mm"
    );
    if (mboWingReason) {
      errors.push({
        id: `${event.id}-mbo-wing-${sanitizeForFirebasePath(mboWingReason)}`,
        birdEvent: event,
        reason: mboWingReason,
        severity: "warning",
      });
    }
  }

  return errors;
}

/**
 * Finds errors in an array of bird events.
 * Checks for sex changes (4 ↔ 5), species changes, same-day recaptures, and out-of-normal measurements.
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
        birdEvent: currentEvent,
        reason: "Sex changed from 4 to 5",
        severity: "danger",
      });
    } else if (previousSex === "5" && currentSex === "4") {
      errors.push({
        id: `${currentEvent.id}-sex-change-5-to-4`,
        birdEvent: currentEvent,
        reason: "Sex changed from 5 to 4",
        severity: "danger",
      });
    } else if (currentSpecies !== previousSpecies) {
      errors.push({
        id: `${currentEvent.id}-species-change`,
        birdEvent: currentEvent,
        reason: `Species changed from ${previousSpecies} to ${currentSpecies}`,
        severity: "danger",
      });
    }

    // Check for same-day recapture
    if (currentEvent.date === previousEvent.date) {
      errors.push({
        id: `${currentEvent.id}-same-day-recapture`,
        birdEvent: currentEvent,
        reason: "Bird was already captured today - should be released without logging",
        severity: "danger",
      });
    }
  }

  // Check all events for out-of-normal measurements
  if (magicTable) {
    for (const event of events) {
      const pyleRange = magicTable.pyle?.[event.species];
      const mboRange = magicTable.mbo?.[event.species];

      const measurementErrors = checkEventMeasurements(event, pyleRange, mboRange);
      errors.push(...measurementErrors);
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
    if (bandId == "999999999") continue; // Skip test band

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
  const mboRange = magicTable?.mbo?.[formData.species];

  // Get sex-specific ranges
  const pyleRanges = getRangesForSex(pyleRange, formData.sex);
  const mboRanges = getRangesForSex(mboRange, formData.sex);

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

  // Check MBO ranges (warning)
  if (mboRanges) {
    const mboWingReason = checkMBOMeasurementRange(
      wingValue,
      mboRanges.wingLower,
      mboRanges.wingUpper,
      "Wing",
      sexLabel,
      "mm"
    );
    if (mboWingReason) {
      messages.push({ text: mboWingReason, severity: "warning" });
    }

    const mboWeightReason = checkMBOMeasurementRange(
      weightValue,
      mboRanges.weightLower,
      mboRanges.weightUpper,
      "Weight",
      sexLabel,
      "g"
    );
    if (mboWeightReason) {
      messages.push({ text: mboWeightReason, severity: "warning" });
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

  // Check if bird is being recaptured on the same day
  if (pastBirdEvents.length > 0 && formData.date) {
    const sameDayCapture = pastBirdEvents.some((capture) => capture.date === formData.date);
    if (sameDayCapture) {
      messages.push({
        text: "Bird was already captured today - should be released without logging",
        severity: "danger",
      });
    }
  }

  return messages;
}

// Legacy aliases for backward compatibility
/** @deprecated Use findBirdEventErrors instead */
export const findConflicts = findBirdEventErrors;
/** @deprecated Use findErrorsInEvents instead */
export const findConflictsInEvents = findErrorsInEvents;
