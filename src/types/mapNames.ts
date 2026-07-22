export const INDEPENDENT_MAP_NAMES = [
  "dismissedConflictsMap",
  "DETsMap",
  "magicTable",
  "volunteersMap",
  "bandGroupNotesMap",
  "speciesAliasesMap",
  "speciesOverridesMap",
  "bandResetsMap",
] as const;

export type IndependentMapName = (typeof INDEPENDENT_MAP_NAMES)[number];
