import { Button, Input, Tab, Tabs, Tooltip } from "@heroui/react";
import { InformationCircleIcon } from "@heroicons/react/24/outline";
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
  const { updateProgram } = useActions();
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [defaultLocation, setDefaultLocation] = useState("MBO");
  const [isMultiLocation, setIsMultiLocation] = useState(false);
  const [error, setError] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const hasInvalidDateRange = Boolean(startDate && endDate && endDate < startDate);

  useEffect(() => {
    if (!isOpen || !program) return;
    setStartDate(program.startDate ?? "");
    setEndDate(program.endDate ?? "");
    setDefaultLocation(program.defaultLocation ?? "MBO");
    setIsMultiLocation(program.isMultiLocation ?? false);
    setError("");
  }, [isOpen, program]);

  const handleSubmit = async () => {
    if (!program || !startDate || !endDate || (!isMultiLocation && !defaultLocation.trim()) || hasInvalidDateRange) return;
    setIsSaving(true);
    setError("");
    try {
      await updateProgram(program.id, startDate, endDate, defaultLocation, isMultiLocation);
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
        <h2 className="text-2xl font-bold">Edit {program?.id ?? "Program"}</h2>
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
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-1 text-sm font-medium text-foreground">
            <span>Location Choice</span>
            <Tooltip content="Single location prefills every new capture. Multi-location requires a location to be entered manually for each capture.">
              <InformationCircleIcon className="h-4 w-4 text-default-500" aria-label="Location choice help" />
            </Tooltip>
          </div>
          <Tabs
            aria-label="Location choice"
            selectedKey={isMultiLocation ? "multi" : "single"}
            onSelectionChange={(key) => {
              const isMulti = key === "multi";
              setIsMultiLocation(isMulti);
              setDefaultLocation(isMulti ? "" : "MBO");
            }}
            size="sm"
            fullWidth
          >
            <Tab key="single" title="Single" />
            <Tab key="multi" title="Multi" />
          </Tabs>
          <Input
            label="Default Location"
            value={defaultLocation}
            {...modalInputProps}
            onChange={(event) => {
              setDefaultLocation(event.target.value.toUpperCase());
              setError("");
            }}
            onKeyDown={(event) => {
              if (event.key === "Enter") handleSubmit();
            }}
            isDisabled={isMultiLocation}
            isRequired={!isMultiLocation}
          />
        </div>
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
          isDisabled={!startDate || !endDate || (!isMultiLocation && !defaultLocation.trim()) || hasInvalidDateRange || isSaving}
          isLoading={isSaving}
        >
          Save Program
        </Button>
      </ModalFooterShell>
    </ModalShell>
  );
}
