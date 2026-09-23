import { useMemo } from "react";
import { useAppStore } from "../../stores/useAppStore";
import { getSpeciesDisplayCode, resolveSpeciesKey, SPECIES_MAP } from "../../types/species";
import SpeciesTooltip from "../Helper/Info/SpeciesTooltip";

interface OWLDETSpeciesTableProps {
  bandedSpeciesCount: Record<string, number>;
  repeatSpeciesCount: Record<string, number>;
  returnSpeciesCount: Record<string, number>;
}

interface SpeciesRow {
  code: string;
  banded: number;
  repeats: number;
  returns: number;
}

export default function OWLDETSpeciesTable({
  bandedSpeciesCount,
  repeatSpeciesCount,
  returnSpeciesCount,
}: OWLDETSpeciesTableProps) {
  const speciesAliasesMap = useAppStore((state) => state.speciesAliasesMap);
  const rows = useMemo(() => {
    const rowsBySpecies = new Map<string, SpeciesRow>();

    const addCounts = (counts: Record<string, number>, field: keyof Omit<SpeciesRow, "code">) => {
      Object.entries(counts).forEach(([species, count]) => {
        const code = resolveSpeciesKey(species, speciesAliasesMap);
        const row = rowsBySpecies.get(code) ?? { code, banded: 0, repeats: 0, returns: 0 };
        row[field] += Number(count) || 0;
        rowsBySpecies.set(code, row);
      });
    };

    addCounts(bandedSpeciesCount, "banded");
    addCounts(repeatSpeciesCount, "repeats");
    addCounts(returnSpeciesCount, "returns");

    return Array.from(rowsBySpecies.values()).sort((left, right) => left.code.localeCompare(right.code));
  }, [bandedSpeciesCount, repeatSpeciesCount, returnSpeciesCount, speciesAliasesMap]);

  return (
    <div className="w-full overflow-auto rounded-medium border border-default-200 bg-content1">
      <table className="min-w-full border-separate border-spacing-0 text-sm" aria-label="OWL species data">
        <thead className="bg-default-100">
          <tr>
            {[
              ["Species", "text-left"],
              ["Band", "text-right"],
              ["Repeat", "text-right"],
              ["Ret", "text-right"],
            ].map(([header, alignment]) => (
              <th
                key={header}
                scope="col"
                className={`border-b border-r border-default-200 px-3 py-2 font-semibold text-default-700 last:border-r-0 ${alignment}`}
              >
                {header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.length > 0 ? (
            rows.map((row) => (
              <tr key={row.code} className="even:bg-default-50">
                <td className="border-b border-r border-default-200 px-3 py-2">
                  <SpeciesTooltip speciesCode={row.code}>
                    {SPECIES_MAP[row.code]?.speciesDescriptionMBO ||
                      SPECIES_MAP[row.code]?.speciesDescriptionCMMN ||
                      getSpeciesDisplayCode(row.code, speciesAliasesMap)}
                  </SpeciesTooltip>
                </td>
                <td className="border-b border-r border-default-200 px-3 py-2 text-right">{row.banded}</td>
                <td className="border-b border-r border-default-200 px-3 py-2 text-right">{row.repeats}</td>
                <td className="border-b border-default-200 px-3 py-2 text-right">{row.returns}</td>
              </tr>
            ))
          ) : (
            <tr>
              <td className="px-3 py-4 text-default-500" colSpan={4}>
                No bird events found for this program and date.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
