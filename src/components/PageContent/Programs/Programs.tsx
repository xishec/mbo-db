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
import { useData } from "../../../services/useData";
import AddProgramModal from "../../Modals/AddProgramModal";

export default function Programs() {
  const { selectProgram, selectedProgram, yearsToProgramMap, isLoading } = useData();
  const [isAddProgramModalOpen, setIsAddProgramModalOpen] = useState(false);

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
    selectProgram(selected);
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

  return (
    <div className="h-full w-full flex flex-col items-center pt-4 p-8 gap-4">
      <div className="w-full flex justify-between items-center">
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
          {selectedProgram && <BreadcrumbItem isCurrent>{selectedProgram}</BreadcrumbItem>}
        </Breadcrumbs>
        <Button color="primary" onPress={() => setIsAddProgramModalOpen(true)}>
          Add Program
        </Button>
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
            selectedKeys={selectedProgram ? new Set([selectedProgram]) : new Set()}
            onSelectionChange={handleProgramChange}
            isVirtualized
            maxTableHeight={600}
            color="secondary"
          >
            <TableHeader>
              <TableColumn>Program Name</TableColumn>
            </TableHeader>
            <TableBody emptyContent={selectedYear ? "No programs found" : "Select a year"}>
              {[...programs]
                .sort((a, b) => a.localeCompare(b))
                .map((name) => (
                  <TableRow key={name}>
                    <TableCell>{name}</TableCell>
                  </TableRow>
                ))}
            </TableBody>
          </Table>
        </div>
      )}

      {selectedProgram && <BirdEvents />}
      
      <AddProgramModal
        isOpen={isAddProgramModalOpen}
        onOpenChange={setIsAddProgramModalOpen}
      />
    </div>
  );
}
