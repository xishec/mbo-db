export type YearsMap = Map<string, Year>;
export interface Year {
  id: string;
  programs: Set<string>;
}

export type ProgramsMap = Map<string, Program>;
export interface Program {
  name: string;
  bandGroupIds: Set<string>;
  recaptureIds: Set<string>;
}

export type BandGroupsMap = Map<string, BandGroup>;
export interface BandGroup {
  id: string;
  captureIds: Set<string>;
}
export const generateBandGroupId = (bandGroupPrefix: string, bandGroupSuffix: string): string => {
  return `${bandGroupPrefix}-${bandGroupSuffix.slice(0, -2)}01`;
};

export type CapturesMap = Map<string, Capture>;
export interface Capture {
  id: string;

  program: string;

  bandPrefix: string;
  bandSuffix: string;
  lastTwoDigits: string;

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

  // to implement later
  //   disposition?: string;
  //   location?: string;
  //   birdStatus?: string;
  //   presentCondition?: string;
  //   howObtainedCode?: string;
  //   d18?: string;
  //   d20?: string;
  //   d22?: string;
}
export const generateCaptureId = (bandPrefix: string, bandSuffix: string, date: string): string => {
  return `${bandPrefix}-${bandSuffix}-${date}`;
};
