import { Button, Input, Tab, Tabs, Tooltip } from "@heroui/react";
import { InformationCircleIcon } from "@heroicons/react/24/outline";
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
  const [defaultLocation, setDefaultLocation] = useState("MBO");
  const [isMultiLocation, setIsMultiLocation] = useState(false);
  const [error, setError] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const hasInvalidDateRange = Boolean(startDate && endDate && endDate < startDate);

  const handleSubmit = async () => {
    if (programId.trim() && startDate && endDate && (isMultiLocation || defaultLocation.trim())) {
      setIsSaving(true);
      try {
        await addProgram(programId.trim(), startDate, endDate, defaultLocation, isMultiLocation);
        setProgramId("");
        setStartDate("");
        setEndDate("");
        setDefaultLocation("MBO");
        setIsMultiLocation(false);
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
          onChange={(e) => { setProgramId(e.target.value.toUpperCase()); setError(""); }}
          onKeyDown={(e) => { if (e.key === "Enter") handleSubmit(); }}
          isRequired
          autoFocus
          isInvalid={!!error}
          errorMessage={error}
          description="This name is permanent and cannot be changed."
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
            size="md"
            color="primary"
            fullWidth
          >
            <Tab key="single" title="Single" />
            <Tab key="multi" title="Multi" />
          </Tabs>
          <Input
            label="Default Location"
            value={defaultLocation}
            {...modalInputProps}
            onChange={(e) => { setDefaultLocation(e.target.value.toUpperCase()); setError(""); }}
            onKeyDown={(e) => { if (e.key === "Enter") handleSubmit(); }}
            isDisabled={isMultiLocation}
            isRequired={!isMultiLocation}
          />
        </div>
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
          isDisabled={!programId.trim() || !startDate || !endDate || (!isMultiLocation && !defaultLocation.trim()) || hasInvalidDateRange || isSaving}
          isLoading={isSaving}
        >
          Add Program
        </Button>
      </ModalFooterShell>
    </ModalShell>
  );
}
