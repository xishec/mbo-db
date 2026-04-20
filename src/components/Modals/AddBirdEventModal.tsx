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
import { getSortedColumns } from "../PageContent/Programs/Captures/helpers";
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
    incrementBandSize,
    bandSizeToBandIdMap,
    volunteersMap,
    speciesInfoMap,
    appSettings,
  } = useData();
  const [formData, setFormData] = useState<CaptureFormData>(() => getDefaultFormData(selectedProgram?.id || ""));
  const inputRefs = useRef<Map<string, HTMLInputElement>>(new Map());
  const [lastBandId, setLastBandId] = useState("");
  const [useCurrentTime, setUseCurrentTime] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [wasOpen, setWasOpen] = useState(false);
  const [isBirdStatusModalOpen, setIsBirdStatusModalOpen] = useState(false);

  const sortedColumns = useMemo(
    () =>
      getSortedColumns(
        isNewCapture,
        birdEventToModify?.id,
        appSettings.captureColumnOrder,
        appSettings.recaptureColumnOrder
      ),
    [isNewCapture, birdEventToModify?.id, appSettings.captureColumnOrder, appSettings.recaptureColumnOrder]
  );

  // Sum of all input column widths (excl. actions/updatedAt/notes) + gaps
  const inputRowWidth = 1120;

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
      const firstEmpty =
        sortedColumns.find((col) => !skipFocusFields.has(col.key) && !defaultData[col.key as keyof CaptureFormData])
          ?.key ?? firstEditableField;
      focusTo(firstEmpty);
    } else if (bandSize !== BandSize.Other && bandSizeToBandIdMap[bandSize]) {
      // Modal already open — update band fields after incrementBandSize
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

  const skipFocusFields = useMemo(() => {
    const skip = new Set(["actions", "programId", "birdEventType", "birdStatus", "updatedAt"]);
    if (useCurrentTime) {
      skip.add("date");
      skip.add("time");
    }
    return skip;
  }, [useCurrentTime]);

  const firstEditableField = useMemo(() => {
    return sortedColumns.find((col) => !skipFocusFields.has(col.key))?.key ?? "bandGroup";
  }, [sortedColumns, skipFocusFields]);

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
    for (const column of sortedColumns) {
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
    for (const column of sortedColumns) {
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
  }, [formData, pastBirdEvents, magicTable, sortedColumns, sexCode, pyleSpeciesRange, volunteersMap]);

  const focusNextInput = useCallback(
    (currentField: keyof CaptureFormData) => {
      const currentIndex = sortedColumns.findIndex((col) => col.key === currentField);
      if (currentIndex < sortedColumns.length - 1) {
        const nextKey = sortedColumns.slice(currentIndex + 1).find((col) => !skipFocusFields.has(col.key))?.key;
        if (nextKey) inputRefs.current.get(nextKey)?.focus();
      }
    },
    [sortedColumns, skipFocusFields]
  );

  const focusPrevInput = useCallback(
    (currentField: keyof CaptureFormData) => {
      const currentIndex = sortedColumns.findIndex((col) => col.key === currentField);
      if (currentIndex > 0) {
        const prevKey = sortedColumns
          .slice(0, currentIndex)
          .reverse()
          .find((col) => !skipFocusFields.has(col.key))?.key;
        if (prevKey) inputRefs.current.get(prevKey)?.focus();
      }
    },
    [sortedColumns, skipFocusFields]
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
      if (e.key === "Tab") {
        e.preventDefault();
        if (e.shiftKey) {
          focusPrevInput(field);
        } else {
          focusNextInput(field);
        }
      }
    },
    [focusNextInput, focusPrevInput]
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

        if (bandSizeToSend !== BandSize.Other && formData.bandGroup && formData.bandLastTwoDigits) {
          await incrementBandSize(bandSizeToSend, formData.bandGroup, formData.bandLastTwoDigits);
        }

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
    [formData, bandSize, addBirdEvent, incrementBandSize, birdEventToModify?.id, isSaving, focusTo, onOpenChange]
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
        if (column.key === "programId") return selectedProgram?.displayName;
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

      // Date: split into Year, Month, Day using HeroUI Input
      if (column.key === "date") {
        const parts = formData.date.split("-");
        const year = parts[0] ?? "";
        const month = parts[1] ?? "";
        const day = parts[2] ?? "";
        const updateDate = (y: string, m: string, d: string) => {
          const yy = y.replace(/\D/g, "").slice(0, 4);
          const mm = m.replace(/\D/g, "").slice(0, 2);
          const dd = d.replace(/\D/g, "").slice(0, 2);
          setFormData((prev) => ({ ...prev, date: `${yy}-${mm}-${dd}`.replace(/-+$/, "") }));
        };
        const subInputClass = "text-sm text-center [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none";
        return (
          <div className="flex gap-0.5 items-center">
            <Input ref={(el: HTMLInputElement | null) => { if (el) inputRefs.current.set("date", el); }}
              {...modalInputProps} className="w-[75px]" maxLength={4} value={year} isDisabled={isSaving || useCurrentTime}
              classNames={{ input: subInputClass }}
              onChange={(e) => { const v = e.target.value.replace(/\D/g, "").slice(0, 4); updateDate(v, month, day); if (v.length === 4) inputRefs.current.get("date-month")?.focus(); }}
              onKeyDown={(e) => { if (e.key === "Backspace" && year === "") focusPrevInput("date" as keyof CaptureFormData); if (e.key === "Tab") { e.preventDefault(); if (e.shiftKey) focusPrevInput("date" as keyof CaptureFormData); else inputRefs.current.get("date-month")?.focus(); } }}
            />
            <Input ref={(el: HTMLInputElement | null) => { if (el) inputRefs.current.set("date-month", el); }}
              {...modalInputProps} className="w-[50px]" maxLength={2} value={month} isDisabled={isSaving || useCurrentTime}
              classNames={{ input: subInputClass }}
              onChange={(e) => { const v = e.target.value.replace(/\D/g, "").slice(0, 2); updateDate(year, v, day); if (v.length === 2) inputRefs.current.get("date-day")?.focus(); }}
              onKeyDown={(e) => { if (e.key === "Backspace" && month === "") inputRefs.current.get("date")?.focus(); if (e.key === "Tab") { e.preventDefault(); if (e.shiftKey) inputRefs.current.get("date")?.focus(); else inputRefs.current.get("date-day")?.focus(); } }}
            />
            <Input ref={(el: HTMLInputElement | null) => { if (el) inputRefs.current.set("date-day", el); }}
              {...modalInputProps} className="w-[50px]" maxLength={2} value={day} isDisabled={isSaving || useCurrentTime}
              classNames={{ input: subInputClass }}
              onChange={(e) => { const v = e.target.value.replace(/\D/g, "").slice(0, 2); updateDate(year, month, v); if (v.length === 2) focusNextInput("date" as keyof CaptureFormData); }}
              onKeyDown={(e) => { if (e.key === "Backspace" && day === "") inputRefs.current.get("date-month")?.focus(); if (e.key === "Tab") { e.preventDefault(); if (e.shiftKey) inputRefs.current.get("date-month")?.focus(); else focusNextInput("date" as keyof CaptureFormData); } }}
            />
          </div>
        );
      }

      // Time: split into Hour, Minute using HeroUI Input
      if (column.key === "time") {
        const parts = formData.time.split(":");
        const hour = parts[0] ?? "";
        const minute = parts[1] ?? "";
        const updateTime = (h: string, m: string) => {
          setFormData((prev) => ({ ...prev, time: `${h.replace(/\D/g, "").slice(0, 2)}:${m.replace(/\D/g, "").slice(0, 2)}` }));
        };
        const subInputClass = "text-sm text-center [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none";
        return (
          <div className="flex gap-0.5 items-center">
            <Input ref={(el: HTMLInputElement | null) => { if (el) inputRefs.current.set("time", el); }}
              {...modalInputProps} className="w-[50px]" maxLength={2} value={hour} isDisabled={isSaving || useCurrentTime}
              classNames={{ input: subInputClass }}
              onChange={(e) => { const v = e.target.value.replace(/\D/g, "").slice(0, 2); updateTime(v, minute); if (v.length === 2) inputRefs.current.get("time-minute")?.focus(); }}
              onKeyDown={(e) => { if (e.key === "Backspace" && hour === "") focusPrevInput("time" as keyof CaptureFormData); if (e.key === "Tab") { e.preventDefault(); if (e.shiftKey) focusPrevInput("time" as keyof CaptureFormData); else inputRefs.current.get("time-minute")?.focus(); } }}
            />
            <Input ref={(el: HTMLInputElement | null) => { if (el) inputRefs.current.set("time-minute", el); }}
              {...modalInputProps} className="w-[50px]" maxLength={2} value={minute} isDisabled={isSaving || useCurrentTime}
              classNames={{ input: subInputClass }}
              onChange={(e) => { const v = e.target.value.replace(/\D/g, "").slice(0, 2); updateTime(hour, v); if (v.length === 2) focusNextInput("time" as keyof CaptureFormData); }}
              onKeyDown={(e) => { if (e.key === "Backspace" && minute === "") inputRefs.current.get("time")?.focus(); if (e.key === "Tab") { e.preventDefault(); if (e.shiftKey) inputRefs.current.get("time")?.focus(); else focusNextInput("time" as keyof CaptureFormData); } }}
            />
          </div>
        );
      }

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
          onChange={(e) => handleInputChange(columnKey, e.target.value, column.maxLength)}
          onKeyDown={(e) => handleKeyDown(e, columnKey)}
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
      handleKeyDown,
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
                      {sortedColumns
                        .filter((column) => !["actions", "updatedAt", "notes", "date", "time", "bander", "scribe", "net", "birdStatus"].includes(column.key))
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
                    <div className="flex gap-1 items-end">
                      {sortedColumns
                        .filter((column) => ["date", "time", "bander", "scribe", "net", "birdStatus"].includes(column.key))
                        .map((column) => (
                          <div
                            key={column.key}
                            className="flex flex-col gap-1 shrink-0"
                            style={{ width: column.inputClassName?.match(/w-\[(\d+px)\]/)?.[1] ?? "auto" }}
                          >
                            <span className="text-xs text-default-900 font-medium px-1 truncate">
                              {column.label}
                            </span>
                            {renderTableCell(column)}
                          </div>
                        ))}
                      {sortedColumns.find((c) => c.key === "notes") && (
                        <div className="flex flex-col gap-1 flex-1 min-w-0">
                          <span className="text-xs text-default-900 font-medium px-1">Notes</span>
                          {renderTableCell(sortedColumns.find((c) => c.key === "notes")!)}
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
              {!birdEventToModify && (
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
