import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { Button, Input, Table, TableHeader, TableColumn, TableBody, TableRow, TableCell, Divider } from "@heroui/react";
import { SPECIES_MAP } from "../../../types/species";
import { SPECIES_GROUPS, DET_SPECIES_CODES_SET, type SpeciesListItem } from "../../../types/DET";
import SpeciesTooltip from "../../Helper/Info/SpeciesTooltip";
import ModalShell, { ModalBodyShell, ModalFooterShell, ModalHeaderShell } from "../ModalShell";
import { modalInputProps, modalCancelButtonProps, modalPrimaryButtonProps } from "../modalDefaults";

interface DETUnifiedSpeciesModalProps {
  isOpen: boolean;
  onOpenChange: () => void;
  observedSpeciesCount: Record<string, number>;
  censusSpeciesCount: Record<string, number>;
  bandedSpeciesCount: Record<string, number>;
  repeatSpeciesCount: Record<string, number>;
  returnSpeciesCount: Record<string, number>;
  DETSpeciesCount: Record<string, number>;
  onSave: (data: {
    observedSpeciesCount: Record<string, number>;
    censusSpeciesCount: Record<string, number>;
    DETSpeciesCount: Record<string, number>;
  }) => void;
}

export default function DETUnifiedSpeciesModal({
  isOpen,
  onOpenChange,
  observedSpeciesCount: initialObservedSpeciesCount,
  censusSpeciesCount: initialCensusSpeciesCount,
  bandedSpeciesCount,
  repeatSpeciesCount,
  returnSpeciesCount,
  DETSpeciesCount: initialDETSpeciesCount,
  onSave,
}: DETUnifiedSpeciesModalProps) {
  const [observedSpeciesCount, setObservedSpeciesCount] = useState<Record<string, number>>(initialObservedSpeciesCount);
  const [censusSpeciesCount, setCensusSpeciesCount] = useState<Record<string, number>>(initialCensusSpeciesCount);
  const [DETSpeciesCount, setDETSpeciesCount] = useState<Record<string, number>>(initialDETSpeciesCount);
  const [customSpeciesCodes, setCustomSpeciesCodes] = useState<Set<string>>(new Set());
  const [newSpeciesCode, setNewSpeciesCode] = useState("");

  const wasOpenRef = useRef(false);
  useEffect(() => {
    if (!isOpen) {
      wasOpenRef.current = false;
      return;
    }

    // Only sync from props when modal first opens
    if (wasOpenRef.current) return;
    wasOpenRef.current = true;

    setObservedSpeciesCount(initialObservedSpeciesCount);
    setCensusSpeciesCount(initialCensusSpeciesCount);
    setDETSpeciesCount(initialDETSpeciesCount);

    // Collect all species codes from the counts to identify custom species
    const allSpeciesCodes = new Set<string>();
    Object.keys(initialObservedSpeciesCount).forEach((code) => allSpeciesCodes.add(code));
    Object.keys(initialCensusSpeciesCount).forEach((code) => allSpeciesCodes.add(code));
    Object.keys(bandedSpeciesCount).forEach((code) => allSpeciesCodes.add(code));
    Object.keys(repeatSpeciesCount).forEach((code) => allSpeciesCodes.add(code));
    Object.keys(returnSpeciesCount).forEach((code) => allSpeciesCodes.add(code));
    Object.keys(initialDETSpeciesCount).forEach((code) => allSpeciesCodes.add(code));

    const custom = new Set<string>();
    allSpeciesCodes.forEach((code) => {
      if (!DET_SPECIES_CODES_SET.has(code)) {
        custom.add(code);
      }
    });
    setCustomSpeciesCodes(custom);
  }, [initialObservedSpeciesCount, initialCensusSpeciesCount, initialDETSpeciesCount, isOpen]);

  // Memoize custom species list - only recalculates when customSpeciesCodes changes
  const customSpeciesList = useMemo(() => {
    return Array.from(customSpeciesCodes)
      .map((code) => {
        // If it exists in SPECIES_MAP, use that data
        if (SPECIES_MAP[code]) {
          return SPECIES_MAP[code];
        }
        // Otherwise, create a minimal species object
        return {
          code,
          pseudoSpeciesType: "Species",
          speciesDescriptionMBO: code,
          speciesDescriptionCMMN: code,
          speciesFrench: "",
          speciesScientific: "",
        };
      })
      .sort((a, b) => a.code.localeCompare(b.code));
  }, [customSpeciesCodes]);

  // Create a flat list with group headers and species, maintaining order
  // Uses pre-processed SPECIES_GROUPS and adds custom species at the end
  const filteredSpeciesWithGroups = useMemo(() => {
    const items: SpeciesListItem[] = [...SPECIES_GROUPS];

    // Add custom species at the end with a group header
    if (customSpeciesList.length > 0) {
      items.push({ type: "group", groupName: "CUSTOM" });
      customSpeciesList.forEach((s) => {
        items.push({ type: "species", code: s.code });
      });
    }

    return items;
  }, [customSpeciesList]);

  // Memoized function to add custom species
  const addCustomSpeciesIfNeeded = useCallback((speciesCode: string) => {
    if (!DET_SPECIES_CODES_SET.has(speciesCode)) {
      setCustomSpeciesCodes((prev) => {
        if (!prev.has(speciesCode)) {
          return new Set([...prev, speciesCode]);
        }
        return prev;
      });
    }
  }, []);

  const updateObservedCount = useCallback(
    (speciesCode: string, value: string) => {
      const numValue = value === "" ? 0 : Number(value) || 0;
      if (numValue === 0) {
        setObservedSpeciesCount((prev) => {
          const updated = { ...prev };
          delete updated[speciesCode];
          return updated;
        });
      } else {
        setObservedSpeciesCount((prev) => ({ ...prev, [speciesCode]: numValue }));
        addCustomSpeciesIfNeeded(speciesCode);
      }
    },
    [addCustomSpeciesIfNeeded]
  );

  const updateCensusCount = useCallback(
    (speciesCode: string, value: string) => {
      const numValue = value === "" ? 0 : Number(value) || 0;
      if (numValue === 0) {
        setCensusSpeciesCount((prev) => {
          const updated = { ...prev };
          delete updated[speciesCode];
          return updated;
        });
      } else {
        setCensusSpeciesCount((prev) => ({ ...prev, [speciesCode]: numValue }));
        addCustomSpeciesIfNeeded(speciesCode);
      }
    },
    [addCustomSpeciesIfNeeded]
  );

  const updateDETCount = useCallback(
    (speciesCode: string, value: string) => {
      const numValue = value === "" ? 0 : Number(value) || 0;
      if (numValue === 0) {
        setDETSpeciesCount((prev) => {
          const updated = { ...prev };
          delete updated[speciesCode];
          return updated;
        });
      } else {
        setDETSpeciesCount((prev) => ({ ...prev, [speciesCode]: numValue }));
        addCustomSpeciesIfNeeded(speciesCode);
      }
    },
    [addCustomSpeciesIfNeeded]
  );

  const handleAddCustomSpecies = useCallback(() => {
    const code = newSpeciesCode.trim().toUpperCase();
    if (!code) return;

    // Check if already exists
    if (DET_SPECIES_CODES_SET.has(code) || customSpeciesCodes.has(code)) {
      setNewSpeciesCode("");
      return;
    }

    // Add to custom species
    setCustomSpeciesCodes((prev) => new Set([...prev, code]));
    setNewSpeciesCode("");
  }, [newSpeciesCode, customSpeciesCodes]);

  // Get only species items (no group headers) for tab navigation
  const speciesCodes = useMemo(
    () => filteredSpeciesWithGroups.filter((item) => item.type === "species").map((item) => item.code),
    [filteredSpeciesWithGroups]
  );

  const handleTabDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>, code: string, column: string) => {
      if (e.key !== "Tab") return;
      e.preventDefault();
      const currentIdx = speciesCodes.indexOf(code);
      const nextIdx = e.shiftKey ? currentIdx - 1 : currentIdx + 1;
      if (nextIdx >= 0 && nextIdx < speciesCodes.length) {
        const nextInput = document.querySelector<HTMLInputElement>(
          `input[data-species="${speciesCodes[nextIdx]}"][data-column="${column}"]`
        );
        nextInput?.focus();
        nextInput?.select();
      }
    },
    [speciesCodes]
  );

  const handleSave = () => {
    onSave({
      observedSpeciesCount,
      censusSpeciesCount,
      DETSpeciesCount,
    });
    onOpenChange();
  };

  return (
    <ModalShell
      modalProps={{
        isOpen,
        onOpenChange,
        className: "!max-w-[1200px]",
      }}
    >
      {(onClose) => (
        <>
          <ModalHeaderShell>Edit Species Data</ModalHeaderShell>
          <ModalBodyShell>
            <div className="flex flex-col gap-4">
              {/* Table */}
              <div className="rounded-medium border border-default-100">
                <Table
                  aria-label="Species data entry table"
                  isHeaderSticky
                  classNames={{
                    wrapper: "max-h-[600px] overscroll-contain",
                  }}
                >
                  <TableHeader>
                    <TableColumn width={200}>Species</TableColumn>
                    <TableColumn width={100}>Obs</TableColumn>
                    <TableColumn width={100}>Cns</TableColumn>
                    <TableColumn width={100}>Band</TableColumn>
                    <TableColumn width={100}>Repeat</TableColumn>
                    <TableColumn width={100}>Ret</TableColumn>
                    <TableColumn width={100}>DET</TableColumn>
                  </TableHeader>
                  <TableBody items={filteredSpeciesWithGroups}>
                    {(item) => {
                      if (item.type === "group") {
                        return (
                          <TableRow key={`group-${item.groupName}`}>
                            <TableCell colSpan={7}>
                              <div className="flex items-center gap-2 py-2">
                                <Divider className="flex-1" />
                                <span className="font-medium text-sm px-2">{item.groupName}</span>
                                <Divider className="flex-1" />
                              </div>
                            </TableCell>
                          </TableRow>
                        );
                      }

                      const code = item.code;
                      const species = SPECIES_MAP[code];
                      return (
                        <TableRow key={code}>
                          <TableCell>
                            <div className="flex flex-col">
                              <span className="font-medium text-sm">
                                <SpeciesTooltip speciesCode={code} />
                              </span>
                              {species && species.speciesDescriptionMBO !== code && (
                                <span className="text-xs text-gray-500">{species.speciesDescriptionMBO}</span>
                              )}
                            </div>
                          </TableCell>
                          <TableCell className="p-1">
                            <input
                              type="number"
                              data-species={code}
                              data-column="obs"
                              defaultValue={observedSpeciesCount[code] || ""}
                              onBlur={(e) => updateObservedCount(code, e.target.value)}
                              onKeyDown={(e) => handleTabDown(e, code, "obs")}
                              min={0}
                              className="w-full text-center text-sm border border-default-200 rounded-medium px-2 py-1.5 focus:outline-none focus:border-primary"
                            />
                          </TableCell>
                          <TableCell className="p-1">
                            <input
                              type="number"
                              data-species={code}
                              data-column="cns"
                              defaultValue={censusSpeciesCount[code] || ""}
                              onBlur={(e) => updateCensusCount(code, e.target.value)}
                              onKeyDown={(e) => handleTabDown(e, code, "cns")}
                              min={0}
                              className="w-full text-center text-sm border border-default-200 rounded-medium px-2 py-1.5 focus:outline-none focus:border-primary"
                            />
                          </TableCell>
                          <TableCell className="p-1">
                            <span className="block text-center text-sm">{bandedSpeciesCount[code] || ""}</span>
                          </TableCell>
                          <TableCell className="p-1">
                            <span className="block text-center text-sm">{repeatSpeciesCount[code] || ""}</span>
                          </TableCell>
                          <TableCell className="p-1">
                            <span className="block text-center text-sm">{returnSpeciesCount[code] || ""}</span>
                          </TableCell>
                          <TableCell className="p-1">
                            <input
                              type="number"
                              data-species={code}
                              data-column="det"
                              defaultValue={DETSpeciesCount[code] || ""}
                              onBlur={(e) => updateDETCount(code, e.target.value)}
                              onKeyDown={(e) => handleTabDown(e, code, "det")}
                              min={0}
                              className="w-full text-center text-sm border border-default-200 rounded-medium px-2 py-1.5 focus:outline-none focus:border-primary"
                            />
                          </TableCell>
                        </TableRow>
                      );
                    }}
                  </TableBody>
                </Table>
              </div>
            </div>
          </ModalBodyShell>
          <ModalFooterShell>
            <div className="flex gap-2 items-end mr-auto max-w-sm">
              <Input
                value={newSpeciesCode}
                onValueChange={setNewSpeciesCode}
                {...modalInputProps}
                placeholder="Custom species code"
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    handleAddCustomSpecies();
                  }
                }}
              />
              <Button
                color="primary"
                variant="flat"
                onPress={handleAddCustomSpecies}
                isDisabled={!newSpeciesCode.trim()}
                size="md"
              >
                Add
              </Button>
            </div>
            <Button {...modalCancelButtonProps} onPress={onClose}>
              Cancel
            </Button>
            <Button {...modalPrimaryButtonProps} onPress={handleSave}>
              Save
            </Button>
          </ModalFooterShell>
        </>
      )}
    </ModalShell>
  );
}
