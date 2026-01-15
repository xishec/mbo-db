import { useMemo } from "react";
import { Modal, ModalContent, ModalHeader, ModalBody, ModalFooter, Button } from "@heroui/react";
import BirdEventsTable from "../PageContent/Programs/Captures/BirdEventsTable";
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

interface ErrorsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function ErrorsModal({ isOpen, onClose }: ErrorsModalProps) {
  const { birdEventsMap, bandIdToBirdEventIdsMap } = useData();

  // Find all bird events with sex conflicts (4 -> 5 or 5 -> 4) or species conflicts
  const conflictingBirdEvents = useMemo(() => {
    return findSexConflicts(bandIdToBirdEventIdsMap, birdEventsMap);
  }, [bandIdToBirdEventIdsMap, birdEventsMap]);

  return (
    <Modal isOpen={isOpen} onClose={onClose} size="5xl" scrollBehavior="inside">
      <ModalContent>
        <ModalHeader className="flex flex-col gap-1">
          <div className="flex justify-between items-center">
            <div>
              <h2 className="text-xl font-bold">Data Errors</h2>
              <p className="text-sm text-default-500">Conflicting Bird Events: Sex changed (4↔5) or Species changed</p>
            </div>
          </div>
        </ModalHeader>

        <ModalBody>
          <BirdEventsTable
            birdEvents={conflictingBirdEvents}
            maxTableHeight={600}
            allowInspectBandId
          />
        </ModalBody>

        <ModalFooter className="gap-4 p-8 pt-4">
          <Button color="primary" onPress={onClose}>
            Close
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
}
