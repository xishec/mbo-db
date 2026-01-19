import { useState, useEffect, useRef } from "react";
import {
  Modal,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
  Button,
  Input,
  Textarea,
  Table,
  TableHeader,
  TableColumn,
  TableBody,
  TableRow,
  TableCell,
} from "@heroui/react";
import type { Injury } from "../../types/DET";
import { TrashIcon, PlusIcon } from "@heroicons/react/24/outline";
import { stopModalPropagation } from "./modalInteractions";
import {
  modalBodyClass,
  modalFooterClass,
  modalHeaderClass,
  modalInputProps,
  modalCancelButtonProps,
  modalPrimaryButtonProps,
} from "./modalDefaults";

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
  const [injuries, setInjuries] = useState<Injury[]>([]);
  const inputRefs = useRef<Map<number, HTMLInputElement>>(new Map());
  const lastAddedIndexRef = useRef<number | null>(null);

  // Sync local state with prop when modal opens
  useEffect(() => {
    if (isOpen) {
      setInjuries([...initialInjuries]);
      lastAddedIndexRef.current = null;
    }
  }, [isOpen, initialInjuries]);

  // Focus the first input of the newly added row
  useEffect(() => {
    if (lastAddedIndexRef.current !== null) {
      const input = inputRefs.current.get(lastAddedIndexRef.current);
      if (input) {
        setTimeout(() => {
          input.focus();
          input.select();
        }, 0);
      }
      lastAddedIndexRef.current = null;
    }
  }, [injuries]);

  const addInjury = () => {
    const newInjury: Injury = {
      specie: "",
      description: "",
    };
    const newIndex = injuries.length;
    setInjuries([...injuries, newInjury]);
    lastAddedIndexRef.current = newIndex;
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
    <Modal onClick={stopModalPropagation}
      isOpen={isOpen}
      onOpenChange={(open) => {
        if (!open) {
          setInjuries(initialInjuries);
        }
        onOpenChange();
      }}
      size="4xl"
      scrollBehavior="inside"
    >
      <ModalContent onClick={stopModalPropagation}>
        {(onClose) => (
          <>
            <ModalHeader className={modalHeaderClass}>Edit Injuries</ModalHeader>
            <ModalBody className={modalBodyClass}>
              <div className="flex flex-col gap-4">
                <div className="rounded-medium border border-default-100 overflow-hidden">
                  <Table aria-label="Injuries table" removeWrapper>
                    <TableHeader>
                      <TableColumn>Species</TableColumn>
                      <TableColumn>Band ID</TableColumn>
                      <TableColumn>Net</TableColumn>
                      <TableColumn>Description</TableColumn>
                      <TableColumn width={50}>Actions</TableColumn>
                    </TableHeader>
                    <TableBody emptyContent="No injuries added">
                      {injuries.map((injury, index) => (
                        <TableRow key={index}>
                          <TableCell className="p-1">
                            <Input
                              ref={(el) => {
                                if (el) {
                                  inputRefs.current.set(index, el);
                                } else {
                                  inputRefs.current.delete(index);
                                }
                              }}
                              value={injury.specie}
                              onValueChange={(val) => updateInjury(index, "specie", val)}
                              {...modalInputProps}
                              placeholder="Enter species"
                              classNames={{ input: "text-sm" }}
                            />
                          </TableCell>
                          <TableCell className="p-1">
                            <Input
                              value={injury.bandId || ""}
                              onValueChange={(val) => updateInjury(index, "bandId", val)}
                              {...modalInputProps}
                              placeholder="Enter band ID"
                              classNames={{ input: "text-sm" }}
                            />
                          </TableCell>
                          <TableCell className="p-1">
                            <Input
                              value={injury.net || ""}
                              onValueChange={(val) => updateInjury(index, "net", val)}
                              {...modalInputProps}
                              placeholder="Enter net"
                              classNames={{ input: "text-sm" }}
                            />
                          </TableCell>
                          <TableCell className="p-1">
                            <Textarea
                              value={injury.description}
                              onValueChange={(val) => updateInjury(index, "description", val)}
                              {...modalInputProps}
                              placeholder="Enter description"
                              minRows={2}
                              classNames={{ input: "text-sm" }}
                            />
                          </TableCell>
                          <TableCell>
                            <Button
                              isIconOnly
                              size="sm"
                              variant="light"
                              color="danger"
                              onPress={() => removeInjury(index)}
                            >
                              <TrashIcon className="h-4 w-4" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>

                <Button
                  startContent={<PlusIcon className="h-4 w-4" />}
                  onPress={addInjury}
                  className="w-full"
                  color="primary"
                  variant="flat"
                >
                  Add Injury
                </Button>
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
