import { useEffect, useState } from "react";
import { Button, Card, CardBody, CardHeader, Select, SelectItem } from "@heroui/react";
import { ArrowRightIcon, PlusIcon } from "@heroicons/react/24/outline";

export interface DETProgramOption {
  programId: string;
  displayName: string;
  detProgramKey?: string;
}

interface DETProgramChooserProps {
  date: string;
  programs: DETProgramOption[];
  canAdd: boolean;
  onAdd: (programId: string) => void;
  onView: (storageKey: string) => void;
}

export default function DETProgramChooser({ date, programs, canAdd, onAdd, onView }: DETProgramChooserProps) {
  const [selectedProgramId, setSelectedProgramId] = useState("");
  const selectedProgram = programs.find((program) => program.programId === selectedProgramId);
  const hasDET = Boolean(selectedProgram?.detProgramKey);

  useEffect(() => {
    setSelectedProgramId("");
  }, [date]);

  const handleAction = () => {
    if (!selectedProgram) return;
    if (selectedProgram.detProgramKey) onView(selectedProgram.detProgramKey);
    else onAdd(selectedProgram.programId);
  };

  return (
    <Card shadow="sm">
      <CardHeader className="flex-col items-start gap-1 px-6 pt-6">
        <p className="text-xl font-semibold">Programs for {date}</p>
        <p className="text-sm text-default-500">Choose a program from this year or the previous year.</p>
      </CardHeader>
      <CardBody className="px-6 pb-6">
        {programs.length > 0 ? (
          <div className="flex items-end gap-3">
            <Select
              className="min-w-0 flex-1"
              aria-label="Program"
              placeholder="Select a program"
              size="md"
              variant="bordered"
              classNames={{ trigger: "h-10 min-h-10" }}
              selectedKeys={selectedProgramId ? [selectedProgramId] : []}
              onSelectionChange={(keys) => {
                const selected = Array.from(keys)[0];
                setSelectedProgramId(selected ? String(selected) : "");
              }}
            >
              {programs.map((program) => (
                <SelectItem
                  key={program.programId}
                  textValue={program.displayName}
                  description={program.displayName !== program.programId ? program.displayName : undefined}
                  endContent={program.detProgramKey ? <span className="text-xs text-success">DET added</span> : null}
                >
                  {program.programId}
                </SelectItem>
              ))}
            </Select>
            <Button
              className="shrink-0"
              color="secondary"
              size="md"
              startContent={hasDET ? <ArrowRightIcon className="h-4 w-4" /> : <PlusIcon className="h-4 w-4" />}
              isDisabled={!selectedProgram || (!hasDET && !canAdd)}
              onPress={handleAction}
            >
              {hasDET ? "View DET" : "Add DET"}
            </Button>
          </div>
        ) : (
          <div className="rounded-medium border border-dashed border-default-200 p-6 text-center text-default-500">
            No programs were found for this year or the previous year.
          </div>
        )}
      </CardBody>
    </Card>
  );
}
