import { Select, SelectItem, Spinner } from "@heroui/react";
import { onValue, ref } from "firebase/database";
import { useEffect, useMemo, useState } from "react";
import { db } from "../firebase";
import type { YearsMap } from "../types/types";

export default function Captures() {
  const [selectedYear, setSelectedYear] = useState<string | "all">("all");
  const [selectedProgram, setSelectedProgram] = useState<string | null>(null);
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
        console.log("yearsMap loaded:", snapshot.val() as YearsMap);
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
      // Collect all unique program names across all years
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

  // Get selected program - the Year type only stores program names, not bandIds
  // BandIds would need to be fetched separately based on program selection
  const selectedProgramExists = useMemo(() => {
    if (!yearsMap || !selectedProgram) return false;
    const yearsToSearch =
      selectedYear === "all" ? Array.from(yearsMap.values()) : [yearsMap.get(selectedYear)].filter(Boolean);
    return yearsToSearch.some((year) => year?.programs.has(selectedProgram));
  }, [yearsMap, selectedProgram, selectedYear]);

  const yearOptions = useMemo(() => {
    const opts: JSX.Element[] = [<SelectItem key="all">All</SelectItem>];
    Array.from(yearsMap?.keys() || [])
      .sort((a, b) => Number(b) - Number(a))
      .forEach((y) => {
        opts.push(<SelectItem key={y}>{y}</SelectItem>);
      });
    return opts;
  }, [yearsMap]);

  if (isLoading) {
    return (
      <div className="p-4 flex items-center gap-2">
        <Spinner size="sm" /> Loading programs...
      </div>
    );
  }

  if (!yearsMap || programNames.length === 0) {
    return <div className="p-4">No programs available.</div>;
  }

  return (
    <div className="h-full flex flex-col gap-6 w-full overflow-hidden">
      <div className="max-w-7xl w-full mx-auto px-8 flex items-center gap-4">
        <Select
          labelPlacement="outside"
          label="Years"
          className="w-full max-w-[220px]"
          selectedKeys={selectedYear === "all" ? ["all"] : [selectedYear]}
          onSelectionChange={(keys) => {
            const first = Array.from(keys)[0];
            const next = first === "all" ? "all" : String(first);
            setSelectedYear(next);
            // Reset selected program if it becomes invalid under new year
            if (selectedProgram && !programNames.includes(selectedProgram)) {
              setSelectedProgram(null);
            }
          }}
          disallowEmptySelection
        >
          {yearOptions}
        </Select>
        <Select
          labelPlacement="outside"
          label="Programs"
          placeholder="Select a program"
          className="w-full"
          selectedKeys={selectedProgram ? [selectedProgram] : []}
          onSelectionChange={(keys) => {
            const first = Array.from(keys)[0];
            setSelectedProgram(first ? String(first) : null);
          }}
          disallowEmptySelection
        >
          {programNames.map((name) => (
            <SelectItem key={name}>{name}</SelectItem>
          ))}
        </Select>
      </div>

      {selectedProgram && selectedProgramExists && (
        <div className="flex-1 min-h-0 overflow-hidden">
          {/* <BandsTable selectedProgram={selectedProgram} /> */}
          <p>Selected program: {selectedProgram}</p>
        </div>
      )}
    </div>
  );
}

// function BandsTable({ selectedProgram, bandIds }: { selectedProgram: string; bandIds: string[] }) {
//   const [bandCaptures, setBandCaptures] = useState<Map<string, Capture[]>>(new Map());
//   const [isLoading, setIsLoading] = useState(false);
//   const [error, setError] = useState<string | null>(null);
//   const [sortDescriptor, setSortDescriptor] = useState<SortDescriptor>({
//     column: 'bandId',
//     direction: 'ascending',
//   });
//   interface AdvancedFilter {
//     id: string;
//     column: string;
//     operator: string;
//     value: string;
//   }
//   const [filters, setFilters] = useState<AdvancedFilter[]>([]);
//   const [draftColumn, setDraftColumn] = useState<string | null>(null);
//   const [draftOperator, setDraftOperator] = useState<string | null>(null);
//   const [draftValue, setDraftValue] = useState<string>('');
//   const cacheRef = useRef<Map<string, Capture[]>>(new Map());

//   useEffect(() => {
//     setBandCaptures(new Map());
//     setError(null);
//     cacheRef.current = new Map();
//     if (bandIds.length === 0) return;
//     let cancelled = false;
//     (async () => {
//       setIsLoading(true);
//       try {
//         const next = new Map<string, Capture[]>();
//         const concurrency = 25;
//         let idx = 0;
//         const fetchOne = async (bandId: string) => {
//           const snap = await get(ref(db, `bands/${bandId}`));
//           if (snap.exists()) {
//             const captures = snap.val() as Capture[];
//             next.set(bandId, captures);
//             cacheRef.current.set(bandId, captures);
//           } else {
//             next.set(bandId, []);
//             cacheRef.current.set(bandId, []);
//           }
//         };
//         const tasks: Promise<void>[] = [];
//         while (idx < bandIds.length) {
//           const chunk = bandIds.slice(idx, idx + concurrency);
//           tasks.push(Promise.all(chunk.map((id) => fetchOne(id))).then(() => {}));
//           idx += concurrency;
//         }
//         await Promise.all(tasks);
//         if (!cancelled) setBandCaptures(next);
//       } catch (e) {
//         if (!cancelled) setError((e as Error).message);
//       } finally {
//         if (!cancelled) setIsLoading(false);
//       }
//     })();
//     return () => {
//       cancelled = true;
//     };
//   }, [bandIds]);

