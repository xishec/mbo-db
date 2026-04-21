import {
  Button,
  Input,
  Select,
  SelectItem,
  Switch,
  Spinner,
  Modal,
  ModalContent,
  ModalBody,
  Card,
  CardBody,
} from "@heroui/react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useData } from "../../services/useData";
import { BandSize, BirdEventType, type BirdEvent, type CaptureFormData } from "../../types";
import { DEFAULT_BIRD_STATUS } from "../../types/birdStatus";
import { validateBirdEventForm, findErrorsInEvents } from "../../types/birdEventErrors";
import BirdStatusModal from "./BirdStatusModal";
import ValidationMessages from "../Helper/ValidationMessages";
import { TABLE_COLUMNS } from "../PageContent/Programs/Captures/helpers";
import { formatFieldValue, getApplicableRange, getDefaultFormData } from "../PageContent/Programs/Captures/helpers";
import BirdEventsTable from "../PageContent/Programs/Captures/BirdEventsTable";
import PyleTable from "../Helper/Info/PyleTable";
import SpeciesFunFacts from "../Helper/Info/SpeciesFunFacts";
import ModalShell, { ModalBodyShell, ModalFooterShell, ModalHeaderShell } from "./ModalShell";
import { modalInputProps, modalCancelButtonProps, modalPrimaryButtonProps } from "./modalDefaults";

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
    volunteersMap,
    speciesInfoMap,
  } = useData();
  const [formData, setFormData] = useState<CaptureFormData>(() => getDefaultFormData(selectedProgram?.id || ""));
  const inputRefs = useRef<Map<string, HTMLInputElement>>(new Map());
  const [lastBandId, setLastBandId] = useState("");
  const [useCurrentTime, setUseCurrentTime] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [wasOpen, setWasOpen] = useState(false);
  const [isBirdStatusModalOpen, setIsBirdStatusModalOpen] = useState(false);

  // Sum of all input column widths (excl. actions/updatedAt/notes) + gaps
  const inputRowWidth = 1145;

  // Reset form data when modal opens
  useEffect(() => {
    if (!isOpen) {
      setWasOpen(false);
      setIsSaving(false);
      return;
    }

    const defaultData = getDefaultFormData(selectedProgram?.id || "");

    // If modifying an existing bird event, use its data
    if (birdEventToModify) {
      const bandGroup = birdEventToModify.band.bandGroupId;
      const bandLastTwoDigits = birdEventToModify.band.last2digits;

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
      if (bandSize !== BandSize.Other && bandSizeToBandIdMap[bandSize]) {
        const bandId = bandSizeToBandIdMap[bandSize];
        if (bandId.length === 9) {
          defaultData.bandGroup = bandId.slice(0, 7);
          defaultData.bandLastTwoDigits = bandId.slice(7, 9);
        }
      }
      setFormData(defaultData);
      setLastBandId("");
      setWasOpen(true);
      const firstEmpty = focusOrder.find((key) => {
        const colKey = key.includes("-") ? key.split("-")[0] : key;
        return !defaultData[colKey as keyof CaptureFormData];
      }) ?? firstEditableField;
      focusTo(firstEmpty);
    } else if (bandSize !== BandSize.Other && bandSizeToBandIdMap[bandSize]) {
      // Modal already open — update band fields after bandSizeToBandIdMap recomputed
      const bandId = bandSizeToBandIdMap[bandSize];
      if (bandId.length === 9) {
        setFormData((prev) => ({
          ...prev,
          bandGroup: bandId.slice(0, 7),
          bandLastTwoDigits: bandId.slice(7, 9),
        }));
        setLastBandId("");
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, bandSize, birdEventToModify, bandSizeToBandIdMap]);

  // Focus order matches visual layout: row 1 then row 2
  const ROW1_KEYS = ["net", "bandGroup", "bandLastTwoDigits", "species", "wing", "age", "howAged", "sex", "howSexed", "fat", "weight"];
  const ROW2_KEYS_DATE_TIME = ["date", "date-month", "date-day", "time", "time-minute"];
  const ROW2_KEYS_OTHER = ["bander", "scribe", "notes"];

  const focusOrder = useMemo(() => {
    const order = [...ROW1_KEYS];
    if (!useCurrentTime) order.push(...ROW2_KEYS_DATE_TIME);
    order.push(...ROW2_KEYS_OTHER);
    return order;
  }, [useCurrentTime]);

  const firstEditableField = useMemo(() => {
    return focusOrder[0] ?? "bandGroup";
  }, [focusOrder]);

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

  const sexCode = formData.sex.charAt(0);

  // Build bandId from bandGroup and bandLastTwoDigits
  const bandId = useMemo(() => {
    if (formData.bandGroup.length === 7 && formData.bandLastTwoDigits.length === 2) {
      return formData.bandGroup + formData.bandLastTwoDigits;
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
    if (!bandId) return BirdEventType.None;
    if (birdEventToModify) return birdEventToModify.birdEventType;
    if (formData.species === "BADE" || formData.species === "BALO") return BirdEventType.None;
    if (pastBirdEvents.length === 0) {
      // For -00 bands, check the previous band group (business rule)
      const last2digits = bandId.slice(7, 9);
      const bandGroupId = bandId.slice(0, 7);
      const bandGroupMapKey =
        last2digits === "00" ? (parseInt(bandGroupId, 10) - 1).toString().padStart(7, "0") : bandGroupId;
      if (bandGroupsMap[bandGroupMapKey] || isNewCapture) return BirdEventType.Banded;
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
  }, [bandId, bandGroupsMap, birdEventToModify, formData.date, formData.species, pastBirdEvents, isNewCapture]);

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

  // Consolidated validation state - all validation logic in one place
  const validationState = useMemo(() => {
    const wingValue = formData.wing ? Number(formData.wing) : null;
    const weightValue = formData.weight ? Number(formData.weight) : null;

    const pyleRange = getApplicableRange(pyleSpeciesRange ?? undefined, sexCode);

    // Range validation for wing and weight (20% tolerance to match error messages)
    const isInTolerance = (value: number, lower: number, upper: number): boolean | null => {
      if (lower === 0 && upper === 0) return null;
      if (value === 0) return false;
      return value >= lower * 0.8 && value <= upper * 1.2;
    };
    const rangeValidation = {
      wing: {
        pyle:
          wingValue !== null && pyleRange ? isInTolerance(wingValue, pyleRange.wingLower, pyleRange.wingUpper) : null,
      },
      weight: {
        pyle:
          weightValue !== null && pyleRange
            ? isInTolerance(weightValue, pyleRange.weightLower, pyleRange.weightUpper)
            : null,
      },
    };

    // Sex validation against past captures
    const capturesWithDefinedSex = pastBirdEvents.filter((capture) => ["4", "5"].includes(capture.sex));
    const sexConflict =
      pastBirdEvents.length > 0 &&
      formData.sex.length > 0 &&
      capturesWithDefinedSex.length > 0 &&
      !capturesWithDefinedSex.every((capture) => capture.sex === formData.sex);

    // Incomplete field validation
    const incompleteFields = new Set<string>();
    for (const column of TABLE_COLUMNS) {
      const value = formData[column.key as keyof CaptureFormData];
      if (column.minLength && value.length > 0 && value.length < column.minLength) {
        incompleteFields.add(column.key);
      }
    }

    // Existing errors from past bird events
    const existingErrors = findErrorsInEvents(pastBirdEvents, magicTable);

    // Current entry validation messages
    const messages = validateBirdEventForm(
      {
        species: formData.species,
        wing: formData.wing,
        weight: formData.weight,
        sex: formData.sex,
        age: formData.age,
        date: formData.date,
        time: formData.time,
        fat: formData.fat,
      },
      pastBirdEvents,
      magicTable
    );

    // Add incomplete field warnings to messages
    for (const column of TABLE_COLUMNS) {
      if (incompleteFields.has(column.key)) {
        messages.push({ text: `${column.label} is incomplete`, severity: "warning" });
      }
    }

    // Volunteer validation
    const banderUnknown = formData.bander.length >= 2 && !volunteersMap[formData.bander];
    const scribeUnknown = formData.scribe.length >= 2 && !volunteersMap[formData.scribe];
    if (banderUnknown) {
      messages.push({
        text: `Unknown bander "${formData.bander}". Saving will auto-add them to the volunteer list.`,
        severity: "warning",
      });
    }
    if (scribeUnknown) {
      messages.push({
        text: `Unknown scribe "${formData.scribe}". Saving will auto-add them to the volunteer list.`,
        severity: "warning",
      });
    }

    return {
      rangeValidation,
      sexConflict,
      banderUnknown,
      scribeUnknown,
      incompleteFields,
      existingErrors,
      warningMessages: messages,
    };
  }, [formData, pastBirdEvents, magicTable, TABLE_COLUMNS, sexCode, pyleSpeciesRange, volunteersMap]);

  const focusNext = useCallback(
    (currentKey: string) => {
      const idx = focusOrder.indexOf(currentKey);
      if (idx >= 0 && idx < focusOrder.length - 1) {
        inputRefs.current.get(focusOrder[idx + 1])?.focus();
      }
    },
    [focusOrder]
  );




  const handleInputChange = useCallback(
    (field: keyof CaptureFormData, value: string, maxLength?: number) => {
      const formattedValue = formatFieldValue(field, value);

      setFormData((prev) => ({
        ...prev,
        [field]: formattedValue,
      }));

      // Auto-focus next input when maxLength is reached
      if (maxLength && formattedValue.length >= maxLength) {
        focusNext(field);
      }

      // Auto-focus next input for weight after decimal digit is entered
      if (field === "weight" && formattedValue.includes(".") && formattedValue.split(".")[1]?.length === 1) {
        focusNext(field);
      }
    },
    [focusNext]
  );

  const getTabIndex = useCallback(
    (key: string) => {
      const idx = focusOrder.indexOf(key);
      return idx >= 0 ? idx + 1 : -1;
    },
    [focusOrder]
  );

  const handleClose = useCallback(() => {
    onOpenChange(false);
  }, [onOpenChange]);

  const handleModalOpenChange = useCallback(
    (isOpen: boolean) => {
      onOpenChange(isOpen);
    },
    [onOpenChange]
  );

  const handleSave = useCallback(
    async (shouldContinue: boolean = false) => {
      if (isSaving) return;
      setIsSaving(true);

      try {
        const bandSizeToSend =
          formData.birdEventType === BirdEventType.Banded || formData.birdEventType === BirdEventType.None
            ? bandSize
            : BandSize.Other;
        await addBirdEvent(formData, bandSizeToSend, birdEventToModify?.id);

        if (shouldContinue) {
          setFormData((prev) => ({
            ...prev,
            species: "",
            wing: "",
            age: "",
            howAged: "",
            sex: "",
            howSexed: "",
            fat: "",
            weight: "",
            birdStatus: DEFAULT_BIRD_STATUS,
            notes: "",
          }));
          setLastBandId("");
          setIsSaving(false);
          focusTo("species");
        } else {
          onOpenChange(false);
        }
      } catch (err) {
        console.error("Failed to save capture:", err);
        alert("Failed to save capture. Please try again.");
        setIsSaving(false);
      }
    },
    [formData, bandSize, addBirdEvent, birdEventToModify?.id, isSaving, focusTo, onOpenChange]
  );

  const handleSaveAndClose = useCallback(() => handleSave(false), [handleSave]);
  const handleSaveAndNext = useCallback(() => handleSave(true), [handleSave]);

  const getInputColor = useCallback(
    (columnKey: keyof CaptureFormData): "danger" | "warning" | null => {
      const { rangeValidation, sexConflict, banderUnknown, scribeUnknown, incompleteFields } = validationState;

      // Wing range validation
      if (columnKey === "wing") {
        if (rangeValidation.wing.pyle === false) return "danger";
      }

      // Weight range validation
      if (columnKey === "weight") {
        if (rangeValidation.weight.pyle === false) return "danger";
      }

      // Warning for values outside strict Pyle range but within 20% tolerance
      if (columnKey === "wing" && rangeValidation.wing.pyle === true) {
        const wingValue = Number(formData.wing);
        const pyleRange = getApplicableRange(pyleSpeciesRange ?? undefined, sexCode);
        if (pyleRange && wingValue > 0 && (wingValue < pyleRange.wingLower || wingValue > pyleRange.wingUpper)) {
          return "warning";
        }
      }
      if (columnKey === "weight" && rangeValidation.weight.pyle === true) {
        const weightValue = Number(formData.weight);
        const pyleRange = getApplicableRange(pyleSpeciesRange ?? undefined, sexCode);
        if (
          pyleRange &&
          weightValue > 0 &&
          (weightValue < pyleRange.weightLower || weightValue > pyleRange.weightUpper)
        ) {
          return "warning";
        }
      }

      // Sex conflict validation
      if (columnKey === "sex" && sexConflict) {
        return "danger";
      }

      // Volunteer validation
      if (columnKey === "bander" && banderUnknown) return "warning";
      if (columnKey === "scribe" && scribeUnknown) return "warning";

      // Incomplete field validation
      if (incompleteFields.has(columnKey)) {
        return "warning";
      }

      return null;
    },
    [validationState]
  );

  const getBorderClass = useCallback((color: "danger" | "warning" | null) => {
    if (color === "danger") {
      return "!border-danger data-[hover=true]:!border-danger group-data-[focus=true]:!border-danger";
    }
    if (color === "warning") {
      return "!border-warning data-[hover=true]:!border-warning group-data-[focus=true]:!border-warning";
    }
    return "";
  }, []);

  const renderTableCell = useCallback(
    (column: { key: string; label: string; type?: string; maxLength?: number }) => {
      const columnKey = column.key as keyof CaptureFormData;
      const inputColor = getInputColor(columnKey);

      // Determine readonly value
      const readonlyValue = (() => {
        if (column.key === "programId") return selectedProgram?.id;
        if (birdEventToModify && (column.key === "bandGroup" || column.key === "bandLastTwoDigits"))
          return formData[columnKey];
        return null;
      })();

      // Readonly field with optional edit icon
      if (readonlyValue) {
        return (
          <div className="px-3 py-2 text-sm text-default-900 bg-default-50 rounded-medium border-medium border-default-50 whitespace-nowrap">
            {readonlyValue}
          </div>
        );
      }

      if (column.key === "birdStatus") {
        return (
          <Button
            fullWidth
            variant="ghost"
            onPress={() => setIsBirdStatusModalOpen(true)}
            isDisabled={isSaving}
            className="border-medium border-default-200 min-w-[0px]"
          >
            {formData[columnKey]}
          </Button>
        );
      }

      // Bird event type selector
      if (column.key === "birdEventType") {
        return (
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
        );
      }

      if (column.key === "date" || column.key === "time") return null;

      return (
        <Input
          ref={(el: HTMLInputElement | null) => {
            if (el) inputRefs.current.set(columnKey, el);
          }}
          {...modalInputProps}
          color={inputColor || "default"}
          aria-label={column.label}
          type={column.type}
          maxLength={column.maxLength}
          validationBehavior="aria"
          value={formData[columnKey]}
          tabIndex={getTabIndex(columnKey)}
          onChange={(e) => handleInputChange(columnKey, e.target.value, column.maxLength)}
          isDisabled={isSaving}
          classNames={{
            input:
              "text-sm [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none",
            inputWrapper: getBorderClass(inputColor),
          }}
        />
      );
    },
    [
      formData,
      selectedProgram,
      useCurrentTime,
      birdEventToModify,
      isSaving,
      getInputColor,
      getBorderClass,
      handleInputChange,
      getTabIndex,
    ]
  );

  const shouldShowPastBirdEvents = pastBirdEvents.length > 0 && !birdEventToModify;

  return (
    <>
      <Modal isOpen={isSaving} isDismissable={false} hideCloseButton size="sm">
        <ModalContent>
          <ModalBody>
            <div className="flex items-center justify-center py-8">
              <Spinner size="lg" label="Saving..." />
            </div>
          </ModalBody>
        </ModalContent>
      </Modal>
      <ModalShell
        modalProps={{
          isDismissable: false,
          isOpen: isOpen && !isSaving,
          onOpenChange: handleModalOpenChange,
          className: "!max-h-[calc(100%-4rem)]",
          style: { maxWidth: inputRowWidth + 64 },
          scrollBehavior: "inside",
        }}
      >
        {() => (
          <>
            <ModalHeaderShell>
              <div className="flex w-full items-center justify-between">
                <div className="flex flex-row items-center gap-1 font-bold">
                  {birdEventToModify ? "Modify" : "Add"} Capture
                </div>
                {!birdEventToModify && (
                  <Switch isSelected={useCurrentTime} onValueChange={setUseCurrentTime}>
                    Use current time
                  </Switch>
                )}
              </div>
            </ModalHeaderShell>
            <ModalBodyShell>
              <div className="flex flex-col gap-4" style={{ width: inputRowWidth }}>
                {formData.species.length === 4 && (
                  <div className="grid grid-cols-2 gap-4">
                    {pyleSpeciesRange && (
                      <PyleTable title="Pyle" speciesCode={formData.species} speciesRange={pyleSpeciesRange} withCard />
                    )}
                    <SpeciesFunFacts
                      speciesCode={formData.species}
                      speciesInfo={speciesInfoMap[formData.species] || null}
                    />
                  </div>
                )}
                <Card shadow="sm">
                  <CardBody className="flex flex-col gap-2 p-3">
                    <div className="flex gap-1">
                      {TABLE_COLUMNS
                        .filter(
                          (column) =>
                            ![
                              "actions",
                              "updatedAt",
                              "notes",
                              "date",
                              "time",
                              "bander",
                              "scribe",
                              "birdStatus",
                            ].includes(column.key)
                        )
                        .map((column) => (
                          <div
                            key={column.key}
                            className="flex flex-col gap-1 shrink-0"
                            style={{ width: column.inputClassName?.match(/w-\[(\d+px)\]/)?.[1] ?? "auto" }}
                          >
                            <span className="text-xs text-default-900 font-medium px-1 truncate">
                              {column.key === "howAged" || column.key === "howSexed" ? "How" : column.label}
                            </span>
                            {renderTableCell(column)}
                          </div>
                        ))}
                    </div>
                    <div className="flex gap-1">
                      {(() => {
                        const dateParts = formData.date.split("-");
                        const timeParts = formData.time.split(":");
                        const disabled = isSaving || useCurrentTime;
                        const cls = "text-sm text-start [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none";
                        const subs = [
                          { key: "date", label: "YYYY", w: "w-[75px]", value: dateParts[0] ?? "", maxLen: 4,
                            onUpdate: (v: string) => setFormData((p) => ({ ...p, date: `${v}-${dateParts[1] ?? ""}-${dateParts[2] ?? ""}`.replace(/-+$/, "") })) },
                          { key: "date-month", label: "MM", w: "w-[50px]", value: dateParts[1] ?? "", maxLen: 2,
                            onUpdate: (v: string) => setFormData((p) => ({ ...p, date: `${dateParts[0] ?? ""}-${v}-${dateParts[2] ?? ""}`.replace(/-+$/, "") })) },
                          { key: "date-day", label: "DD", w: "w-[50px]", value: dateParts[2] ?? "", maxLen: 2,
                            onUpdate: (v: string) => setFormData((p) => ({ ...p, date: `${dateParts[0] ?? ""}-${dateParts[1] ?? ""}-${v}` })) },
                          { key: "time", label: "HH", w: "w-[50px]", value: timeParts[0] ?? "", maxLen: 2,
                            onUpdate: (v: string) => setFormData((p) => ({ ...p, time: `${v}:${timeParts[1] ?? ""}` })) },
                          { key: "time-minute", label: "MM", w: "w-[50px]", value: timeParts[1] ?? "", maxLen: 2,
                            onUpdate: (v: string) => setFormData((p) => ({ ...p, time: `${timeParts[0] ?? ""}:${v}` })) },
                        ];
                        return subs.map((s) => (
                          <div key={s.key} className={`flex flex-col gap-1 shrink-0 ${s.w}`}>
                            <span className="text-xs text-default-900 font-medium px-1 text-start">{s.label}</span>
                            <Input ref={(el: HTMLInputElement | null) => { if (el) inputRefs.current.set(s.key, el); }}
                              {...modalInputProps} maxLength={s.maxLen} value={s.value} isDisabled={disabled}
                              classNames={{ input: cls }}
                              tabIndex={getTabIndex(s.key)}
                              onChange={(e) => { const v = e.target.value.replace(/\D/g, "").slice(0, s.maxLen); s.onUpdate(v); if (v.length === s.maxLen) focusNext(s.key); }}
                            />
                          </div>
                        ));
                      })()}
                      {TABLE_COLUMNS
                        .filter((column) => ["bander", "scribe", "birdStatus"].includes(column.key))
                        .map((column) => (
                          <div
                            key={column.key}
                            className="flex flex-col gap-1 shrink-0"
                            style={{ width: column.inputClassName?.match(/w-\[(\d+px)\]/)?.[1] ?? "auto" }}
                          >
                            <span className="text-xs text-default-900 font-medium px-1 truncate">{column.label}</span>
                            {renderTableCell(column)}
                          </div>
                        ))}
                      {TABLE_COLUMNS.find((c) => c.key === "notes") && (
                        <div className="flex flex-col gap-1 flex-1 min-w-0">
                          <span className="text-xs text-default-900 font-medium px-1">Notes</span>
                          {renderTableCell(TABLE_COLUMNS.find((c) => c.key === "notes")!)}
                        </div>
                      )}
                    </div>
                  </CardBody>
                </Card>

                <ValidationMessages
                  messages={validationState.existingErrors.map((e) => ({ text: e.reason, severity: e.severity }))}
                  title="Existing Errors in Past Captures:"
                />
                <ValidationMessages messages={validationState.warningMessages} title="Warnings for Current Entry:" />

                {shouldShowPastBirdEvents && (
                  <div className="mt-2">
                    <h3 className="text-lg font-normal mb-2">
                      Existing data for band <span className="font-bold">{bandId}</span> :
                    </h3>
                    <BirdEventsTable birdEvents={pastBirdEvents} maxTableHeight={300} allowInspectHistory />
                  </div>
                )}
              </div>
            </ModalBodyShell>
            <ModalFooterShell>
              <Button {...modalCancelButtonProps} onPress={handleClose}>
                Cancel
              </Button>
              {!birdEventToModify && isNewCapture && (
                <Button
                  {...modalPrimaryButtonProps}
                  variant="bordered"
                  onPress={handleSaveAndNext}
                  isDisabled={!formData.bandGroup || !formData.bandLastTwoDigits || !formData.species}
                >
                  Save and Next
                </Button>
              )}
              <Button
                {...modalPrimaryButtonProps}
                onPress={handleSaveAndClose}
                isDisabled={!formData.bandGroup || !formData.bandLastTwoDigits || !formData.species}
              >
                Save
              </Button>
            </ModalFooterShell>
          </>
        )}
      </ModalShell>
      <BirdStatusModal
        isOpen={isBirdStatusModalOpen}
        onOpenChange={setIsBirdStatusModalOpen}
        currentStatus={formData.birdStatus || DEFAULT_BIRD_STATUS}
        onStatusChange={(status) => setFormData((prev) => ({ ...prev, birdStatus: status }))}
      />
    </>
  );
}
