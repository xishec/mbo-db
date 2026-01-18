import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import {
  Modal,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
  Button,
  Input,
  Table,
  TableHeader,
  TableColumn,
  TableBody,
  TableRow,
  TableCell,
} from "@heroui/react";
import { SPECIES_MAP } from "../../types/species";
import { DETSpecies } from "../../types/DET";
import {
  modalBodyClass,
  modalFooterClass,
  modalHeaderClass,
  modalInputProps,
  modalCancelButtonProps,
  modalPrimaryButtonProps,
} from "./modalDefaults";

// Calculate DET species list once outside component - it never changes
const DET_SPECIES_CODES_SET = new Set(Object.values(DETSpecies) as string[]);
const DET_SPECIES_LIST = Array.from(DET_SPECIES_CODES_SET)
  .map((code) => SPECIES_MAP[code])
  .filter((species): species is NonNullable<typeof species> => species !== undefined)
  .sort((a, b) => a.code.localeCompare(b.code));


interface DETUnifiedSpeciesModalProps {
  isOpen: boolean;
  onOpenChange: () => void;
  observedSpeciesCount: Record<string, number>;
  censusSpeciesCount: Record<string, number>;
  returnSpeciesCount: Record<string, number>;
  DETSpeciesCount: Record<string, number>;
  onSave: (data: {
    observedSpeciesCount: Record<string, number>;
    censusSpeciesCount: Record<string, number>;
    returnSpeciesCount: Record<string, number>;
    DETSpeciesCount: Record<string, number>;
  }) => void;
}

