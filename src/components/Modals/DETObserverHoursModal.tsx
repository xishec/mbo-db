import { useState, useMemo, useRef, useEffect } from "react";
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
import type { ObserverHours, Observer } from "../../types/DET";
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

interface DETObserverHoursModalProps {
  isOpen: boolean;
  onOpenChange: () => void;
  observerHours: ObserverHours;
  onSave: (observerHours: ObserverHours) => void;
}

export default function DETObserverHoursModal({
  isOpen,
  onOpenChange,
  observerHours: initialObserverHours,
  onSave,
}: DETObserverHoursModalProps) {
  const [observerHours, setObserverHours] = useState<ObserverHours>(initialObserverHours);
  const inputRefs = useRef<Map<number, HTMLInputElement>>(new Map());
  const lastAddedIndexRef = useRef<number | null>(null);

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
  }, [observerHours.observers]);

  const addObserver = () => {
    const newObserver: Observer = {
      name: "",
      initials: "",
      hoursObserved: 0,
      class: 0,
      totalHours: 0,
    };
    const updated = [...(observerHours.observers || []), newObserver];
    const newIndex = updated.length - 1;
    const newTotal = updated.reduce((sum, obs) => sum + obs.totalHours, 0);
    setObserverHours({
      ...observerHours,
      observers: updated,
      total: newTotal,
    });
    lastAddedIndexRef.current = newIndex;
  };

  // Calculate total hours for an observer based on class and hours observed
  const calculateTotalHours = (hoursObserved: number, classValue: number): number => {
    if (!hoursObserved || !classValue) return 0;

    // Based on the formula: Class 1 x 1, Class 2 x 0.5, Class 3 x 0.33
    const multipliers: Record<number, number> = {
      1: 1,
      2: 0.5,
      3: 0.33,
    };

    const multiplier = multipliers[classValue] || 0;
    return hoursObserved * multiplier;
  };

  const updateObserver = (index: number, field: keyof Observer, value: string | number) => {
    const updated = [...(observerHours.observers || [])];
    const observer = { ...updated[index], [field]: value };

    // Auto-calculate totalHours when hoursObserved or class changes
    if (field === "hoursObserved" || field === "class") {
      observer.totalHours = calculateTotalHours(
        field === "hoursObserved" ? (value as number) : observer.hoursObserved,
        field === "class" ? (value as number) : observer.class
      );
    }

    updated[index] = observer;

    // Recalculate grand total
    const newTotal = updated.reduce((sum, obs) => sum + obs.totalHours, 0);
    setObserverHours({ ...observerHours, observers: updated, total: newTotal });
  };

  const removeObserver = (index: number) => {
    const updated = (observerHours.observers || []).filter((_, i) => i !== index);
    const newTotal = updated.reduce((sum, obs) => sum + obs.totalHours, 0);
    setObserverHours({ ...observerHours, observers: updated, total: newTotal });
  };

  // Calculate grand total from all observers
  const grandTotal = useMemo(() => {
    return (observerHours.observers || []).reduce((sum, obs) => sum + obs.totalHours, 0);
  }, [observerHours.observers]);

  const handleSave = () => {
    // Ensure total is up to date before saving
    const finalTotal = (observerHours.observers || []).reduce((sum, obs) => sum + obs.totalHours, 0);
    onSave({ ...observerHours, total: finalTotal });
    onOpenChange();
  };

  return (
    <Modal onClick={stopModalPropagation}
      isOpen={isOpen}
      onOpenChange={(open) => {
        if (!open) {
          // Reset state when modal closes
          setObserverHours(initialObserverHours);
          lastAddedIndexRef.current = null;
        }
        onOpenChange();
      }}
      size="4xl"
      scrollBehavior="inside"
    >
      <ModalContent onClick={stopModalPropagation}>
        {(onClose) => (
          <>
            <ModalHeader className={modalHeaderClass}>Edit Observer Hours</ModalHeader>
            <ModalBody className={modalBodyClass}>
              <div className="flex flex-col gap-4">
                {/* Summary Row */}
                <div className="border rounded-medium border border-default-100 p-3 ">
                  <div className="flex items-center gap-4 w-full">
                    <div className="font-semibold text-sm whitespace-nowrap flex-shrink-0">Total Observer Hours</div>
                    <div className="text-xs text-gray-600 whitespace-nowrap text-center flex-grow min-w-0">
                      (Class 1 x 1) + (Class 2 x 0.5) + (Class 3 x 0.33)
                    </div>
                    <div className="flex-shrink-0">
                      <Input
                        type="number"
                        value={grandTotal.toFixed(1)}
                        {...modalInputProps}
                        isReadOnly
                        classNames={{ input: "text-right", inputWrapper: "border-none" }}
                      />
                    </div>
                  </div>
                </div>

                <div className="rounded-medium border border-default-100 overflow-hidden">
                  <Table aria-label="Observer hours table" removeWrapper>
                    <TableHeader>
                      <TableColumn>Observer Name</TableColumn>
                      <TableColumn>Obs Initials</TableColumn>
                      <TableColumn>Hours Obs</TableColumn>
                      <TableColumn>Class</TableColumn>
                      <TableColumn>Total hours</TableColumn>
                      <TableColumn width={50}>Actions</TableColumn>
                    </TableHeader>
                    <TableBody emptyContent="No observers added">
                      {(observerHours.observers || []).map((observer, index) => (
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
                              value={observer.name}
                              onValueChange={(val) => updateObserver(index, "name", val)}
                              {...modalInputProps}
                              placeholder="Enter name"
                              classNames={{
                                input: "text-sm",
                              }}
                            />
                          </TableCell>
                          <TableCell className="p-1">
                            <Input
                              value={observer.initials}
                              onValueChange={(val) => updateObserver(index, "initials", val.toUpperCase())}
                              {...modalInputProps}
                              placeholder="ABC"
                              maxLength={3}
                              classNames={{
                                input: "text-sm",
                              }}
                            />
                          </TableCell>
                          <TableCell className="p-1">
                            <Input
                              type="number"
                              value={String(observer.hoursObserved || "")}
                              onValueChange={(val) => updateObserver(index, "hoursObserved", Number(val) || 0)}
                              {...modalInputProps}
                              placeholder="0"
                              step="0.5"
                              min="0"
                              classNames={{
                                input: "text-sm",
                              }}
                            />
                          </TableCell>
                          <TableCell className="p-1">
                            <div className="flex items-center gap-1">
                              <Input
                                type="number"
                                value={String(observer.class || "")}
                                onValueChange={(val) => {
                                  const classVal = Number(val);
                                  if (classVal >= 1 && classVal <= 3) {
                                    updateObserver(index, "class", classVal);
                                  }
                                }}
                                {...modalInputProps}
                                placeholder="1-3"
                                min="1"
                                max="3"
                                classNames={{
                                  input: "text-sm text-center",
                                  inputWrapper: "w-16",
                                }}
                              />
                              <span className="text-gray-400 text-sm whitespace-nowrap pl-4">=</span>
                            </div>
                          </TableCell>
                          <TableCell className="p-1">
                            <Input
                              type="number"
                              value={observer.totalHours.toFixed(1)}
                              {...modalInputProps}
                              isReadOnly
                              classNames={{
                                input: "text-sm bg-gray-50",
                              }}
                            />
                          </TableCell>
                          <TableCell>
                            <Button
                              isIconOnly
                              size="sm"
                              variant="light"
                              color="danger"
                              onPress={() => removeObserver(index)}
                            >
                              <TrashIcon className="h-4 w-4" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>

                <div className="flex w-full">
                  <Button
                    startContent={<PlusIcon className="h-4 w-4" />}
                    onPress={addObserver}
                    className="w-full"
                    color="primary"
                    variant="flat"
                  >
                    Add Observer
                  </Button>
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
