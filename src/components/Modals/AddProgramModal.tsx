import { Button, Input } from "@heroui/react";
import { useState } from "react";
import { useActions } from "../../stores/useAppStore";
import ModalShell, { ModalBodyShell, ModalFooterShell, ModalHeaderShell } from "./ModalShell";
import { modalInputProps, modalCancelButtonProps, modalPrimaryButtonProps } from "./modalDefaults";

interface AddProgramModalProps {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
}

export default function AddProgramModal({ isOpen, onOpenChange }: AddProgramModalProps) {
  const { addProgram } = useActions();
  const [programId, setProgramId] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [error, setError] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const hasInvalidDateRange = Boolean(startDate && endDate && endDate < startDate);

  const handleSubmit = async () => {
    if (programId.trim() && startDate && endDate) {
      setIsSaving(true);
      try {
        await addProgram(programId.trim(), startDate, endDate);
        setProgramId("");
        setStartDate("");
        setEndDate("");
        onOpenChange(false);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to add program");
      } finally {
        setIsSaving(false);
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
        <Input
          label="Start Date"
          value={startDate}
          {...modalInputProps}
          onChange={(e) => { setStartDate(e.target.value); setError(""); }}
          onKeyDown={(e) => { if (e.key === "Enter") handleSubmit(); }}
          isRequired
          type="date"
        />
        <Input
          label="End Date"
          value={endDate}
          {...modalInputProps}
          onChange={(e) => { setEndDate(e.target.value); setError(""); }}
          onKeyDown={(e) => { if (e.key === "Enter") handleSubmit(); }}
          isRequired
          type="date"
          min={startDate || undefined}
          isInvalid={hasInvalidDateRange}
          errorMessage={hasInvalidDateRange ? "End date must be on or after start date" : undefined}
        />
      </ModalBodyShell>
      <ModalFooterShell>
        <Button {...modalCancelButtonProps} onPress={() => onOpenChange(false)} isDisabled={isSaving}>
          Cancel
        </Button>
        <Button
          {...modalPrimaryButtonProps}
          onPress={handleSubmit}
          isDisabled={!programId.trim() || !startDate || !endDate || hasInvalidDateRange || isSaving}
          isLoading={isSaving}
        >
          Add Program
        </Button>
      </ModalFooterShell>
    </ModalShell>
  );
}
