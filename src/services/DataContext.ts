import { createContext } from "react";
import type { DataContextType, ProgramData } from "../types";

export const defaultProgramData: ProgramData = {
  bandGroupToNewCaptures: {},
  reCaptures: [],
  isLoadingProgram: false,
  isLoadingCaptures: false,
  isLoadingReCaptures: false,
};

export const DataContext = createContext<DataContextType | null>(null);
