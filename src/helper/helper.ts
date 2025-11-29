export type YearsMap = Map<string, Year>;
export interface Year {
  id: string;
  programs: Set<string>;
}

export type ProgramsMap = Map<string, Program>;
export interface Program {
  name: string;
  bandGroupIds: Set<string>;
  reCaptureIds: Set<string>;
}

export type BandGroupsMap = Map<string, BandGroup>;
export interface BandGroup {
  id: string;
  captureIds: Set<string>;
}

export type CapturesMap = Map<string, Capture>;
export interface Capture {
  id: string;

  program: string;

  bandPrefix: string;
  bandSuffix: string;

  bandGroupId: string;
  bandLastTwoDigits: string;

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
export const generateBandGroupId = (capture: Capture): string => {
  return `${capture.bandPrefix}-${capture.bandSuffix.slice(0, -2)}`;
};
export const generateCaptureId = (capture: Capture): string => {
  return `${capture.date}-${capture.bandGroupId}${capture.bandLastTwoDigits}`;
};
export const generateCaptureTableId = (capture: Capture): string => {
  return `${capture.bandGroupId}${capture.bandLastTwoDigits}`;
};

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
