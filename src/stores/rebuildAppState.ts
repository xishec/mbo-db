import type { AppState } from "./useAppStore";
import type { BandResetsMap, BirdEventsMap } from "../types";
import {
  computeBandSizeToBandIdMap,
  computeSpeciesInfoMap,
  rebuildMapsFromEvents,
} from "./derive";

export type RebuiltBirdEventState = Pick<
  AppState,
  | "bandIdToBirdEventIdsMap"
  | "bandGroupsMap"
  | "programsMap"
  | "yearsToProgramMap"
  | "volunteerStatsMap"
  | "bandSizeToBandIdMap"
  | "speciesInfoMap"
  | "selectedProgram"
>;

/** Rebuild all state derived from the current bird-event collection. */
export function rebuildBirdEventState(
  events: BirdEventsMap,
  state: AppState,
  bandResetsMap: BandResetsMap = state.bandResetsMap
): RebuiltBirdEventState {
  const { bandIdMap, bandGroups, programs, years, volunteerStats } = rebuildMapsFromEvents(
    events,
    state.volunteersMap,
    bandResetsMap
  );

  // Preserve stored fields and empty programs that have no active events.
  for (const [programId, existingProgram] of Object.entries(state.programsMap)) {
    programs[programId] = programs[programId]
      ? { ...existingProgram, ...programs[programId] }
      : {
          id: existingProgram.id,
          displayName: existingProgram.displayName,
          bandGroupIds: [],
          recaptureIds: [],
        };
  }

  return {
    bandIdToBirdEventIdsMap: bandIdMap,
    bandGroupsMap: bandGroups,
    programsMap: programs,
    yearsToProgramMap: years,
    volunteerStatsMap: volunteerStats,
    bandSizeToBandIdMap: computeBandSizeToBandIdMap(events, bandGroups, bandResetsMap),
    speciesInfoMap: computeSpeciesInfoMap(events, state.speciesAliasesMap, bandResetsMap),
    selectedProgram: state.selectedProgram ? programs[state.selectedProgram.id] ?? null : null,
  };
}
