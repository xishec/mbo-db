import { useState, useEffect, useRef } from "react";
import {
        Button,
  Input,
  Table,
  TableHeader,
  TableColumn,
  TableBody,
  TableRow,
  TableCell,
} from "@heroui/react";
import { TrashIcon, PlusIcon } from "@heroicons/react/24/outline";
import ModalShell, { ModalBodyShell, ModalFooterShell, ModalHeaderShell } from "./ModalShell";
import {
        modalInputProps,
  modalCancelButtonProps,
  modalPrimaryButtonProps,
} from "./modalDefaults";

interface DETVisitorsModalProps {
  isOpen: boolean;
  onOpenChange: () => void;
  visitors: string[];
  onSave: (visitors: string[]) => void;
}

export default function DETVisitorsModal({
  isOpen,
  onOpenChange,
  visitors: initialVisitors,
  onSave,
}: DETVisitorsModalProps) {
  const [visitors, setVisitors] = useState<string[]>([]);
  const inputRefs = useRef<Map<number, HTMLInputElement>>(new Map());
  const lastAddedIndexRef = useRef<number | null>(null);

  // Sync local state with prop when modal opens
  useEffect(() => {
    if (isOpen) {
      setVisitors([...initialVisitors]);
      lastAddedIndexRef.current = null;
    }
  }, [isOpen, initialVisitors]);

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
  }, [visitors]);

  const addVisitor = () => {
    const newIndex = visitors.length;
    setVisitors([...visitors, ""]);
    lastAddedIndexRef.current = newIndex;
  };

  const updateVisitor = (index: number, value: string) => {
    const updated = [...visitors];
    updated[index] = value;
    setVisitors(updated);
  };

  const removeVisitor = (index: number) => {
    setVisitors(visitors.filter((_, i) => i !== index));
  };

  const handleSave = () => {
    onSave(visitors);
    onOpenChange();
  };

  return (
    <ModalShell
      modalProps={{
        isOpen,
        onOpenChange: (open) => {
          if (!open) {
            setVisitors(initialVisitors);
          }
          onOpenChange();
        },
        size: "4xl",
        scrollBehavior: "inside",
      }}
    >
      {(onClose) => (
        <>
            <ModalHeaderShell>Edit Visitors</ModalHeaderShell>
            <ModalBodyShell>
              <div className="flex flex-col gap-4">
                <div className="rounded-medium border border-default-100 overflow-hidden">
                  <Table aria-label="Visitors table" removeWrapper>
                    <TableHeader>
                      <TableColumn>Visitor Name</TableColumn>
                      <TableColumn width={50}>Actions</TableColumn>
                    </TableHeader>
                    <TableBody emptyContent="No visitors added">
                      {visitors.map((visitor, index) => (
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
                              value={visitor}
                              onValueChange={(val) => updateVisitor(index, val)}
                              {...modalInputProps}
                              placeholder="Enter visitor name"
                              classNames={{ input: "text-sm" }}
                            />
                          </TableCell>
                          <TableCell>
                            <Button
                              isIconOnly
                              size="sm"
                              variant="light"
                              color="danger"
                              onPress={() => removeVisitor(index)}
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
                  onPress={addVisitor}
                  className="w-full"
                  color="primary"
                  variant="flat"
                >
                  Add Visitor
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
