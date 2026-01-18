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
import type { NetHours, Net } from "../../types/DET";
import { TrashIcon, PlusIcon } from "@heroicons/react/24/outline";

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
  const [netHours, setNetHours] = useState<NetHours>(initialNetHours);

  useEffect(() => {
    setNetHours(initialNetHours);
  }, [initialNetHours, isOpen]);

  const addNet = () => {
    const newNet: Net = {
      id: `net-${Date.now()}`,
      total: "0",
    };
    setNetHours({
      ...netHours,
      nets: [...netHours.nets, newNet],
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

  const handleSave = () => {
    onSave(netHours);
    onOpenChange();
  };

  return (
    <Modal isOpen={isOpen} onOpenChange={onOpenChange} size="2xl" scrollBehavior="inside">
      <ModalContent>
        {(onClose) => (
          <>
            <ModalHeader>Edit Net Hours</ModalHeader>
            <ModalBody>
              <div className="flex flex-col gap-4">
                <div className="grid grid-cols-2 gap-4">
                  <Input
                    label="Hummingbird Trap Total"
                    value={netHours.hummingbirdTrapTotal}
                    onValueChange={(val) => setNetHours({ ...netHours, hummingbirdTrapTotal: val })}
                    variant="bordered"
                  />
                  <Input
                    label="Total"
                    value={netHours.total}
                    onValueChange={(val) => setNetHours({ ...netHours, total: val })}
                    variant="bordered"
                  />
                </div>

                <div className="flex justify-between items-center">
                  <span className="font-semibold">Nets</span>
                  <Button
                    startContent={<PlusIcon className="h-4 w-4" />}
                    onPress={addNet}
                    size="sm"
                    color="primary"
                    variant="flat"
                  >
                    Add Net
                  </Button>
                </div>

                {netHours.nets.map((net, index) => (
                  <div key={index} className="border rounded-lg p-4 space-y-3">
                    <div className="flex justify-between items-center mb-2">
                      <span className="font-semibold">Net {index + 1}</span>
                      <Button
                        isIconOnly
                        size="sm"
                        variant="light"
                        color="danger"
                        onPress={() => removeNet(index)}
                      >
                        <TrashIcon className="h-4 w-4" />
                      </Button>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <Input
                        label="ID"
                        value={net.id}
                        onValueChange={(val) => updateNet(index, "id", val)}
                        variant="bordered"
                        size="sm"
                      />
                      <Input
                        label="Open"
                        type="time"
                        value={net.open || ""}
                        onValueChange={(val) => updateNet(index, "open", val)}
                        variant="bordered"
                        size="sm"
                      />
                      <Input
                        label="Closed"
                        type="time"
                        value={net.closed || ""}
                        onValueChange={(val) => updateNet(index, "closed", val)}
                        variant="bordered"
                        size="sm"
                      />
                      <Input
                        label="Hours"
                        value={net.hours || ""}
                        onValueChange={(val) => updateNet(index, "hours", val)}
                        variant="bordered"
                        size="sm"
                      />
                      <Input
                        label="Multiplier"
                        type="number"
                        value={String(net.multiplier || "")}
                        onValueChange={(val) => updateNet(index, "multiplier", Number(val) || undefined)}
                        variant="bordered"
                        size="sm"
                      />
                      <Input
                        label="Total"
                        value={net.total}
                        onValueChange={(val) => updateNet(index, "total", val)}
                        variant="bordered"
                        size="sm"
                      />
                    </div>
                  </div>
                ))}
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
