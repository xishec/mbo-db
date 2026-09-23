import { Button, Input } from "@heroui/react";
import { useEffect, useState } from "react";
import { useActions } from "../../stores/useAppStore";
import type { Program } from "../../types";
import ModalShell, { ModalBodyShell, ModalFooterShell, ModalHeaderShell } from "./ModalShell";
import { modalCancelButtonProps, modalInputProps, modalPrimaryButtonProps } from "./modalDefaults";

interface EditProgramDatesModalProps {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  program: Program | null;
}

export default function EditProgramDatesModal({
  isOpen,
  onOpenChange,
  program,
}: EditProgramDatesModalProps) {
  const { updateProgramDates } = useActions();
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [error, setError] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const hasInvalidDateRange = Boolean(startDate && endDate && endDate < startDate);

  useEffect(() => {
    if (!isOpen || !program) return;
    setStartDate(program.startDate ?? "");
    setEndDate(program.endDate ?? "");
    setError("");
  }, [isOpen, program]);

  const handleSubmit = async () => {
    if (!program || !startDate || !endDate || hasInvalidDateRange) return;
    setIsSaving(true);
    setError("");
    try {
      await updateProgramDates(program.id, startDate, endDate);
      onOpenChange(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update program dates");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <ModalShell
      modalProps={{
        isDismissable: false,
        isOpen,
        placement: "top-center",
        onOpenChange,
      }}
    >
      <ModalHeaderShell>
        <h2 className="text-2xl font-bold">Edit {program?.id ?? "Program"} Dates</h2>
      </ModalHeaderShell>
      <ModalBodyShell>
        <Input
          label="Start Date"
          value={startDate}
          {...modalInputProps}
          onChange={(event) => {
            setStartDate(event.target.value);
            setError("");
          }}
          onKeyDown={(event) => {
            if (event.key === "Enter") handleSubmit();
          }}
          isRequired
          type="date"
          autoFocus
        />
        <Input
          label="End Date"
          value={endDate}
          {...modalInputProps}
          onChange={(event) => {
            setEndDate(event.target.value);
            setError("");
          }}
          onKeyDown={(event) => {
            if (event.key === "Enter") handleSubmit();
          }}
          isRequired
          type="date"
          min={startDate || undefined}
          isInvalid={hasInvalidDateRange || !!error}
          errorMessage={hasInvalidDateRange ? "End date must be on or after start date" : error}
        />
      </ModalBodyShell>
      <ModalFooterShell>
        <Button {...modalCancelButtonProps} onPress={() => onOpenChange(false)} isDisabled={isSaving}>
          Cancel
        </Button>
        <Button
          {...modalPrimaryButtonProps}
          onPress={handleSubmit}
          isDisabled={!startDate || !endDate || hasInvalidDateRange || isSaving}
          isLoading={isSaving}
        >
          Save Dates
        </Button>
      </ModalFooterShell>
    </ModalShell>
  );
}
