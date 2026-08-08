import { Button, Card, CardBody, Checkbox, Input, Modal, ModalContent, Select, SelectItem } from "@heroui/react";
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { BellAlertIcon, ChevronLeftIcon, ChevronRightIcon } from "@heroicons/react/24/outline";
import { useActions, useAppStore } from "../../stores/useAppStore";
import { birdEventsStore, useBirdEventsVersion } from "../../services/birdEventsStore";
import { Band, BandSize, BirdEventType, type BirdEvent, type CaptureFormData, type SpeciesRange } from "../../types";
import { DEFAULT_BIRD_STATUS } from "../../types/birdStatus";
import { findErrorsInEvents, getRangesForSex, validateBirdEventForm } from "../../types/birdEventErrors";
import { getSpeciesDisplayCode, resolveSpeciesKey } from "../../types/species";
import { getLocalDateString } from "../../utils/dateUtils";
import { showPersistentErrorToast } from "../../utils/toast";
import PyleTable from "../Helper/Info/PyleTable";
import VolunteerTooltip from "../Helper/Info/VolunteerTooltip";
import { TABLE_COLUMNS, formatFieldValue, getDefaultFormData } from "../PageContent/Programs/Captures/helpers";
import BirdEventsTable from "../PageContent/Programs/Captures/BirdEventsTable";
import { computeBandReminder, isActiveBirdEvent } from "../../stores/derive";
import BirdStatusModal from "./BirdStatusModal";
import BirdReminderModal from "./BirdReminderModal";
import { ModalBodyShell, ModalFooterShell, ModalHeaderShell } from "./ModalShell";
import { modalCancelButtonProps, modalInputProps, modalPrimaryButtonProps } from "./modalDefaults";

const PAGE_RECAPTURE = "recapture";
type StartBandingPage = BandSize | typeof PAGE_RECAPTURE;
const PAGE_OPTIONS: StartBandingPage[] = [...Object.values(BandSize), PAGE_RECAPTURE];

const FIRST_ROW_KEYS = [
  "net",
  "page",
  "birdEventType",
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
] as const;

const SECOND_ROW_KEYS = [
  "bander",
  "scribe",
  "date",
  "date-month",
  "date-day",
  "time",
  "time-minute",
  "birdStatus",
  "notes",
] as const;

const FIELD_WIDTHS: Record<string, string> = {
  net: "50px",
  page: "150px",
  birdEventType: "125px",
  bandGroup: "125px",
  bandLastTwoDigits: "50px",
  species: "100px",
  wing: "75px",
  age: "50px",
  howAged: "50px",
  sex: "50px",
  howSexed: "50px",
  fat: "50px",
  weight: "75px",
  date: "75px",
  "date-month": "50px",
  "date-day": "50px",
  time: "50px",
  "time-minute": "50px",
  bander: "75px",
  scribe: "75px",
  birdStatus: "75px",
};

const FIELD_LABELS: Record<string, string> = {
  net: "Net",
  page: "Size / Recapture",
  birdEventType: "",
  bandGroup: "Band Group",
  bandLastTwoDigits: "Digit",
  species: "Species",
  wing: "Wing",
  age: "Age",
  howAged: "How",
  sex: "Sex",
  howSexed: "How",
  fat: "Fat",
  weight: "Weight",
  date: "YYYY",
  "date-month": "MM",
  "date-day": "DD",
  time: "HH",
  "time-minute": "MM",
  bander: "Bander",
  scribe: "Scribe",
  birdStatus: "Status",
  notes: "Notes",
};

const AUTO_ADVANCE_FIELDS = new Set<keyof CaptureFormData>([
  "net",
  "bandGroup",
  "bandLastTwoDigits",
  "species",
  "age",
  "howAged",
  "sex",
  "howSexed",
  "fat",
  "bander",
  "scribe",
  "birdStatus",
]);

interface StartBandingEntryProps {
  entryId: string;
  isDoubleBanding?: boolean;
}

type EntryMessage = {
  tone: "default" | "success" | "warning" | "danger";
  text: string;
};

type SelectedPage = StartBandingPage | null;

function getPageLabel(page: StartBandingPage) {
  return page === PAGE_RECAPTURE ? "Recapture" : page;
}

function getBandFromNextId(bandId: string | undefined) {
  if (!bandId || bandId.length !== 9) return null;
  return new Band(bandId.slice(0, 4), bandId.slice(4, 9));
}

function isSettablePage(page: SelectedPage): page is BandSize {
  return page !== null && page !== PAGE_RECAPTURE && page !== BandSize.Other;
}

function isNewCaptureType(birdEventType: string): boolean {
  return birdEventType === BirdEventType.Banded || birdEventType === BirdEventType.None;
}

function getPageForBandGroup(
  bandGroup: string,
  bandSizeToBandIdMap: Record<BandSize, string>
): { page: BandSize; band: Band } | null {
  if (bandGroup.length !== 7) return null;

  for (const [size, bandId] of Object.entries(bandSizeToBandIdMap)) {
    const band = getBandFromNextId(bandId);
    if (band?.bandGroupId === bandGroup) {
      return { page: size as BandSize, band };
    }
  }

  return null;
}

function getDigitOrder(digit: string): number | null {
  if (!/^\d{2}$/.test(digit)) return null;
  const value = Number(digit);
  if (!Number.isFinite(value)) return null;
  return value === 0 ? 100 : value;
}

function getBandSizeForSave(selectedPage: SelectedPage, formData: CaptureFormData): BandSize {
  if (!isNewCaptureType(formData.birdEventType)) return BandSize.Other;
  return isSettablePage(selectedPage) ? selectedPage : BandSize.Other;
}

