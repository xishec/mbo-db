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
import Captures from "./Captures";
import { onValue, ref } from "firebase/database";
import { useEffect, useMemo, useState } from "react";
import { db } from "../firebase";
import type { YearsMap } from "../types/types";

export default function Programs() {
  const [selectedYear, setSelectedYear] = useState("all");
  const [selectedProgram, setSelectedProgram] = useState<string | null>(null);
  const [yearsMap, setYearsMap] = useState<YearsMap>(new Map());
  const [isLoading, setIsLoading] = useState(true);

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
      }
      setIsLoading(false);
    });
    return unsubscribe;
  }, []);

  // Year rows for the table
  const yearRows = useMemo(() => {
    return ["all", ...Array.from(yearsMap.keys()).sort((a, b) => Number(b) - Number(a))];
  }, [yearsMap]);

  // Get program names based on selected year
  const programNames = useMemo(() => {
    if (yearsMap.size === 0) return [];
    if (selectedYear === "all") {
      const allPrograms = new Set<string>();
      for (const year of yearsMap.values()) {
        year.programs.forEach((p) => allPrograms.add(p));
      }
      return Array.from(allPrograms).sort();
    }
    return Array.from(yearsMap.get(selectedYear)?.programs ?? []).sort();
  }, [yearsMap, selectedYear]);

  const handleYearChange = (keys: "all" | Set<React.Key>) => {
    const newYear = keys === "all" ? "all" : String(Array.from(keys)[0]);
    setSelectedYear(newYear);

    // Reset program if it doesn't exist in new year
    if (selectedProgram) {
      const programs =
        newYear === "all"
          ? Array.from(yearsMap.values()).flatMap((y) => Array.from(y.programs))
          : Array.from(yearsMap.get(newYear)?.programs ?? []);
      if (!programs.includes(selectedProgram)) {
        setSelectedProgram(null);
      }
    }
  };

  const handleProgramChange = (keys: "all" | Set<React.Key>) => {
    const selected = keys === "all" ? null : String(Array.from(keys)[0]) || null;
    setSelectedProgram(selected);
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
    <div className="max-w-6xl h-full w-full flex flex-col mx-auto p-8 gap-6">
      <Breadcrumbs className="col-span-2">
        <BreadcrumbItem
          onPress={() => {
            setSelectedYear("all");
            setSelectedProgram(null);
          }}
        >
          Programs
        </BreadcrumbItem>
        <BreadcrumbItem onPress={() => setSelectedProgram(null)}>
          {selectedYear === "all" ? "All Years" : selectedYear}
        </BreadcrumbItem>
        {selectedProgram && <BreadcrumbItem isCurrent>{selectedProgram}</BreadcrumbItem>}
      </Breadcrumbs>

      {!selectedProgram && (
        <div className="grid grid-cols-[1fr_2fr] gap-6">
          <Table
            isHeaderSticky
            aria-label="Years table"
            selectionMode="single"
            selectedKeys={new Set([selectedYear])}
            onSelectionChange={handleYearChange}
            disallowEmptySelection
            isVirtualized
            maxTableHeight={600}
          >
            <TableHeader>
              <TableColumn>Year</TableColumn>
            </TableHeader>
            <TableBody>
              {yearRows.map((year) => (
                <TableRow key={year}>
                  <TableCell>{year === "all" ? "All" : year}</TableCell>
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
          >
            <TableHeader>
              <TableColumn>Program Name</TableColumn>
            </TableHeader>
            <TableBody emptyContent="No programs found">
              {programNames.map((name) => (
                <TableRow key={name}>
                  <TableCell>{name}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {selectedProgram && <Captures selectedProgram={selectedProgram} />}
    </div>
  );
}
