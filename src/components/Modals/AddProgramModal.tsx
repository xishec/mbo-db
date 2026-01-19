import { Button, Input, Modal, ModalBody, ModalContent, ModalFooter, ModalHeader } from "@heroui/react";
import { useState } from "react";
import { useData } from "../../services/useData";
import { stopModalPropagation } from "./modalInteractions";
import {
  modalBodyClass,
  modalFooterClass,
  modalHeaderClass,
  modalInputProps,
  modalCancelButtonProps,
  modalPrimaryButtonProps,
} from "./modalDefaults";

interface AddProgramModalProps {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
}

export default function AddProgramModal({ isOpen, onOpenChange }: AddProgramModalProps) {
  const { addProgram } = useData();
  const [displayName, setDisplayName] = useState("");
  const [year, setYear] = useState(() => new Date().getFullYear().toString());
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async () => {
    if (displayName.trim() && year.trim()) {
      setIsLoading(true);
      setError("");
      try {
        // Auto-generate programId from timestamp
        const programId = `${displayName.trim()}-${Date.now().toString()}`;
        await addProgram(programId, displayName.trim(), year.trim());
        setDisplayName("");
        setYear(new Date().getFullYear().toString());
        onOpenChange(false);
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : "Failed to add program";
        setError(errorMessage);
        console.error("Failed to add program:", err);
      } finally {
        setIsLoading(false);
      }
    }
  };

  const handleClose = () => {
    setError("");
    onOpenChange(false);
  };

  return (
    <Modal onClick={stopModalPropagation} isDismissable isOpen={isOpen} placement="top-center" onOpenChange={handleClose}>
      <ModalContent onClick={stopModalPropagation}>
        <ModalHeader className={modalHeaderClass}>
          <h2 className="text-2xl font-bold">Add New Program</h2>
          <p className="text-sm font-normal">Enter a display name and year for the new program</p>
        </ModalHeader>
        <ModalBody className={modalBodyClass}>
          <Input
            label="Year"
            placeholder="Enter year"
            value={year}
            {...modalInputProps}
            onChange={(e) => setYear(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && displayName.trim() && year.trim()) {
                handleSubmit();
              }
            }}
            isRequired
            type="number"
          />
          <Input
            label="Display Name"
            placeholder="Enter display name (e.g., MBO Fall Migration)"
            value={displayName}
            {...modalInputProps}
            onChange={(e) => {
              setDisplayName(e.target.value);
              setError("");
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter" && displayName.trim() && year.trim()) {
                handleSubmit();
              }
            }}
            isRequired
            autoFocus
            isInvalid={!!error}
            errorMessage={error}
          />
        </ModalBody>
        <ModalFooter className={modalFooterClass}>
          <Button
            {...modalCancelButtonProps}
            onPress={() => onOpenChange(false)}
            className="flex-1"
            isDisabled={isLoading}
          >
            Cancel
          </Button>
          <Button
            {...modalPrimaryButtonProps}
            onPress={handleSubmit}
            isDisabled={!displayName.trim() || !year.trim()}
            isLoading={isLoading}
            className="flex-1"
          >
            Add Program
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
}
