import { Button, Input } from "@heroui/react";
import { useState } from "react";
import { useData } from "../../services/useData";
import ModalShell, { ModalBodyShell, ModalFooterShell, ModalHeaderShell } from "./ModalShell";
import { modalInputProps, modalCancelButtonProps, modalPrimaryButtonProps } from "./modalDefaults";

interface AddProgramModalProps {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
}

export default function AddProgramModal({ isOpen, onOpenChange }: AddProgramModalProps) {
  const { addProgram } = useData();
  const [programId, setProgramId] = useState("");
  const [year, setYear] = useState(() => new Date().getFullYear().toString());
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async () => {
    if (programId.trim() && year.trim()) {
      setIsLoading(true);
      setError("");
      try {
        await addProgram(programId.trim(), year.trim());
        setProgramId("");
        setYear(new Date().getFullYear().toString());
        onOpenChange(false);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to add program");
      } finally {
        setIsLoading(false);
      }
    }
  };

  return (
    <ModalShell
      modalProps={{
        isDismissable: false,
        isOpen,
        placement: "top-center",
        onOpenChange: () => { setError(""); onOpenChange(false); },
      }}
    >
      <ModalHeaderShell>
        <h2 className="text-2xl font-bold">Add New Program</h2>
      </ModalHeaderShell>
      <ModalBodyShell>
        <Input
          label="Year"
          placeholder="Enter year"
          value={year}
          {...modalInputProps}
          onChange={(e) => setYear(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") handleSubmit(); }}
          isRequired
          type="number"
        />
        <Input
          label="Program Name"
          placeholder="e.g., SMMP2026"
          value={programId}
          {...modalInputProps}
          onChange={(e) => { setProgramId(e.target.value); setError(""); }}
          onKeyDown={(e) => { if (e.key === "Enter") handleSubmit(); }}
          isRequired
          autoFocus
          isInvalid={!!error}
          errorMessage={error}
          description="This name is permanent and cannot be changed."
        />
      </ModalBodyShell>
      <ModalFooterShell>
        <Button {...modalCancelButtonProps} onPress={() => onOpenChange(false)} isDisabled={isLoading}>
          Cancel
        </Button>
        <Button {...modalPrimaryButtonProps} onPress={handleSubmit} isDisabled={!programId.trim() || !year.trim()} isLoading={isLoading}>
          Add Program
        </Button>
      </ModalFooterShell>
    </ModalShell>
  );
}
