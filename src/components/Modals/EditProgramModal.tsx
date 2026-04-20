import { Button, Input } from "@heroui/react";
import { useState, useMemo, useEffect } from "react";
import { useData } from "../../services/useData";
import type { Program } from "../../types";
import ModalShell, { ModalBodyShell, ModalFooterShell, ModalHeaderShell } from "./ModalShell";
import {
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
  const [displayName, setDisplayName] = useState(() => program?.displayName ?? "");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");

  // Sync displayName from props when modal opens or program changes
  useEffect(() => {
    if (isOpen && program) {
      setDisplayName(program.displayName);
      setError("");
    }
  }, [isOpen, program]);

  // Reset error when modal closes
  const handleOpenChange = (open: boolean) => {
    if (!open) {
      setError("");
    }
    onOpenChange(open);
  };

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
    handleOpenChange(false);
  };

  return (
    <ModalShell
      modalProps={{
        isDismissable: false,
        isOpen,
        placement: "top-center",
        onOpenChange: handleClose,
      }}
    >
      <ModalHeaderShell>
        <h2 className="text-2xl font-bold">Edit Program</h2>
        <p className="text-sm font-normal">Update the display name for this program</p>
          {program && (
            <p className="text-xs text-gray-500 mt-2">
              Program ID: <span className="font-mono">{program.id}</span>
            </p>
          )}
        </ModalHeaderShell>
        <ModalBodyShell>
          {!isOnline && (
            <div className="bg-warning-50 border border-warning-200 rounded-medium p-3 text-sm text-warning-800">
              You are currently offline. Changes will be saved locally and synced when back online. Please make sure no one else edits this program before you sync.
            </div>
          )}
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
        </ModalBodyShell>
        <ModalFooterShell>
          <Button {...modalCancelButtonProps} onPress={handleClose} className="flex-1" isDisabled={isLoading}>
            Cancel
          </Button>
          <Button
            {...modalPrimaryButtonProps}
            onPress={handleSubmit}
            isDisabled={!displayName.trim() || !hasChanged || isDuplicate}
            isLoading={isLoading}
            className="flex-1"
          >
            Update Program
          </Button>
        </ModalFooterShell>
    </ModalShell>
  );
}
