import { useState, useEffect } from "react";
import {
  Modal,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
  Button,
  Input,
  Chip,
} from "@heroui/react";
import { PlusIcon } from "@heroicons/react/24/outline";
import {
  modalBodyClass,
  modalFooterClass,
  modalHeaderClass,
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

export default function DETVisitorsModal({ isOpen, onOpenChange, visitors, onSave }: DETVisitorsModalProps) {
  const [localVisitors, setLocalVisitors] = useState<string[]>([]);
  const [newVisitor, setNewVisitor] = useState("");

  // Sync local state with prop when modal opens
  useEffect(() => {
    if (isOpen) {
      /* eslint-disable react-hooks/set-state-in-effect */
      setLocalVisitors([...visitors]);
      setNewVisitor("");
      /* eslint-enable react-hooks/set-state-in-effect */
    }
  }, [isOpen, visitors]);

  const handleSave = () => {
    onSave(localVisitors);
    onOpenChange();
  };

  const addVisitor = () => {
    if (newVisitor.trim()) {
      setLocalVisitors([...localVisitors, newVisitor.trim()]);
      setNewVisitor("");
    }
  };

  const removeVisitor = (index: number) => {
    setLocalVisitors(localVisitors.filter((_, i) => i !== index));
  };

  return (
    <Modal isOpen={isOpen} onOpenChange={onOpenChange} size="2xl">
      <ModalContent>
        {(onClose) => (
          <>
            <ModalHeader className={modalHeaderClass}>Edit Visitors</ModalHeader>
            <ModalBody className={modalBodyClass}>
              <div className="space-y-4">
                <div className="flex gap-2">
                  <Input
                    label="Add Visitor"
                    value={newVisitor}
                    onValueChange={setNewVisitor}
                    {...modalInputProps}
                    className="flex-1"
                    onKeyPress={(e) => e.key === "Enter" && addVisitor()}
                    placeholder="Enter visitor name"
                  />
                  <Button
                    startContent={<PlusIcon className="h-4 w-4" />}
                    onPress={addVisitor}
                    color="primary"
                    className="self-end"
                  >
                    Add
                  </Button>
                </div>

                <div className="min-h-[200px] border rounded-lg p-4 border-default-200">
                  <p className="text-xs text-default-600 mb-3">Visitors ({localVisitors.length})</p>
                  <div className="flex flex-wrap gap-2">
                    {localVisitors.map((visitor, index) => (
                      <Chip key={index} onClose={() => removeVisitor(index)} variant="flat" color="primary">
                        {visitor}
                      </Chip>
                    ))}
                    {localVisitors.length === 0 && (
                      <p className="text-sm text-gray-500">No visitors added yet</p>
                    )}
                  </div>
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
