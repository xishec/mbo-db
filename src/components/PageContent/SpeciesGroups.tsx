import { useMemo, useState } from "react";
import { SPECIES_GROUPS } from "../../types/DET";
import { SPECIES_MAP } from "../../types/species";
import { useData } from "../../services/useData";
import SpeciesInfoModal from "../Modals/SpeciesInfoModal";

type SpeciesGroup = {
  name: string;
  speciesCodes: string[];
};

export default function SpeciesGroups() {
  const { speciesInfoMap } = useData();
  const [selectedSpeciesCode, setSelectedSpeciesCode] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const groupedSpecies = useMemo<SpeciesGroup[]>(() => {
    const groups: SpeciesGroup[] = [];
    let currentGroup: SpeciesGroup | null = null;

    for (const item of SPECIES_GROUPS) {
      if (item.type === "group") {
        currentGroup = { name: item.groupName, speciesCodes: [] };
        groups.push(currentGroup);
        continue;
      }

      if (!currentGroup) {
        currentGroup = { name: "Other", speciesCodes: [] };
        groups.push(currentGroup);
      }

      currentGroup.speciesCodes.push(item.code);
    }

    return groups;
  }, []);

  const handleRowClick = (code: string) => {
    setSelectedSpeciesCode(code);
    setIsModalOpen(true);
  };

  const handleModalOpenChange = (open: boolean) => {
    setIsModalOpen(open);
    if (!open) {
      setSelectedSpeciesCode(null);
    }
  };

  return (
    <div className="px-8 py-8">
      <div className="mx-auto max-w-7xl">
        <div className="mb-8">
          <h1 className="text-3xl font-semibold text-default-900">Species Catalog</h1>
        </div>

        <div className="space-y-10 pb-[200px]">
          {groupedSpecies.map((group) => (
            <section key={group.name}>
              <div className="flex items-baseline justify-between">
                <h2 className="text-xl font-semibold text-default-900">{group.name}</h2>
                <span className="text-xs text-default-400">{group.speciesCodes.length} species</span>
              </div>

              <div className="mt-3 overflow-hidden rounded-medium border border-default-200">
                <div className="grid grid-cols-[110px_minmax(0,1fr)_minmax(0,1fr)_140px] bg-default-100 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-default-600">
                  <div>Code</div>
                  <div>English</div>
                  <div>French</div>
                  <div className="text-right">Captures</div>
                </div>
                <div className="divide-y divide-default-200">
                  {group.speciesCodes.map((code) => {
                    const species = SPECIES_MAP[code];
                    const englishName = species?.speciesDescriptionMBO ?? species?.speciesDescriptionCMMN ?? "Unknown";
                    const frenchName = species?.speciesFrench ?? "Unknown";
                    const totalCaptures = speciesInfoMap[code]?.totalCaptures ?? 0;

                    return (
                      <button
                        key={code}
                        type="button"
                        className="grid w-full grid-cols-[110px_minmax(0,1fr)_minmax(0,1fr)_140px] px-4 py-2 text-left text-sm hover:bg-default-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
                        onClick={() => handleRowClick(code)}
                      >
                        <div className="font-mono text-default-900">{code}</div>
                        <div className="text-default-900">{englishName}</div>
                        <div className="text-default-900">{frenchName}</div>
                        <div className="text-right tabular-nums text-default-900">{totalCaptures}</div>
                      </button>
                    );
                  })}
                </div>
              </div>
            </section>
          ))}
        </div>
      </div>

      {selectedSpeciesCode && (
        <SpeciesInfoModal isOpen={isModalOpen} onOpenChange={handleModalOpenChange} speciesCode={selectedSpeciesCode} />
      )}
    </div>
  );
}
