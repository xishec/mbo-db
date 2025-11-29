import { useContext } from "react";
import { ProgramDataContext } from "./ProgramDataContext";

export function useProgramData() {
  const context = useContext(ProgramDataContext);
  if (!context) {
    throw new Error("useProgramData must be used within a ProgramDataProvider");
  }
  return context;
}
