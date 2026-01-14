import {
  Button,
  Input,
  Modal,
  ModalBody,
  ModalContent,
  ModalFooter,
  ModalHeader,
  Select,
  SelectItem,
  Switch,
  Table,
  TableBody,
  TableCell,
  TableColumn,
  TableHeader,
  TableRow,
} from "@heroui/react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useData } from "../../services/useData";
import { BandSize, BirdEventType, type BirdEvent, type CaptureFormData } from "../../types";
import { TABLE_COLUMNS, getSortedColumns } from "../PageContent/Programs/Captures/helpers";
import {
  formatFieldValue,
  getApplicableRange,
  getDefaultFormData,
  isInRange,
} from "../PageContent/Programs/Captures/helpers";
import BirdEventsTable from "../PageContent/Programs/Captures/BirdEventsTable";
import SpeciesRangeTable from "../PageContent/Programs/Captures/SpeciesRangeTable";

interface AddBirdEventModalProps {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  bandSize?: BandSize;
  birdEventToModify?: BirdEvent;
  isNewCapture: boolean;
}

export default function AddBirdEventModal({
  isOpen,
  onOpenChange,
  bandSize = BandSize.Other,
  birdEventToModify,
  isNewCapture,
}: AddBirdEventModalProps) {
  const {
    selectedProgram,
    bandGroupsMap,
    magicTable,
    bandIdToBirdEventIdsMap,
    birdEventsMap,
    addBirdEvent,
    bandSizeToBandIdMap,
    incrementBandSize,
  } = useData();
  const [formData, setFormData] = useState<CaptureFormData>(() => getDefaultFormData(selectedProgram?.id || ""));
  const inputRefs = useRef<Map<string, HTMLInputElement>>(new Map());
  const [lastBandId, setLastBandId] = useState("");
  const [useCurrentTime, setUseCurrentTime] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [wasOpen, setWasOpen] = useState(false);

  // Get sorted columns based on capture type
  const sortedColumns = useMemo(
    () => getSortedColumns(isNewCapture, birdEventToModify?.id),
    [isNewCapture, birdEventToModify?.id]
  );

  // Reset form data when modal opens
  useEffect(() => {
    if (!isOpen) {
      setWasOpen(false);
      return;
    }

    const defaultData = getDefaultFormData(selectedProgram?.id || "");

    // If modifying an existing bird event, use its data
    if (birdEventToModify) {
      const bandGroup = birdEventToModify.band.id.slice(0, 7);
      const bandLastTwoDigits = birdEventToModify.band.id.slice(7, 9);

      defaultData.programId = birdEventToModify.programId;
      defaultData.bandGroup = bandGroup;
      defaultData.bandLastTwoDigits = bandLastTwoDigits;
      defaultData.species = birdEventToModify.species;
      defaultData.wing = birdEventToModify.wing.toString();
      defaultData.age = birdEventToModify.age;
      defaultData.howAged = birdEventToModify.howAged;
      defaultData.sex = birdEventToModify.sex;
      defaultData.howSexed = birdEventToModify.howSexed;
      defaultData.fat = birdEventToModify.fat.toString();
      defaultData.weight = birdEventToModify.weight.toString();
      defaultData.date = birdEventToModify.date;
      defaultData.time = birdEventToModify.time;
      defaultData.bander = birdEventToModify.bander;
      defaultData.scribe = birdEventToModify.scribe;
      defaultData.net = birdEventToModify.net;
      defaultData.birdStatus = birdEventToModify.birdStatus;
      defaultData.notes = birdEventToModify.notes;

      setUseCurrentTime(false); // Disable auto-update when modifying
      setFormData(defaultData);
      setLastBandId("");
      setWasOpen(true);
    } else if (!wasOpen) {
      // First time opening modal - reset to defaults
      // Preserve date/time if useCurrentTime is false
      if (!useCurrentTime) {
        defaultData.date = formData.date;
        defaultData.time = formData.time;
      }

      // Populate bandGroup and bandLastTwoDigits from bandSize
      let preFilled = false;
      if (bandSize !== BandSize.Other && bandSizeToBandIdMap[bandSize]) {
        const bandId = bandSizeToBandIdMap[bandSize];
        if (bandId.length === 9) {
          const bandGroup = bandId.slice(0, 7);
          const bandLastTwoDigits = bandId.slice(7, 9);
          defaultData.bandGroup = bandGroup;
          defaultData.bandLastTwoDigits = bandLastTwoDigits;
          preFilled = true;
        }
      }
      setFormData(defaultData);
      setLastBandId("");
      setWasOpen(true);
      if (isNewCapture) {
        focusTo(preFilled ? "species" : "bandGroup");
      } else {
        focusTo("bander");
      }
    } else {
      // Modal already open - only update band fields if bandSize changed
      if (bandSize !== BandSize.Other && bandSizeToBandIdMap[bandSize]) {
        const bandId = bandSizeToBandIdMap[bandSize];
        if (bandId.length === 9) {
          const bandGroup = bandId.slice(0, 7);
          const bandLastTwoDigits = bandId.slice(7, 9);
          setFormData((prev) => ({
            ...prev,
            bandGroup,
            bandLastTwoDigits,
          }));
          setLastBandId("");
          focusTo("bander");
        }
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, bandSize, birdEventToModify, bandSizeToBandIdMap]);

  const focusTo = useCallback((fieldKey: string) => {
    setTimeout(() => {
      inputRefs.current.get(fieldKey)?.focus();
    }, 100);
  }, []);

  // Update date/time when useCurrentTime is enabled
  useEffect(() => {
    if (!useCurrentTime) return;

    const updateTime = () => {
      const now = new Date();
      const currentDate = now.toISOString().split("T")[0];
      const currentTime = now.toTimeString().slice(0, 5);
      setFormData((prev) => {
        if (prev.date === currentDate && prev.time === currentTime) return prev;
        return { ...prev, date: currentDate, time: currentTime };
      });
    };

    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, [useCurrentTime]);

  // Species range lookups
  const pyleSpeciesRange = useMemo(() => {
    if (formData.species.length !== 4 || !magicTable || !magicTable.pyle) return null;
    return magicTable.pyle[formData.species] || null;
  }, [formData.species, magicTable]);

  const mboSpeciesRange = useMemo(() => {
    if (formData.species.length !== 4 || !magicTable || !magicTable.mbo) return null;
    return magicTable.mbo[formData.species] || null;
  }, [formData.species, magicTable]);

  const sexCode = formData.sex.charAt(0);

  // Build bandId from bandGroup and bandLastTwoDigits
  const bandId = useMemo(() => {
    if (formData.bandGroup.length === 7 && formData.bandLastTwoDigits.length === 2) {
      return `${formData.bandGroup}${formData.bandLastTwoDigits}`;
    }
    return "";
  }, [formData.bandGroup, formData.bandLastTwoDigits]);

  // Derive past bird events from bandId (no state needed!)
  const pastBirdEvents = useMemo(() => {
    if (!bandId) return [];
    const birdEventIds = bandIdToBirdEventIdsMap[bandId] || [];
    return birdEventIds
      .map((id) => birdEventsMap[id])
      .filter(Boolean)
      .filter((event) => event.modifiedEventId == null)
      .filter((event) => !birdEventToModify || event.id !== birdEventToModify.id);
  }, [bandId, bandIdToBirdEventIdsMap, birdEventsMap, birdEventToModify]);

  // Compute suggested capture type (doesn't auto-update formData)
  const suggestedBirdEventType = useMemo(() => {
    if (formData.bandGroup.length !== 7) return BirdEventType.None;
    if (birdEventToModify) return birdEventToModify.birdEventType;
    if (formData.species === "BADE" || formData.species === "BALO") return BirdEventType.None;
    if (pastBirdEvents.length === 0) {
      if (bandGroupsMap[formData.bandGroup] || isNewCapture) return BirdEventType.Banded;
      else return BirdEventType.Alien;
    } else {
      const currentDate = new Date(formData.date);
      const hasRecentCapture = pastBirdEvents.some((capture) => {
        const captureDate = new Date(capture.date);
        const daysDiff = Math.abs((currentDate.getTime() - captureDate.getTime()) / (1000 * 60 * 60 * 24));
        return daysDiff <= 90;
      });
      return hasRecentCapture ? BirdEventType.Repeat : BirdEventType.Return;
    }
  }, [
    bandGroupsMap,
    birdEventToModify,
    formData.bandGroup,
    formData.date,
    formData.species,
    pastBirdEvents,
    isNewCapture,
  ]);

  // Set birdEventType to suggested value only when modal opens or key dependencies change
  useEffect(() => {
    if (!isOpen) return;
    setFormData((prev) => ({ ...prev, birdEventType: suggestedBirdEventType }));
  }, [isOpen, suggestedBirdEventType]);

  // Auto-fill species from past bird events whenever bandId changes
  if (bandId && bandId !== lastBandId) {
    let existingSpecies: string | undefined;

    if (birdEventToModify) {
      existingSpecies = birdEventToModify.species;
    } else {
      const birdEventIds = bandIdToBirdEventIdsMap[bandId] || [];
      const events = birdEventIds
        .map((id) => birdEventsMap[id])
        .filter(Boolean)
        .filter((event) => event.modifiedEventId == null);
      existingSpecies = events[0]?.species;
    }

    if (existingSpecies) {
      setFormData((prev) => ({ ...prev, species: existingSpecies }));
    }
    setLastBandId(bandId);
  } else if (!bandId && lastBandId) {
    setLastBandId("");
  }

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
    if (pastBirdEvents.length > 0 && formData.sex.length > 0) {
      const capturesWithDefinedSex = pastBirdEvents.filter((capture) => ["4", "5"].includes(capture.sex));
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

    // Check if bird is being recaptured on the same day
    if (pastBirdEvents.length > 0 && formData.date && useCurrentTime) {
      const sameDayCapture = pastBirdEvents.some((capture) => capture.date === formData.date);
      if (sameDayCapture) {
        messages.push({
          text: "Bird was already captured today - should be released without logging",
          color: "danger",
        });
      }
    }

    for (const column of TABLE_COLUMNS) {
      const value = formData[column.key as keyof CaptureFormData];
      if (column.minLength && value.length > 0 && value.length < column.minLength) {
        messages.push({ text: `${column.label} is incomplete`, color: "warning" });
      }
    }

    return messages;
  }, [
    sexCode,
    rangeValidation.wing.pyle,
    rangeValidation.wing.mbo,
    rangeValidation.weight.pyle,
    rangeValidation.weight.mbo,
    pyleRange,
    mboRange,
    pastBirdEvents,
    formData,
    useCurrentTime,
  ]);

  const focusNextInput = useCallback((currentField: keyof CaptureFormData) => {
    const currentIndex = TABLE_COLUMNS.findIndex((col) => col.key === currentField);
    if (currentIndex < TABLE_COLUMNS.length - 1) {
      const nextKey = TABLE_COLUMNS.slice(currentIndex + 1).find(
        (col) => !["birdEventType", "date", "time"].includes(col.key)
      )?.key;
      if (!nextKey) return;

      inputRefs.current.get(nextKey)?.focus();
    }
  }, []);

  const focusPrevInput = useCallback((currentField: keyof CaptureFormData) => {
    const currentIndex = TABLE_COLUMNS.findIndex((col) => col.key === currentField);
    if (currentIndex > 0) {
      const prevKey = TABLE_COLUMNS.slice(0, currentIndex)
        .reverse()
        .find((col) => !["birdEventType", "date", "time"].includes(col.key))?.key;
      if (!prevKey) return;

      inputRefs.current.get(prevKey)?.focus();
    }
  }, []);

  const handleInputChange = useCallback(
    (field: keyof CaptureFormData, value: string, maxLength?: number) => {
      const formattedValue = formatFieldValue(field, value);

      setFormData((prev) => ({
        ...prev,
        [field]: formattedValue,
      }));

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

  const handleModalOpenChange = useCallback(
    (isOpen: boolean) => {
      if (!isOpen && isSaving) {
        // Prevent closing modal while saving
        return;
      }
      onOpenChange(isOpen);
    },
    [isSaving, onOpenChange]
  );

  const handleSave = useCallback(
    async (shouldContinue: boolean = false) => {
      setIsSaving(true);
      try {
        const bandSizeToSend =
          formData.birdEventType === BirdEventType.Banded || formData.birdEventType === BirdEventType.None
            ? bandSize
            : BandSize.Other;
        await addBirdEvent(formData, bandSizeToSend, birdEventToModify?.id);

        if (shouldContinue) {
          await incrementBandSize(bandSizeToSend, formData.bandGroup, formData.bandLastTwoDigits);

          setIsSaving(false);
          focusTo("species");
        } else {
          setIsSaving(false);
          handleClose();
        }
      } catch (err) {
        console.error("Failed to save capture:", err);
        alert("Failed to save capture. Please try again.");
        setIsSaving(false);
      }
    },
    [formData, bandSize, addBirdEvent, birdEventToModify?.id, incrementBandSize, focusTo, handleClose]
  );

  const handleSaveAndClose = useCallback(() => handleSave(false), [handleSave]);
  const handleSaveAndNext = useCallback(() => handleSave(true), [handleSave]);

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
    if (columnKey === "sex" && pastBirdEvents.length > 0 && formData.sex.length > 0) {
      const capturesWithDefinedSex = pastBirdEvents.filter((capture) => ["4", "5"].includes(capture.sex));
      if (capturesWithDefinedSex.length > 0) {
        const allSexMatch = capturesWithDefinedSex.every((capture) => capture.sex === formData.sex);
        if (!allSexMatch) {
          return "danger";
        }
      }
    }

    const column = TABLE_COLUMNS.find((col) => col.key === columnKey);
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

  const shouldShowPastBirdEvents = pastBirdEvents.length > 0 && !birdEventToModify;

  return (
    <Modal
      isKeyboardDismissDisabled
      isOpen={isOpen}
      onOpenChange={handleModalOpenChange}
      className={`${birdEventToModify ? "!max-w-[calc(100%-8rem)]" : "!max-w-[calc(100%-4rem)]"} ${
        shouldShowPastBirdEvents ? "!h-[calc(100%-4rem)]" : ""
      }`}
      scrollBehavior="inside"
    >
      <ModalContent>
        {() => (
          <>
            <ModalHeader className="flex flex-row items-center justify-between p-8 pb-0 font-normal">
              <div className="flex flex-row items-center gap-1 font-bold">
                {birdEventToModify ? "Modify" : "Add"} Capture
              </div>
              {!birdEventToModify && (
                <Switch isSelected={useCurrentTime} onValueChange={setUseCurrentTime}>
                  Use current time
                </Switch>
              )}
            </ModalHeader>
            <ModalBody className="gap-4 px-8 py-4">
              {formData.species.length === 4 && (pyleSpeciesRange || mboSpeciesRange) && (
                <div className="flex gap-4">
                  <SpeciesRangeTable title="Pyle" speciesCode={formData.species} speciesRange={pyleSpeciesRange} />
                  <SpeciesRangeTable title="MBO" speciesCode={formData.species} speciesRange={mboSpeciesRange} />
                </div>
              )}
              <Table
                aria-label="New capture form"
                classNames={{
                  base: "table-fixed",
                  table: "table-fixed",
                }}
              >
                <TableHeader columns={sortedColumns.filter((column) => column.key !== "actions")}>
                  {(column) => (
                    <TableColumn key={column.key} className={column.className || ""}>
                      {column.key === "howAged" || column.key === "howSexed" ? "" : column.label}
                    </TableColumn>
                  )}
                </TableHeader>
                <TableBody>
                  <TableRow key="new-capture">
                    {sortedColumns
                      .filter((column) => column.key !== "actions")
                      .map((column) => {
                        const columnKey = column.key as keyof CaptureFormData;
                        const inputColor = getInputColor(columnKey);

                        const getReadonlyValue = () => {
                          if (column.key === "programId") return selectedProgram?.displayName;
                          if (useCurrentTime && (columnKey === "date" || columnKey === "time"))
                            return formData[columnKey];
                          // Make band fields readonly when prefilled from birdEventToModify
                          if (birdEventToModify && (column.key === "bandGroup" || column.key === "bandLastTwoDigits"))
                            return formData[columnKey];
                          return null;
                        };

                        const readonlyValue = getReadonlyValue();

                        return (
                          <TableCell key={column.key} className="p-1">
                            {readonlyValue ? (
                              <div className="px-3 py-2 text-sm text-default-600 bg-default-50 rounded-lg border whitespace-nowrap">
                                {readonlyValue}
                              </div>
                            ) : column.key === "birdEventType" ? (
                              <Select
                                variant="bordered"
                                aria-label={column.label}
                                selectedKeys={[formData.birdEventType]}
                                onSelectionChange={(keys) => {
                                  const value = Array.from(keys)[0] as string;
                                  setFormData((prev) => ({ ...prev, birdEventType: value }));
                                }}
                                isDisabled={isSaving}
                                classNames={{
                                  trigger: "min-h-unit-10 h-unit-10",
                                  value: "text-sm",
                                }}
                              >
                                {Object.values(BirdEventType).map((type) => (
                                  <SelectItem key={type}>{type}</SelectItem>
                                ))}
                              </Select>
                            ) : (
                              <Input
                                ref={(el) => {
                                  if (el) inputRefs.current.set(columnKey, el);
                                }}
                                variant="bordered"
                                color={inputColor || "default"}
                                aria-label={column.label}
                                type={column.type || "text"}
                                maxLength={column.maxLength}
                                validationBehavior="aria"
                                value={formData[columnKey]}
                                onChange={(e) => handleInputChange(columnKey, e.target.value, column.maxLength)}
                                onKeyDown={(e) => handleKeyDown(e, columnKey)}
                                onFocus={(e) => e.target.select()}
                                isDisabled={isSaving}
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

              {shouldShowPastBirdEvents && (
                <div className="mt-4">
                  <h3 className="text-lg font-normal mb-2">
                    Existing data for band <span className="font-bold">{bandId}</span> :
                  </h3>
                  <BirdEventsTable
                    birdEvents={pastBirdEvents}
                    maxTableHeight={300}
                    sortDescriptors={[{ column: "date", direction: "ascending" }]}
                    allowInspectHistory
                  />
                </div>
              )}
            </ModalBody>
            <ModalFooter className="gap-4 p-8 pt-4">
              <Button color="danger" variant="bordered" onPress={handleClose} isDisabled={isSaving}>
                Cancel
              </Button>
              <Button
                color="primary"
                variant="bordered"
                onPress={handleSaveAndNext}
                isLoading={isSaving}
                isDisabled={isSaving}
              >
                Save and Next
              </Button>
              <Button color="primary" onPress={handleSaveAndClose} isLoading={isSaving} isDisabled={isSaving}>
                Save
              </Button>
            </ModalFooter>
          </>
        )}
      </ModalContent>
    </Modal>
  );
}