function shouldAutoAdvanceWing(value: string, range: ReturnType<typeof getRangesForSex>): boolean {
  if (!value || !range || range.wingLower <= 0 || range.wingUpper <= 0) return false;

  const wingValue = Number(value);
  if (!Number.isFinite(wingValue)) return false;

  const lowerWithMargin = Math.floor(range.wingLower * 0.8);
  const upperWithMargin = Math.ceil(range.wingUpper * 1.2);

  return wingValue >= lowerWithMargin && wingValue <= upperWithMargin && wingValue * 10 > upperWithMargin;
}

function getWingAutoAdvanceRange(speciesRange: SpeciesRange | undefined): ReturnType<typeof getRangesForSex> {
  if (!speciesRange) return null;

  const lowers = [speciesRange.fWingLower, speciesRange.mWingLower].filter((value) => value > 0);
  const uppers = [speciesRange.fWingUpper, speciesRange.mWingUpper].filter((value) => value > 0);
  if (lowers.length === 0 || uppers.length === 0) return null;

  return {
    weightLower: 0,
    weightUpper: 0,
    wingLower: Math.min(...lowers),
    wingUpper: Math.max(...uppers),
  };
}

export default function StartBandingEntry({ entryId, isDoubleBanding = false }: StartBandingEntryProps) {
  const selectedProgram = useAppStore((s) => s.selectedProgram);
  const isAppSaving = useAppStore((s) => s.isSaving);
  const bandIdToBirdEventIdsMap = useAppStore((s) => s.bandIdToBirdEventIdsMap);
  const bandSizeToBandIdMap = useAppStore((s) => s.bandSizeToBandIdMap);
  const magicTable = useAppStore((s) => s.magicTable);
  const speciesAliasesMap = useAppStore((s) => s.speciesAliasesMap);
  const volunteersMap = useAppStore((s) => s.volunteersMap);
  const volunteerStatsMap = useAppStore((s) => s.volunteerStatsMap);
  const bandResetsMap = useAppStore((s) => s.bandResetsMap);
  const { addBirdEvent } = useActions();
  const birdEventsVersion = useBirdEventsVersion();
  const [formData, setFormData] = useState<CaptureFormData>(() => getDefaultFormData(selectedProgram?.id || ""));
  const [selectedPage, setSelectedPage] = useState<SelectedPage>(null);
  const [lastBandId, setLastBandId] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [isEntryWarningOpen, setIsEntryWarningOpen] = useState(false);
  const [entryMessage, setEntryMessage] = useState<EntryMessage | null>(null);
  const [validationMessageIndex, setValidationMessageIndex] = useState(0);
  const [isBirdStatusModalOpen, setIsBirdStatusModalOpen] = useState(false);
  const [isNotesModalOpen, setIsNotesModalOpen] = useState(false);
  const [reminderNotice, setReminderNotice] = useState<{
    bandId: string;
    notes: string[];
  } | null>(null);
  const shownReminderBandRef = useRef("");
  const savedReminderBandRef = useRef("");
  const inputRefs = useRef<Map<string, HTMLInputElement>>(new Map());
  const notesTextareaRef = useRef<HTMLTextAreaElement | null>(null);
  const pendingSavedBandSizeRef = useRef<BandSize | null>(null);
  const shownEntryWarningKeyRef = useRef("");

  const focusOrder = useMemo(() => [...FIRST_ROW_KEYS, ...SECOND_ROW_KEYS], []);

  const focusNext = useCallback(
    (currentKey: string) => {
      const idx = focusOrder.indexOf(currentKey as (typeof focusOrder)[number]);
      if (idx >= 0 && idx < focusOrder.length - 1) {
        inputRefs.current.get(focusOrder[idx + 1])?.focus();
      }
    },
    [focusOrder]
  );

  const getTabIndex = useCallback(
    (key: string) => {
      const idx = focusOrder.indexOf(key as (typeof focusOrder)[number]);
      return idx >= 0 ? idx + 1 : -1;
    },
    [focusOrder]
  );

  const registerRef = useCallback((key: string, el: HTMLInputElement | null) => {
    if (el) inputRefs.current.set(key, el);
  }, []);

  const applyPage = useCallback(
    (page: StartBandingPage) => {
      setSelectedPage(page);
      if (page === PAGE_RECAPTURE || page === BandSize.Other) {
        setFormData((prev) => ({
          ...prev,
          bandGroup: "",
          bandLastTwoDigits: "",
          birdEventType: page === PAGE_RECAPTURE ? BirdEventType.Repeat : BirdEventType.None,
        }));
        return;
      }

      const band = getBandFromNextId(bandSizeToBandIdMap[page]);
      setFormData((prev) => ({
        ...prev,
        bandGroup: band?.bandGroupId ?? "",
        bandLastTwoDigits: band?.last2digits ?? "",
        birdEventType: BirdEventType.Banded,
      }));
    },
    [bandSizeToBandIdMap]
  );

  useEffect(() => {
    const defaultData = getDefaultFormData(selectedProgram?.id || "");
    const savedBander = localStorage.getItem("lastBander");
    const savedScribe = localStorage.getItem("lastScribe");
    if (savedBander) defaultData.bander = savedBander;
    if (savedScribe) defaultData.scribe = savedScribe;

    setFormData(defaultData);
    setLastBandId("");
    setSelectedPage(null);
    setIsEntryWarningOpen(false);
    shownEntryWarningKeyRef.current = "";
  }, [selectedProgram?.id]);

  const bandId = useMemo(() => {
    if (formData.bandGroup.length === 7 && formData.bandLastTwoDigits.length === 2) {
      return formData.bandGroup + formData.bandLastTwoDigits;
    }
    return "";
  }, [formData.bandGroup, formData.bandLastTwoDigits]);

  const pastBirdEvents = useMemo(() => {
    void birdEventsVersion;
    if (!bandId) return [];
    const birdEventIds = bandIdToBirdEventIdsMap[bandId] || [];
    return birdEventIds
      .map((id) => birdEventsStore.get(id))
      .filter((event): event is BirdEvent => !!event)
      .filter((event) => isActiveBirdEvent(event, bandResetsMap));
  }, [bandId, bandIdToBirdEventIdsMap, birdEventsVersion, bandResetsMap]);

  const mustBandAfterReset = useMemo(
    () =>
      Boolean(bandId && bandResetsMap[bandId]) &&
      !pastBirdEvents.some((event) => isNewCaptureType(event.birdEventType)),
    [bandId, bandResetsMap, pastBirdEvents]
  );
  const requiredResetEventType =
    formData.species === "BADE" || formData.species === "BALO" ? BirdEventType.None : BirdEventType.Banded;
  const bandReminder = useMemo(() => computeBandReminder(pastBirdEvents), [pastBirdEvents]);
  const effectiveReminder = formData.reminder ?? bandReminder.enabled;

  useEffect(() => {
    if (savedReminderBandRef.current && savedReminderBandRef.current !== bandId) {
      savedReminderBandRef.current = "";
    }
    if (shownReminderBandRef.current && shownReminderBandRef.current !== bandId) {
      shownReminderBandRef.current = "";
    }
    if (!bandId) {
      return;
    }
    if (savedReminderBandRef.current === bandId) return;
    if (shownReminderBandRef.current === bandId) return;
    if (!bandReminder.enabled) return;

    shownReminderBandRef.current = bandId;
    setReminderNotice({
      bandId,
      notes: bandReminder.notes,
    });
  }, [bandId, bandReminder]);

  const matchedPageForBandGroup = useMemo(
    () => getPageForBandGroup(formData.bandGroup, bandSizeToBandIdMap),
    [bandSizeToBandIdMap, formData.bandGroup]
  );

  const suggestedBirdEventType = useMemo(() => {
    if (mustBandAfterReset) return requiredResetEventType;
    if (selectedPage !== PAGE_RECAPTURE) {
      return formData.species === "BADE" || formData.species === "BALO"
        ? BirdEventType.None
        : selectedPage
          ? BirdEventType.Banded
          : BirdEventType.None;
    }
    if (!bandId) return BirdEventType.Repeat;
    if (pastBirdEvents.length === 0) return BirdEventType.Alien;

    const currentDate = new Date(formData.date);
    const hasRecentCapture = pastBirdEvents.some((capture) => {
      const captureDate = new Date(capture.date);
      const daysDiff = Math.abs((currentDate.getTime() - captureDate.getTime()) / (1000 * 60 * 60 * 24));
      return daysDiff <= 90;
    });
    return hasRecentCapture ? BirdEventType.Repeat : BirdEventType.Return;
  }, [
    bandId,
    formData.date,
    formData.species,
    mustBandAfterReset,
    pastBirdEvents,
    requiredResetEventType,
    selectedPage,
  ]);

  useEffect(() => {
    setFormData((prev) => ({ ...prev, birdEventType: suggestedBirdEventType }));
  }, [suggestedBirdEventType]);

  useLayoutEffect(() => {
    const savedBandSize = pendingSavedBandSizeRef.current;
    if (!savedBandSize || savedBandSize === BandSize.Other) return;

    const nextBand = getBandFromNextId(bandSizeToBandIdMap[savedBandSize]);
    if (!nextBand) return;

    pendingSavedBandSizeRef.current = null;
    setFormData((prev) =>
      prev.bandGroup === nextBand.bandGroupId && prev.bandLastTwoDigits === nextBand.last2digits
        ? prev
        : { ...prev, bandGroup: nextBand.bandGroupId, bandLastTwoDigits: nextBand.last2digits }
    );
    setLastBandId("");
  }, [bandSizeToBandIdMap]);

  useEffect(() => {
    if (bandId && bandId !== lastBandId) {
      const existingSpecies = pastBirdEvents[0]?.species;
      if (existingSpecies) {
        setFormData((prev) => ({ ...prev, species: existingSpecies }));
      }
      setLastBandId(bandId);
    } else if (!bandId && lastBandId) {
      setLastBandId("");
    }
  }, [bandId, lastBandId, pastBirdEvents]);

  useEffect(() => {
    if (!isNotesModalOpen) return;
    const raf = requestAnimationFrame(() => {
      const el = notesTextareaRef.current;
      if (!el) return;
      el.focus();
      el.setSelectionRange(el.value.length, el.value.length);
    });
    return () => cancelAnimationFrame(raf);
  }, [isNotesModalOpen]);

  const resolvedSpecies = useMemo(
    () => resolveSpeciesKey(formData.species, speciesAliasesMap),
    [formData.species, speciesAliasesMap]
  );

  const pyleSpeciesRange = useMemo(() => {
    if (resolvedSpecies.length !== 4 || !magicTable?.pyle) return null;
    return magicTable.pyle[resolvedSpecies] || null;
  }, [magicTable, resolvedSpecies]);

  const rangeValidation = useMemo(() => {
    const pyleRange = getRangesForSex(pyleSpeciesRange ?? undefined, formData.sex.charAt(0));
    const wingValue = formData.wing ? Number(formData.wing) : null;
    const weightValue = formData.weight ? Number(formData.weight) : null;

    const isInTolerance = (value: number, lower: number, upper: number): boolean | null => {
      if (lower === 0 && upper === 0) return null;
      if (value === 0) return false;
      return value >= lower * 0.8 && value <= upper * 1.2;
    };

    return {
      wing: wingValue !== null && pyleRange ? isInTolerance(wingValue, pyleRange.wingLower, pyleRange.wingUpper) : null,
      weight:
        weightValue !== null && pyleRange
          ? isInTolerance(weightValue, pyleRange.weightLower, pyleRange.weightUpper)
          : null,
    };
  }, [formData.sex, formData.weight, formData.wing, pyleSpeciesRange]);

  const wingAutoAdvanceRange = useMemo(
    () => getWingAutoAdvanceRange(pyleSpeciesRange ?? undefined),
    [pyleSpeciesRange]
  );

  const bandDigitGapMessage = useMemo(() => {
    if (isDoubleBanding || !matchedPageForBandGroup || formData.bandLastTwoDigits.length !== 2) return null;

    const enteredOrder = getDigitOrder(formData.bandLastTwoDigits);
    const expectedOrder = getDigitOrder(matchedPageForBandGroup.band.last2digits);
    if (enteredOrder === null || expectedOrder === null || enteredOrder <= expectedOrder) return null;

    return `Digit ${formData.bandLastTwoDigits} skips next available digit ${matchedPageForBandGroup.band.last2digits} for band group ${formData.bandGroup}`;
  }, [formData.bandGroup, formData.bandLastTwoDigits, isDoubleBanding, matchedPageForBandGroup]);

  const validationMessages = useMemo(() => {
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
      magicTable,
      speciesAliasesMap
    );

    const existingSpeciesValues = [
      ...new Set(pastBirdEvents.map((capture) => capture.species).filter((species) => species.length === 4)),
    ];
    if (
      formData.species.length === 4 &&
      existingSpeciesValues.length > 0 &&
      !existingSpeciesValues.includes(formData.species)
    ) {
      messages.push({
        text: `Species ${getSpeciesDisplayCode(formData.species, speciesAliasesMap)} does not match existing captures (was ${existingSpeciesValues
          .map((species) => getSpeciesDisplayCode(species, speciesAliasesMap))
          .join(", ")})`,
        severity: "danger",
      });
    }

    if (bandDigitGapMessage) {
      messages.push({ text: bandDigitGapMessage, severity: "danger" });
    }

    for (const column of TABLE_COLUMNS) {
      const value = formData[column.key as keyof CaptureFormData];
      if (column.minLength && typeof value === "string" && value.length > 0 && value.length < column.minLength) {
        messages.push({ text: `${column.label} is incomplete`, severity: "warning" });
      }
    }

    if (formData.bander.length >= 2 && !volunteersMap[formData.bander] && !volunteerStatsMap[formData.bander]) {
      messages.push({
        text: `Unknown bander "${formData.bander}". Saving will auto-add them to the volunteer list.`,
        severity: "warning",
      });
    }

    if (formData.scribe.length >= 2 && !volunteersMap[formData.scribe] && !volunteerStatsMap[formData.scribe]) {
      messages.push({
        text: `Unknown scribe "${formData.scribe}". Saving will auto-add them to the volunteer list.`,
        severity: "warning",
      });
    }

    messages.unshift(
      ...findErrorsInEvents(pastBirdEvents, magicTable, speciesAliasesMap).map((error) => ({
        text: error.reason,
        severity: error.severity,
      }))
    );

    return messages;
  }, [bandDigitGapMessage, formData, magicTable, pastBirdEvents, speciesAliasesMap, volunteerStatsMap, volunteersMap]);

  const incompleteFields = useMemo(() => {
    const fields = new Set<string>();
    for (const column of TABLE_COLUMNS) {
      const value = formData[column.key as keyof CaptureFormData];
      if (column.minLength && typeof value === "string" && value.length > 0 && value.length < column.minLength) {
        fields.add(column.key);
      }
    }
    return fields;
  }, [formData]);

  const sexConflict = useMemo(() => {
    if (!formData.sex || pastBirdEvents.length === 0) return false;
    const capturesWithDefinedSex = pastBirdEvents.filter((capture) => ["4", "5"].includes(capture.sex));
    return (
      capturesWithDefinedSex.length > 0 && !capturesWithDefinedSex.every((capture) => capture.sex === formData.sex)
    );
  }, [formData.sex, pastBirdEvents]);

  const speciesConflict = useMemo(() => {
    if (formData.species.length !== 4 || pastBirdEvents.length === 0) return false;
    const existingSpeciesValues = [
      ...new Set(pastBirdEvents.map((capture) => capture.species).filter((species) => species.length === 4)),
    ];
    return existingSpeciesValues.length > 0 && !existingSpeciesValues.includes(formData.species);
  }, [formData.species, pastBirdEvents]);

  const priorBandingConflict = useMemo(() => {
    return (
      isNewCaptureType(formData.birdEventType) && pastBirdEvents.some((event) => isNewCaptureType(event.birdEventType))
    );
  }, [formData.birdEventType, pastBirdEvents]);

  const recentRecaptureConflict = useMemo(() => {
    if (!formData.date || !formData.time || pastBirdEvents.length === 0) return false;
    const currentDateTime = new Date(`${formData.date}T${formData.time}`).getTime();
    return pastBirdEvents.some((capture) => {
      const captureDateTime = new Date(`${capture.date}T${capture.time}`).getTime();
      const timeDiffHours = (currentDateTime - captureDateTime) / (1000 * 60 * 60);
      return timeDiffHours >= 0 && timeDiffHours < 12;
    });
  }, [formData.date, formData.time, pastBirdEvents]);

  const ageIssueSeverity = useMemo(() => {
    const ageMessage = validationMessages.find((message) => /\bage\b/i.test(message.text));
    return ageMessage?.severity ?? null;
  }, [validationMessages]);

  const getInputColor = useCallback(
    (fieldKey: keyof CaptureFormData): "danger" | "warning" | "default" => {
      if ((fieldKey === "bandGroup" || fieldKey === "bandLastTwoDigits") && priorBandingConflict) return "danger";
      if (fieldKey === "bandLastTwoDigits" && bandDigitGapMessage) return "danger";
      if (fieldKey === "wing" && rangeValidation.wing === false) return "danger";
      if (fieldKey === "weight" && rangeValidation.weight === false) return "danger";
      if (fieldKey === "species" && speciesConflict) return "danger";
      if (fieldKey === "fat" && formData.fat && Number(formData.fat) > 7) return "danger";
      if (fieldKey === "sex" && sexConflict) return "danger";
      if ((fieldKey === "date" || fieldKey === "time") && recentRecaptureConflict) return "danger";
      if (fieldKey === "age" && ageIssueSeverity === "danger") return "danger";
      if (incompleteFields.has(fieldKey)) return "warning";
      if (fieldKey === "age" && ageIssueSeverity === "warning") return "warning";
      if (
        fieldKey === "bander" &&
        formData.bander.length >= 2 &&
        !volunteersMap[formData.bander] &&
        !volunteerStatsMap[formData.bander]
      ) {
        return "warning";
      }
      if (
        fieldKey === "scribe" &&
        formData.scribe.length >= 2 &&
        !volunteersMap[formData.scribe] &&
        !volunteerStatsMap[formData.scribe]
      ) {
        return "warning";
      }
      return "default";
    },
    [
      ageIssueSeverity,
      bandDigitGapMessage,
      formData.bander,
      formData.fat,
      formData.scribe,
      incompleteFields,
      priorBandingConflict,
      rangeValidation,
      recentRecaptureConflict,
      sexConflict,
      speciesConflict,
      volunteerStatsMap,
      volunteersMap,
    ]
  );

  const getBorderClass = useCallback((color: "danger" | "warning" | "default") => {
    if (color === "danger") {
      return "!border-danger data-[hover=true]:!border-danger group-data-[focus=true]:!border-danger";
    }
    if (color === "warning") {
      return "!border-warning data-[hover=true]:!border-warning group-data-[focus=true]:!border-warning";
    }
    return "";
  }, []);

  const handleInputChange = useCallback(
    (field: keyof CaptureFormData, value: string, maxLength?: number) => {
      const formattedValue = formatFieldValue(field, value);
      setEntryMessage(null);
      const nextValue =
        field === "species" && formattedValue.length === 4
          ? resolveSpeciesKey(formattedValue, speciesAliasesMap)
          : formattedValue;

      setFormData((prev) => ({ ...prev, [field]: nextValue }));
      if (maxLength && AUTO_ADVANCE_FIELDS.has(field) && formattedValue.length >= maxLength) {
        focusNext(field);
      }
      if (field === "wing" && shouldAutoAdvanceWing(formattedValue, wingAutoAdvanceRange)) {
        focusNext(field);
      }
      if (field === "weight" && formattedValue.includes(".") && formattedValue.split(".")[1]?.length === 1) {
        focusNext(field);
      }
    },
    [focusNext, speciesAliasesMap, wingAutoAdvanceRange]
  );

  const renderDateTimeInput = (fieldKey: string) => {
    const dateParts = formData.date.split("-");
    const timeParts = formData.time.split(":");
    const subFields: Record<string, { value: string; maxLen: number; onUpdate: (value: string) => void }> = {
      date: {
        value: dateParts[0] ?? "",
        maxLen: 4,
        onUpdate: (value) =>
          setFormData((prev) => ({
            ...prev,
            date: `${value}-${dateParts[1] ?? ""}-${dateParts[2] ?? ""}`.replace(/-+$/, ""),
          })),
      },
      "date-month": {
        value: dateParts[1] ?? "",
        maxLen: 2,
        onUpdate: (value) =>
          setFormData((prev) => ({
            ...prev,
            date: `${dateParts[0] ?? ""}-${value}-${dateParts[2] ?? ""}`.replace(/-+$/, ""),
          })),
      },
      "date-day": {
        value: dateParts[2] ?? "",
        maxLen: 2,
        onUpdate: (value) =>
          setFormData((prev) => ({ ...prev, date: `${dateParts[0] ?? ""}-${dateParts[1] ?? ""}-${value}` })),
      },
      time: {
        value: timeParts[0] ?? "",
        maxLen: 2,
        onUpdate: (value) => setFormData((prev) => ({ ...prev, time: `${value}:${timeParts[1] ?? ""}` })),
      },
      "time-minute": {
        value: timeParts[1] ?? "",
        maxLen: 2,
        onUpdate: (value) => setFormData((prev) => ({ ...prev, time: `${timeParts[0] ?? ""}:${value}` })),
      },
    };

    const sub = subFields[fieldKey];
    if (!sub) return null;
    const inputColor = fieldKey.startsWith("date") ? getInputColor("date") : getInputColor("time");

    return (
      <Input
        ref={(el: HTMLInputElement | null) => registerRef(fieldKey, el)}
        {...modalInputProps}
        color={inputColor}
        maxLength={sub.maxLen}
        value={sub.value}
        classNames={{
          input:
            "text-sm text-start [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none",
          inputWrapper: getBorderClass(inputColor),
        }}
        tabIndex={getTabIndex(fieldKey)}
        onFocus={(event) => event.target.select()}
        onChange={(event) => {
          const value = event.target.value.replace(/\D/g, "").slice(0, sub.maxLen);
          setEntryMessage(null);
          sub.onUpdate(value);
          if (value.length === sub.maxLen) focusNext(fieldKey);
        }}
      />
    );
  };

  const renderField = (fieldKey: string) => {
    if (fieldKey === "page") {
      return (
        <Select
          variant="bordered"
          aria-label="Size / Recapture"
          selectedKeys={selectedPage ? [selectedPage] : []}
          placeholder=""
          itemHeight={52}
          maxListboxHeight={420}
          popoverProps={{
            classNames: {
              content: "min-w-[240px]",
            },
          }}
          classNames={{ trigger: "min-h-unit-10 h-unit-10", value: "text-sm" }}
          tabIndex={getTabIndex(fieldKey)}
          onSelectionChange={(keys) => {
            const page = Array.from(keys)[0] as StartBandingPage | undefined;
            if (!page) return;
            setEntryMessage(null);
            applyPage(page);
            const hasPrefilledBand =
              page !== PAGE_RECAPTURE &&
              page !== BandSize.Other &&
              Boolean(getBandFromNextId(bandSizeToBandIdMap[page]));
            setTimeout(() => inputRefs.current.get(hasPrefilledBand ? "species" : "bandGroup")?.focus(), 0);
          }}
        >
          {PAGE_OPTIONS.map((page) => {
            const band = page === PAGE_RECAPTURE ? null : getBandFromNextId(bandSizeToBandIdMap[page]);
            return (
              <SelectItem key={page} description={band ? `${band.bandGroupId}-${band.last2digits}` : undefined}>
                {getPageLabel(page)}
              </SelectItem>
            );
          })}
        </Select>
      );
    }

    if (fieldKey.startsWith("date") || fieldKey.startsWith("time")) {
      return renderDateTimeInput(fieldKey);
    }

    if (fieldKey === "birdEventType") {
      return (
        <Input
          {...modalInputProps}
          aria-label="Type"
          value={formData.birdEventType}
          isDisabled
          classNames={{
            input: "text-sm",
          }}
        />
      );
    }

    if (fieldKey === "birdStatus") {
      return (
        <Button
          fullWidth
          variant="ghost"
          tabIndex={getTabIndex(fieldKey)}
          onPress={() => setIsBirdStatusModalOpen(true)}
          className="border-medium border-default-200 min-w-[0px]"
        >
          {formData.birdStatus}
        </Button>
      );
    }

    if (fieldKey === "notes") {
      return (
        <Button
          variant="ghost"
          tabIndex={getTabIndex(fieldKey)}
          onPress={() => setIsNotesModalOpen(true)}
          className="border-medium border-default-200 w-full min-w-0 justify-start overflow-hidden"
        >
          {effectiveReminder && <BellAlertIcon className="h-4 w-4 shrink-0 text-warning" />}
          <span className="truncate">{formData.notes || ""}</span>
        </Button>
      );
    }

    const column = TABLE_COLUMNS.find((candidate) => candidate.key === fieldKey);
    if (!column) return null;
    const columnKey = column.key as keyof CaptureFormData;
    const inputColor = getInputColor(columnKey);

    return (
      <Input
        ref={(el: HTMLInputElement | null) => registerRef(columnKey, el)}
        {...modalInputProps}
        color={inputColor}
        aria-label={column.label}
        type={column.type}
        maxLength={column.maxLength}
        validationBehavior="aria"
        value={
          columnKey === "species" && formData.species.length === 4
            ? getSpeciesDisplayCode(formData.species, speciesAliasesMap)
            : String(formData[columnKey] ?? "")
        }
        tabIndex={getTabIndex(columnKey)}
        onChange={(event) => handleInputChange(columnKey, event.target.value, column.maxLength)}
        onFocus={(event) => event.target.select()}
        classNames={{
          input:
            "text-sm [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none",
          inputWrapper: getBorderClass(inputColor),
        }}
      />
    );
  };

  const renderFieldGroup = (fieldKey: string) => {
    const isNotes = fieldKey === "notes";
    const volunteerCode =
      (fieldKey === "bander" || fieldKey === "scribe") && formData[fieldKey] ? formData[fieldKey] : null;

    return (
      <div
        key={`${entryId}-${fieldKey}`}
        className={`flex flex-col gap-1 ${isNotes ? "flex-1 min-w-0" : "shrink-0"}`}
        style={isNotes ? undefined : { width: FIELD_WIDTHS[fieldKey] }}
      >
        {volunteerCode ? (
          <span className="min-h-5 text-sm text-default-900 font-medium px-1 truncate underline">
            <VolunteerTooltip volunteerCode={volunteerCode}>{FIELD_LABELS[fieldKey]}</VolunteerTooltip>
          </span>
        ) : (
          <span className="min-h-5 text-sm text-default-900 font-medium px-1 truncate">{FIELD_LABELS[fieldKey]}</span>
        )}
        {renderField(fieldKey)}
      </div>
    );
  };

  const hasExistingData = pastBirdEvents.length > 0;
  const existingDataTitle = `${hasExistingData ? "Existing data" : "No data"} for band ${bandId || ""}`.trim();
  const canSave = Boolean(
    selectedPage && formData.bandGroup && formData.bandLastTwoDigits && formData.species && selectedProgram
  );
  const entryWarnings = useMemo(() => {
    const warnings: string[] = [];

    if (!bandId) return warnings;

    if (selectedPage !== null && selectedPage !== PAGE_RECAPTURE && pastBirdEvents.length > 0) {
      warnings.push(
        `Band ${bandId} has capture history, but page ${getPageLabel(selectedPage)} is a new-banding page. This entry will be saved as ${suggestedBirdEventType}.`
      );
    }

    if (suggestedBirdEventType === BirdEventType.Alien) {
      warnings.push(
        `Band ${bandId} has no capture history. It will be saved as Alien. Make sure this is not the first band from a new band group.`
      );
    }

    if (isSettablePage(selectedPage)) {
      const currentBand = getBandFromNextId(bandSizeToBandIdMap[selectedPage]);
      if (currentBand?.bandGroupId !== formData.bandGroup) {
        warnings.push(
          currentBand
            ? `Page ${getPageLabel(selectedPage)} currently uses band group ${currentBand.bandGroupId}. Saving will change it to ${formData.bandGroup}.`
            : `Page ${getPageLabel(selectedPage)} has no band group yet. Saving will set it to ${formData.bandGroup}.`
        );
      }
    }

    return warnings;
  }, [bandId, bandSizeToBandIdMap, formData.bandGroup, pastBirdEvents.length, selectedPage, suggestedBirdEventType]);
  const entryWarningKey = useMemo(
    () => (entryWarnings.length > 0 ? JSON.stringify([selectedPage, bandId, entryWarnings]) : ""),
    [bandId, entryWarnings, selectedPage]
  );

  useEffect(() => {
    if (!entryWarningKey) {
      shownEntryWarningKeyRef.current = "";
      setIsEntryWarningOpen(false);
      return;
    }
    if (shownEntryWarningKeyRef.current === entryWarningKey) return;

    shownEntryWarningKeyRef.current = entryWarningKey;
    setIsEntryWarningOpen(true);
  }, [entryWarningKey]);

  const orderedMessages = useMemo<EntryMessage[]>(() => {
    const messages = [
      ...validationMessages
        .filter((message) => message.severity === "danger")
        .map((message): EntryMessage => ({ tone: "danger", text: message.text })),
      ...validationMessages
        .filter((message) => message.severity === "warning")
        .map((message): EntryMessage => ({ tone: "warning", text: message.text })),
    ];

    const allMessages = !entryMessage
      ? messages
      : entryMessage.tone === "danger"
        ? [entryMessage, ...messages]
        : [...messages, entryMessage];
    const seen = new Set<string>();
    return allMessages.filter((message) => {
      if (seen.has(message.text)) return false;
      seen.add(message.text);
      return true;
    });
  }, [entryMessage, validationMessages]);
  const messageCount = orderedMessages.length;
  const activeMessageIndex = Math.min(validationMessageIndex, Math.max(0, messageCount - 1));
  const activeMessage = orderedMessages[activeMessageIndex];

  useEffect(() => {
    setValidationMessageIndex(0);
  }, [orderedMessages]);

  const moveValidationMessage = useCallback(
    (direction: -1 | 1) => {
      if (messageCount < 2) return;
      setValidationMessageIndex((current) => (current + direction + messageCount) % messageCount);
    },
    [messageCount]
  );
  const displayedMessage =
    activeMessage ??
    ({
      tone: "default",
      text: canSave ? "Ready to save" : "Enter fields to save",
    } satisfies EntryMessage);
  const messageClassName =
    displayedMessage.tone === "success"
      ? "border-success-200 text-success-700"
      : displayedMessage.tone === "danger"
        ? "border-danger-200 text-danger-700"
        : displayedMessage.tone === "warning"
          ? "border-warning-200 text-warning-700"
          : "border-default-200 text-default-900";

  const saveEntry = useCallback(async () => {
    if (isSaving || isAppSaving || !canSave) return;
    setIsSaving(true);
    let suppressedReminderBand = "";

    try {
      const birdEventTypeToSave = mustBandAfterReset ? requiredResetEventType : suggestedBirdEventType;
      const formDataToSave = { ...formData, birdEventType: birdEventTypeToSave };
      const bandSizeToSend = getBandSizeForSave(selectedPage, formDataToSave);
      const trackedBandSize =
        isNewCaptureType(birdEventTypeToSave) && bandSizeToSend !== BandSize.Other ? bandSizeToSend : null;
      pendingSavedBandSizeRef.current = trackedBandSize;

      if (formDataToSave.reminder) {
        suppressedReminderBand = bandId;
        savedReminderBandRef.current = bandId;
      }
      await addBirdEvent(formDataToSave, bandSizeToSend, undefined);

      if (formData.bander) localStorage.setItem("lastBander", formData.bander);
      if (formData.scribe) localStorage.setItem("lastScribe", formData.scribe);

      const now = new Date();
      const nextDate = getLocalDateString(now);
      const nextTime = now.toTimeString().slice(0, 5);

      setFormData((prev) => ({
        ...prev,
        net: "",
        ...(trackedBandSize ? {} : { bandGroup: "", bandLastTwoDigits: "" }),
        species: "",
        wing: "",
        age: "",
        howAged: "",
        sex: "",
        howSexed: "",
        fat: "",
        weight: "",
        date: nextDate,
        time: nextTime,
        birdStatus: DEFAULT_BIRD_STATUS,
        notes: "",
        reminder: undefined,
      }));
      setLastBandId("");
      setEntryMessage({ tone: "success", text: "Saved. Ready for next bird." });
      inputRefs.current.get("net")?.focus();
    } catch (err) {
      if (savedReminderBandRef.current === suppressedReminderBand) savedReminderBandRef.current = "";
      pendingSavedBandSizeRef.current = null;
      setEntryMessage(null);
      showPersistentErrorToast("Save failed", err, "Please try again.");
    } finally {
      setIsSaving(false);
    }
  }, [
    addBirdEvent,
    bandId,
    canSave,
    formData,
    isAppSaving,
    isSaving,
    mustBandAfterReset,
    requiredResetEventType,
    selectedPage,
    suggestedBirdEventType,
  ]);

  return (
    <>
      <Card shadow="none" className="w-full border border-default-200">
        <CardBody className="flex flex-col gap-4 p-4">
          <section className="flex flex-col gap-4">
            <div className="flex gap-1">{[...FIRST_ROW_KEYS, ...SECOND_ROW_KEYS].map(renderFieldGroup)}</div>
          </section>

          <div className="grid min-h-[220px] grid-cols-[420px_minmax(0,1fr)] items-stretch gap-4">
            <section className="flex min-w-0 flex-col gap-4">
              <PyleTable title="Pyle" speciesCode={resolvedSpecies} speciesRange={pyleSpeciesRange} withCard />
            </section>

            <section className="flex min-w-0 flex-col gap-2">
              <h3 className="text-sm font-medium text-default-900">{existingDataTitle}</h3>
              <div className={hasExistingData ? "" : "[&_th]:text-default-400"}>
                <BirdEventsTable
                  birdEvents={pastBirdEvents}
                  maxTableHeight={185}
                  showSummary={false}
                  removeWrapperShadow
                  sortDescriptors={[{ column: "date", direction: "ascending" }]}
                  hiddenColumns={[
                    "actions",
                    "net",
                    "bandGroup",
                    "bandLastTwoDigits",
                    "species",
                    "scribe",
                    "birdStatus",
                    "updatedAt",
                  ]}
                />
              </div>
            </section>
          </div>

          <div className="flex items-center justify-between gap-4">
            <div
              className={`flex h-[40px] min-h-[40px] max-h-[40px] flex-1 items-center gap-2 overflow-hidden rounded-medium border bg-transparent px-3 text-sm font-medium ${messageClassName}`}
              tabIndex={messageCount > 1 ? 0 : undefined}
              onKeyDown={(event) => {
                if (event.key === "ArrowLeft") {
                  event.preventDefault();
                  moveValidationMessage(-1);
                } else if (event.key === "ArrowRight") {
                  event.preventDefault();
                  moveValidationMessage(1);
                }
              }}
            >
              <span className="min-w-0 flex-1 truncate" title={displayedMessage.text}>
                {displayedMessage.text}
              </span>
              {messageCount > 1 && (
                <div className="flex shrink-0 items-center gap-1">
                  <span className="text-xs tabular-nums opacity-70">
                    {activeMessageIndex + 1}/{messageCount}
                  </span>
                  <Button
                    isIconOnly
                    size="sm"
                    variant="light"
                    aria-label="Previous validation message"
                    onPress={() => moveValidationMessage(-1)}
                  >
                    <ChevronLeftIcon className="h-4 w-4" />
                  </Button>
                  <Button
                    isIconOnly
                    size="sm"
                    variant="light"
                    aria-label="Next validation message"
                    onPress={() => moveValidationMessage(1)}
                  >
                    <ChevronRightIcon className="h-4 w-4" />
                  </Button>
                </div>
              )}
            </div>
            <Button
              color="secondary"
              onPress={() => void saveEntry()}
              isDisabled={!canSave || isAppSaving}
              isLoading={isSaving}
            >
              Save
            </Button>
          </div>
        </CardBody>
      </Card>

      <Modal
        isOpen={isEntryWarningOpen}
        onOpenChange={setIsEntryWarningOpen}
        isDismissable={false}
        isKeyboardDismissDisabled
        size="2xl"
      >
        <ModalContent>
          {(onClose) => (
            <>
              <ModalHeaderShell>
                <h2 className="text-xl font-semibold">Check band entry</h2>
              </ModalHeaderShell>
              <ModalBodyShell>
                <p>Please review this band before continuing:</p>
                <ul className="flex list-disc flex-col gap-3 pl-5">
                  {entryWarnings.map((warning) => (
                    <li key={warning}>{warning}</li>
                  ))}
                </ul>
              </ModalBodyShell>
              <ModalFooterShell>
                <Button {...modalPrimaryButtonProps} onPress={onClose}>
                  Review entry
                </Button>
              </ModalFooterShell>
            </>
          )}
        </ModalContent>
      </Modal>

      <BirdStatusModal
        isOpen={isBirdStatusModalOpen}
        onOpenChange={setIsBirdStatusModalOpen}
        currentStatus={formData.birdStatus || DEFAULT_BIRD_STATUS}
        onStatusChange={(status) => {
          setEntryMessage(null);
          setFormData((prev) => ({ ...prev, birdStatus: status }));
        }}
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
                  ref={notesTextareaRef}
                  className="w-full min-h-[200px] p-3 rounded-medium border-medium border-default-200 bg-default-50 text-sm resize-y"
                  value={formData.notes}
                  onChange={(event) => {
                    setEntryMessage(null);
                    setFormData((prev) => ({ ...prev, notes: event.target.value }));
                  }}
                  placeholder="Add notes..."
                />
                <Checkbox
                  isSelected={effectiveReminder}
                  onValueChange={(reminder) => setFormData((prev) => ({ ...prev, reminder }))}
                >
                  Reminder on next capture
                </Checkbox>
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
      <BirdReminderModal
        isOpen={reminderNotice !== null}
        onOpenChange={(open) => {
          if (!open) setReminderNotice(null);
        }}
        bandId={reminderNotice?.bandId ?? ""}
        notes={reminderNotice?.notes ?? []}
      />
    </>
  );
}
