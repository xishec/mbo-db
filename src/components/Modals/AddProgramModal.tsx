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

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && programName.trim()) {
      handleSubmit();
    }
  };

  return (
    <Modal isOpen={isOpen} onOpenChange={onOpenChange}>
      <ModalContent>
        <ModalHeader>Add New Program</ModalHeader>
        <ModalBody>
          <Input
            label="Program Name"
            variant="bordered"
            value={programName}
            onChange={(e) => setProgramName(e.target.value)}
            onKeyPress={handleKeyPress}
          />
        </ModalBody>
        <ModalFooter>
          <Button color="danger" variant="light" onPress={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button color="primary" onPress={handleSubmit} isDisabled={!programName.trim()}>
            Add Program
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
}
