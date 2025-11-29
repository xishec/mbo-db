import { Button, Select, SelectItem, Spinner, useDisclosure } from "@heroui/react";
import { onValue, ref } from "firebase/database";
import { useEffect, useMemo, useState } from "react";
import { db } from "../firebase";
import { CAPTURE_TYPE_OPTIONS, type CaptureType, type Program, type ProgramsMap } from "../helper/helper";
import AddCaptureModal from "./AddCaptureModal";
import CapturesTable from "./CapturesTable";

export default function Captures({ selectedProgram }: { selectedProgram: string }) {
  const [programsMap, setProgramsMap] = useState<ProgramsMap>(new Map());
  const [isLoading, setIsLoading] = useState(true);
  const [captureType, setCaptureType] = useState<CaptureType>("NEW_CAPTURES");
  const { isOpen, onOpen, onOpenChange } = useDisclosure();

  // Fetch programs map
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
              bandGroupIds: new Set(program.bandGroupIds ?? []),
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
      <AddCaptureModal isOpen={isOpen} onOpenChange={onOpenChange} />

      <div className="w-full max-w-6xl flex items-end justify-between gap-4">
        <div className="flex items-end gap-4">
          <Select
            label="Capture Type"
            labelPlacement="outside"
            variant="bordered"
            selectedKeys={[captureType]}
            onSelectionChange={(keys) => {
              const selected = Array.from(keys)[0] as CaptureType;
              if (selected) setCaptureType(selected);
            }}
          >
            {CAPTURE_TYPE_OPTIONS.map((option) => (
              <SelectItem key={option.key}>{option.label}</SelectItem>
            ))}
          </Select>
        </div>
        <Button color="secondary" onPress={onOpen}>
          Add Capture
        </Button>
      </div>

      
      
      <CapturesTable
        bandGroupIds={program?.bandGroupIds ?? new Set()}
        reCaptureIds={program?.reCaptureIds ?? new Set()}
        captureType={captureType}
      />
    </div>
  );
}
