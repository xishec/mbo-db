import { useState, useEffect, useRef } from "react";
import {
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
import type { Released } from "../../../types/DET";
import { TrashIcon, PlusIcon } from "@heroicons/react/24/outline";
import ModalShell, { ModalBodyShell, ModalFooterShell, ModalHeaderShell } from "../ModalShell";
import {
        modalInputProps,
  modalCancelButtonProps,
  modalPrimaryButtonProps,
} from "../modalDefaults";

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
  const [released, setReleased] = useState<Released[]>([]);
  const inputRefs = useRef<Map<number, HTMLInputElement>>(new Map());
  const lastAddedIndexRef = useRef<number | null>(null);

  // Sync local state with prop when modal opens
  useEffect(() => {
    if (isOpen) {
      setReleased([...initialReleased]);
      lastAddedIndexRef.current = null;
    }
  }, [isOpen, initialReleased]);

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
  }, [released]);

  const addReleased = () => {
    const newReleased: Released = {
      specie: "",
    };
    const newIndex = released.length;
    setReleased([...released, newReleased]);
    lastAddedIndexRef.current = newIndex;
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
    <ModalShell
      modalProps={{
        isOpen,
        onOpenChange: (open) => {
          if (!open) {
            setReleased(initialReleased);
          }
          onOpenChange();
        },
        size: "4xl",
        scrollBehavior: "inside",
      }}
    >
      {(onClose) => (
        <>
            <ModalHeaderShell>Edit Released</ModalHeaderShell>
            <ModalBodyShell>
              <div className="flex flex-col gap-4">
                <div className="rounded-medium border border-default-100 overflow-hidden">
                  <Table aria-label="Released birds table" removeWrapper>
                    <TableHeader>
                      <TableColumn>Species</TableColumn>
                      <TableColumn>Age</TableColumn>
                      <TableColumn>How Aged</TableColumn>
                      <TableColumn>Sex</TableColumn>
                      <TableColumn>How Sexed</TableColumn>
                      <TableColumn>Net</TableColumn>
                      <TableColumn>Description</TableColumn>
                      <TableColumn width={50}>Actions</TableColumn>
                    </TableHeader>
                    <TableBody emptyContent="No released birds added">
                      {released.map((item, index) => (
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
                              value={item.specie}
                              onValueChange={(val) => updateReleased(index, "specie", val)}
                              {...modalInputProps}
                              placeholder="Enter species"
                              classNames={{ input: "text-sm" }}
                            />
                          </TableCell>
                          <TableCell className="p-1">
                            <Input
                              value={item.age || ""}
                              onValueChange={(val) => updateReleased(index, "age", val)}
                              {...modalInputProps}
                              placeholder="Enter age"
                              classNames={{ input: "text-sm" }}
                            />
                          </TableCell>
                          <TableCell className="p-1">
                            <Input
                              value={item.howAged || ""}
                              onValueChange={(val) => updateReleased(index, "howAged", val)}
                              {...modalInputProps}
                              placeholder="Enter how aged"
                              classNames={{ input: "text-sm" }}
                            />
                          </TableCell>
                          <TableCell className="p-1">
                            <Input
                              value={item.sex || ""}
                              onValueChange={(val) => updateReleased(index, "sex", val)}
                              {...modalInputProps}
                              placeholder="Enter sex"
                              classNames={{ input: "text-sm" }}
                            />
                          </TableCell>
                          <TableCell className="p-1">
                            <Input
                              value={item.howSexed || ""}
                              onValueChange={(val) => updateReleased(index, "howSexed", val)}
                              {...modalInputProps}
                              placeholder="Enter how sexed"
                              classNames={{ input: "text-sm" }}
                            />
                          </TableCell>
                          <TableCell className="p-1">
                            <Input
                              value={item.net || ""}
                              onValueChange={(val) => updateReleased(index, "net", val)}
                              {...modalInputProps}
                              placeholder="Enter net"
                              classNames={{ input: "text-sm" }}
                            />
                          </TableCell>
                          <TableCell className="p-1">
                            <Textarea
                              value={item.description || ""}
                              onValueChange={(val) => updateReleased(index, "description", val)}
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
                              onPress={() => removeReleased(index)}
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
                  onPress={addReleased}
                  className="w-full"
                  color="primary"
                  variant="flat"
                >
                  Add Released
                </Button>
              </div>
            </ModalBodyShell>
            <ModalFooterShell>
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