//   // Flatten all captures rows
//   const allCaptureRows = useMemo(() => {
//     const rows: Array<Capture & { key: string; bandId: string }> = [];
//     for (const [bandId, captures] of bandCaptures.entries()) {
//       captures.forEach((capture, idx) => {
//         const prog = capture.Program ? capture.Program.trim() : undefined;
//         if (prog === selectedProgram) {
//           rows.push({ ...capture, key: `${bandId}-${idx}`, bandId });
//         }
//       });
//     }
//     return rows;
//   }, [bandCaptures, selectedProgram]);

//   interface RowItem extends Capture {
//     key: string;
//     bandId: string;
//   }

//   // Operators
//   const baseOperators = [
//     { key: 'eq', label: '=' },
//     { key: 'neq', label: '≠' },
//     { key: 'contains', label: 'contains' },
//     { key: 'starts', label: 'starts' },
//     { key: 'ends', label: 'ends' },
//     { key: 'gt', label: '>' },
//     { key: 'gte', label: '>=' },
//     { key: 'lt', label: '<' },
//     { key: 'lte', label: '<=' },
//     { key: 'exists', label: 'exists' },
//     { key: 'notexists', label: 'not exists' },
//   ];

//   const evaluateFilter = useCallback((row: RowItem, f: AdvancedFilter): boolean => {
//     const rawVal = (row as unknown as { [key: string]: unknown })[f.column];
//     const valStr = rawVal === undefined || rawVal === null ? '' : String(rawVal);
//     switch (f.operator) {
//       case 'exists':
//         return valStr !== '';
//       case 'notexists':
//         return valStr === '';
//       case 'eq':
//         return valStr === f.value;
//       case 'neq':
//         return valStr !== f.value;
//       case 'contains':
//         return valStr.toLowerCase().includes(f.value.toLowerCase());
//       case 'starts':
//         return valStr.toLowerCase().startsWith(f.value.toLowerCase());
//       case 'ends':
//         return valStr.toLowerCase().endsWith(f.value.toLowerCase());
//       case 'gt':
//       case 'gte':
//       case 'lt':
//       case 'lte': {
//         const numVal = Number(valStr);
//         const numFilter = Number(f.value);
//         if (Number.isNaN(numVal) || Number.isNaN(numFilter)) return false;
//         if (f.operator === 'gt') return numVal > numFilter;
//         if (f.operator === 'gte') return numVal >= numFilter;
//         if (f.operator === 'lt') return numVal < numFilter;
//         if (f.operator === 'lte') return numVal <= numFilter;
//         return false;
//       }
//       default:
//         return true;
//     }
//   }, []);
//   const sortedRows = useMemo(() => {
//     // Start from all capture rows for current program
//     let base: RowItem[] = allCaptureRows as RowItem[];
//     // Apply advanced filters if any
//     if (filters.length) {
//       base = base.filter((r) => filters.every((f) => evaluateFilter(r, f)));
//     }
//     const { column, direction } = sortDescriptor;
//     if (!column) return base;
//     const collator = new Intl.Collator(undefined, {
//       numeric: true,
//       sensitivity: 'base',
//     });
//     const rowsCopy = [...base];
//     rowsCopy.sort((a, b) => {
//       const aVal = (a as unknown as { [key: string]: unknown })[column as string];
//       const bVal = (b as unknown as { [key: string]: unknown })[column as string];
//       const aStr = aVal == null ? '' : String(aVal);
//       const bStr = bVal == null ? '' : String(bVal);
//       const cmp = collator.compare(aStr, bStr);
//       return direction === 'descending' ? -cmp : cmp;
//     });
//     return rowsCopy;
//   }, [allCaptureRows, sortDescriptor, filters, evaluateFilter]);

//   // Virtualized table will render all rows efficiently; no manual pagination.

//   return (
//     <div className="flex flex-col gap-4 h-full w-full min-h-0 overflow-hidden">
//       {error && <div className="text-danger text-sm">Error: {error}</div>}

