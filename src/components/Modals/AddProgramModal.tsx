import {
  Button,
  Input,
  Modal,
  ModalBody,
  ModalContent,
  ModalFooter,
  ModalHeader,
} from "@heroui/react";
import { useState } from "react";

interface AddProgramModalProps {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
}

export default function AddProgramModal({ isOpen, onOpenChange }: AddProgramModalProps) {
  const [programName, setProgramName] = useState("");

  const handleSubmit = () => {
    if (programName.trim()) {
      // TODO: Implement program creation logic
      console.log("Adding program:", programName.trim());
      setProgramName("");
      onOpenChange(false);
    }
  };

  return (
    <Modal isOpen={isOpen} placement="top-center" onOpenChange={onOpenChange}>
      <ModalContent>
        <ModalHeader className="flex flex-col gap-1 p-8 pb-0">
          <h2 className="text-2xl font-bold">Add New Program</h2>
        </ModalHeader>
        <ModalBody className="gap-4 px-8 py-4">
          <Input
            label="Program Name"
            variant="bordered"
            value={programName}
            labelPlacement="outside"
            onChange={(e) => setProgramName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && programName.trim()) {
                handleSubmit();
              }
            }}
            isRequired
            autoFocus
          />
        </ModalBody>
        <ModalFooter className="gap-4 p-8 pt-0">
          <Button color="danger" variant="light" onPress={() => onOpenChange(false)} className="flex-1">
            Cancel
          </Button>
          <Button color="primary" onPress={handleSubmit} isDisabled={!programName.trim()} className="flex-1">
            Add Program
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
}
