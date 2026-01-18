import { useState, useEffect } from "react";
import {
  Modal,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
  Button,
  Input,
  Textarea,
} from "@heroui/react";
import type { Injury } from "../../types/DET";
import { TrashIcon, PlusIcon } from "@heroicons/react/24/outline";

interface DETInjuriesModalProps {
  isOpen: boolean;
  onOpenChange: () => void;
  injuries: Injury[];
  onSave: (injuries: Injury[]) => void;
}

export default function DETInjuriesModal({
  isOpen,
  onOpenChange,
  injuries: initialInjuries,
  onSave,
}: DETInjuriesModalProps) {
  const [injuries, setInjuries] = useState<Injury[]>(initialInjuries);

  useEffect(() => {
    setInjuries(initialInjuries);
  }, [initialInjuries, isOpen]);

  const addInjury = () => {
    const newInjury: Injury = {
      specie: "",
      description: "",
    };
    setInjuries([...injuries, newInjury]);
  };

  const updateInjury = (index: number, field: keyof Injury, value: string) => {
    const updated = [...injuries];
    updated[index] = { ...updated[index], [field]: value };
    setInjuries(updated);
  };

  const removeInjury = (index: number) => {
    setInjuries(injuries.filter((_, i) => i !== index));
  };

  const handleSave = () => {
    onSave(injuries);
    onOpenChange();
  };

  return (
    <Modal isOpen={isOpen} onOpenChange={onOpenChange} size="2xl" scrollBehavior="inside">
      <ModalContent>
        {(onClose) => (
          <>
            <ModalHeader>Edit Injuries</ModalHeader>
            <ModalBody>
              <div className="flex flex-col gap-4">
                <Button
                  startContent={<PlusIcon className="h-4 w-4" />}
                  onPress={addInjury}
                  size="sm"
                  color="primary"
                  variant="flat"
                  className="self-start"
                >
                  Add Injury
                </Button>
                {injuries.map((injury, index) => (
                  <div key={index} className="border rounded-lg p-4 space-y-3">
                    <div className="flex justify-between items-center mb-2">
                      <span className="font-semibold">Injury {index + 1}</span>
                      <Button
                        isIconOnly
                        size="sm"
                        variant="light"
                        color="danger"
                        onPress={() => removeInjury(index)}
                      >
                        <TrashIcon className="h-4 w-4" />
                      </Button>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <Input
                        label="Species"
                        value={injury.specie}
                        onValueChange={(val) => updateInjury(index, "specie", val)}
                        variant="bordered"
                        size="sm"
                      />
                      <Input
                        label="Band ID"
                        value={injury.bandId || ""}
                        onValueChange={(val) => updateInjury(index, "bandId", val)}
                        variant="bordered"
                        size="sm"
                      />
                      <Input
                        label="Net"
                        value={injury.net || ""}
                        onValueChange={(val) => updateInjury(index, "net", val)}
                        variant="bordered"
                        size="sm"
                      />
                      <Textarea
                        label="Description"
                        value={injury.description}
                        onValueChange={(val) => updateInjury(index, "description", val)}
                        variant="bordered"
                        size="sm"
                        minRows={2}
                      />
                    </div>
                  </div>
                ))}
                {injuries.length === 0 && (
                  <p className="text-sm text-gray-500 text-center py-4">No injuries added</p>
                )}
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
