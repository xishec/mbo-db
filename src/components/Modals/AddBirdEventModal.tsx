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
  addToast,
} from "@heroui/react";
import VolunteerTooltip from "../Helper/Info/VolunteerTooltip";
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { useAppStore, useActions } from "../../stores/useAppStore";
import { birdEventsStore, useBirdEventsVersion } from "../../services/birdEventsStore";
import { Band, BandSize, BirdEventType, getBandGroupMapKey, type BirdEvent, type CaptureFormData } from "../../types";
import { DEFAULT_BIRD_STATUS } from "../../types/birdStatus";
import { validateBirdEventForm, findErrorsInEvents } from "../../types/birdEventErrors";
import BirdStatusModal from "./BirdStatusModal";
import ValidationMessages from "../Helper/ValidationMessages";
import { TABLE_COLUMNS } from "../PageContent/Programs/Captures/helpers";
import { formatFieldValue, getApplicableRange, getDefaultFormData } from "../PageContent/Programs/Captures/helpers";
import { getLocalDateString } from "../../utils/dateUtils";
import BirdEventsTable from "../PageContent/Programs/Captures/BirdEventsTable";
import ModalShell, { ModalBodyShell, ModalFooterShell, ModalHeaderShell } from "./ModalShell";
import { modalInputProps, modalCancelButtonProps, modalPrimaryButtonProps } from "./modalDefaults";
import SpeciesInfoPanel from "./AddBirdEventParts/SpeciesInfoPanel";

interface AddBirdEventModalProps {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  bandSize?: BandSize;
  birdEventToModify?: BirdEvent;
  isNewCapture: boolean;
  defaultNet?: string;
}

