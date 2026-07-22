import {
  Breadcrumbs,
  BreadcrumbItem,
  Button,
  Spinner,
  Table,
  TableBody,
  TableCell,
  TableColumn,
  TableHeader,
  TableRow,
} from "@heroui/react";
import BirdEvents from "./Captures/BirdEvents";
import { useMemo, useState } from "react";
import { useAppStore, useActions, useIsLoggedIn } from "../../../stores/useAppStore";
import AddProgramModal from "../../Modals/AddProgramModal";
import StartBandingModal from "../../Modals/StartBandingModal";
import type { Program } from "../../../types";
import PageHeader from "../PageHeader";

export default function Programs() {
  const selectedProgram = useAppStore((s) => s.selectedProgram);
  const yearsToProgramMap = useAppStore((s) => s.yearsToProgramMap);
  const programsMap = useAppStore((s) => s.programsMap);
  const isLoading = useAppStore((s) => s.isLoading);
  const isLoggedIn = useIsLoggedIn();
  const { selectProgram } = useActions();
  const [isAddProgramModalOpen, setIsAddProgramModalOpen] = useState(false);
  const [isStartBandingModalOpen, setIsStartBandingModalOpen] = useState(false);

  // Year rows for the table (sorted descending)
  const yearRows = useMemo(() => {
    return Object.keys(yearsToProgramMap).sort((a, b) => Number(b) - Number(a));
  }, [yearsToProgramMap]);

  // Default to the most recent year
  const [selectedYear, setSelectedYear] = useState<string>("");
  const effectiveYear = selectedYear || yearRows[0] || "";

  // Get programs for selected year
  const programs = useMemo(() => {
    if (!effectiveYear || Object.keys(yearsToProgramMap).length === 0) return [];
    return yearsToProgramMap[effectiveYear] ?? [];
  }, [yearsToProgramMap, effectiveYear]);

  const handleYearChange = (keys: "all" | Set<React.Key>) => {
    const newYear = keys === "all" ? "" : String(Array.from(keys)[0]);
    setSelectedYear(newYear);
    selectProgram(null);
  };

  const handleProgramChange = (keys: "all" | Set<React.Key>) => {
    const selected = keys === "all" ? null : String(Array.from(keys)[0]) || null;
    selectProgram(selected ? programsMap[selected] : null);
  };

  if (isLoading) {
    return (
      <div className="p-4 flex items-center gap-4">
        <Spinner size="sm" /> Loading programs...
      </div>
    );
  }

  if (Object.keys(yearsToProgramMap).length === 0) {
    return <div className="p-4">No programs available.</div>;
  }

  const headerSubtitle = selectedProgram
    ? "Review captures and program details."
    : "Select a year and program to view captures.";

  return (
    <div
      className={`h-full w-full flex flex-col pt-4 p-8 gap-4 ${
        selectedProgram ? "" : "max-w-7xl mx-auto"
      }`}
    >
      {!selectedProgram && (
        <PageHeader
          title="Programs"
          subtitle={headerSubtitle}
          actions={
            isLoggedIn ? (
              <Button color="secondary" onPress={() => setIsAddProgramModalOpen(true)}>
                Add Program
              </Button>
            ) : null
          }
        />
      )}
      <div className="w-full flex justify-between items-center h-[40px]">
        <div className="flex items-center gap-2">
          <Breadcrumbs>
            <BreadcrumbItem
              onPress={() => {
                setSelectedYear("");
                selectProgram(null);
              }}
            >
              Years
            </BreadcrumbItem>
            {effectiveYear && <BreadcrumbItem onPress={() => selectProgram(null)}>{effectiveYear}</BreadcrumbItem>}
            {selectedProgram && (
              <BreadcrumbItem isCurrent>{selectedProgram.id}</BreadcrumbItem>
            )}
          </Breadcrumbs>
        </div>
        {selectedProgram && isLoggedIn && (
          <Button color="secondary" onPress={() => setIsStartBandingModalOpen(true)}>
            Start Banding
          </Button>
        )}
      </div>

      {!selectedProgram && (
        <div className="w-full grid grid-cols-[1fr_2fr] gap-4">
          <Table
            isHeaderSticky
            aria-label="Years table"
            selectionMode="single"
            selectedKeys={effectiveYear ? new Set([effectiveYear]) : new Set()}
            onSelectionChange={handleYearChange}
            isVirtualized
            maxTableHeight={600}
            color="secondary"
            classNames={{
              td: "data-[selected=true]:text-secondary-900 data-[selected=true]:font-bold",
            }}
          >
            <TableHeader>
              <TableColumn>Year</TableColumn>
            </TableHeader>
            <TableBody>
              {yearRows.map((year) => (
                <TableRow key={year}>
                  <TableCell>{year}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>

          <Table
            isHeaderSticky
            aria-label="Programs table"
            selectionMode="single"
            selectedKeys={selectedProgram ? new Set([(selectedProgram as Program).id]) : new Set()}
            onSelectionChange={handleProgramChange}
            isVirtualized
            maxTableHeight={600}
            color="secondary"
          >
            <TableHeader>
              <TableColumn width={300}>Program Name</TableColumn>
              <TableColumn>First Capture</TableColumn>
              <TableColumn>Last Capture</TableColumn>
            </TableHeader>
            <TableBody emptyContent={selectedYear ? "No programs found" : "Select a year"}>
              {[...programs]
                .sort((a, b) => a.localeCompare(b))
                .map((programId) => {
                  const program = programsMap[programId];
                  return (
                    <TableRow key={programId}>
                      <TableCell>{program?.id}</TableCell>
                      <TableCell>{program?.firstCaptureDate ?? ""}</TableCell>
                      <TableCell>{program?.lastCaptureDate ?? ""}</TableCell>
                    </TableRow>
                  );
                })}
            </TableBody>
          </Table>
        </div>
      )}

      {selectedProgram && <BirdEvents />}

      <AddProgramModal isOpen={isAddProgramModalOpen} onOpenChange={setIsAddProgramModalOpen} />
      <StartBandingModal isOpen={isStartBandingModalOpen} onOpenChange={setIsStartBandingModalOpen} />
    </div>
  );
}
