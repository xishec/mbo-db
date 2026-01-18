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
import type { Released } from "../../types/DET";
import { TrashIcon, PlusIcon } from "@heroicons/react/24/outline";
import {
  modalBodyClass,
  modalFooterClass,
  modalHeaderClass,
  modalInputProps,
  modalCancelButtonProps,
  modalPrimaryButtonProps,
} from "./modalDefaults";

interface DETReleasedModalProps {
  isOpen: boolean;
  onOpenChange: () => void;
  released: Released[];
  onSave: (released: Released[]) => void;
}

export default function DETReleasedModal({
  isOpen,
  onOpenChange,
  released: initialReleased,
  onSave,
}: DETReleasedModalProps) {
  const [released, setReleased] = useState<Released[]>(initialReleased);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setReleased(initialReleased);
  }, [initialReleased, isOpen]);

  const addReleased = () => {
    const newReleased: Released = {
      specie: "",
    };
    setReleased([...released, newReleased]);
  };

  const updateReleased = (index: number, field: keyof Released, value: string) => {
    const updated = [...released];
    updated[index] = { ...updated[index], [field]: value };
    setReleased(updated);
  };

  const removeReleased = (index: number) => {
    setReleased(released.filter((_, i) => i !== index));
  };

  const handleSave = () => {
    onSave(released);
    onOpenChange();
  };

  return (
    <Modal isOpen={isOpen} onOpenChange={onOpenChange} size="2xl" scrollBehavior="inside">
      <ModalContent>
        {(onClose) => (
          <>
            <ModalHeader className={modalHeaderClass}>Edit Released</ModalHeader>
            <ModalBody className={modalBodyClass}>
              <div className="flex flex-col gap-4">
                <Button
                  startContent={<PlusIcon className="h-4 w-4" />}
                  onPress={addReleased}
                  size="sm"
                  color="primary"
                  variant="flat"
                  className="self-start"
                >
                  Add Released
                </Button>
                {released.map((item, index) => (
                  <div key={index} className="border rounded-lg p-4 space-y-3">
                    <div className="flex justify-between items-center mb-2">
                      <span className="font-semibold">Released {index + 1}</span>
                      <Button
                        isIconOnly
                        size="sm"
                        variant="light"
                        color="danger"
                        onPress={() => removeReleased(index)}
                      >
                        <TrashIcon className="h-4 w-4" />
                      </Button>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <Input
                        label="Species"
                        value={item.specie}
                        onValueChange={(val) => updateReleased(index, "specie", val)}
                        {...modalInputProps}
                      />
                      <Input
                        label="Age"
                        value={item.age || ""}
                        onValueChange={(val) => updateReleased(index, "age", val)}
                        {...modalInputProps}
                      />
                      <Input
                        label="How Aged"
                        value={item.howAged || ""}
                        onValueChange={(val) => updateReleased(index, "howAged", val)}
                        {...modalInputProps}
                      />
                      <Input
                        label="Sex"
                        value={item.sex || ""}
                        onValueChange={(val) => updateReleased(index, "sex", val)}
                        {...modalInputProps}
                      />
                      <Input
                        label="How Sexed"
                        value={item.howSexed || ""}
                        onValueChange={(val) => updateReleased(index, "howSexed", val)}
                        {...modalInputProps}
                      />
                      <Input
                        label="Net"
                        value={item.net || ""}
                        onValueChange={(val) => updateReleased(index, "net", val)}
                        {...modalInputProps}
                      />
                      <Textarea
                        label="Description"
                        value={item.description || ""}
                        onValueChange={(val) => updateReleased(index, "description", val)}
                        labelPlacement="outside"
                        variant="bordered"
                        minRows={2}
                      />
                    </div>
                  </div>
                ))}
                {released.length === 0 && (
                  <p className="text-sm text-gray-500 text-center py-4">No released birds added</p>
                )}
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