export default function AddBirdEventModal({
  isOpen,
  onOpenChange,
  bandSize = BandSize.Other,
  birdEventToModify,
  isNewCapture,
  defaultNet,
}: AddBirdEventModalProps) {
  const selectedProgram = useAppStore((s) => s.selectedProgram);
  const bandGroupsMap = useAppStore((s) => s.bandGroupsMap);
  const magicTable = useAppStore((s) => s.magicTable);
  const bandIdToBirdEventIdsMap = useAppStore((s) => s.bandIdToBirdEventIdsMap);
  const bandSizeToBandIdMap = useAppStore((s) => s.bandSizeToBandIdMap);
  const volunteersMap = useAppStore((s) => s.volunteersMap);
  const speciesInfoMap = useAppStore((s) => s.speciesInfoMap);
  const { addBirdEvent } = useActions();
  const birdEventsVersion = useBirdEventsVersion();
  const [formData, setFormData] = useState<CaptureFormData>(() => getDefaultFormData(selectedProgram?.id || ""));
  const inputRefs = useRef<Map<string, HTMLInputElement>>(new Map());
  const [lastBandId, setLastBandId] = useState("");
  const [useCurrentTime, setUseCurrentTime] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [wasOpen, setWasOpen] = useState(false);
  const [isBirdStatusModalOpen, setIsBirdStatusModalOpen] = useState(false);
  const [isNotesModalOpen, setIsNotesModalOpen] = useState(false);
  const [selectedBandSize, setSelectedBandSize] = useState<BandSize>(bandSize);

  // Auto-update band size when band group changes (for new captures).
  // Matching logic:
  //   1. Recapture → always "Other"
  //   2. Group matches an existing size's group → use that size
  //   3. No match → keep the size the user opened the modal with. Setting
  //      "Other" here would silently lose the user's intent when they type
  //      a brand-new band group under a known size.
  useEffect(() => {
    if (birdEventToModify || !formData.bandGroup) return;

    if (formData.birdEventType !== BirdEventType.Banded && formData.birdEventType !== BirdEventType.None) {
      setSelectedBandSize(BandSize.Other);
      return;
    }

    for (const [size, bandId] of Object.entries(bandSizeToBandIdMap)) {
      if (bandId && bandId.length === 9) {
        const band = new Band(bandId.slice(0, 4), bandId.slice(4, 9));
        if (getBandGroupMapKey(band) === formData.bandGroup) {
          setSelectedBandSize(size as BandSize);
          return;
        }
      }
    }
    // No match — preserve the user's initial size intent.
    setSelectedBandSize(bandSize);
  }, [formData.bandGroup, formData.birdEventType, bandSizeToBandIdMap, birdEventToModify, bandSize]);

  // Reset form data when modal opens
  useEffect(() => {
    if (!isOpen) {
      setWasOpen(false);
      setIsSaving(false);
      return;
    }

    const defaultData = getDefaultFormData(selectedProgram?.id || "");

    // Restore bander and scribe from localStorage
    const savedBander = localStorage.getItem("lastBander");
    const savedScribe = localStorage.getItem("lastScribe");
    if (savedBander) defaultData.bander = savedBander;
    if (savedScribe) defaultData.scribe = savedScribe;

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

      // Derive band size from band group
      let derivedBandSize: BandSize = BandSize.Other;
      for (const [size, bandId] of Object.entries(bandSizeToBandIdMap)) {
        if (bandId && bandId.length === 9) {
          const band = new Band(bandId.slice(0, 4), bandId.slice(4, 9));
          if (getBandGroupMapKey(band) === bandGroup) {
            derivedBandSize = size as BandSize;
            break;
          }
        }
      }
      setSelectedBandSize(derivedBandSize);
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
          // Band class expects: bandPrefix (4 chars) + bandSuffix (5 chars = 3 middle + 2 last)
          const bandPrefix = bandId.slice(0, 4);
          const bandSuffix = bandId.slice(4, 9);
          const band = new Band(bandPrefix, bandSuffix);
          defaultData.bandGroup = band.bandGroupId;
          defaultData.bandLastTwoDigits = band.last2digits;
        }
      }

      // Pre-fill net if provided
      if (defaultNet) {
        defaultData.net = defaultNet;
      }

      setFormData(defaultData);
      setLastBandId("");
      setSelectedBandSize(bandSize);
      setWasOpen(true);
      const firstEmpty = focusOrder.find((key) => {
        const colKey = key.includes("-") ? key.split("-")[0] : key;
        return !defaultData[colKey as keyof CaptureFormData];
      }) ?? firstEditableField;
      focusTo(firstEmpty);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, bandSize, birdEventToModify, defaultNet]);

  // After save-and-next, advance the band to the next suggestion. Must run
  // BEFORE paint (useLayoutEffect) — otherwise validation briefly sees the
  // stale band + the newly-arrived past event and flashes "< 12h recapture".
  //
  // Only act when the map entry for this size actually changes (i.e. a new
  // banding landed). Actions always replace `bandSizeToBandIdMap` with a
  // new object reference even for recapture saves, which would otherwise
  // re-run this effect and clobber fields we just cleared for the next
  // recapture.
  const lastAppliedBandIdRef = useRef<string | null>(null);
  useLayoutEffect(() => {
    if (!isOpen || birdEventToModify || !wasOpen) return;
    if (bandSize === BandSize.Other) return;
    const bandId = bandSizeToBandIdMap[bandSize];
    if (!bandId || bandId.length !== 9) return;
    if (lastAppliedBandIdRef.current === bandId) return;
    lastAppliedBandIdRef.current = bandId;

    // Band class expects: bandPrefix (4 chars) + bandSuffix (5 chars = 3 middle + 2 last)
    const bandPrefix = bandId.slice(0, 4);
    const bandSuffix = bandId.slice(4, 9);
    const band = new Band(bandPrefix, bandSuffix);
    setFormData((prev) =>
      prev.bandGroup === band.bandGroupId && prev.bandLastTwoDigits === band.last2digits
        ? prev
        : { ...prev, bandGroup: band.bandGroupId, bandLastTwoDigits: band.last2digits }
    );
    setLastBandId("");
  }, [isOpen, bandSize, birdEventToModify, bandSizeToBandIdMap, wasOpen]);

  // Reset the "last applied" tracker whenever the modal closes or changes
  // target size, so reopening for the same size still prefills fresh.
  useEffect(() => {
    if (!isOpen) lastAppliedBandIdRef.current = null;
  }, [isOpen, bandSize]);

  // Focus order matches visual layout
  // Row 1: Most frequently edited fields
  const ROW1_KEYS = [
    "bandGroup",
    "bandLastTwoDigits",
    "species",
    "wing",
    "age",
    "howAged",
    "sex",
    "howSexed",
    "fat",
    "weight",
    "bander",
    "scribe",
    "birdStatus",
    "notes",
  ];

  // Row 2: Less frequently edited fields
  const ROW2_KEYS = ["net", "bandSize", "birdEventType"];
  const DATE_TIME_KEYS = ["date", "date-month", "date-day", "time", "time-minute"];

  const focusOrder = useMemo(() => {
    // Keep birdStatus and notes in the order so Tab from them lands on the
    // next row (net). They're rendered as Buttons (not Inputs) so the
    // tabIndex hooks still place them in the keyboard sequence.
    const order = [...ROW1_KEYS, ...ROW2_KEYS];
    if (!useCurrentTime) order.push(...DATE_TIME_KEYS);
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

  const registerRef = useCallback((key: string, el: HTMLInputElement | null) => {
    if (el) inputRefs.current.set(key, el);
  }, []);

  // Update date/time when useCurrentTime is enabled
  useEffect(() => {
    if (!useCurrentTime) return;

    const updateTime = () => {
      const now = new Date();
      const currentDate = getLocalDateString(now);
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
      .map((id) => birdEventsStore.get(id))
      .filter((event): event is BirdEvent => !!event)
      .filter((event) => event.modifiedEventId == null)
      .filter((event) => !birdEventToModify || event.id !== birdEventToModify.id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bandId, bandIdToBirdEventIdsMap, birdEventsVersion, birdEventToModify]);

  // Compute suggested capture type (doesn't auto-update formData)
  const suggestedBirdEventType = useMemo(() => {
    if (!bandId) return BirdEventType.None;
    if (birdEventToModify) return birdEventToModify.birdEventType;
    if (formData.species === "BADE" || formData.species === "BALO") return BirdEventType.None;
    if (pastBirdEvents.length === 0) {
      // For -00 bands, check the previous band group (business rule)
      // Band class expects: bandPrefix (4 chars) + bandSuffix (5 chars = 3 middle + 2 last)
      const band = new Band(bandId.slice(0, 4), bandId.slice(4, 9));
      const bandGroupMapKey = getBandGroupMapKey(band);
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
        .map((id) => birdEventsStore.get(id))
        .filter((event): event is BirdEvent => !!event)
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
        birdEventType: formData.birdEventType,
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
        // Use the user's current size selection (selectedBandSize) — not the
        // initial prop — so changing the band group mid-edit is reflected
        // back into bandSizeToBandIdMap after save.
        const bandSizeToSend =
          formData.birdEventType === BirdEventType.Banded || formData.birdEventType === BirdEventType.None
            ? selectedBandSize
            : BandSize.Other;
        await addBirdEvent(formData, bandSizeToSend, birdEventToModify?.id);

        // Save bander and scribe to localStorage
        if (formData.bander) localStorage.setItem("lastBander", formData.bander);
        if (formData.scribe) localStorage.setItem("lastScribe", formData.scribe);

        if (shouldContinue) {
          // Whether THIS save was a new capture (Banded/None) — the modal's
          // `isNewCapture` prop reflects how the modal was opened, not what
          // the user actually entered. A Size-1 modal where the user typed
          // a Repeat should behave like a recapture on save-and-next.
          const savedAsNewCapture =
            formData.birdEventType === BirdEventType.Banded ||
            formData.birdEventType === BirdEventType.None;

          // New capture: band fields auto-repopulate via the reset
          // useLayoutEffect when bandSizeToBandIdMap advances. Recapture:
          // the map doesn't advance, so we must clear the band fields
          // ourselves — the next recap's band is unrelated.
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
            ...(savedAsNewCapture ? {} : { bandGroup: "", bandLastTwoDigits: "" }),
          }));
          setLastBandId("");
          setIsSaving(false);
          // New bandings skip to species (band/net already filled);
          // recaptures start at bandGroup since the bander types it.
          focusTo(savedAsNewCapture ? "species" : "bandGroup");
        } else {
          onOpenChange(false);
        }
      } catch (err) {
        console.error("Failed to save capture:", err);
        addToast({
          title: "Save failed",
          description: "Failed to save capture. Please try again.",
          color: "danger",
        });
        setIsSaving(false);
      }
    },
    [formData, selectedBandSize, isNewCapture, focusTo, addBirdEvent, birdEventToModify?.id, isSaving, onOpenChange]
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

  // Handle band size selection
  const handleBandSizeChange = useCallback((size: BandSize) => {
    setSelectedBandSize(size);

    if (size === BandSize.Other) {
      // Clear band fields for "other"
      setFormData((prev) => ({
        ...prev,
        bandGroup: "",
        bandLastTwoDigits: "",
      }));
      return;
    }

    const bandId = bandSizeToBandIdMap[size];
    if (bandId && bandId.length === 9) {
      const bandPrefix = bandId.slice(0, 4);
      const bandSuffix = bandId.slice(4, 9);
      const band = new Band(bandPrefix, bandSuffix);
      setFormData((prev) => ({
        ...prev,
        bandGroup: band.bandGroupId,
        bandLastTwoDigits: band.last2digits,
      }));
    } else {
      // No next band available - clear fields for manual entry
      setFormData((prev) => ({
        ...prev,
        bandGroup: "",
        bandLastTwoDigits: "",
      }));
    }
  }, [bandSizeToBandIdMap]);

  // Render a single field (used for unified row rendering)
  const renderField = useCallback(
    (fieldKey: string) => {
      // Show Band Size as readonly always
      if (fieldKey === "bandSize") {
        return (
          <div className="px-3 py-2 text-sm text-default-900 bg-default-50 rounded-medium border-medium border-default-50 whitespace-nowrap">
            {selectedBandSize}
          </div>
        );
      }

      // Date/time sub-fields
      if (fieldKey.startsWith("date") || fieldKey.startsWith("time")) {
        const dateParts = formData.date.split("-");
        const timeParts = formData.time.split(":");
        const subFields: Record<string, { value: string; maxLen: number; onUpdate: (v: string) => void }> = {
          date: {
            value: dateParts[0] ?? "",
            maxLen: 4,
            onUpdate: (v) =>
              setFormData((p) => ({
                ...p,
                date: `${v}-${dateParts[1] ?? ""}-${dateParts[2] ?? ""}`.replace(/-+$/, ""),
              })),
          },
          "date-month": {
            value: dateParts[1] ?? "",
            maxLen: 2,
            onUpdate: (v) =>
              setFormData((p) => ({
                ...p,
                date: `${dateParts[0] ?? ""}-${v}-${dateParts[2] ?? ""}`.replace(/-+$/, ""),
              })),
          },
          "date-day": {
            value: dateParts[2] ?? "",
            maxLen: 2,
            onUpdate: (v) =>
              setFormData((p) => ({
                ...p,
                date: `${dateParts[0] ?? ""}-${dateParts[1] ?? ""}-${v}`,
              })),
          },
          time: {
            value: timeParts[0] ?? "",
            maxLen: 2,
            onUpdate: (v) => setFormData((p) => ({ ...p, time: `${v}:${timeParts[1] ?? ""}` })),
          },
          "time-minute": {
            value: timeParts[1] ?? "",
            maxLen: 2,
            onUpdate: (v) => setFormData((p) => ({ ...p, time: `${timeParts[0] ?? ""}:${v}` })),
          },
        };

        const sub = subFields[fieldKey];
        if (!sub) return null;

        // Show as readonly when using current time
        if (useCurrentTime) {
          return (
            <div className="px-3 py-2 text-sm text-default-900 bg-default-50 rounded-medium border-medium border-default-50 whitespace-nowrap">
              {sub.value}
            </div>
          );
        }

        return (
          <Input
            ref={(el: HTMLInputElement | null) => registerRef(fieldKey, el)}
            {...modalInputProps}
            maxLength={sub.maxLen}
            value={sub.value}
            isDisabled={isSaving}
            classNames={{
              input:
                "text-sm text-start [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none",
            }}
            tabIndex={getTabIndex(fieldKey)}
            onFocus={(e) => (e.target as HTMLInputElement).select()}
            onChange={(e) => {
              const v = e.target.value.replace(/\D/g, "").slice(0, sub.maxLen);
              sub.onUpdate(v);
              if (v.length === sub.maxLen) focusNext(fieldKey);
            }}
          />
        );
      }

      // Find column definition
      const column = TABLE_COLUMNS.find((c) => c.key === fieldKey);
      if (!column) return null;

      const columnKey = column.key as keyof CaptureFormData;
      const inputColor = getInputColor(columnKey);

      // Determine readonly value
      const readonlyValue = (() => {
        if (column.key === "birdEventType") return formData[columnKey];
        if (birdEventToModify && (column.key === "bandGroup" || column.key === "bandLastTwoDigits"))
          return formData[columnKey];
        return null;
      })();

      // Readonly field
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

      if (column.key === "notes") {
        return (
          <Button
            variant="ghost"
            onPress={() => setIsNotesModalOpen(true)}
            isDisabled={isSaving}
            className="border-medium border-default-200 w-full min-w-0 justify-start overflow-hidden"
          >
            <span className="truncate">{formData.notes || ""}</span>
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
          onFocus={(e) => (e.target as HTMLInputElement).select()}
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
      selectedBandSize,
      bandSizeToBandIdMap,
      handleBandSizeChange,
      useCurrentTime,
      birdEventToModify,
      isSaving,
      getInputColor,
      getBorderClass,
      handleInputChange,
      getTabIndex,
      registerRef,
      focusNext,
      setFormData,
    ]
  );

  // Get field metadata (label and width)
  const getFieldMetadata = useCallback((fieldKey: string) => {
    if (fieldKey === "bandSize") {
      return { label: "Band Size", width: "75px" };
    }

    const dateTimeLabels: Record<string, { label: string; width: string }> = {
      date: { label: "YYYY", width: "75px" },
      "date-month": { label: "MM", width: "50px" },
      "date-day": { label: "DD", width: "50px" },
      time: { label: "HH", width: "50px" },
      "time-minute": { label: "MM", width: "50px" },
    };

    if (dateTimeLabels[fieldKey]) {
      return dateTimeLabels[fieldKey];
    }

    const column = TABLE_COLUMNS.find((c) => c.key === fieldKey);
    if (!column) return null;

    const width = column.inputClassName?.match(/w-\[(\d+px)\]/)?.[1] ?? "auto";
    const label = column.key === "howAged" || column.key === "howSexed" ? "How" : column.label;

    return { label, width };
  }, []);

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
          className: "!max-h-[calc(100%-4rem)] !max-w-7xl",
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
              <div className="flex flex-col gap-4">
                <SpeciesInfoPanel
                  speciesCode={formData.species}
                  pyleSpeciesRange={pyleSpeciesRange}
                  speciesInfo={speciesInfoMap[formData.species] || null}
                />
                <Card shadow="sm" className="w-full">
                  <CardBody className="flex flex-col gap-2 p-3">
                    {/* Row 1: Most frequently edited - Band Group, Digit, Species, Wing, Age, How, Sex, How, Fat, Weight, Bander, Scribe */}
                    <div className="flex gap-1">
                      {ROW1_KEYS.map((fieldKey) => {
                        const metadata = getFieldMetadata(fieldKey);
                        if (!metadata) return null;

                        // Notes grows to fill remaining space; everything else is fixed-width.
                        const isNotes = fieldKey === "notes";

                        // Hover the label to see the volunteer's full name
                        // and totals once the code resolves.
                        const volunteerCode =
                          (fieldKey === "bander" || fieldKey === "scribe") && formData[fieldKey]
                            ? formData[fieldKey]
                            : null;

                        return (
                          <div
                            key={fieldKey}
                            className={`flex flex-col gap-1 ${isNotes ? "flex-1 min-w-0" : "shrink-0"}`}
                            style={isNotes ? undefined : { width: metadata.width }}
                          >
                            {volunteerCode ? (
                              <span className="text-xs text-default-900 font-medium px-1 truncate underline">
                                <VolunteerTooltip volunteerCode={volunteerCode}>
                                  {metadata.label}
                                </VolunteerTooltip>
                              </span>
                            ) : (
                              <span className="text-xs text-default-900 font-medium px-1 truncate">
                                {metadata.label}
                              </span>
                            )}
                            {renderField(fieldKey)}
                          </div>
                        );
                      })}
                    </div>

                    {/* Row 2: Less frequently edited - Net, Band Size, Event Type, Date, Time, Status, Notes */}
                    <div className="flex gap-1">
                      {ROW2_KEYS.map((fieldKey) => {
                        const metadata = getFieldMetadata(fieldKey);
                        if (!metadata) return null;

                        return (
                          <div
                            key={fieldKey}
                            className="flex flex-col gap-1 shrink-0"
                            style={{ width: metadata.width }}
                          >
                            <span className="text-xs text-default-900 font-medium px-1 truncate">
                              {metadata.label}
                            </span>
                            {renderField(fieldKey)}
                          </div>
                        );
                      })}
                      {DATE_TIME_KEYS.map((fieldKey) => {
                        const metadata = getFieldMetadata(fieldKey);
                        if (!metadata) return null;

                        return (
                          <div
                            key={fieldKey}
                            className="flex flex-col gap-1 shrink-0"
                            style={{ width: metadata.width }}
                          >
                            <span className="text-xs text-default-900 font-medium px-1 text-start">
                              {metadata.label}
                            </span>
                            {renderField(fieldKey)}
                          </div>
                        );
                      })}
                    </div>
                  </CardBody>
                </Card>

                <ValidationMessages
                  messages={validationState.existingErrors.map((e) => ({ text: e.reason, severity: e.severity }))}
                  title="Existing Errors in Past Captures:"
                />
                <ValidationMessages messages={validationState.warningMessages} title="Warnings for Current Entry:" />

                {shouldShowPastBirdEvents && (
                  <div className="mt-2 w-full">
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
      <Modal isOpen={isNotesModalOpen} onOpenChange={setIsNotesModalOpen} size="2xl">
        <ModalContent>
          {(onClose) => (
            <>
              <ModalHeaderShell>
                <h2 className="text-xl font-semibold">Notes</h2>
              </ModalHeaderShell>
              <ModalBodyShell>
                <textarea
                  className="w-full min-h-[200px] p-3 rounded-medium border-medium border-default-200 bg-default-50 text-sm resize-y"
                  value={formData.notes}
                  onChange={(e) => setFormData((prev) => ({ ...prev, notes: e.target.value }))}
                  placeholder="Add notes..."
                  autoFocus
                />
              </ModalBodyShell>
              <ModalFooterShell>
                <Button {...modalCancelButtonProps} onPress={onClose}>
                  Cancel
                </Button>
                <Button {...modalPrimaryButtonProps} onPress={onClose}>
                  Done
                </Button>
              </ModalFooterShell>
            </>
          )}
        </ModalContent>
      </Modal>
    </>
  );
}
