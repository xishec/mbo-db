export type YearsMap = Map<string, Year>;
export interface Year {
  id: string;
  programs: Set<string>;
}

export type ProgramsMap = Map<string, Program>;
export interface Program {
  name: string;
  newCaptureIds: Set<string>;
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