export default function DETUnifiedSpeciesModal({
  isOpen,
  onOpenChange,
  observedSpeciesCount: initialObservedSpeciesCount,
  censusSpeciesCount: initialCensusSpeciesCount,
  returnSpeciesCount: initialReturnSpeciesCount,
  DETSpeciesCount: initialDETSpeciesCount,
  onSave,
}: DETUnifiedSpeciesModalProps) {
  const [observedSpeciesCount, setObservedSpeciesCount] = useState<Record<string, number>>(
    initialObservedSpeciesCount
  );
  const [censusSpeciesCount, setCensusSpeciesCount] = useState<Record<string, number>>(
    initialCensusSpeciesCount
  );
  const [returnSpeciesCount, setReturnSpeciesCount] = useState<Record<string, number>>(
    initialReturnSpeciesCount
  );
  const [DETSpeciesCount, setDETSpeciesCount] = useState<Record<string, number>>(initialDETSpeciesCount);
  const [customSpeciesCodes, setCustomSpeciesCodes] = useState<Set<string>>(new Set());
  const [newSpeciesCode, setNewSpeciesCode] = useState("");
  const processedInitialDataRef = useRef(false);

  useEffect(() => {
    if (!isOpen) {
      processedInitialDataRef.current = false;
      return;
    }

    /* eslint-disable react-hooks/set-state-in-effect */
    setObservedSpeciesCount(initialObservedSpeciesCount);
    setCensusSpeciesCount(initialCensusSpeciesCount);
    setReturnSpeciesCount(initialReturnSpeciesCount);
    setDETSpeciesCount(initialDETSpeciesCount);
    /* eslint-enable react-hooks/set-state-in-effect */

    // Only process initial data once when modal opens
    if (!processedInitialDataRef.current) {
      // Collect all species codes from the counts to identify custom species
      const allSpeciesCodes = new Set<string>();
      Object.keys(initialObservedSpeciesCount).forEach((code) => allSpeciesCodes.add(code));
      Object.keys(initialCensusSpeciesCount).forEach((code) => allSpeciesCodes.add(code));
      Object.keys(initialReturnSpeciesCount).forEach((code) => allSpeciesCodes.add(code));
      Object.keys(initialDETSpeciesCount).forEach((code) => allSpeciesCodes.add(code));

      // Find custom species (not in DET enum)
      const custom = new Set<string>();
      allSpeciesCodes.forEach((code) => {
        if (!DET_SPECIES_CODES_SET.has(code)) {
          custom.add(code);
        }
      });
      setCustomSpeciesCodes(custom);
      processedInitialDataRef.current = true;
    }
  }, [
    initialObservedSpeciesCount,
    initialCensusSpeciesCount,
    initialReturnSpeciesCount,
    initialDETSpeciesCount,
    isOpen,
  ]);

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

  // Get all species (DET enum + custom) - only recalculates when custom list changes
  const filteredSpecies = useMemo(() => {
    return [...DET_SPECIES_LIST, ...customSpeciesList];
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

  const updateObservedCount = useCallback((speciesCode: string, value: string) => {
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
  }, [addCustomSpeciesIfNeeded]);

  const updateCensusCount = useCallback((speciesCode: string, value: string) => {
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
  }, [addCustomSpeciesIfNeeded]);

  const updateReturnCount = useCallback((speciesCode: string, value: string) => {
    const numValue = value === "" ? 0 : Number(value) || 0;
    if (numValue === 0) {
      setReturnSpeciesCount((prev) => {
        const updated = { ...prev };
        delete updated[speciesCode];
        return updated;
      });
    } else {
      setReturnSpeciesCount((prev) => ({ ...prev, [speciesCode]: numValue }));
      addCustomSpeciesIfNeeded(speciesCode);
    }
  }, [addCustomSpeciesIfNeeded]);

  const updateDETCount = useCallback((speciesCode: string, value: string) => {
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
  }, [addCustomSpeciesIfNeeded]);

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

  const handleSave = () => {
    onSave({
      observedSpeciesCount,
      censusSpeciesCount,
      returnSpeciesCount,
      DETSpeciesCount,
    });
    onOpenChange();
  };

  return (
    <Modal isOpen={isOpen} onOpenChange={onOpenChange} size="5xl">
      <ModalContent>
        {(onClose) => (
          <>
            <ModalHeader className={modalHeaderClass}>
              Edit Species Data
            </ModalHeader>
            <ModalBody className={modalBodyClass}>
              <div className="flex flex-col gap-4">
                {/* Add Custom Species */}
                <div className="flex gap-2 items-end">
                  <Input
                    value={newSpeciesCode}
                    onValueChange={setNewSpeciesCode}
                    {...modalInputProps}
                    placeholder="Enter custom species code"
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

                {/* Table */}
                <div style={{ height: "600px" }}>
                  <Table
                    aria-label="Species data entry table"
                    isVirtualized
                    maxTableHeight={600}
                    rowHeight={50}
                    isHeaderSticky
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
                    <TableBody items={filteredSpecies}>
                      {(species) => {
                        const code = species.code;
                        return (
                          <TableRow key={code}>
                            <TableCell>
                              <div className="flex flex-col">
                                <span className="font-medium text-sm">{code}</span>
                                {species.speciesDescriptionMBO !== code && (
                                  <span className="text-xs text-gray-500">{species.speciesDescriptionMBO}</span>
                                )}
                              </div>
                            </TableCell>
                            <TableCell>
                              <Input
                                type="number"
                                value={String(observedSpeciesCount[code] || "")}
                                onValueChange={(val) => updateObservedCount(code, val)}
                                {...modalInputProps}
                                min={0}
                                classNames={{
                                  input: "text-center",
                                }}
                              />
                            </TableCell>
                            <TableCell>
                              <Input
                                type="number"
                                value={String(censusSpeciesCount[code] || "")}
                                onValueChange={(val) => updateCensusCount(code, val)}
                                {...modalInputProps}
                                min={0}
                                classNames={{
                                  input: "text-center",
                                }}
                              />
                            </TableCell>
                            <TableCell>
                              <Input
                                type="number"
                                value=""
                                {...modalInputProps}
                                isDisabled
                                placeholder="—"
                                classNames={{
                                  input: "text-center",
                                }}
                              />
                            </TableCell>
                            <TableCell>
                              <Input
                                type="number"
                                value=""
                                {...modalInputProps}
                                isDisabled
                                placeholder="—"
                                classNames={{
                                  input: "text-center",
                                }}
                              />
                            </TableCell>
                            <TableCell>
                              <Input
                                type="number"
                                value={String(returnSpeciesCount[code] || "")}
                                onValueChange={(val) => updateReturnCount(code, val)}
                                {...modalInputProps}
                                min={0}
                                classNames={{
                                  input: "text-center",
                                }}
                              />
                            </TableCell>
                            <TableCell>
                              <Input
                                type="number"
                                value={String(DETSpeciesCount[code] || "")}
                                onValueChange={(val) => updateDETCount(code, val)}
                                {...modalInputProps}
                                min={0}
                                classNames={{
                                  input: "text-center",
                                }}
                              />
                            </TableCell>
                          </TableRow>
                        );
                      }}
                    </TableBody>
                  </Table>
                </div>
              </div>
            </ModalBody>
            <ModalFooter className={modalFooterClass}>
              <Button {...modalCancelButtonProps} onPress={onClose}>
                Cancel
              </Button>
              <Button {...modalPrimaryButtonProps} onPress={handleSave}>
                Save
              </Button>
            </ModalFooter>
          </>
        )}
      </ModalContent>
    </Modal>
  );
}
