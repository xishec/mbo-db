export interface CaptureFormData {
  program: string;
  bandGroup: string;
  bandLastTwoDigits: string;
  species: string;
  wing: string;
  age: string;
  sex: string;
  fat: string;
  weight: string;
  date: string;
  time: string;
  bander: string;
  scribe: string;
  net: string;
  notes: string;
}

export interface CaptureColumn {
  key: keyof CaptureFormData;
  label: string;
  type?: string;
  className?: string;
  maxLength?: number;
  minLength?: number;
}

export const CAPTURE_COLUMNS: CaptureColumn[] = [
  { key: "program", label: "Program", className: "min-w-[150px]" },
  { key: "bandGroup", label: "Band Group", maxLength: 8, minLength: 8 },
  { key: "bandLastTwoDigits", label: "Band", maxLength: 2, minLength: 2 },
  { key: "species", label: "Species", maxLength: 4, minLength: 4 },
  { key: "wing", label: "Wing", className: "min-w-[60px]", minLength: 1 },
  { key: "age", label: "Age", className: "min-w-[60px]", maxLength: 3, minLength: 3 },
  { key: "sex", label: "Sex", className: "min-w-[60px]", maxLength: 3, minLength: 3 },
  { key: "fat", label: "Fat", maxLength: 1, minLength: 1 },
  { key: "weight", label: "Weight", minLength: 1 },
  { key: "date", label: "Date", type: "date" },
  { key: "time", label: "Time", type: "time" },
  { key: "bander", label: "Bander", maxLength: 3, minLength: 3 },
  { key: "scribe", label: "Scribe", maxLength: 3, minLength: 3 },
  { key: "net", label: "Net", maxLength: 2, minLength: 2 },
  { key: "notes", label: "Notes", className: "min-w-[150px]" },
];
