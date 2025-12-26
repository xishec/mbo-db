// Database structure types
export type YearToProgramMap = Record<string, string[]>;
export type ProgramsMap = Record<string, Program>;
export type BandGroupsMap = Record<string, BandGroup>;
export type BirdEventsMap = Record<string, BirdEvent>;
export type BandIdToBirdEventIdsMap = Record<string, string[]>;

export interface Program {
  id: string;
  bandGroupIds: string[];
  recaptureEventIds: string[];
}

export class Band {
  id: string;
  bandGroupId: string;
  last2digits: string;

  constructor(bandPrefix: string, bandSuffix: string) {
    this.id = crypto.randomUUID();
    this.bandGroupId = `${bandPrefix}-${bandSuffix.slice(0, -2)}`;
    this.last2digits = bandSuffix.slice(-2);
  }
}

export interface BandGroup {
  id: string;
  captureEventIds: string[];
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

export const enum BirdEventType {
  Banded,
  None,
  Alien,
  Repeat,
  Return,
}

export const enum HEADERS {
  Program,
  BandPrefix,
  BandSuffix,
  Species,
  WingChord,
  Age,
  HowAged,
  Sex,
  HowSexed,
  Fat,
  Weight,
  CaptureDate,
  Bander,
  Scribe,
  Net,
  NotesForMBO,
  D18,
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

// Service types
export interface ProgramData {
  bandGroupToNewCaptures: Record<string, Capture[]>;
  reCaptures: Capture[];
  isLoadingProgram: boolean;
  isLoadingCaptures: boolean;
  isLoadingReCaptures: boolean;
}

export interface DataContextType {
  programData: ProgramData;
  selectProgram: (programName: string | null) => void;
  selectedProgram: string | null;
  fetchCapturesByBandId: (bandId: string) => Promise<Capture[]>;
  checkBandIdExists: (bandId: string) => Promise<boolean>;
  allCaptures: Capture[];
  isLoadingAllCaptures: boolean;
  magicTable: MagicTable | null;
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
  key: keyof CaptureFormData;
  label: string;
  type?: string;
  className?: string;
  maxLength?: number;
  minLength?: number;
}