//       <div className="max-w-7xl w-full mx-auto px-8 flex flex-col gap-4 ">
//         {/* Line 1: filter controls */}
//         <div className="flex items-end gap-4 w-full">
//           <Select
//             labelPlacement="outside"
//             placeholder="Select column"
//             variant="bordered"
//             label="Filter column"
//             selectedKeys={draftColumn ? [draftColumn] : []}
//             onSelectionChange={(keys) => {
//               const first = Array.from(keys)[0];
//               setDraftColumn(first ? String(first) : null);
//               setDraftOperator(null);
//               setDraftValue('');
//             }}
//             className="min-w-[150px]"
//           >
//             {TABLE_COLUMNS.map((c) => (
//               <SelectItem key={c.key}>{c.label}</SelectItem>
//             ))}
//           </Select>
//           <Select
//             labelPlacement="outside"
//             placeholder="Select operator"
//             variant="bordered"
//             label="Operator"
//             selectedKeys={draftOperator ? [draftOperator] : []}
//             onSelectionChange={(keys) => {
//               const first = Array.from(keys)[0];
//               setDraftOperator(first ? String(first) : null);
//             }}
//             className="min-w-[120px]"
//             isDisabled={!draftColumn}
//           >
//             {baseOperators.map((op) => {
//               const isNumeric = draftColumn ? NUMERIC_FIELDS.has(draftColumn) : false;
//               const numericOnly = ['gt', 'gte', 'lt', 'lte'];
//               const disable = !isNumeric && numericOnly.includes(op.key);
//               return (
//                 <SelectItem key={op.key} isDisabled={disable}>
//                   {op.label}
//                 </SelectItem>
//               );
//             })}
//           </Select>
//           <Input
//             labelPlacement="outside"
//             placeholder="Enter value"
//             label="Value"
//             variant="bordered"
//             value={draftValue}
//             onValueChange={setDraftValue}
//             className="min-w-[140px]"
//             isDisabled={!draftOperator || ['exists', 'notexists'].includes(draftOperator)}
//           />
//           <Button
//             color="primary"
//             variant="solid"
//             isDisabled={
//               !draftColumn ||
//               !draftOperator ||
//               (!['exists', 'notexists'].includes(draftOperator) && draftValue.trim() === '')
//             }
//             onPress={() => {
//               if (!draftColumn || !draftOperator) return;
//               if (!['exists', 'notexists'].includes(draftOperator) && draftValue.trim() === '') return;
//               const newFilter: AdvancedFilter = {
//                 id: `${draftColumn}-${draftOperator}-${Date.now()}`,
//                 column: draftColumn,
//                 operator: draftOperator,
//                 value: draftValue.trim(),
//               };
//               setFilters((prev) => [...prev, newFilter]);
//               setDraftValue('');
//               setDraftOperator(null);
//               setDraftColumn(null);
//             }}
//           >
//             Add
//           </Button>
//         </div>

//         {/* Line 2: chips */}
//         {filters.length > 0 && (
//           <div className="flex w-full justify-between items-center gap-4 flex-wrap">
//             {filters.map((f) => {
//               const labelMap: Record<string, string> = {
//                 eq: '=',
//                 neq: '≠',
//                 contains: 'contains',
//                 starts: 'starts',
//                 ends: 'ends',
//                 gt: '>',
//                 gte: '>=',
//                 lt: '<',
//                 lte: '<=',
//                 exists: 'exists',
//                 notexists: 'not exists',
//               };
//               const colLabel = TABLE_COLUMNS.find((c) => c.key === f.column)?.label || f.column;
//               const valuePart = ['exists', 'notexists'].includes(f.operator) ? '' : ` ${f.value}`;
//               return (
//                 <Chip
//                   variant="flat"
//                   size="lg"
//                   radius="sm"
//                   key={f.id}
//                   color="secondary"
//                   className="h-[40px]"
//                   onClose={() => setFilters((prev) => prev.filter((x) => x.id !== f.id))}
//                 >
//                   {colLabel} {labelMap[f.operator]}
//                   {valuePart}
//                 </Chip>
//               );
//             })}
//           </div>
//         )}

//         <div className="flex w-full justify-end text-sm opacity-70 ml-auto">
//           Showing {sortedRows.length} filtered (Total {allCaptureRows.length})
//         </div>
//       </div>

//       <div className="px-8 flex-1 w-full h-full overflow-scroll" style={{ border: '10px solid red' }}>
//         <Table
//           isHeaderSticky
//           className="h-full"
//           aria-label="Band captures virtualized table with sorting"
//           sortDescriptor={sortDescriptor}
//           onSortChange={setSortDescriptor}
//           removeWrapper
//         >
//           <TableHeader columns={TABLE_COLUMNS}>
//             {(column) => (
//               <TableColumn
//                 key={column.key}
//                 allowsSorting
//                 className={column.key === 'bandId' ? 'whitespace-nowrap' : undefined}
//               >
//                 {column.label}
//               </TableColumn>
//             )}
//           </TableHeader>
//           <TableBody
//             items={sortedRows}
//             emptyContent={isLoading ? <Spinner size="sm" /> : 'No captures'}
//             loadingState={isLoading && bandCaptures.size === 0 ? 'loading' : 'idle'}
//           >
//             {(item) => (
//               <TableRow key={item.key}>
//                 {(columnKey) => (
//                   <TableCell className={columnKey === 'bandId' ? 'whitespace-nowrap' : undefined}>
//                     {getKeyValue(item as RowItem, columnKey as string)}
//                   </TableCell>
//                 )}
//               </TableRow>
//             )}
//           </TableBody>
//         </Table>
//       </div>
//     </div>
//   );
// }
