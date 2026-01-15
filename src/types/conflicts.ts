import type { BirdEvent, BirdEventsMap, BandIdToBirdEventIdsMap, MagicTable, SpeciesRange } from ".";

export interface Conflict {
  birdEvent: BirdEvent;
  reason: string;
}

/**
 * Check if a measurement is outside the 20% tolerance of Pyle range
 */
function checkMeasurementTolerance(
  value: number,
  pyleLower: number,
  pyleUpper: number,
  measurementType: "Weight" | "Wing",
  sexLabel: "male" | "female",
  unit: "g" | "mm",
  age?: string
): string | null {
  if (value <= 0 || pyleLower <= 0) return null;
  
  // For Wing measurements with age 4, use 90% tolerance instead of 20%
  const lowerBoundMultiplier = measurementType === "Wing" && age === "4" ? 0.1 : 0.8;
  const lowerBound = pyleLower * lowerBoundMultiplier;
  const upperBound = pyleUpper * 1.2; // 20% above
  
  if (value < lowerBound) {
    const percentage = measurementType === "Wing" && age === "4" ? "90%" : "20%";
    return `${measurementType} ${value}${unit} is ${percentage} below normal ${sexLabel} range (${pyleLower}-${pyleUpper}${unit})`;
  } else if (value > upperBound) {
    return `${measurementType} ${value}${unit} is 20% above normal ${sexLabel} range (${pyleLower}-${pyleUpper}${unit})`;
  }
  
  return null;
}

/**
 * Check a single event for out-of-range measurements
 */
function checkEventMeasurements(event: BirdEvent, speciesRange: SpeciesRange): string[] {
  const reasons: string[] = [];
  const sex = event.sex;
  
  if (sex === "5") {
    // Female
    const weightReason = checkMeasurementTolerance(
      event.weight,
      speciesRange.fWeightLower,
      speciesRange.fWeightUpper,
      "Weight",
      "female",
      "g",
      event.age
    );
    if (weightReason) reasons.push(weightReason);
    
    const wingReason = checkMeasurementTolerance(
      event.wing,
      speciesRange.fWingLower,
      speciesRange.fWingUpper,
      "Wing",
      "female",
      "mm",
      event.age
    );
    if (wingReason) reasons.push(wingReason);
  } else if (sex === "4") {
    // Male
    const weightReason = checkMeasurementTolerance(
      event.weight,
      speciesRange.mWeightLower,
      speciesRange.mWeightUpper,
      "Weight",
      "male",
      "g",
      event.age
    );
    if (weightReason) reasons.push(weightReason);
    
    const wingReason = checkMeasurementTolerance(
      event.wing,
      speciesRange.mWingLower,
      speciesRange.mWingUpper,
      "Wing",
      "male",
      "mm",
      event.age
    );
    if (wingReason) reasons.push(wingReason);
  }
  
  return reasons;
}

/**
 * Finds conflicts in an array of bird events.
 * Checks for sex changes (4↔5), species changes, and out-of-normal measurements.
 */
export function findConflictsInEvents(events: BirdEvent[], magicTable?: MagicTable): Conflict[] {
  const conflicts: Conflict[] = [];
  
  // Check consecutive events for sex/species changes
  for (let i = 1; i < events.length; i++) {
    const currentEvent = events[i];
    const previousEvent = events[i - 1];
    
    const currentSex = currentEvent.sex;
    const previousSex = previousEvent.sex;
    const currentSpecies = currentEvent.species;
    const previousSpecies = previousEvent.species;

    if (previousSex === "4" && currentSex === "5") {
      conflicts.push({
        birdEvent: currentEvent,
        reason: "Sex changed from 4 to 5"
      });
    } else if (previousSex === "5" && currentSex === "4") {
      conflicts.push({
        birdEvent: currentEvent,
        reason: "Sex changed from 5 to 4"
      });
    } else if (currentSpecies !== previousSpecies) {
      conflicts.push({
        birdEvent: currentEvent,
        reason: `Species changed from ${previousSpecies} to ${currentSpecies}`
      });
    }
  }
  
  // Check all events for out-of-normal measurements
  if (magicTable?.pyle) {
    for (const event of events) {
      const speciesRange = magicTable.pyle[event.species];
      if (!speciesRange) continue;
      
      const reasons = checkEventMeasurements(event, speciesRange);
      for (const reason of reasons) {
        conflicts.push({
          birdEvent: event,
          reason
        });
      }
    }
  }
  
  return conflicts;
}

/**
 * Scans through bands to find conflicting changes.
 * Returns bird events where sex changed from "4" to "5" or from "5" to "4" or species changed for the same band.
 */
export function findConflicts(bandIdToBirdEventIdsMap: BandIdToBirdEventIdsMap, birdEventsMap: BirdEventsMap, magicTable?: MagicTable): Conflict[] {
  const conflicts: Conflict[] = [];

  // Iterate through each band
  for (const bandId in bandIdToBirdEventIdsMap) {
    if (bandId == "999999999") continue; // Skip test band

    const eventIds = bandIdToBirdEventIdsMap[bandId];
    const events = eventIds
      .map(id => birdEventsMap[id])
      .filter(Boolean);
    
    conflicts.push(...findConflictsInEvents(events, magicTable));
  }

  return conflicts;
}
