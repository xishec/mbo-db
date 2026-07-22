import { create } from "zustand";
import type { User } from "firebase/auth";
import type {
  BandGroupsMap,
  BandIdToBirdEventIdsMap,
  BandSizeToBandIdMap,
  BandResetsMap,
  DETsMap,
  DismissedConflictsMap,
  MagicTable,
  ProgramsMap,
  SpeciesInfoMap,
  VolunteerStatsMap,
  VolunteersMap,
  YearToProgramMap,
  Program,
  SpeciesAliasesMap,
  SpeciesOverridesMap,
} from "../types";

export type SyncResult = "success" | "error" | null;
export type Milestone = { banderCode: string; count: number } | null;

// Everything the app reads. Held in a Zustand store outside React so
// updates don't cascade through every consumer. Consumers subscribe
// with selectors — they only re-render when their slice changes.
//
// Note: birdEventsMap lives in services/birdEventsStore (Map singleton),
// NOT here. It's mutated in place on saves; keeping it out of Zustand
// avoids the O(N) copy-on-write. Consumers: `useBirdEventsVersion` +
// `birdEventsStore.get(id)`.
export interface AppState {
  // Loading
  isLoading: boolean;
  loadingStatus: string;
  error: string | null;

  // Auth
  user: User | null;
  isAdmin: boolean;
  authReady: boolean;

  // Connectivity
  isOnline: boolean;

  // Selected program
  selectedProgram: Program | null;

  // Data
  yearsToProgramMap: YearToProgramMap;
  programsMap: ProgramsMap;
  bandIdToBirdEventIdsMap: BandIdToBirdEventIdsMap;
  bandGroupsMap: BandGroupsMap;
  magicTable: MagicTable;
  bandSizeToBandIdMap: BandSizeToBandIdMap;
  dismissedConflictsMap: DismissedConflictsMap;
  DETsMap: DETsMap;
  volunteersMap: VolunteersMap;
  volunteerStatsMap: VolunteerStatsMap;
  bandGroupNotesMap: Record<string, string>;
  speciesAliasesMap: SpeciesAliasesMap;
  speciesOverridesMap: SpeciesOverridesMap;
  speciesInfoMap: SpeciesInfoMap;
  bandResetsMap: BandResetsMap;

  // Queue / sync
  pendingCount: number;
  queuedEventIds: Set<string>;
  lastSyncedAt: number | null;
  isSyncing: boolean;
  syncResult: SyncResult;
  // True while addBirdEvent's async tail (IDB write + optional online sync)
  // is in flight. The modal closes instantly on Save, but UI that would
  // race the persistence (like the Add + button) should stay disabled
  // until this clears.
  isSaving: boolean;

  // Milestones
  milestone: Milestone;
}

export const initialAppState: AppState = {
  isLoading: true,
  loadingStatus: "Initializing...",
  error: null,

  user: null,
  isAdmin: false,
  authReady: false,

  isOnline: typeof navigator !== "undefined" ? navigator.onLine : true,

  selectedProgram: null,

  yearsToProgramMap: {},
  programsMap: {},
  bandIdToBirdEventIdsMap: {},
  bandGroupsMap: {},
  magicTable: { pyle: {} },
  bandSizeToBandIdMap: {} as BandSizeToBandIdMap,
  dismissedConflictsMap: {},
  DETsMap: {},
  volunteersMap: {},
  volunteerStatsMap: {},
  bandGroupNotesMap: {},
  speciesAliasesMap: {},
  speciesOverridesMap: {},
  speciesInfoMap: {},
  bandResetsMap: {},

  pendingCount: 0,
  queuedEventIds: new Set(),
  lastSyncedAt: null,
  isSyncing: false,
  syncResult: null,
  isSaving: false,

  milestone: null,
};

export const useAppStore = create<AppState>()(() => initialAppState);

// Derived selectors
export const useUserEmail = () => useAppStore((s) => s.user?.email ?? null);
export const useIsLoggedIn = () => useAppStore((s) => !!s.user || !s.isOnline);

// Re-export for back-compat so consumers can keep the single import.
// Actions live in stores/actions.ts now.
export { useActions, actions } from "./actions";
