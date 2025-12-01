import { createContext } from "react";
import type { Capture } from "../helper/helper";

export interface SpeciesRange {
  fWeightLower: number;
  fWeightUpper: number;
  fWingLower: number;
  fWingUpper: number;
  mWeightLower: number;
  mWeightUpper: number;
  mWingLower: number;
  mWingUpper: number;
}

export interface MagicTable {
  pyle: Record<string, SpeciesRange>;
  mbo: Record<string, SpeciesRange>;
}

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

export const defaultProgramData: ProgramData = {
  bandGroupToNewCaptures: {},
  reCaptures: [],
  isLoadingProgram: false,
  isLoadingCaptures: false,
  isLoadingReCaptures: false,
};

export const DataContext = createContext<DataContextType | null>(null);
