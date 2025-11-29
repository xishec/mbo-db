import { Spinner, Tabs, Tab } from "@heroui/react";
import { onValue, ref } from "firebase/database";
import { useEffect, useMemo, useState } from "react";
import { db } from "../firebase";
import type { Program, ProgramsMap } from "../types/types";
import NewCaptures from "./NewCaptures";

export default function Captures({ selectedProgram }: { selectedProgram: string }) {
  const [programsMap, setProgramsMap] = useState<ProgramsMap>(new Map());
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const programsMapRef = ref(db, "programsMap");

    const unsubscribe = onValue(programsMapRef, (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.val();
        console.log(data);
        const newProgramsMap: ProgramsMap = new Map();
        for (const [name, programData] of Object.entries(data) as [
          string,
          { name: string; bandGroupIds: string[]; recaptureIds: string[] }
        ][]) {
          newProgramsMap.set(name, {
            name: programData.name,
            bandGroupIds: new Set(programData.bandGroupIds ?? []),
            recaptureIds: new Set(programData.recaptureIds ?? []),
          });
        }
        setProgramsMap(newProgramsMap);
      }
      setIsLoading(false);
    });
    return unsubscribe;
  }, []);

  const program: Program | undefined = useMemo(
    () => programsMap.get(selectedProgram ?? ""),
    [programsMap, selectedProgram]
  );

  if (!selectedProgram) {
    return null;
  }

  if (isLoading) {
    return (
      <div className="p-4 flex items-center gap-2">
        <Spinner size="sm" /> Loading captures...
      </div>
    );
  }

  return (
    <Tabs
      color="primary"
      classNames={{
        base: "w-full",
        tabList: "w-full",
        tabContent: "text-default-800",
        panel: "p-0",
      }}
    >
      <Tab key="new" title="New captures">
        <NewCaptures program={program!} />
      </Tab>
      <Tab key="re" title="Re captures">
        {/* <CapturesTable columns={inferColumns(reRows)} rows={reRows as any[]} ariaLabel="Re captures table" /> */}
      </Tab>
      <Tab key="summary" title="Summary">
        {/* <CapturesTable columns={inferColumns(summaryRows)} rows={summaryRows as any[]} ariaLabel="Summary table" /> */}
      </Tab>
    </Tabs>
  );
}
