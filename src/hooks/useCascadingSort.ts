import { useCallback, useState } from "react";
import type { SortDescriptor } from "@heroui/react";

const MAX_SORT_DESCRIPTORS = 3;

/**
 * Hook for multi-column cascading sort.
 * Clicking a column promotes it to primary sort; holds up to 3 levels.
 */
export function useCascadingSort(initial: SortDescriptor[] = []) {
  const [sortDescriptors, setSortDescriptors] = useState<SortDescriptor[]>(initial);

  const handleSortChange = useCallback((descriptor: SortDescriptor) => {
    setSortDescriptors((prev) => {
      const existingIndex = prev.findIndex((d) => d.column === descriptor.column);

      if (existingIndex === 0) {
        const updated = [...prev];
        updated[0] = descriptor;
        return updated;
      }
      if (existingIndex > 0) {
        const updated = prev.filter((d) => d.column !== descriptor.column);
        return [descriptor, ...updated];
      }
      return [descriptor, ...prev].slice(0, MAX_SORT_DESCRIPTORS);
    });
  }, []);

  const resetSort = useCallback(() => setSortDescriptors([]), []);

  return { sortDescriptors, handleSortChange, resetSort } as const;
}

/**
 * Generic cascading sort comparator.
 * numericColumns: set of column keys that should be compared numerically.
 * specialSort: optional per-column override (return a number or undefined to fall through).
 */
export function cascadingSort<T>(
  rows: T[],
  sortDescriptors: SortDescriptor[],
  numericColumns: Set<string>,
  specialSort?: (column: string, a: T, b: T) => number | undefined
): T[] {
  if (sortDescriptors.length === 0) return rows;

  return [...rows].sort((a, b) => {
    for (const descriptor of sortDescriptors) {
      const column = descriptor.column as string;
      let cmp: number | undefined;

      if (specialSort) {
        cmp = specialSort(column, a, b);
      }

      if (cmp === undefined) {
        const first = (a as Record<string, unknown>)[column];
        const second = (b as Record<string, unknown>)[column];

        if (numericColumns.has(column)) {
          cmp = (parseFloat(String(first)) || 0) - (parseFloat(String(second)) || 0);
        } else {
          cmp = String(first).localeCompare(String(second));
        }
      }

      if (cmp !== 0) {
        return descriptor.direction === "descending" ? -cmp : cmp;
      }
    }
    return 0;
  });
}
