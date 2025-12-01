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
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useData } from "../../../../../services/useData";
import type { Capture, CaptureFormData } from "../../../../../types";
import { CAPTURE_COLUMNS } from "../helpers";
import { formatFieldValue, getApplicableRange, getDefaultFormData, isInRange } from "../helpers";
import CapturesTable from "../CapturesTable";
import SpeciesRangeTable from "../SpeciesRangeTable";

interface AddCaptureModalProps {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
}

export default function AddCaptureModal({ isOpen, onOpenChange }: AddCaptureModalProps) {
  const { selectedProgram, fetchCapturesByBandId, checkBandIdExists, magicTable } = useData();
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
      const timer = setTimeout(() => {
        inputRefs.current.get("bandGroup")?.focus();
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [isOpen]);

  // Species range lookups
  const pyleSpeciesRange = useMemo(() => {
    if (formData.species.length !== 4 || !magicTable) return null;
    return magicTable.pyle[formData.species] || null;
  }, [formData.species, magicTable]);

  const mboSpeciesRange = useMemo(() => {
    if (formData.species.length !== 4 || !magicTable) return null;
    return magicTable.mbo[formData.species] || null;
  }, [formData.species, magicTable]);

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
          pyle:
            weightValue !== null && pyleRange
              ? isInRange(weightValue, pyleRange.weightLower, pyleRange.weightUpper)
              : null,
          mbo:
            weightValue !== null && mboRange
              ? isInRange(weightValue, mboRange.weightLower, mboRange.weightUpper)
              : null,
        },
      },
      pyleRange,
      mboRange,
    };
  }, [formData.wing, formData.weight, sexCode, pyleSpeciesRange, mboSpeciesRange]);

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

    // Check if sex matches existing captures logic
    if (existingCaptures.length > 0 && formData.sex.length > 0) {
      const capturesWithDefinedSex = existingCaptures.filter((capture) => ["4", "5"].includes(capture.sex));
      if (capturesWithDefinedSex.length > 0) {
        const allSexMatch = capturesWithDefinedSex.every((capture) => capture.sex === formData.sex);
        if (!allSexMatch) {
          const existingSexValues = [...new Set(capturesWithDefinedSex.map((c) => c.sex))].join(", ");
          messages.push({
            text: `Sex ${formData.sex} does not match existing captures (was ${existingSexValues})`,
            color: "danger",
          });
        }
      }
    }

    for (const column of CAPTURE_COLUMNS) {
      const value = formData[column.key as keyof CaptureFormData];
      if (column.minLength && value.length > 0 && value.length < column.minLength) {
        messages.push({ text: `${column.label} is incomplete`, color: "warning" });
      }
    }

    return messages;
  }, [rangeValidation, formData, sexCode, pyleRange, mboRange, existingCaptures]);

  // Build bandId from bandGroup and bandLastTwoDigits
  const bandId = useMemo(() => {
    if (formData.bandGroup.length === 8 && formData.bandLastTwoDigits.length === 2) {
      return `${formData.bandGroup}${formData.bandLastTwoDigits}`;
    }
    return "";
  }, [formData.bandGroup, formData.bandLastTwoDigits]);

  // Fetch existing captures when bandId is complete
  useEffect(() => {
    if (!bandId) return;

    Promise.all([fetchCapturesByBandId(bandId), checkBandIdExists(bandId)]).then(([captures, exists]) => {
      setExistingCaptures(captures);

      // setFormData((prev) => {
      //   const updates: Partial<CaptureFormData> = {};

      //   // Auto-compute captureType if date is available
      //   if (prev.date) {
      //     let captureType = "None";
      //     if (captures.length > 0) {
      //       // Check if any capture was within 90 days
      //       const currentDate = new Date(prev.date);
      //       const hasRecentCapture = captures.some((capture) => {
      //         const captureDate = new Date(capture.date);
      //         const daysDiff = Math.abs((currentDate.getTime() - captureDate.getTime()) / (1000 * 60 * 60 * 24));
      //         return daysDiff <= 90;
      //       });
      //       captureType = hasRecentCapture ? "Repeat" : "Return";
      //     } else if (!exists) {
      //       captureType = "Alien";
      //     } else {
      //       captureType = "Banded";
      //     }
      //     updates.captureType = captureType;
      //   }

      //   // Set species from first capture
      //   if (captures.length > 0 && captures[0].species) {
      //     updates.species = captures[0].species;
      //   }

      //   return { ...prev, ...updates };
      // });
    });
  }, [bandId, fetchCapturesByBandId, checkBandIdExists]);

  const focusNextInput = useCallback((currentField: keyof CaptureFormData) => {
    const currentIndex = CAPTURE_COLUMNS.findIndex((col) => col.key === currentField);
    if (currentIndex < CAPTURE_COLUMNS.length - 1) {
      const nextKey = CAPTURE_COLUMNS[currentIndex + 1].key;
      inputRefs.current.get(nextKey)?.focus();
    }
  }, []);

  const focusPrevInput = useCallback((currentField: keyof CaptureFormData) => {
    const currentIndex = CAPTURE_COLUMNS.findIndex((col) => col.key === currentField);
    if (currentIndex > 0) {
      const prevKey = CAPTURE_COLUMNS[currentIndex - 1].key;
      inputRefs.current.get(prevKey)?.focus();
    }
  }, []);

  const handleInputChange = useCallback(
    (field: keyof CaptureFormData, value: string, maxLength?: number) => {
      const formattedValue = formatFieldValue(field, value);
      let shouldResetSpecies = false;

      // Reset species and existing captures when band fields change and bandId becomes invalid
      if (field === "bandGroup" || field === "bandLastTwoDigits") {
        setFormData((prev) => {
          const isBandIdValid =
            field === "bandGroup"
              ? formattedValue.length === 8 && prev.bandLastTwoDigits.length === 2
              : prev.bandGroup.length === 8 && formattedValue.length === 2;

          if (!isBandIdValid) {
            setExistingCaptures([]);
            shouldResetSpecies = true;
          }

          return {
            ...prev,
            [field]: formattedValue,
            ...(shouldResetSpecies ? { species: "" } : {}),
          };
        });
      } else {
        setFormData((prev) => ({ ...prev, [field]: formattedValue }));
      }

      // Auto-focus next input when maxLength is reached
      if (maxLength && formattedValue.length >= maxLength) {
        focusNextInput(field);
      }

      // Auto-focus next input for weight after decimal digit is entered
      if (field === "weight" && formattedValue.includes(".") && formattedValue.split(".")[1]?.length === 1) {
        focusNextInput(field);
      }
    },
    [focusNextInput]
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent, field: keyof CaptureFormData) => {
      if ((e.key === "Backspace" || e.key === "Delete") && formData[field] === "") {
        e.preventDefault();
        focusPrevInput(field);
      } else if (e.key === "Tab") {
        e.preventDefault();
        if (e.shiftKey) {
          focusPrevInput(field);
        } else {
          focusNextInput(field);
        }
      }
    },
    [formData, focusNextInput, focusPrevInput]
  );

  const handleClose = useCallback(() => {
    onOpenChange(false);
  }, [onOpenChange]);

  const handleSave = useCallback(() => {
    // TODO: Implement save logic
    console.log("Saving capture:", formData);
    handleClose();
  }, [formData, handleClose]);

  const getInputColor = (columnKey: keyof CaptureFormData) => {
    // Check wing range validation
    if (columnKey === "wing") {
      if (rangeValidation.wing.pyle === false) return "danger";
      if (rangeValidation.wing.mbo === false) return "warning";
    }

    // Check weight range validation
    if (columnKey === "weight") {
      if (rangeValidation.weight.pyle === false) return "danger";
      if (rangeValidation.weight.mbo === false) return "warning";
    }

    // Check if sex is valid based on existing captures
    if (columnKey === "sex" && existingCaptures.length > 0 && formData.sex.length > 0) {
      const capturesWithDefinedSex = existingCaptures.filter((capture) => ["4", "5"].includes(capture.sex));
      if (capturesWithDefinedSex.length > 0) {
        const allSexMatch = capturesWithDefinedSex.every((capture) => capture.sex === formData.sex);
        if (!allSexMatch) {
          return "danger";
        }
      }
    }

    const column = CAPTURE_COLUMNS.find((col) => col.key === columnKey);
    const value = formData[columnKey];
    const isIncomplete = column?.minLength && value.length > 0 && value.length < column.minLength;
    return isIncomplete ? "warning" : null;
  };

  const getBorderClass = (color: "danger" | "warning" | null) => {
    if (color === "danger") {
      return "!border-danger data-[hover=true]:!border-danger group-data-[focus=true]:!border-danger";
    }
    if (color === "warning") {
      return "!border-warning data-[hover=true]:!border-warning group-data-[focus=true]:!border-warning";
    }
    return "";
  };

  return (
    <Modal
      isKeyboardDismissDisabled
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
                      {column.key === "howAged" || column.key === "howSexed" ? "" : column.label}
                    </TableColumn>
                  )}
                </TableHeader>
                <TableBody>
                  <TableRow key="new-capture">
                    {CAPTURE_COLUMNS.map((column) => {
                      const inputColor = getInputColor(column.key);
                      return (
                        <TableCell key={column.key} className="p-1">
                          {column.key === "programId" ? (
                            <div className="px-3 py-2 text-sm text-default-600 bg-default-50 rounded-lg border">
                              {selectedProgram}
                            </div>
                          ) : column.key === "captureType" ? (
                            <div className="px-3 py-2 text-sm text-default-600 bg-default-50 rounded-lg border">
                              {formData.captureType}
                            </div>
                          ) : (
                            <Input
                              ref={(el) => {
                                if (el) inputRefs.current.set(column.key, el);
                              }}
                              variant="bordered"
                              color={inputColor || "default"}
                              aria-label={column.label}
                              type={column.type || "text"}
                              maxLength={column.maxLength}
                              validationBehavior="aria"
                              value={formData[column.key as keyof CaptureFormData]}
                              onChange={(e) => handleInputChange(column.key, e.target.value, column.maxLength)}
                              onKeyDown={(e) => handleKeyDown(e, column.key)}
                              style={column.maxLength ? { width: `${10 * column.maxLength}px` } : undefined}
                              classNames={{
                                input:
                                  "text-sm [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none",
                                inputWrapper: getBorderClass(inputColor),
                              }}
                            />
                          )}
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
