import type { AppState } from "./useAppStore";
import type { BandResetsMap, BirdEventsMap } from "../types";
import {
  computeBandSizeToBandIdMap,
  computeSpeciesInfoMap,
  mergeStoredPrograms,
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

  // Preserve stored fields, date ranges, and empty programs that have no active events.
  mergeStoredPrograms(programs, years, state.programsMap);

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
