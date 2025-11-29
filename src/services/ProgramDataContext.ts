import { createContext } from "react";
import type { BandGroupsMap, Capture, Program } from "../helper/helper";

export interface ProgramData {
  program: Program | null;
  // All captures for all bandGroups in the program (keyed by bandGroupId)
  capturesByBandGroup: Map<string, Capture[]>;
  // All recaptures for the program
  reCaptures: Capture[];
  isLoadingProgram: boolean;
  isLoadingCaptures: boolean;
  isLoadingReCaptures: boolean;
}

export interface ProgramDataContextType {
  bandGroupsMap: BandGroupsMap;
  isLoadingBandGroups: boolean;
  programData: ProgramData;
  selectProgram: (programName: string | null) => void;
  selectedProgram: string | null;
}

export const defaultProgramData: ProgramData = {
  program: null,
  capturesByBandGroup: new Map(),
  reCaptures: [],
  isLoadingProgram: false,
  isLoadingCaptures: false,
  isLoadingReCaptures: false,
};

export const ProgramDataContext = createContext<ProgramDataContextType | null>(null);
