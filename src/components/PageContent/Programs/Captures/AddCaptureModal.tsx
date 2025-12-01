import {
  Button,
  Input,
  Modal,
  ModalBody,
  ModalContent,
  ModalFooter,
  ModalHeader,
  Table,
  TableBody,
  TableCell,
  TableColumn,
  TableHeader,
  TableRow,
} from "@heroui/react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useData } from "../../../../services/useData";
import type { Capture, SpeciesRange } from "../../../../helper/helper";
import CapturesTable from "./CapturesTable";
import SpeciesRangeTable from "./SpeciesRangeTable";

// Get the applicable range bounds based on sex
// sex "4" = male, sex "5" = female, otherwise use combined bounds
function getApplicableRange(
  speciesRange: SpeciesRange | null,
  sex: string
): { weightLower: number; weightUpper: number; wingLower: number; wingUpper: number } | null {
  if (!speciesRange) return null;

  if (sex === "4") {
    // Male
    return {
      weightLower: speciesRange.mWeightLower,
      weightUpper: speciesRange.mWeightUpper,
      wingLower: speciesRange.mWingLower,
      wingUpper: speciesRange.mWingUpper,
    };
  } else if (sex === "5") {
    // Female
    return {
      weightLower: speciesRange.fWeightLower,
      weightUpper: speciesRange.fWeightUpper,
      wingLower: speciesRange.fWingLower,
      wingUpper: speciesRange.fWingUpper,
    };
  } else {
    // Unknown sex - use widest range (min of lowers, max of uppers)
    return {
      weightLower: Math.min(speciesRange.mWeightLower, speciesRange.fWeightLower),
      weightUpper: Math.max(speciesRange.mWeightUpper, speciesRange.fWeightUpper),
      wingLower: Math.min(speciesRange.mWingLower, speciesRange.fWingLower),
      wingUpper: Math.max(speciesRange.mWingUpper, speciesRange.fWingUpper),
    };
  }
}

// Check if a value is within range (returns null if no range, true if in range, false if out of range)
function isInRange(value: number, lower: number, upper: number): boolean | null {
  if (lower === 0 && upper === 0) return null; // No valid range data
  if (value === 0) return false
  return value >= lower && value <= upper;
}

interface AddCaptureModalProps {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
}

interface CaptureFormData {
  program: string;
  bandGroup: string;
  bandLastTwoDigits: string;
  species: string;
  wing: string;
  age: string;
  sex: string;
  fat: string;
  weight: string;
  date: string;
  time: string;
  bander: string;
  scribe: string;
  net: string;
  notes: string;
}

const getDefaultFormData = (program: string): CaptureFormData => {
  const now = new Date();
  const date = now.toISOString().split("T")[0]; // YYYY-MM-DD
  const time = now.toTimeString().slice(0, 5); // HH:MM

  return {
    program,
    bandGroup: "",
    bandLastTwoDigits: "",
    species: "",
    wing: "",
    age: "",
    sex: "",
    fat: "",
    weight: "",
    date,
    time,
    bander: "",
    scribe: "",
    net: "",
    notes: "",
  };
};

const CAPTURE_COLUMNS: {
  key: keyof CaptureFormData;
  label: string;
  type?: string;
  className?: string;
  maxLength?: number;
  minLength?: number;
}[] = [
  { key: "program", label: "Program", className: "min-w-[150px]" },
  { key: "bandGroup", label: "Band Group", className: "", maxLength: 8, minLength: 8 },
  { key: "bandLastTwoDigits", label: "Band", className: "", maxLength: 2, minLength: 2 },
  { key: "species", label: "Species", className: "", maxLength: 4, minLength: 4 },
  { key: "wing", label: "Wing", className: "min-w-[60px]", minLength: 1 },
  { key: "age", label: "Age", className: "min-w-[60px]", maxLength: 3, minLength: 3 },
  { key: "sex", label: "Sex", className: "min-w-[60px]", maxLength: 3, minLength: 3 },
  { key: "fat", label: "Fat", className: "", maxLength: 1, minLength: 1 },
  { key: "weight", label: "Weight", className: "", minLength: 1 },
  { key: "date", label: "Date", type: "date", className: "" },
  { key: "time", label: "Time", type: "time", className: "" },
  { key: "bander", label: "Bander", className: "", maxLength: 3, minLength: 3 },
  { key: "scribe", label: "Scribe", className: "", maxLength: 3, minLength: 3 },
  { key: "net", label: "Net", className: "", maxLength: 2, minLength: 3 },
  { key: "notes", label: "Notes", className: "min-w-[150px]" },
];

