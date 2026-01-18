import { useState, useEffect } from "react";
import {
  Modal,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
  Button,
  Input,
} from "@heroui/react";
import { TrashIcon, PlusIcon } from "@heroicons/react/24/outline";

interface DETSpeciesModalProps {
  isOpen: boolean;
  onOpenChange: () => void;
  speciesCount: Record<string, number>;
  onSave: (speciesCount: Record<string, number>) => void;
  title?: string;
}

export default function DETSpeciesModal({
  isOpen,
  onOpenChange,
  speciesCount: initialSpeciesCount,
  onSave,
  title = "Edit Species Count",
}: DETSpeciesModalProps) {
  const [speciesCount, setSpeciesCount] = useState<Record<string, number>>(initialSpeciesCount);
  const [newSpeciesCode, setNewSpeciesCode] = useState("");
  const [newSpeciesCount, setNewSpeciesCount] = useState("");

  useEffect(() => {
    setSpeciesCount(initialSpeciesCount);
  }, [initialSpeciesCount, isOpen]);

  const addSpecies = () => {
    if (newSpeciesCode.trim() && newSpeciesCount && !isNaN(Number(newSpeciesCount))) {
      setSpeciesCount({
        ...speciesCount,
        [newSpeciesCode.trim().toUpperCase()]: Number(newSpeciesCount),
      });
      setNewSpeciesCode("");
      setNewSpeciesCount("");
    }
  };

  const updateSpeciesCount = (speciesCode: string, count: number) => {
    if (count === 0) {
      const updated = { ...speciesCount };
      delete updated[speciesCode];
      setSpeciesCount(updated);
    } else {
      setSpeciesCount({ ...speciesCount, [speciesCode]: count });
    }
  };

  const removeSpecies = (speciesCode: string) => {
    const updated = { ...speciesCount };
    delete updated[speciesCode];
    setSpeciesCount(updated);
  };

  const handleSave = () => {
    onSave(speciesCount);
    onOpenChange();
  };

  return (
    <Modal isOpen={isOpen} onOpenChange={onOpenChange} size="2xl" scrollBehavior="inside">
      <ModalContent>
        {(onClose) => (
          <>
            <ModalHeader>{title}</ModalHeader>
            <ModalBody>
              <div className="flex flex-col gap-4">
                <div className="border-b pb-4">
                  <p className="text-sm font-semibold mb-2">Add Species</p>
                  <div className="flex gap-2">
                    <Input
                      label="Species Code"
                      value={newSpeciesCode}
                      onValueChange={setNewSpeciesCode}
                      variant="bordered"
                      placeholder="e.g., ABDU"
                      className="flex-1"
                      onKeyPress={(e) => e.key === "Enter" && addSpecies()}
                    />
                    <Input
                      label="Count"
                      type="number"
                      value={newSpeciesCount}
                      onValueChange={setNewSpeciesCount}
                      variant="bordered"
                      className="flex-1"
                      onKeyPress={(e) => e.key === "Enter" && addSpecies()}
                    />
                    <Button
                      startContent={<PlusIcon className="h-4 w-4" />}
                      onPress={addSpecies}
                      color="primary"
                      className="self-end"
                      isDisabled={!newSpeciesCode.trim() || !newSpeciesCount}
                    >
                      Add
                    </Button>
                  </div>
                </div>

                <div className="flex flex-wrap gap-2">
                  {Object.entries(speciesCount).map(([code, count]) => (
                    <div key={code} className="flex items-center gap-2 border rounded px-2 py-1">
                      <span className="font-medium">{code}:</span>
                      <Input
                        type="number"
                        value={String(count)}
                        onValueChange={(val) => updateSpeciesCount(code, Number(val) || 0)}
                        variant="bordered"
                        size="sm"
                        className="w-20"
                      />
                      <Button
                        isIconOnly
                        size="sm"
                        variant="light"
                        color="danger"
                        onPress={() => removeSpecies(code)}
                      >
                        <TrashIcon className="h-3 w-3" />
                      </Button>
                    </div>
                  ))}
                  {Object.keys(speciesCount).length === 0 && (
                    <p className="text-sm text-gray-500">No species added</p>
                  )}
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
