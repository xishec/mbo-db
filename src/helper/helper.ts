// Database structure types (as stored in Firebase RTDB after serialization)
export type YearToProgramMap = Map<string, Set<string>>;

export type ProgramsMap = Map<string, Program>;

export interface Program {
  name: string;
  usedBandGroupIds: Set<string>;
  reCaptureIds: Set<string>;
}

export type BandGroupToCaptureIdsMap = Map<string, Set<string>>;

export type BandIdToCaptureIdsMap = Map<string, Set<string>>;

export type CapturesMap = Map<string, Capture>;

export interface Capture {
  // generated
  id: string;
  bandGroup: string;
  bandLastTwoDigits: string;
  bandId: string;
  // --------------

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

  // to implement later
  //   disposition?: string;
  //   location?: string;
  //   birdStatus?: string;
  //   presentCondition?: string;
  //   howObtainedCode?: string;
  //   d20?: string;
  //   d22?: string;
}

export const CaptureType = {
  Banded: "Banded",
  Alien: "Alien",
  Repeat: "Repeat",
  Return: "Return",
  None: "None",
};

export const NUMERIC_FIELDS = new Set(["WingChord", "Weight", "Fat"]);

export const HEADER_TO_CAPTURE_PROPERTY: Record<string, string> = {
  Program: "programId",

  BandPrefix: "bandPrefix",
  BandSuffix: "bandSuffix",

  Species: "species",
  WingChord: "wing",
  Age: "age",
  HowAged: "howAged",
  Sex: "sex",
  HowSexed: "howSexed",
  Fat: "fat",
  Weight: "weight",
  CaptureDate: "date",
  Bander: "bander",
  Scribe: "scribe",
  Net: "net",
  NotesForMBO: "notes",
  D18: "captureType",

  // to implement later
  //   Disposition: "disposition",
  //   Location: "location",
  //   BirdStatus: "birdStatus",
  //   PresentCondition: "presentCondition",
  //   HowObtainedCode: "howObtainedCode",
  //   D20: "d20",
  //   D22: "d22",
};
