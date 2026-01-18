import { useState, useEffect, useMemo } from "react";
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
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    setObservedSpeciesCount(initialObservedSpeciesCount);
    setCensusSpeciesCount(initialCensusSpeciesCount);
    setReturnSpeciesCount(initialReturnSpeciesCount);
    setDETSpeciesCount(initialDETSpeciesCount);
  }, [
    initialObservedSpeciesCount,
    initialCensusSpeciesCount,
    initialReturnSpeciesCount,
    initialDETSpeciesCount,
    isOpen,
  ]);

  // Get all species and filter by search query
  const filteredSpecies = useMemo(() => {
    const allSpecies = Object.values(SPECIES_MAP);
    if (!searchQuery.trim()) {
      return allSpecies;
    }
    const query = searchQuery.toLowerCase();
    return allSpecies.filter(
      (species) =>
        species.code.toLowerCase().includes(query) ||
        species.speciesDescriptionMBO.toLowerCase().includes(query) ||
        species.speciesDescriptionCMMN.toLowerCase().includes(query)
    );
  }, [searchQuery]);

  const updateObservedCount = (speciesCode: string, value: string) => {
    const numValue = value === "" ? 0 : Number(value) || 0;
    if (numValue === 0) {
      const updated = { ...observedSpeciesCount };
      delete updated[speciesCode];
      setObservedSpeciesCount(updated);
    } else {
      setObservedSpeciesCount({ ...observedSpeciesCount, [speciesCode]: numValue });
    }
  };

  const updateCensusCount = (speciesCode: string, value: string) => {
    const numValue = value === "" ? 0 : Number(value) || 0;
    if (numValue === 0) {
      const updated = { ...censusSpeciesCount };
      delete updated[speciesCode];
      setCensusSpeciesCount(updated);
    } else {
      setCensusSpeciesCount({ ...censusSpeciesCount, [speciesCode]: numValue });
    }
  };

  const updateReturnCount = (speciesCode: string, value: string) => {
    const numValue = value === "" ? 0 : Number(value) || 0;
    if (numValue === 0) {
      const updated = { ...returnSpeciesCount };
      delete updated[speciesCode];
      setReturnSpeciesCount(updated);
    } else {
      setReturnSpeciesCount({ ...returnSpeciesCount, [speciesCode]: numValue });
    }
  };

  const updateDETCount = (speciesCode: string, value: string) => {
    const numValue = value === "" ? 0 : Number(value) || 0;
    if (numValue === 0) {
      const updated = { ...DETSpeciesCount };
      delete updated[speciesCode];
      setDETSpeciesCount(updated);
    } else {
      setDETSpeciesCount({ ...DETSpeciesCount, [speciesCode]: numValue });
    }
  };

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
    <Modal isOpen={isOpen} onOpenChange={onOpenChange} size="5xl" scrollBehavior="inside">
      <ModalContent>
        {(onClose) => (
          <>
            <ModalHeader>Edit Species Data</ModalHeader>
            <ModalBody>
              <div className="flex flex-col gap-4">
                {/* Search */}
                <Input
                  label="Search Species"
                  value={searchQuery}
                  onValueChange={setSearchQuery}
                  variant="bordered"
                  placeholder="Search by code or name..."
                  size="sm"
                />

                {/* Table */}
                <div className="border rounded-lg overflow-hidden">
                  <div className="p-2 bg-gray-50 border-b text-xs text-gray-600">
                    Note: Band and Repeat columns are auto-generated and cannot be edited.
                  </div>
                  <Table aria-label="Species data entry table" removeWrapper>
                    <TableHeader>
                      <TableColumn width={200}>Species</TableColumn>
                      <TableColumn width={100}>Obs</TableColumn>
                      <TableColumn width={100}>Cns</TableColumn>
                      <TableColumn width={100}>Band</TableColumn>
                      <TableColumn width={100}>Repeat</TableColumn>
                      <TableColumn width={100}>Ret</TableColumn>
                      <TableColumn width={100}>DET</TableColumn>
                    </TableHeader>
                    <TableBody>
                      {filteredSpecies.map((species) => (
                        <TableRow key={species.code}>
                          <TableCell>
                            <div className="flex flex-col">
                              <span className="font-medium text-sm">{species.code}</span>
                              <span className="text-xs text-gray-500">{species.speciesDescriptionMBO}</span>
                            </div>
                          </TableCell>
                          <TableCell>
                            <Input
                              type="number"
                              value={String(observedSpeciesCount[species.code] || "")}
                              onValueChange={(val) => updateObservedCount(species.code, val)}
                              variant="bordered"
                              size="sm"
                              min={0}
                              classNames={{
                                input: "text-center",
                                inputWrapper: "h-9",
                              }}
                            />
                          </TableCell>
                          <TableCell>
                            <Input
                              type="number"
                              value={String(censusSpeciesCount[species.code] || "")}
                              onValueChange={(val) => updateCensusCount(species.code, val)}
                              variant="bordered"
                              size="sm"
                              min={0}
                              classNames={{
                                input: "text-center",
                                inputWrapper: "h-9",
                              }}
                            />
                          </TableCell>
                          <TableCell>
                            <Input
                              type="number"
                              value=""
                              variant="bordered"
                              size="sm"
                              isDisabled
                              placeholder="—"
                              classNames={{
                                input: "text-center",
                                inputWrapper: "h-9",
                              }}
                            />
                          </TableCell>
                          <TableCell>
                            <Input
                              type="number"
                              value=""
                              variant="bordered"
                              size="sm"
                              isDisabled
                              placeholder="—"
                              classNames={{
                                input: "text-center",
                                inputWrapper: "h-9",
                              }}
                            />
                          </TableCell>
                          <TableCell>
                            <Input
                              type="number"
                              value={String(returnSpeciesCount[species.code] || "")}
                              onValueChange={(val) => updateReturnCount(species.code, val)}
                              variant="bordered"
                              size="sm"
                              min={0}
                              classNames={{
                                input: "text-center",
                                inputWrapper: "h-9",
                              }}
                            />
                          </TableCell>
                          <TableCell>
                            <Input
                              type="number"
                              value={String(DETSpeciesCount[species.code] || "")}
                              onValueChange={(val) => updateDETCount(species.code, val)}
                              variant="bordered"
                              size="sm"
                              min={0}
                              classNames={{
                                input: "text-center",
                                inputWrapper: "h-9",
                              }}
                            />
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </div>
            </ModalBody>
            <ModalFooter>
              <Button color="default" variant="flat" onPress={onClose}>
                Cancel
              </Button>
              <Button color="primary" onPress={handleSave}>
                Save
              </Button>
            </ModalFooter>
          </>
        )}
      </ModalContent>
    </Modal>
  );
}
