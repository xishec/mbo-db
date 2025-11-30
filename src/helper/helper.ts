// Database structure types (as stored in Firebase RTDB after serialization)
export type YearToProgramMap = Map<string, Set<string>>;

export type ProgramToCaptureIdsMap = Map<string, Set<string>>;

export type BandIdToCaptureIdsMap = Map<string, Set<string>>;

export type CaptureIdToCaptureMap = Map<string, Capture>;

export interface Capture {
  // generated
  id: string;
  bandGroupId: string;
  bandLastTwoDigits: string;
  bandId: string;
  // --------------

  program: string;

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
  status: string;

  // to implement later
  //   disposition?: string;
  //   location?: string;
  //   birdStatus?: string;
  //   presentCondition?: string;
  //   howObtainedCode?: string;
  //   d20?: string;
  //   d22?: string;
}

export const NUMERIC_FIELDS = new Set(["WingChord", "Weight", "Fat"]);

export const HEADER_TO_CAPTURE_PROPERTY: Record<string, string> = {
  Program: "program",

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
  D18: "status",

  // to implement later
  //   Disposition: "disposition",
  //   Location: "location",
  //   BirdStatus: "birdStatus",
  //   PresentCondition: "presentCondition",
  //   HowObtainedCode: "howObtainedCode",
  //   D20: "d20",
  //   D22: "d22",
};

export type CaptureType = "NEW_CAPTURES" | "RE_CAPTURES";

export const CAPTURE_TYPE_OPTIONS: { key: CaptureType; label: string }[] = [
  { key: "NEW_CAPTURES", label: "New Captures" },
  { key: "RE_CAPTURES", label: "Re Captures" },
];
