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
        const rawProgramsMap = snapshot.val() as ProgramsMap;
        const newProgramsMap: ProgramsMap = new Map(
          Object.entries(rawProgramsMap).map(([name, program]) => [
            name,
            {
              name: name,
              newCaptureIds: new Set(program.newCaptureIds ?? []),
              reCaptureIds: new Set(program.reCaptureIds ?? []),
            },
          ])
        );
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
    <div className="w-full flex flex-col items-center gap-4">
      <Tabs
        color="default"
        classNames={{
          base: "w-full max-w-6xl",
          tabList: "w-full",
          tabContent: "text-default-800",
          panel: "px-8 py-0 w-screen ",
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
    </div>
  );
}
