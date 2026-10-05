export const INDEPENDENT_MAP_NAMES = [
  "programsMap",
  "dismissedConflictsMap",
  "magicTable",
  "volunteersMap",
  "bandGroupNotesMap",
  "bandGroupSizesMap",
  "speciesAliasesMap",
  "bandResetsMap",
] as const;

export type IndependentMapName = (typeof INDEPENDENT_MAP_NAMES)[number];
