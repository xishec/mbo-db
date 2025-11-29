import {
  Breadcrumbs,
  BreadcrumbItem,
  Spinner,
  Table,
  TableBody,
  TableCell,
  TableColumn,
  TableHeader,
  TableRow,
} from "@heroui/react";
import Captures from "./Captures/Captures";
import { onValue, ref } from "firebase/database";
import { useEffect, useMemo, useState } from "react";
import { db } from "../../../firebase";
import type { YearsMap } from "../../../helper/helper";
import { useProgramData } from "../../../services/useProgramData";

export default function Programs() {
  const [selectedYear, setSelectedYear] = useState<string>("");
  const [yearsMap, setYearsMap] = useState<YearsMap>(new Map());
  const [isLoading, setIsLoading] = useState(true);

  const { selectProgram, selectedProgram } = useProgramData();

  // Fetch yearsMap from RTDB
  useEffect(() => {
    const yearsRef = ref(db, "yearsMap");
    const unsubscribe = onValue(yearsRef, (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.val();
        const newYearMap: YearsMap = new Map();
        for (const [year, yearData] of Object.entries(data) as [string, { id: string; programs: string[] }][]) {
          newYearMap.set(year, {
            id: yearData.id,
            programs: new Set(yearData.programs),
          });
        }
        setYearsMap(newYearMap);

        // Select the most recent year by default
        const years = Array.from(newYearMap.keys()).sort((a, b) => Number(b) - Number(a));
        if (years.length > 0 && !selectedYear) {
          setSelectedYear(years[0]);
        }
      }
      setIsLoading(false);
    });
    return unsubscribe;
  }, [selectedYear]);

  // Year rows for the table
  const yearRows = useMemo(() => {
    return Array.from(yearsMap.keys()).sort((a, b) => Number(b) - Number(a));
  }, [yearsMap]);

  // Get programs for selected year
  const programs = useMemo(() => {
    if (!selectedYear || yearsMap.size === 0) return new Set<string>();
    return yearsMap.get(selectedYear)?.programs ?? new Set<string>();
  }, [yearsMap, selectedYear]);

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
      <div className="p-4 flex items-center gap-2">
        <Spinner size="sm" /> Loading programs...
      </div>
    );
  }

  if (yearsMap.size === 0) {
    return <div className="p-4">No programs available.</div>;
  }

  return (
    <div className="h-full w-full flex flex-col items-center pt-4 p-8 gap-4">
      <div className="w-full">
        <Breadcrumbs>
          <BreadcrumbItem
            onPress={() => {
              setSelectedYear("");
              selectProgram(null);
            }}
          >
            Years
          </BreadcrumbItem>
          {selectedYear && <BreadcrumbItem onPress={() => selectProgram(null)}>{selectedYear}</BreadcrumbItem>}
          {selectedProgram && <BreadcrumbItem isCurrent>{selectedProgram}</BreadcrumbItem>}
        </Breadcrumbs>
      </div>

      {!selectedProgram && (
        <div className="w-full grid grid-cols-[1fr_2fr] gap-4">
          <Table
            isHeaderSticky
            aria-label="Years table"
            selectionMode="single"
            selectedKeys={selectedYear ? new Set([selectedYear]) : new Set()}
            onSelectionChange={handleYearChange}
            isVirtualized
            maxTableHeight={600}
            color="primary"
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
            color="primary"
          >
            <TableHeader>
              <TableColumn>Program Name</TableColumn>
            </TableHeader>
            <TableBody emptyContent={selectedYear ? "No programs found" : "Select a year"}>
              {Array.from(programs)
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

      {selectedProgram && <Captures />}
    </div>
  );
}
