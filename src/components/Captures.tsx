import { Spinner, Tabs, Tab } from "@heroui/react";
import { onValue, ref } from "firebase/database";
import { useEffect, useMemo, useState } from "react";
import { db } from "../firebase";
import CapturesTable from "./CapturesTable";
import type { ProgramsMap } from "../types/types";

export default function Captures({ selectedProgram }: { selectedProgram: string | null }) {
  const [programMap, setProgramMap] = useState<ProgramsMap>(new Map());
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    const programRef = ref(db, "programsMap");
    const unsubscribe = onValue(programRef, (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.val();
        const newProgramMap: ProgramsMap = new Map();
        for (const [name, programData] of Object.entries(data) as [
          string,
          { name: string; bandGroupIds: string[]; recaptureIds: string[] }
        ][]) {
          newProgramMap.set(name, {
            name: programData.name,
            bandGroupIds: new Set(programData.bandGroupIds ?? []),
            recaptureIds: new Set(programData.recaptureIds ?? []),
          });
        }
        setProgramMap(newProgramMap);
      }
      setIsLoading(false);
    });
    return unsubscribe;
  }, [selectedProgram]);

  const programData = useMemo(() => programMap.get(selectedProgram ?? ""), [programMap, selectedProgram]);

  const newRows = useMemo(
    () => (programData ? Array.from(programData.bandGroupIds).map((id) => ({ id })) : []),
    [programData]
  );
  const reRows = useMemo(
    () => (programData ? Array.from(programData.recaptureIds).map((id) => ({ id })) : []),
    [programData]
  );
  const summaryRows = useMemo(
    () =>
      programData
        ? [
            {
              name: programData.name,
              bandGroups: programData.bandGroupIds.size,
              recaptures: programData.recaptureIds.size,
            },
          ]
        : [],
    [programData]
  );

  const inferColumns = (rows: Array<Record<string, unknown>>) => {
    if (!rows.length) return [] as string[];
    const keys = Object.keys(rows[0]);
    return keys;
  };

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
        <CapturesTable columns={inferColumns(newRows)} rows={newRows as any[]} ariaLabel="New captures table" />
      </Tab>
      <Tab key="re" title="Re captures">
        <CapturesTable columns={inferColumns(reRows)} rows={reRows as any[]} ariaLabel="Re captures table" />
      </Tab>
      <Tab key="summary" title="Summary">
        <CapturesTable columns={inferColumns(summaryRows)} rows={summaryRows as any[]} ariaLabel="Summary table" />
      </Tab>
    </Tabs>
  );
}