export default function AddCaptureModal({ isOpen, onOpenChange }: AddCaptureModalProps) {
  const { selectedProgram, fetchCapturesByBandId, magicTable } = useData();
  const [formData, setFormData] = useState<CaptureFormData>(() => getDefaultFormData(selectedProgram || ""));
  const [lastOpenState, setLastOpenState] = useState(false);
  const inputRefs = useRef<Map<string, HTMLInputElement>>(new Map());
  const [existingCaptures, setExistingCaptures] = useState<Capture[]>([]);

  // Reset form data when modal opens
  if (isOpen && !lastOpenState) {
    setFormData(getDefaultFormData(selectedProgram || ""));
    setExistingCaptures([]);
  }
  if (isOpen !== lastOpenState) {
    setLastOpenState(isOpen);
  }

  // Focus on bandGroup input when modal opens
  useEffect(() => {
    if (isOpen) {
      // Small delay to ensure modal is rendered
      const timer = setTimeout(() => {
        inputRefs.current.get("bandGroup")?.focus();
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [isOpen]);

  const pyleSpeciesRange = useMemo(() => {
    if (formData.species.length !== 4 || !magicTable) {
      return null;
    }
    return magicTable.pyle[formData.species] || null;
  }, [formData.species, magicTable]);
  const mboSpeciesRange = useMemo(() => {
    if (formData.species.length !== 4 || !magicTable) {
      return null;
    }
    return magicTable.mbo[formData.species] || null;
  }, [formData.species, magicTable]);

  // Get the first character of sex field for range checking (e.g., "4 | P" -> "4")
  const sexCode = formData.sex.charAt(0);

  // Calculate range validation for wing and weight
  const { rangeValidation, pyleRange, mboRange } = useMemo(() => {
    const wingValue = formData.wing ? Number(formData.wing) : null;
    const weightValue = formData.weight ? Number(formData.weight) : null;

    const pyleRange = getApplicableRange(pyleSpeciesRange, sexCode);
    const mboRange = getApplicableRange(mboSpeciesRange, sexCode);

    return {
      rangeValidation: {
        wing: {
          pyle: wingValue !== null && pyleRange ? isInRange(wingValue, pyleRange.wingLower, pyleRange.wingUpper) : null,
          mbo: wingValue !== null && mboRange ? isInRange(wingValue, mboRange.wingLower, mboRange.wingUpper) : null,
        },
        weight: {
          pyle: weightValue !== null && pyleRange ? isInRange(weightValue, pyleRange.weightLower, pyleRange.weightUpper) : null,
          mbo: weightValue !== null && mboRange ? isInRange(weightValue, mboRange.weightLower, mboRange.weightUpper) : null,
        },
      },
      pyleRange,
      mboRange,
    };
  }, [formData.wing, formData.weight, sexCode, pyleSpeciesRange, mboSpeciesRange]);

  // Determine if wing/weight inputs should show warning (out of range for at least one source)
  // Pyle = danger (red), MBO = warning (orange). Pyle takes priority.
  const wingColor =
    rangeValidation.wing.pyle === false ? "danger" : rangeValidation.wing.mbo === false ? "warning" : null;
  const weightColor =
    rangeValidation.weight.pyle === false ? "danger" : rangeValidation.weight.mbo === false ? "warning" : null;

  // Generate warning messages
  const warningMessages = useMemo(() => {
    const messages: { text: string; color: "danger" | "warning" }[] = [];
    const sexLabel = sexCode === "4" ? "male" : sexCode === "5" ? "female" : "unknown";

    if (rangeValidation.wing.pyle === false && pyleRange) {
      messages.push({
        text: `Wing ${formData.wing} is outside of Pyle range for sex ${sexLabel}, wing should be ${pyleRange.wingLower}-${pyleRange.wingUpper}`,
        color: "danger",
      });
    }
    if (rangeValidation.wing.mbo === false && mboRange) {
      messages.push({
        text: `Wing ${formData.wing} is outside of MBO range for sex ${sexLabel}, wing should be ${mboRange.wingLower}-${mboRange.wingUpper}`,
        color: "warning",
      });
    }
    if (rangeValidation.weight.pyle === false && pyleRange) {
      messages.push({
        text: `Weight ${formData.weight} is outside of Pyle range for sex ${sexLabel}, weight should be ${pyleRange.weightLower}-${pyleRange.weightUpper}`,
        color: "danger",
      });
    }
    if (rangeValidation.weight.mbo === false && mboRange) {
      messages.push({
        text: `Weight ${formData.weight} is outside of MBO range for sex ${sexLabel}, weight should be ${mboRange.weightLower}-${mboRange.weightUpper}`,
        color: "warning",
      });
    }

    // Check for incomplete inputs
    for (const column of CAPTURE_COLUMNS) {
      const value = formData[column.key];
      if (column.minLength && value.length > 0 && value.length < column.minLength) {
        messages.push({
          text: `${column.label} is incomplete`,
          color: "warning",
        });
      }
    }

    return messages;
  }, [rangeValidation, formData, sexCode, pyleRange, mboRange]);

  // Build bandId from bandGroup and bandLastTwoDigits
  const bandId = useMemo(() => {
    if (formData.bandGroup.length === 8 && formData.bandLastTwoDigits.length === 2) {
      return `${formData.bandGroup}${formData.bandLastTwoDigits}`;
    }
    return "";
  }, [formData.bandGroup, formData.bandLastTwoDigits]);

  // Fetch existing captures when bandId is complete
  useEffect(() => {
    if (!bandId) {
      return;
    }

    fetchCapturesByBandId(bandId).then((captures) => {
      setExistingCaptures(captures);
      // Auto-fill species from first existing capture
      if (captures.length > 0 && captures[0].species) {
        setFormData((prev) => ({ ...prev, species: captures[0].species }));
      }
    });
  }, [bandId, fetchCapturesByBandId]);

  const handleInputChange = (field: keyof CaptureFormData, value: string, maxLength?: number) => {
    let shouldResetSpecies = false;

    // Limit bandGroup to format "4 digits - 3 digits" (e.g., "2801-123") - auto-insert -
    if (field === "bandGroup") {
      const digits = value.replace(/\D/g, "").slice(0, 7);
      if (digits.length <= 4) {
        value = digits;
      } else {
        value = `${digits.slice(0, 4)}-${digits.slice(4)}`;
      }
      // Reset species and existing captures when bandGroup changes and bandId becomes invalid
      const newBandIdValid = value.length === 8 && formData.bandLastTwoDigits.length === 2;
      if (!newBandIdValid) {
        setExistingCaptures([]);
        shouldResetSpecies = true;
      }
    }
    // Limit bandLastTwoDigits to 2 digits only
    if (field === "bandLastTwoDigits") {
      value = value.replace(/\D/g, "").slice(0, 2);
      // Reset species and existing captures when bandLastTwoDigits changes and bandId becomes invalid
      const newBandIdValid = formData.bandGroup.length === 8 && value.length === 2;
      if (!newBandIdValid) {
        setExistingCaptures([]);
        shouldResetSpecies = true;
      }
    }
    // Species: 4 letters only
    if (field === "species") {
      value = value
        .replace(/[^a-zA-Z]/g, "")
        .toUpperCase()
        .slice(0, 4);
    }
    // Wing: digits only (no decimal)
    if (field === "wing") {
      value = value.replace(/\D/g, "");
    }
    // Age: format "digit | digit" (e.g., "4 | 1") - auto-insert |
    if (field === "age") {
      // Remove everything except digits
      const digits = value.replace(/[^0-9]/g, "").slice(0, 2);
      if (digits.length === 0) {
        value = "";
      } else if (digits.length === 1) {
        value = digits;
      } else {
        value = `${digits[0]} | ${digits[1]}`;
      }
    }
    // Sex: format "digit | letter/digit" (e.g., "5 | P") - auto-insert |
    if (field === "sex") {
      // Remove everything except alphanumeric
      const chars = value
        .replace(/[^a-zA-Z0-9]/g, "")
        .toUpperCase()
        .slice(0, 2);
      if (chars.length === 0) {
        value = "";
      } else if (chars.length === 1) {
        value = chars;
      } else {
        value = `${chars[0]} | ${chars[1]}`;
      }
    }
    // Fat: 1 digit only
    if (field === "fat") {
      value = value.replace(/\D/g, "").slice(0, 1);
    }
    // Weight: number with 1 decimal digit (e.g., 12.3)
    if (field === "weight") {
      // Allow only digits and one decimal point
      value = value.replace(/[^0-9.]/g, "");
      // Only allow one decimal point
      const parts = value.split(".");
      if (parts.length > 2) {
        value = parts[0] + "." + parts.slice(1).join("");
      }
      // Limit to 1 decimal digit
      if (parts.length === 2 && parts[1].length > 1) {
        value = parts[0] + "." + parts[1].slice(0, 1);
      }
    }
    // Bander: 3 letters only
    if (field === "bander") {
      value = value
        .replace(/[^a-zA-Z]/g, "")
        .toUpperCase()
        .slice(0, 3);
    }
    // Scribe: 3 letters only
    if (field === "scribe") {
      value = value
        .replace(/[^a-zA-Z]/g, "")
        .toUpperCase()
        .slice(0, 3);
    }
    // Net: 2 letters or numbers
    if (field === "net") {
      value = value
        .replace(/[^a-zA-Z0-9]/g, "")
        .toUpperCase()
        .slice(0, 2);
    }
    setFormData((prev) => ({
      ...prev,
      [field]: value,
      ...(shouldResetSpecies ? { species: "" } : {}),
    }));

    // Auto-focus next input when maxLength is reached
    if (maxLength && value.length >= maxLength) {
      const currentIndex = CAPTURE_COLUMNS.findIndex((col) => col.key === field);
      if (currentIndex < CAPTURE_COLUMNS.length - 1) {
        const nextKey = CAPTURE_COLUMNS[currentIndex + 1].key;
        const nextInput = inputRefs.current.get(nextKey);
        nextInput?.focus();
      }
    }

    // Auto-focus next input for weight after decimal digit is entered
    if (field === "weight" && value.includes(".") && value.split(".")[1]?.length === 1) {
      const currentIndex = CAPTURE_COLUMNS.findIndex((col) => col.key === field);
      if (currentIndex < CAPTURE_COLUMNS.length - 1) {
        const nextKey = CAPTURE_COLUMNS[currentIndex + 1].key;
        const nextInput = inputRefs.current.get(nextKey);
        nextInput?.focus();
      }
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent, field: keyof CaptureFormData) => {
    // Focus previous input when pressing backspace/delete on an empty field
    if ((e.key === "Backspace" || e.key === "Delete") && formData[field] === "") {
      const currentIndex = CAPTURE_COLUMNS.findIndex((col) => col.key === field);
      if (currentIndex > 0) {
        e.preventDefault();
        const prevKey = CAPTURE_COLUMNS[currentIndex - 1].key;
        const prevInput = inputRefs.current.get(prevKey);
        prevInput?.focus();
      }
    }

    if (e.key === "Tab" && !e.shiftKey) {
      const currentIndex = CAPTURE_COLUMNS.findIndex((col) => col.key === field);
      if (currentIndex < CAPTURE_COLUMNS.length - 1) {
        e.preventDefault();
        const nextKey = CAPTURE_COLUMNS[currentIndex + 1].key;
        const nextInput = inputRefs.current.get(nextKey);
        nextInput?.focus();
      }
    } else if (e.key === "Tab" && e.shiftKey) {
      const currentIndex = CAPTURE_COLUMNS.findIndex((col) => col.key === field);
      if (currentIndex > 0) {
        e.preventDefault();
        const prevKey = CAPTURE_COLUMNS[currentIndex - 1].key;
        const prevInput = inputRefs.current.get(prevKey);
        prevInput?.focus();
      }
    }
  };

  const handleClose = () => {
    onOpenChange(false);
  };

  const handleSave = () => {
    // TODO: Implement save logic
    console.log("Saving capture:", formData);
    handleClose();
  };

  return (
    <Modal
      isKeyboardDismissDisabled={true}
      isOpen={isOpen}
      onOpenChange={onOpenChange}
      className={`!max-w-[calc(100%-4rem)] ${existingCaptures.length > 0 ? "!h-[calc(100%-4rem)]" : ""}`}
      scrollBehavior="inside"
    >
      <ModalContent>
        {() => (
          <>
            <ModalHeader className="flex flex-row items-center gap-1 p-8 pb-0 font-normal">
              Add Capture in <span className="font-bold">{selectedProgram}</span>
            </ModalHeader>
            <ModalBody className="gap-4 px-8 py-4">
              {formData.species.length === 4 && (pyleSpeciesRange || mboSpeciesRange) && (
                <div className="flex gap-4">
                  <SpeciesRangeTable title="Pyle" speciesCode={formData.species} speciesRange={pyleSpeciesRange} />
                  <SpeciesRangeTable title="MBO" speciesCode={formData.species} speciesRange={mboSpeciesRange} />
                </div>
              )}
              <Table>
                <TableHeader columns={CAPTURE_COLUMNS}>
                  {(column) => (
                    <TableColumn key={column.key} className={`whitespace-nowrap ${column.className || ""}`}>
                      {column.label}
                    </TableColumn>
                  )}
                </TableHeader>
                <TableBody>
                  <TableRow key="new-capture">
                    {CAPTURE_COLUMNS.map((column) => {
                      // Check range validation for wing/weight
                      const rangeColor =
                        column.key === "wing" ? wingColor : column.key === "weight" ? weightColor : null;

                      // Check minLength validation (only show warning if field has content but is incomplete)
                      const value = formData[column.key];
                      const isIncomplete = column.minLength && value.length > 0 && value.length < column.minLength;

                      // Determine final input color: range errors take priority, then minLength
                      const inputColor = rangeColor || (isIncomplete ? "warning" : null);

                      // Build border classes that persist regardless of focus state
                      const borderClass =
                        inputColor === "danger"
                          ? "!border-danger data-[hover=true]:!border-danger group-data-[focus=true]:!border-danger"
                          : inputColor === "warning"
                          ? "!border-warning data-[hover=true]:!border-warning group-data-[focus=true]:!border-warning"
                          : "";

                      return (
                        <TableCell key={column.key} className="p-1">
                          <Input
                            ref={(el) => {
                              if (el) inputRefs.current.set(column.key, el);
                            }}
                            variant="bordered"
                            color={inputColor || "default"}
                            aria-label={column.label}
                            type={column.type || "text"}
                            maxLength={column.maxLength}
                            value={formData[column.key]}
                            onChange={(e) => handleInputChange(column.key, e.target.value, column.maxLength)}
                            onKeyDown={(e) => handleKeyDown(e, column.key)}
                            classNames={{
                              input:
                                "text-sm [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none",
                              inputWrapper: borderClass,
                            }}
                          />
                        </TableCell>
                      );
                    })}
                  </TableRow>
                </TableBody>
              </Table>

              {warningMessages.length > 0 && (
                <div className="text-sm">
                  <ul className="list-disc list-inside">
                    {warningMessages.map((msg, idx) => (
                      <li key={idx} className={msg.color === "danger" ? "text-danger" : "text-warning"}>
                        {msg.text}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {existingCaptures.length > 0 && (
                <div className="mt-4">
                  <h3 className="text-lg font-normal mb-2">
                    Existing data for band <span className="font-bold">{bandId}</span> :
                  </h3>
                  <CapturesTable
                    captures={existingCaptures}
                    maxTableHeight={300}
                    sortColumn="date"
                    sortDirection="descending"
                  />
                </div>
              )}
            </ModalBody>
            <ModalFooter className="gap-4 p-8 pt-0">
              <Button color="danger" variant="light" onPress={handleClose}>
                Cancel
              </Button>
              <Button color="primary" onPress={handleSave}>
                Save
              </Button>
            </ModalFooter>
          </>
        )}
      </ModalContent>
    </Modal>
  );
}
