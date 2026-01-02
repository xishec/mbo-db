import { Button, Input, Modal, ModalBody, ModalContent, ModalFooter, ModalHeader } from "@heroui/react";
import { useState, useEffect } from "react";
import { useData } from "../../services/useData";
import type { Program } from "../../types";

interface EditProgramModalProps {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  program: Program | null;
}

export default function EditProgramModal({ isOpen, onOpenChange, program }: EditProgramModalProps) {
  const { updateProgram } = useData();
  const [displayName, setDisplayName] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");

  // Update displayName when program changes
  useEffect(() => {
    if (program) {
      setDisplayName(program.displayName);
      setError("");
    }
  }, [program]);

  const handleSubmit = async () => {
    if (displayName.trim() && program) {
      setIsLoading(true);
      setError("");
      try {
        await updateProgram(program.id, displayName.trim());
        onOpenChange(false);
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : "Failed to update program";
        setError(errorMessage);
        console.error("Failed to update program:", err);
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
    <Modal isOpen={isOpen} placement="top-center" onOpenChange={handleClose}>
      <ModalContent>
        <ModalHeader className="flex flex-col gap-1 p-8 pb-0">
          <h2 className="text-2xl font-bold">Edit Program</h2>
          <p className="text-sm font-normal">Update the display name for this program</p>
          {program && (
            <p className="text-xs text-gray-500 mt-2">
              Program ID: <span className="font-mono">{program.id}</span>
            </p>
          )}
        </ModalHeader>
        <ModalBody className="gap-4 px-8 py-4">
          <Input
            label="Display Name"
            placeholder="Enter display name (e.g., MBO Fall Migration)"
            variant="bordered"
            value={displayName}
            labelPlacement="outside"
            onChange={(e) => {
              setDisplayName(e.target.value);
              setError("");
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter" && displayName.trim()) {
                handleSubmit();
              }
            }}
            isRequired
            autoFocus
            isInvalid={!!error}
            errorMessage={error}
          />
        </ModalBody>
        <ModalFooter className="gap-4 p-8 pt-4">
          <Button
            color="danger"
            variant="bordered"
            onPress={handleClose}
            className="flex-1"
            isDisabled={isLoading}
          >
            Cancel
          </Button>
          <Button
            color="primary"
            onPress={handleSubmit}
            isDisabled={!displayName.trim() || displayName.trim() === program?.displayName}
            isLoading={isLoading}
            className="flex-1"
          >
            Update Program
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
}
