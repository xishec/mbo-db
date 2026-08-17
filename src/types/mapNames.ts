export const INDEPENDENT_MAP_NAMES = [
  "dismissedConflictsMap",
  "DETsByDateMap",
  "magicTable",
  "volunteersMap",
  "bandGroupNotesMap",
  "speciesAliasesMap",
  "bandResetsMap",
] as const;

export type IndependentMapName = (typeof INDEPENDENT_MAP_NAMES)[number];
