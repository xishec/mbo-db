import { createContext } from "react";
import type { Capture } from "../helper/helper";

export interface ProgramData {
  bandGroupToNewCaptures: Map<string, Capture[]>;
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
  fetchAllCaptures: () => Promise<Capture[]>;
}

export const defaultProgramData: ProgramData = {
  bandGroupToNewCaptures: new Map(),
  reCaptures: [],
  isLoadingProgram: false,
  isLoadingCaptures: false,
  isLoadingReCaptures: false,
};

export const DataContext = createContext<DataContextType | null>(null);
