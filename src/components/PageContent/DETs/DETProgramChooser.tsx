import { Card, CardBody, CardHeader, Chip } from "@heroui/react";
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
  return (
    <Card shadow="sm">
      <CardHeader className="flex-col items-start gap-1 px-6 pt-6">
        <p className="text-xl font-semibold">Programs for {date}</p>
        <p className="text-sm text-default-500">Select a program to view its DET or add one.</p>
      </CardHeader>
      <CardBody className="gap-3 px-6 pb-6">
        {programs.length > 0 ? (
          programs.map((program) => {
            const hasDET = Boolean(program.detProgramKey);
            const isDisabled = !hasDET && !canAdd;
            return (
              <button
                key={program.programId}
                type="button"
                disabled={isDisabled}
                className="flex w-full items-center justify-between gap-4 rounded-medium border border-default-200 px-4 py-3 text-left transition-colors hover:border-secondary hover:bg-secondary-50 disabled:cursor-not-allowed disabled:opacity-50"
                onClick={() => {
                  if (program.detProgramKey) onView(program.detProgramKey);
                  else onAdd(program.programId);
                }}
              >
                <span className="min-w-0">
                  <span className="block font-semibold text-default-800">{program.programId}</span>
                  {program.displayName !== program.programId && (
                    <span className="block truncate text-sm text-default-500">{program.displayName}</span>
                  )}
                </span>
                <span className="flex shrink-0 items-center gap-3">
                  <Chip size="sm" color={hasDET ? "success" : "default"} variant="flat">
                    {hasDET ? "DET added" : "No DET"}
                  </Chip>
                  {hasDET ? (
                    <ArrowRightIcon className="h-5 w-5 text-default-500" />
                  ) : (
                    <PlusIcon className="h-5 w-5 text-default-500" />
                  )}
                </span>
              </button>
            );
          })
        ) : (
          <div className="rounded-medium border border-dashed border-default-200 p-6 text-center text-default-500">
            No programs with bird activity were found for this date.
          </div>
        )}
      </CardBody>
    </Card>
  );
}
