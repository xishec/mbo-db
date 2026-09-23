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
  const availablePrograms = programs.filter((program) => !program.detProgramKey);
  const addedPrograms = programs.filter((program) => program.detProgramKey);
  const selectedProgram = availablePrograms.find((program) => program.programId === selectedProgramId);

  useEffect(() => {
    setSelectedProgramId("");
  }, [date]);

  const handleAction = () => {
    if (!selectedProgram) return;
    onAdd(selectedProgram.programId);
  };

  return (
    <Card shadow="sm">
      <CardHeader className="flex-col items-start gap-1 px-6 pt-6">
        <p className="text-xl font-semibold">Programs for {date}</p>
        <p className="text-sm text-default-500">Choose a program from this year or the previous year.</p>
      </CardHeader>
      <CardBody className="gap-4 px-6 pb-6">
        {programs.length > 0 ? (
          <>
            <div className="flex items-end gap-3">
              <Select
                className="min-w-0 flex-1"
                aria-label="Program"
                placeholder={availablePrograms.length > 0 ? "Select a program" : "All programs have a DET"}
                size="md"
                variant="bordered"
                classNames={{ trigger: "h-10 min-h-10" }}
                isDisabled={availablePrograms.length === 0}
                selectedKeys={selectedProgramId ? [selectedProgramId] : []}
                onSelectionChange={(keys) => {
                  const selected = Array.from(keys)[0];
                  setSelectedProgramId(selected ? String(selected) : "");
                }}
              >
                {availablePrograms.map((program) => (
                  <SelectItem
                    key={program.programId}
                    textValue={program.displayName}
                    description={program.displayName !== program.programId ? program.displayName : undefined}
                  >
                    {program.programId}
                  </SelectItem>
                ))}
              </Select>
              <Button
                className="shrink-0"
                color="secondary"
                size="md"
                startContent={<PlusIcon className="h-4 w-4" />}
                isDisabled={!selectedProgram || !canAdd}
                onPress={handleAction}
              >
                Add DET
              </Button>
            </div>

            {addedPrograms.length > 0 && (
              <div className="space-y-2 border-t border-default-200 pt-4">
                <p className="text-sm font-medium text-default-600">Added DETs</p>
                <div className="space-y-2">
                  {addedPrograms.map((program) => (
                    <button
                      key={program.programId}
                      type="button"
                      className="flex h-10 min-h-10 w-full items-center justify-between rounded-medium border-medium border-default-200 px-3 text-left text-small transition-colors hover:border-default-400"
                      onClick={() => program.detProgramKey && onView(program.detProgramKey)}
                    >
                      <span className="font-medium text-default-700">{program.programId}</span>
                      <ArrowRightIcon className="h-4 w-4 text-default-500" />
                    </button>
                  ))}
                </div>
              </div>
            )}
          </>
        ) : (
          <div className="rounded-medium border border-dashed border-default-200 p-6 text-center text-default-500">
            No programs were found for this year or the previous year.
          </div>
        )}
      </CardBody>
    </Card>
  );
}
