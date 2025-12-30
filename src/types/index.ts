// Database structure types
export type YearToProgramMap = Record<string, string[]>;
export type ProgramsMap = Record<string, Program>;
export type BandGroupsMap = Record<string, BandGroup>;
export type BirdEventsMap = Record<string, BirdEvent>;
export type BandIdToBirdEventIdsMap = Record<string, string[]>;

export interface Program {
  id: string;
  bandGroupIds: string[];
  recaptureIds: string[];
  nextBandSizes?: Record<BandSize, string>;
}

export class Band {
  id: string;
  bandGroupId: string;
  last2digits: string;
  bandPrefix: string;
  bandSuffix: string;

  constructor(bandPrefix: string, bandSuffix: string) {
    this.last2digits = bandSuffix.slice(-2);
    let bandGroupIdNumber = parseInt(bandPrefix + bandSuffix.slice(0, -2), 10);
    if (this.last2digits === "00") {
      bandGroupIdNumber -= 1;
    }
    this.bandGroupId = bandGroupIdNumber.toString();
    this.bandPrefix = bandPrefix;
    this.bandSuffix = bandSuffix;
    this.id = `${this.bandGroupId}-${this.last2digits}`;
  }

  // 1462068-00 should be the same Band Group as 1462067-99
  get displayBandGroupId(): string {
    if (this.last2digits === "00") {
      return (parseInt(this.bandGroupId, 10) + 1).toString();
    }
    return this.bandGroupId;
  }
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
  notes: string;

  previousEventId: string | null;
  modifiedEventId: string | null;
  birdEventType: BirdEventType;
}

export function generateBirdEventId(
  bandId: string,
  date: string,
  bander: string,
  scribe: string,
  net: string,
  weight: string
): string {
  return `${bandId}${date}${bander}${scribe}${net}${weight}`.replace(".", "");
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
  CaptureDate = "CaptureDate",
  Bander = "Bander",
  Scribe = "Scribe",
  Net = "Net",
  NotesForMBO = "NotesForMBO",
  D18 = "D18",
}

export interface SpeciesRange {
  fWeightLower: number;
  fWeightUpper: number;
  fWingLower: number;
  fWingUpper: number;
  fCounter?: number;
  mWeightLower: number;
  mWeightUpper: number;
  mWingLower: number;
  mWingUpper: number;
  mCounter?: number;
  unknownWeightLower: number;
  unknownWeightUpper: number;
  unknownWingLower: number;
  unknownWingUpper: number;
  unknownCounter?: number;
}

export interface MagicTable {
  pyle: Record<string, SpeciesRange>;
  mbo: Record<string, SpeciesRange>;
}

// Database root type (loaded from alpha/)
export interface AlphaData {
  yearsToProgramMap: YearToProgramMap;
  programsMap: ProgramsMap;
  bandIdToBirdEventIdsMap: BandIdToBirdEventIdsMap;
  birdEventsMap: BirdEventsMap;
  bandGroupsMap: BandGroupsMap;
  magicTable: MagicTable;
}

// Service types
export interface DataContextType {
  // Loading state
  isLoading: boolean;
  error: string | null;

  // Selected program
  selectedProgram: string | null;
  selectProgram: (programId: string | null) => void;
  nextBandSizes: Record<BandSize, string> | undefined;

  // All data from alpha/
  yearsToProgramMap: YearToProgramMap;
  programsMap: ProgramsMap;
  bandIdToBirdEventIdsMap: BandIdToBirdEventIdsMap;
  birdEventsMap: BirdEventsMap;
  bandGroupsMap: BandGroupsMap;
  magicTable: MagicTable;

  // Offline support
  isOnline: boolean;
  pendingCount: number;

  // Actions
  addCapture: (
    captureData: CaptureFormData,
    birdEventType: BirdEventType,
    bandSize: BandSize,
    nextBandSizes: Record<BandSize, string> | undefined
  ) => Promise<void>;
  addProgram: (programName: string, year: string) => Promise<void>;
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
  captureType: string;
  notes: string;
}

export interface CaptureColumn {
  key: keyof CaptureFormData | "actions";
  label: string;
  type?: string;
  className?: string;
  maxLength?: number;
  minLength?: number;
}

// Queue types for offline support
export interface PendingEvent {
  id: string;
  pendingEvent: BirdEvent;
  timestamp: number;
  environment: string;
}
