import {
  Autocomplete,
  AutocompleteItem,
  Button,
  Select,
  SelectItem,
  Spinner,
  useDisclosure,
} from "@heroui/react";
import { onValue, ref } from "firebase/database";
import { useEffect, useMemo, useState } from "react";
import { db } from "../firebase";
import {
  CAPTURE_TYPE_OPTIONS,
  type Capture,
  type CaptureType,
  type CapturesMap,
  type Program,
  type ProgramsMap,
} from "../helper/helper";
import AddCaptureModal from "./AddCaptureModal";
import CapturesTable from "./CapturesTable";

export default function Captures({ selectedProgram }: { selectedProgram: string }) {
  const [programsMap, setProgramsMap] = useState<ProgramsMap>(new Map());
  const [isLoading, setIsLoading] = useState(true);
  const [captureType, setCaptureType] = useState<CaptureType>("NEW_CAPTURES");
  const [capturesMap, setCapturesMap] = useState<CapturesMap>(new Map());
  const [selectedBandGroupId, setSelectedBandGroupId] = useState<string>("All");
  const [isLoadingCaptures, setIsLoadingCaptures] = useState(true);
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

  // Get the relevant capture IDs based on capture type
  const captureIds = useMemo(() => {
    if (!program) return new Set<string>();
    return captureType === "NEW_CAPTURES" ? program.newCaptureIds : program.reCaptureIds;
  }, [program, captureType]);

  // Extract bandGroupId from captureId (captureId format: ${date}-${bandGroupId}${lastTwoDigits})
  const extractBandGroupId = (captureId: string): string => {
    const withoutDate = captureId.replace(/^\d{4}-\d{2}-\d{2}-/, "");
    return withoutDate.slice(0, -2);
  };

  // Compute unique band group IDs from captureIds
  const bandGroupIds = useMemo(() => {
    const bandGroupSet = new Set<string>();
    for (const captureId of captureIds) {
      bandGroupSet.add(extractBandGroupId(captureId));
    }
    return ["All", ...Array.from(bandGroupSet).sort()];
  }, [captureIds]);

  // Fetch captures from RTDB
  useEffect(() => {
    const captureIdArray = Array.from(captureIds);

    if (captureIdArray.length === 0) {
      setCapturesMap(new Map());
      setIsLoadingCaptures(false);
      return;
    }

    setIsLoadingCaptures(true);
    const newCapturesMap: CapturesMap = new Map();
    let loadedCount = 0;

    const unsubscribes = captureIdArray.map((captureId) => {
      const captureRef = ref(db, `capturesMap/${captureId}`);
      return onValue(captureRef, (snapshot) => {
        if (snapshot.exists()) {
          const rawCapture = snapshot.val() as Capture;
          newCapturesMap.set(captureId, rawCapture);
        }
        loadedCount++;
        if (loadedCount >= captureIdArray.length) {
          setCapturesMap(new Map(newCapturesMap));
          setIsLoadingCaptures(false);
        }
      });
    });

    return () => unsubscribes.forEach((unsubscribe) => unsubscribe());
  }, [captureIds]);

  // Reset band group selection when capture type changes
  useEffect(() => {
    setSelectedBandGroupId("All");
  }, [captureType]);

  // Get captures filtered by selected band group
  const captures = useMemo(() => {
    const allCaptures = Array.from(capturesMap.values());

    if (selectedBandGroupId === "All") {
      return allCaptures;
    }

    return allCaptures.filter((capture) => capture.bandGroupId === selectedBandGroupId);
  }, [capturesMap, selectedBandGroupId]);

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

          <Autocomplete
            labelPlacement="outside"
            variant="bordered"
            label="Select Band Group"
            placeholder="Search band groups..."
            selectedKey={selectedBandGroupId}
            onSelectionChange={(key) => setSelectedBandGroupId((key as string) ?? "All")}
          >
            {bandGroupIds.map((id) => (
              <AutocompleteItem key={id}>{id}</AutocompleteItem>
            ))}
          </Autocomplete>
        </div>
        <Button color="secondary" onPress={onOpen}>
          Add Capture
        </Button>
      </div>

      {isLoadingCaptures ? (
        <div className="p-4 flex items-center gap-2">
          <Spinner size="sm" /> Loading captures...
        </div>
      ) : (
        <CapturesTable captures={captures} />
      )}
    </div>
  );
}
