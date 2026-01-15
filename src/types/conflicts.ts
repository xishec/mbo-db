import type { BirdEvent, BirdEventsMap, BandIdToBirdEventIdsMap } from ".";

export interface Conflict {
  birdEvent: BirdEvent;
  reason: string;
}

/**
 * Finds conflicts in an array of bird events.
 * Checks for sex changes (4↔5) and species changes between consecutive events.
 */
export function findConflictsInEvents(events: BirdEvent[]): Conflict[] {
  if (events.length < 2) return [];
  
  const conflicts: Conflict[] = [];
  
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
  
  return conflicts;
}

/**
 * Scans through bands to find conflicting changes.
 * Returns bird events where sex changed from "4" to "5" or from "5" to "4" or species changed for the same band.
 */
export function findConflicts(bandIdToBirdEventIdsMap: BandIdToBirdEventIdsMap, birdEventsMap: BirdEventsMap): Conflict[] {
  const conflicts: Conflict[] = [];

  // Iterate through each band
  for (const bandId in bandIdToBirdEventIdsMap) {
    if (bandId == "999999999") continue; // Skip test band

    const eventIds = bandIdToBirdEventIdsMap[bandId];
    const events = eventIds
      .map(id => birdEventsMap[id])
      .filter(Boolean);
    
    conflicts.push(...findConflictsInEvents(events));
  }

  return conflicts;
}
