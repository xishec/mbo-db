import type { DET } from "./DET";

// Re-export DET type
export type { DET } from "./DET";

// Database structure types
export type YearToProgramMap = Record<string, string[]>;
export type ProgramsMap = Record<string, Program>;
export type BandGroupsMap = Record<string, BandGroup>;
export type BirdEventsMap = Record<string, BirdEvent>;
export type BandIdToBirdEventIdsMap = Record<string, string[]>;
export type BandSizeToBandIdMap = Record<BandSize, string>;
export type DismissedConflictsMap = Record<string, boolean>;
export type DETsMap = Record<string, DET>;
export type VolunteersMap = Record<string, Volunteer>;

export interface Volunteer {
  code: string;
  fullName: string;
  totalBanded: number;
  totalScribed: number;
}

export interface Program {
  id: string;
  displayName: string;
  bandGroupIds: string[];
  recaptureIds: string[];
  firstCaptureDate?: string;
  lastCaptureDate?: string;
}

export class Band {
  id: string;
  bandGroupId: string;
  last2digits: string;
  bandPrefix: string;
  bandSuffix: string;

  constructor(bandPrefix: string, bandSuffix: string) {
    this.bandPrefix = bandPrefix;
    this.bandSuffix = bandSuffix;
    this.last2digits = bandSuffix.slice(-2);
    // Band group is always the first 7 digits (no adjustment)
    this.bandGroupId = bandPrefix + bandSuffix.slice(0, 3);
    this.id = this.bandGroupId + this.last2digits;
  }
}

/**
 * Get the correct bandGroupsMap key for a band
 *
 * Business rule: -00 bands belong to the PREVIOUS band group
 * - 2991468-00 and 2991467-99 should be in the SAME group
 * - Both stored under bandGroupsMap["2991467"]
 *
 * Examples:
 * - Band 2991468-00: bandGroupId="2991468" → map key "2991467"
 * - Band 2991467-99: bandGroupId="2991467" → map key "2991467"
 */
export function getBandGroupMapKey(band: Band): string {
  if (band.last2digits !== "00") return band.bandGroupId;

  // Subtract 1 and preserve leading zeros (7 digits)
  const numericValue = parseInt(band.bandGroupId, 10) - 1;
  return numericValue.toString().padStart(7, "0");
}

export interface BandGroup {
  id: string;
  newCaptureIds: string[];
}

export interface BirdEvent {
  id: string;
  programId: string;
  band: Band;
  species: string;
  wing: number;
  age: string;
  howAged: string;
  sex: string;
  howSexed: string;
  fat: number;
  weight: number;
  date: string;
  time: string;
  bander: string;
  scribe: string;
  net: string;
  birdStatus: string;
  notes: string;
  updatedAt: string;

  previousEventId: string | null;
  modifiedEventId: string | null;
  birdEventType: BirdEventType;
}

export function generateBirdEventId(
  bandId: string,
  date: string,
  net: string,
  wing: string,
  weight: string,
  isModification: boolean = false
): string {
  return `${bandId}${date}${net}${wing}${weight}${isModification ? "ModAt" + Date.now() : ""}`.replace(".", "");
}

export enum BirdEventType {
  Banded = "Banded",
  None = "None",
  Alien = "Alien",
  Repeat = "Repeat",
  Return = "Return",
}

export enum BandSize {
  Size0a = "0a",
  Size0 = "0",
  Size1 = "1",
  Size1b = "1b",
  Size1a = "1a",
  Size1d = "1d",
  Size2 = "2",
  Size3 = "3",
  Size3b = "3b",
  Size3a = "3a",
  Other = "other",
}

export enum HEADERS {
  Program = "Program",
  BandPrefix = "BandPrefix",
  BandSuffix = "BandSuffix",
  Species = "Species",
  WingChord = "WingChord",
  Age = "Age",
  HowAged = "HowAged",
  Sex = "Sex",
  HowSexed = "HowSexed",
  Fat = "Fat",
  Weight = "Weight",
  WeightTime = "WeightTime",
  CaptureDate = "CaptureDate",
  Bander = "Bander",
  Scribe = "Scribe",
  Net = "Net",
  NotesForMBO = "NotesForMBO",
  D18 = "D18",
  BirdStatus = "BirdStatus",
}

export interface SpeciesRange {
  fWeightLower: number;
  fWeightUpper: number;
  fWingLower: number;
  fWingUpper: number;
  mWeightLower: number;
  mWeightUpper: number;
  mWingLower: number;
  mWingUpper: number;
  unknownWeightLower: number;
  unknownWeightUpper: number;
  unknownWingLower: number;
  unknownWingUpper: number;
}

