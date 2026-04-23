export const INDEPENDENT_MAP_NAMES = [
  "dismissedConflictsMap",
  "DETsMap",
  "magicTable",
  "volunteersFullNameMap",
  "bandGroupNotesMap",
] as const;

export type IndependentMapName = typeof INDEPENDENT_MAP_NAMES[number];
