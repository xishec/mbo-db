import { useState, useMemo } from "react";
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
import type { NetHours, Net } from "../../types/DET";
import { TrashIcon, PlusIcon } from "@heroicons/react/24/outline";
import {
  modalBodyClass,
  modalFooterClass,
  modalHeaderClass,
  modalInputProps,
  modalCancelButtonProps,
  modalPrimaryButtonProps,
} from "./modalDefaults";

interface DETNetHoursModalProps {
  isOpen: boolean;
  onOpenChange: () => void;
  netHours: NetHours;
  onSave: (netHours: NetHours) => void;
}

export default function DETNetHoursModal({
  isOpen,
  onOpenChange,
  netHours: initialNetHours,
  onSave,
}: DETNetHoursModalProps) {
  const [netHours, setNetHours] = useState<NetHours>(() => initialNetHours);

  const addNet = () => {
    setNetHours({
      ...netHours,
      nets: [
        ...netHours.nets,
        {
          id: `net-${Date.now()}`,
          open: "",
          closed: "",
          hours: "0",
          multiplier: 1.0,
          total: "0",
        },
      ],
    });
  };

  const updateNet = (index: number, field: keyof Net, value: string | number | undefined) => {
    const updated = [...netHours.nets];
    updated[index] = { ...updated[index], [field]: value };
    setNetHours({ ...netHours, nets: updated });
  };

  const removeNet = (index: number) => {
    setNetHours({
      ...netHours,
      nets: netHours.nets.filter((_, i) => i !== index),
    });
  };

  const totalNetHours = useMemo(() => {
    return netHours.nets.reduce((sum, net) => sum + (parseFloat(net.hours || "0") || 0) * (net.multiplier || 1), 0);
  }, [netHours.nets]);

  const handleSave = () => {
    onSave(netHours);
    onOpenChange();
  };

  return (
    <Modal
      isOpen={isOpen}
      onOpenChange={(open) => {
        if (!open) {
          setNetHours(initialNetHours);
        }
        onOpenChange();
      }}
      size="4xl"
      scrollBehavior="inside"
    >
      <ModalContent>
        {(onClose) => (
          <>
            <ModalHeader className={modalHeaderClass}>Edit Net Hours</ModalHeader>
            <ModalBody className={modalBodyClass}>
              <div className="flex flex-col gap-4">
                {/* Hummingbird Trap */}
                <div className="rounded-medium border border-default-100 p-3">
                  <div className="flex items-center gap-4 w-full">
                    <div className="font-semibold text-sm whitespace-nowrap flex-shrink-0">Hummingbird Trap</div>
                    <div className="flex-grow" />
                    <div className="w-24">
                      <Input
                        type="number"
                        value={parseFloat(netHours.hummingbirdTrapTotal || "0").toFixed(1)}
                        onValueChange={(val) => setNetHours({ ...netHours, hummingbirdTrapTotal: val })}
                        {...modalInputProps}
                        min="0"
                        classNames={{ input: "text-right" }}
                      />
                    </div>
                  </div>
                </div>

                {/* Totals Summary */}
                <div className="rounded-medium border border-default-100 p-3">
                  <div className="flex items-center gap-4 w-full">
                    <div className="font-semibold text-sm whitespace-nowrap flex-shrink-0">Total Net Hours</div>
                    <div className="flex-grow" />
                    <div className="w-24">
                      <Input
                        type="number"
                        value={totalNetHours.toFixed(1)}
                        {...modalInputProps}
                        isReadOnly
                        classNames={{ input: "text-right", inputWrapper: "border-none" }}
                      />
                    </div>
                  </div>
                </div>

                {/* Nets Table */}
                <span className="font-semibold">Nets</span>
                <div className="rounded-medium border border-default-100 overflow-hidden">
                  <Table aria-label="Net hours table" removeWrapper>
                    <TableHeader>
                      <TableColumn>Net ID</TableColumn>
                      <TableColumn>Open</TableColumn>
                      <TableColumn>Closed</TableColumn>
                      <TableColumn>Hours</TableColumn>
                      <TableColumn>Multiplier</TableColumn>
                      <TableColumn>Total</TableColumn>
                      <TableColumn width={50}>Actions</TableColumn>
                    </TableHeader>
                    <TableBody emptyContent="No nets added">
                      {netHours.nets.map((net, index) => (
                        <TableRow key={index}>
                          <TableCell>
                            <Input
                              value={net.id}
                              onValueChange={(val) => updateNet(index, "id", val)}
                              {...modalInputProps}
                              placeholder="A1"
                              classNames={{ input: "text-sm font-medium" }}
                            />
                          </TableCell>
                          <TableCell>
                            <Input
                              type="time"
                              value={net.open || ""}
                              onValueChange={(val) => updateNet(index, "open", val)}
                              {...modalInputProps}
                              classNames={{ input: "text-sm" }}
                            />
                          </TableCell>
                          <TableCell>
                            <Input
                              type="time"
                              value={net.closed || ""}
                              onValueChange={(val) => updateNet(index, "closed", val)}
                              {...modalInputProps}
                              classNames={{ input: "text-sm" }}
                            />
                          </TableCell>
                          <TableCell>
                            <Input
                              type="number"
                              value={net.hours || ""}
                              onValueChange={(val) => updateNet(index, "hours", val)}
                              {...modalInputProps}
                              placeholder="0"
                              step="0.5"
                              min="0"
                              classNames={{ input: "text-sm" }}
                            />
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-1">
                              <Input
                                type="number"
                                value={String(net.multiplier || "1")}
                                onValueChange={(val) => updateNet(index, "multiplier", Number(val) || 1)}
                                {...modalInputProps}
                                placeholder="1"
                                step="0.1"
                                min="0"
                                classNames={{
                                  input: "text-sm text-center",
                                  inputWrapper: "w-20",
                                }}
                              />
                              <span className="text-gray-400 text-sm whitespace-nowrap">=</span>
                            </div>
                          </TableCell>
                          <TableCell>
                            <Input
                              type="number"
                              value={String((parseFloat(net.hours || "0") * (net.multiplier || 1)).toFixed(1))}
                              {...modalInputProps}
                              isReadOnly
                              classNames={{ input: "text-sm bg-gray-50" }}
                            />
                          </TableCell>
                          <TableCell>
                            <Button
                              isIconOnly
                              size="sm"
                              variant="light"
                              color="danger"
                              onPress={() => removeNet(index)}
                            >
                              <TrashIcon className="h-4 w-4" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>

                {/* Add Net Button */}
                <Button
                  startContent={<PlusIcon className="h-4 w-4" />}
                  onPress={addNet}
                  className="w-full"
                  color="primary"
                  variant="flat"
                >
                  Add Net
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
