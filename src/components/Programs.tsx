import {
  Select,
  SelectItem,
  Spinner,
  Table,
  TableBody,
  TableCell,
  TableColumn,
  TableHeader,
  TableRow,
} from "@heroui/react";
import { onValue, ref } from "firebase/database";
import { useEffect, useMemo, useState } from "react";
import { db } from "../firebase";
import type { YearsMap } from "../types/types";

export default function Programs() {
  const [selectedYear, setSelectedYear] = useState<string | "all">("all");
  const [selectedProgram, setSelectedProgram] = useState<Set<string>>(new Set());
  const [yearsMap, setYearsMap] = useState<YearsMap>(new Map());
  const [isLoading, setIsLoading] = useState(true);

  // Fetch yearsMap from RTDB
  useEffect(() => {
    const yearsRef = ref(db, "yearsMap");

    const unsubscribeYears = onValue(yearsRef, (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.val() as YearsMap;
        const newYearMap: YearsMap = new Map();
        for (const [year, yearData] of Object.entries(data)) {
          newYearMap.set(year, {
            id: yearData.id,
            programs: new Set(yearData.programs),
          });
        }
        setYearsMap(newYearMap);
      }
      setIsLoading(false);
    });

    return () => {
      unsubscribeYears();
    };
  }, []);

  // Get program names from yearsMap based on selected year
  const programNames = useMemo(() => {
    if (!yearsMap || yearsMap.size === 0) return [];
    if (selectedYear === "all") {
      const allPrograms = new Set<string>();
      for (const year of yearsMap.values()) {
        for (const programName of year.programs) {
          allPrograms.add(programName);
        }
      }
      return Array.from(allPrograms).sort();
    }
    const year = yearsMap.get(selectedYear);
    if (!year) return [];
    return Array.from(year.programs).sort();
  }, [yearsMap, selectedYear]);

  const yearOptions = useMemo(() => {
    const opts: JSX.Element[] = [<SelectItem key="all">All</SelectItem>];
    Array.from(yearsMap?.keys() || [])
      .sort((a, b) => Number(b) - Number(a))
      .forEach((y) => {
        opts.push(<SelectItem key={y}>{y}</SelectItem>);
      });
    return opts;
  }, [yearsMap]);

  const selectedProgramName = Array.from(selectedProgram)[0] || null;

  if (isLoading) {
    return (
      <div className="p-4 flex items-center gap-2">
        <Spinner size="sm" /> Loading programs...
      </div>
    );
  }

  if (!yearsMap || yearsMap.size === 0) {
    return <div className="p-4">No programs available.</div>;
  }

  return (
    <div className="h-full flex flex-col gap-6 w-full overflow-hidden">
      <div className="max-w-7xl w-full mx-auto px-8 flex flex-col gap-4">
        <Select
          labelPlacement="outside"
          label="Filter by Year"
          className="w-full max-w-[220px]"
          selectedKeys={selectedYear === "all" ? ["all"] : [selectedYear]}
          onSelectionChange={(keys) => {
            const first = Array.from(keys)[0];
            const next = first === "all" ? "all" : String(first);
            setSelectedYear(next);
          }}
          disallowEmptySelection
        >
          {yearOptions}
        </Select>

        <Table
          aria-label="Programs table"
          selectionMode="single"
          selectedKeys={selectedProgram}
          onSelectionChange={(keys) => setSelectedProgram(keys as Set<string>)}
          classNames={{
            wrapper: "max-h-[400px]",
          }}
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

      {selectedProgramName && (
        <div className="flex-1 min-h-0 overflow-hidden px-8">
          <p>Selected program: {selectedProgramName}</p>
        </div>
      )}
    </div>
  );
}
