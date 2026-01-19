import { useState, useEffect } from "react";
import {
  Modal,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
  Button,
  Input,
  Textarea,
} from "@heroui/react";
import type { DET } from "../../types/DET";
import { stopModalPropagation } from "./modalInteractions";
import {
  modalBodyClass,
  modalFooterClass,
  modalHeaderClass,
  modalInputProps,
  modalCancelButtonProps,
  modalPrimaryButtonProps,
} from "./modalDefaults";

interface AddOrEditDETModalProps {
  isOpen: boolean;
  onOpenChange: () => void;
  onSave: (det: DET) => Promise<void>;
  existingDET?: DET | null;
  mode: "create" | "edit";
}

export default function AddOrEditDETModal({ isOpen, onOpenChange, onSave, existingDET, mode }: AddOrEditDETModalProps) {
  const [date, setDate] = useState("");
  const [programId, setProgramId] = useState("");
  const [location, setLocation] = useState("");
  const [banderInCharge, setBanderInCharge] = useState("");
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");
  const [coverageCode, setCoverageCode] = useState("");
  const [narrative, setNarrative] = useState("");
  const [deviations, setDeviations] = useState("");
  const [stationManagement, setStationManagement] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState("");

  // Prefill form when editing
  useEffect(() => {
    if (mode === "edit" && existingDET) {
      setDate(existingDET.date);
      setProgramId(existingDET.programId);
      setLocation(existingDET.location);
      setBanderInCharge(existingDET.banderInCharge || "");
      setStart(existingDET.start || "");
      setEnd(existingDET.end || "");
      setCoverageCode(String(existingDET.coverageCode));
      setNarrative(existingDET.narrative);
      setDeviations(existingDET.deviations);
      setStationManagement(existingDET.stationManagement);
    } else if (mode === "create") {
      // Reset form for new DET
      setDate("");
      setProgramId("");
      setLocation("");
      setBanderInCharge("");
      setStart("");
      setEnd("");
      setCoverageCode("");
      setNarrative("");
      setDeviations("");
      setStationManagement("");
    }
    setError("");
  }, [mode, existingDET, isOpen]);

  const handleSave = async () => {
    setError("");

    // Validation
    if (!date) {
      setError("Date is required");
      return;
    }
    if (!programId) {
      setError("Program ID is required");
      return;
    }
    if (!location) {
      setError("Location is required");
      return;
    }
    if (!coverageCode || isNaN(Number(coverageCode))) {
      setError("Valid coverage code is required");
      return;
    }

    try {
      setIsSaving(true);

      // Build DET object, preserving complex fields from existing DET
      const det: DET = {
        date,
        programId,
        location,
        banderInCharge: banderInCharge || undefined,
        start: start || undefined,
        end: end || undefined,
        coverageCode: Number(coverageCode),
        narrative,
        deviations,
        stationManagement,
        
        // Preserve existing complex data or use defaults
        observerHours: existingDET?.observerHours || { total: 0 },
        netHours: existingDET?.netHours || { nets: [], hummingbirdTrapTotal: "0", total: "0" },
        visitors: existingDET?.visitors || [],
        injuries: existingDET?.injuries || [],
        released: existingDET?.released || [],
        censuser: existingDET?.censuser,
        censusStart: existingDET?.censusStart,
        censusEnd: existingDET?.censusEnd,
        observedSpeciesCount: existingDET?.observedSpeciesCount || {},
        censusSpeciesCount: existingDET?.censusSpeciesCount || {},
        bandedSpeciesCount: existingDET?.bandedSpeciesCount || {},
        repeatSpeciesCount: existingDET?.repeatSpeciesCount || {},
        returnSpeciesCount: existingDET?.returnSpeciesCount || {},
        DETSpeciesCount: existingDET?.DETSpeciesCount || {},
        weather: existingDET?.weather,
      };

      await onSave(det);
      onOpenChange(); // Close modal on success
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save DET");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Modal onClick={stopModalPropagation} isOpen={isOpen} onOpenChange={onOpenChange} size="2xl" scrollBehavior="inside">
      <ModalContent onClick={stopModalPropagation}>
        {(onClose) => (
          <>
            <ModalHeader className={modalHeaderClass}>
              {mode === "create" ? "Add New DET" : "Edit DET"}
            </ModalHeader>
            <ModalBody className={modalBodyClass}>
              <div className="flex flex-col gap-4">
                {error && (
                  <div className="bg-danger-50 text-danger-500 p-3 rounded-lg text-sm">
                    {error}
                  </div>
                )}

                <Input
                  label="Date"
                  {...modalInputProps}
                  type="date"
                  value={date}
                  onValueChange={setDate}
                  isRequired
                  isDisabled={mode === "edit"} // Can't change date when editing
                />

                <Input
                  label="Program ID"
                    {...modalInputProps}
                  value={programId}
                  onValueChange={setProgramId}
                  isRequired
                  placeholder="e.g., FALL2024"
                />

                <Input
                  label="Location"
                    {...modalInputProps}
                  value={location}
                  onValueChange={setLocation}
                  isRequired
                  placeholder="e.g., MBO"
                />

                <div className="grid grid-cols-3 gap-4">
                  <Input
                    label="Bander in Charge"
                    {...modalInputProps}
                    value={banderInCharge}
                    onValueChange={setBanderInCharge}
                  />
                  <Input
                    label="Start Time"
                    {...modalInputProps}
                    type="time"
                    value={start}
                    onValueChange={setStart}
                  />
                  <Input
                    label="End Time"
                    {...modalInputProps}
                    type="time"
                    value={end}
                    onValueChange={setEnd}
                  />
                </div>

                <Input
                  label="Coverage Code"
                  {...modalInputProps}
                  type="number"
                  value={coverageCode}
                  onValueChange={setCoverageCode}
                  isRequired
                  placeholder="e.g., 1"
                />

                <Textarea
                  label="Narrative"
                  labelPlacement="outside"
                  value={narrative}
                  onValueChange={setNarrative}
                  variant="bordered"
                  minRows={3}
                  placeholder="Daily narrative..."
                />

                <Textarea
                  label="Deviations"
                  labelPlacement="outside"
                  value={deviations}
                  onValueChange={setDeviations}
                  variant="bordered"
                  minRows={3}
                  placeholder="Any deviations from protocol..."
                />

                <Textarea
                  label="Station Management"
                  labelPlacement="outside"
                  value={stationManagement}
                  onValueChange={setStationManagement}
                  variant="bordered"
                  minRows={3}
                  placeholder="Station management notes..."
                />
              </div>
            </ModalBody>
            <ModalFooter className={modalFooterClass}>
              <Button {...modalCancelButtonProps} onPress={onClose} isDisabled={isSaving}>
                Cancel
              </Button>
              <Button {...modalPrimaryButtonProps} onPress={handleSave} isLoading={isSaving}>
                {mode === "create" ? "Create DET" : "Save Changes"}
              </Button>
            </ModalFooter>
          </>
        )}
      </ModalContent>
    </Modal>
  );
}