export interface MagicTable {
  pyle: Record<string, SpeciesRange>;
}

// Database root type
export interface DatabaseData {
  yearsToProgramMap: YearToProgramMap;
  programsMap: ProgramsMap;
  bandIdToBirdEventIdsMap: BandIdToBirdEventIdsMap;
  birdEventsMap: BirdEventsMap;
  bandGroupsMap: BandGroupsMap;
  bandSizeToBandIdMap: BandSizeToBandIdMap;
  dismissedConflictsMap: DismissedConflictsMap;
  DETsMap?: DETsMap;
}

// Service types
export interface DataContextType {
  // Loading state
  isLoading: boolean;
  error: string | null;

  // User authentication
  isLoggedIn: boolean;
  isAdmin: boolean;
  userEmail: string | null;
  signOut: () => Promise<void>;

  // Selected program
  selectedProgram: Program | null;
  selectProgram: (program: Program | null) => void;

  // All data from alpha/
  yearsToProgramMap: YearToProgramMap;
  programsMap: ProgramsMap;
  bandIdToBirdEventIdsMap: BandIdToBirdEventIdsMap;
  birdEventsMap: BirdEventsMap;
  bandGroupsMap: BandGroupsMap;
  magicTable: MagicTable;
  bandSizeToBandIdMap: BandSizeToBandIdMap;
  dismissedConflictsMap: DismissedConflictsMap;
  DETsMap: DETsMap;
  volunteersMap: VolunteersMap;
  speciesInfoMap: SpeciesInfoMap;

  // Offline support
  isOnline: boolean;
  pendingCount: number;
  lastSyncedAt: number | null;
  forceOffline: boolean;
  setForceOffline: (force: boolean) => void;
  modeChosen: boolean;
  chooseOnline: () => void;
  chooseOffline: () => void;

  // Actions
  addBirdEvent: (
    captureData: CaptureFormData,
    bandSize: BandSize,
    previousEventId: string | undefined
  ) => Promise<void>;
  addProgram: (programId: string, displayName: string, year: string) => Promise<void>;
  updateProgram: (programId: string, newDisplayName: string) => Promise<void>;
  syncQueue: () => Promise<void>;
  updateBandSizeMap: (bandSizeMap: BandSizeToBandIdMap) => Promise<void>;
  incrementBandSize: (
    bandSize: BandSize,
    bandGroup: string,
    bandLastTwoDigits: string
  ) => Promise<Record<BandSize, string>>;
  dismissConflict: (conflictId: string) => Promise<void>;
  resetDismissedConflicts: () => Promise<void>;
  saveDET: (det: DET) => Promise<void>;
  updateVolunteerName: (code: string, fullName: string) => Promise<void>;
  addVolunteer: (code: string, fullName: string) => Promise<void>;
  milestone: { banderCode: string; count: number } | null;
  clearMilestone: () => void;
  triggerTestMilestone: () => void;
}

// Form types
export interface CaptureFormData {
  programId: string;
  bandGroup: string;
  bandLastTwoDigits: string;
  species: string;
  wing: string;
  age: string;
  howAged: string;
  sex: string;
  howSexed: string;
  fat: string;
  weight: string;
  date: string;
  time: string;
  bander: string;
  scribe: string;
  net: string;
  birdEventType: string;
  birdStatus: string;
  notes: string;
}

export interface CaptureColumn {
  key: keyof CaptureFormData | "actions" | "updatedAt";
  label: string;
  type: string;
  tableClassName?: string;
  inputClassName?: string;
  maxLength?: number;
  minLength?: number;
}

// Queue types for offline support
export interface PendingBirdEvent {
  id: string;
  type: "bird-event";
  pendingEvent: BirdEvent;
  timestamp: number;
  environment: string;
  action: "added" | "modified";
}

export interface PendingDETEvent {
  id: string;
  type: "det";
  det: DET;
  timestamp: number;
  environment: string;
}

export type PendingEvent = PendingBirdEvent | PendingDETEvent;

export interface SpeciesInfo {
  totalCaptures: number;
  speciesCode: string;
  biggest: BirdEvent;
  fattest: BirdEvent;
  dummiest: BirdEvent;
  dummiestCount: number;
  oldest: BirdEvent | null; // null if no band has multiple events
  oldestSpanDays: number; // Span in days for the oldest individual (-1 if n/a)
  favoriteBander: string;
  favoriteBanderRate: number;
  favoriteNet: string;
  favoriteNetRate: number;
}

export type SpeciesInfoMap = Record<string, SpeciesInfo>;