// Database structure types
export type YearToProgramMap = Record<string, string[]>;
export type ProgramsMap = Record<string, Program>;
export type BandGroupToCaptureIdsMap = Record<string, string[]>;
export type BandIdToCaptureIdsMap = Record<string, string[]>;
export type CapturesMap = Record<string, Capture>;

// Domain models
export interface Program {
  name: string;
  usedBandGroupIds: string[];
  reCaptureIds: string[];
}

export interface Capture {
  id: string;
  bandGroup: string;
  bandLastTwoDigits: string;
  bandId: string;
  programId: string;
  bandPrefix: string;
  bandSuffix: string;
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
  captureType: keyof typeof CaptureType;
}

export const CaptureType = {
  Banded: "Banded",
  Alien: "Alien",
  Repeat: "Repeat",
  Return: "Return",
  None: "None",
};

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
  allCaptures: Capture[];
  isLoadingAllCaptures: boolean;
  magicTable: MagicTable | null;
}

// Form types
export interface CaptureFormData {
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

export interface CaptureColumn {
  key: keyof CaptureFormData;
  label: string;
  type?: string;
  className?: string;
  maxLength?: number;
  minLength?: number;
}
