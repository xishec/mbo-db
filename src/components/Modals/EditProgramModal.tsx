import { Button, Input, Modal, ModalBody, ModalContent, ModalFooter, ModalHeader } from "@heroui/react";
import { useState, useEffect, useMemo } from "react";
import { useData } from "../../services/useData";
import type { Program } from "../../types";
import {
  modalBodyClass,
  modalFooterClass,
  modalHeaderClass,
  modalInputProps,
  modalCancelButtonProps,
  modalPrimaryButtonProps,
} from "./modalDefaults";

interface EditProgramModalProps {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  program: Program | null;
}

export default function EditProgramModal({ isOpen, onOpenChange, program }: EditProgramModalProps) {
  const { updateProgram, isOnline, programsMap } = useData();
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

  // Check if display name is unique (case-insensitive, excluding current program)
  const isDuplicate = useMemo(() => {
    if (!displayName.trim() || !program) return false;
    const trimmedDisplayName = displayName.trim();
    return Object.values(programsMap).some(
      (p) => p.id !== program.id && p.displayName.toLowerCase() === trimmedDisplayName.toLowerCase()
    );
  }, [displayName, program, programsMap]);

  // Check if displayName has changed
  const hasChanged = useMemo(() => {
    return displayName.trim() !== program?.displayName;
  }, [displayName, program]);

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
    <Modal isDismissable isOpen={isOpen} placement="top-center" onOpenChange={handleClose}>
      <ModalContent>
        <ModalHeader className={modalHeaderClass}>
          <h2 className="text-2xl font-bold">Edit Program</h2>
          <p className="text-sm font-normal">Update the display name for this program</p>
          {program && (
            <p className="text-xs text-gray-500 mt-2">
              Program ID: <span className="font-mono">{program.id}</span>
            </p>
          )}
        </ModalHeader>
        <ModalBody className={modalBodyClass}>
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
              if (e.key === "Enter" && displayName.trim() && !isDuplicate && hasChanged) {
                handleSubmit();
              }
            }}
            isRequired
            autoFocus
            isInvalid={!!error || isDuplicate}
            errorMessage={error || (isDuplicate ? "A program with this display name already exists" : "")}
          />
        </ModalBody>
        <ModalFooter className={modalFooterClass}>
          <Button {...modalCancelButtonProps} onPress={handleClose} className="flex-1" isDisabled={isLoading}>
            Cancel
          </Button>
          <Button
            {...modalPrimaryButtonProps}
            onPress={handleSubmit}
            isDisabled={!displayName.trim() || !hasChanged || isDuplicate || !isOnline}
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
