import { useMemo } from "react";
import BirdEventsTable from "./Programs/Captures/BirdEventsTable";
import { useData } from "../../services/useData";
import type { BirdEvent, BirdEventsMap, BandIdToBirdEventIdsMap } from "../../types";

/**
 * Scans through bands to find conflicting changes.
 * Returns bird events where sex changed from "4" to "5" or from "5" to "4" or species changed for the same band.
 */
function findSexConflicts(bandIdToBirdEventIdsMap: BandIdToBirdEventIdsMap, birdEventsMap: BirdEventsMap): BirdEvent[] {
  const conflicts: BirdEvent[] = [];

  // Iterate through each band
  for (const bandId in bandIdToBirdEventIdsMap) {
    const eventIds = bandIdToBirdEventIdsMap[bandId];

    // Check consecutive events for this band
    for (let i = 1; i < eventIds.length; i++) {
      const currentEvent = birdEventsMap[eventIds[i]];
      const previousEvent = birdEventsMap[eventIds[i - 1]];

      if (!currentEvent || !previousEvent) {
        continue;
      }

      // Check for sex conflict: 4 -> 5 or 5 -> 4
      const currentSex = currentEvent.sex;
      const previousSex = previousEvent.sex;

      // Check for species conflict
      const currentSpecies = currentEvent.species;
      const previousSpecies = previousEvent.species;

      if (
        (previousSex === "4" && currentSex === "5") ||
        (previousSex === "5" && currentSex === "4") ||
        currentSpecies !== previousSpecies
      ) {
        conflicts.push(currentEvent);
      }
    }
  }

  return conflicts;
}

export default function Errors() {
  const { birdEventsMap, bandIdToBirdEventIdsMap } = useData();

  // Find all bird events with sex conflicts (4 -> 5 or 5 -> 4) or species conflicts
  const conflictingBirdEvents = useMemo(() => {
    return findSexConflicts(bandIdToBirdEventIdsMap, birdEventsMap);
  }, [bandIdToBirdEventIdsMap, birdEventsMap]);

  return (
    <div className="text-center p-4">
      <h2 className="text-3xl font-bold mb-4">Errors</h2>
      <p className="mb-4">
        Conflicting Bird Events: Sex changed (4↔5) or Species changed ({conflictingBirdEvents.length} found)
      </p>
      <BirdEventsTable
        captures={conflictingBirdEvents}
        maxTableHeight={600}
        sortDescriptors={[{ column: "date", direction: "descending" }]}
      />
    </div>
  );
}
