import { useCallback, useEffect, useMemo, useState, type KeyboardEvent } from "react";
import { parseCsv, stringifyCsv } from "../../utils/csv";

export interface CsvEditorProps {
  csvTemplate: string;
  onChange: (csv: string) => void;
  ariaLabel?: string;
  className?: string;
  maxHeight?: number | string;
  readOnlyColumns?: Array<number | string>;
  formatReadOnlyValue?: (value: string, columnName: string) => string;
  inputPlaceholder?: (row: string[], columnName: string, columnIndex: number) => string | undefined;
  inputSuffix?: (row: string[], columnName: string, columnIndex: number) => string | undefined;
  inputClassName?: (row: string[], columnName: string, isReadOnly: boolean) => string;
}

function normalizeRows(rows: string[][]): string[][] {
  if (rows.length === 0) return [];

  const columnCount = rows[0].length;
  return rows.map((row) => Array.from({ length: columnCount }, (_, columnIndex) => row[columnIndex] ?? ""));
}

export default function CsvEditor({
  csvTemplate,
  onChange,
  ariaLabel = "CSV editor",
  className = "",
  maxHeight,
  readOnlyColumns = [],
  formatReadOnlyValue,
  inputPlaceholder,
  inputSuffix,
  inputClassName,
}: CsvEditorProps) {
  const [rows, setRows] = useState<string[][]>(() => normalizeRows(parseCsv(csvTemplate)));

  useEffect(() => {
    setRows(normalizeRows(parseCsv(csvTemplate)));
  }, [csvTemplate]);

  const headers = useMemo(() => rows[0] ?? [], [rows]);
  const dataRows = useMemo(() => rows.slice(1), [rows]);
  const readOnlyColumnIndexes = useMemo(
    () =>
      new Set(
        readOnlyColumns
          .map((column) => (typeof column === "number" ? column : headers.indexOf(column)))
          .filter((index) => index >= 0)
      ),
    [headers, readOnlyColumns]
  );
  const updateCell = useCallback(
    (rowIndex: number, columnIndex: number, value: string) => {
      setRows((currentRows) => {
        const nextRows = currentRows.map((row) => [...row]);
        const bodyRowIndex = rowIndex + 1;
        if (!nextRows[bodyRowIndex]) return currentRows;

        nextRows[bodyRowIndex][columnIndex] = value;
        const nextCsv = stringifyCsv(nextRows);
        onChange(nextCsv);
        return nextRows;
      });
    },
    [onChange]
  );
  const handleArrowNavigation = useCallback(
    (event: KeyboardEvent<HTMLInputElement>, rowIndex: number, columnIndex: number) => {
      if (
        !["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(event.key) ||
        event.altKey ||
        event.ctrlKey ||
        event.metaKey ||
        event.shiftKey
      ) {
        return;
      }

      const editableColumns = headers.map((_, index) => index).filter((index) => !readOnlyColumnIndexes.has(index));
      const currentEditableIndex = editableColumns.indexOf(columnIndex);
      if (currentEditableIndex < 0) return;

      let nextRowIndex = rowIndex;
      let nextColumnIndex = columnIndex;

      if (event.key === "ArrowUp") nextRowIndex -= 1;
      if (event.key === "ArrowDown") nextRowIndex += 1;
      if (event.key === "ArrowLeft") {
        nextColumnIndex = editableColumns[currentEditableIndex - 1] ?? columnIndex;
      }
      if (event.key === "ArrowRight") {
        nextColumnIndex = editableColumns[currentEditableIndex + 1] ?? columnIndex;
      }

      const table = event.currentTarget.closest("table");
      if (!table || (nextRowIndex === rowIndex && nextColumnIndex === columnIndex)) return;

      let nextInput: HTMLInputElement | null | undefined;
      if (nextRowIndex >= 0 && nextRowIndex < dataRows.length) {
        nextInput = table.querySelector<HTMLInputElement>(
          `input[data-csv-row="${nextRowIndex}"][data-csv-column="${nextColumnIndex}"]`
        );
      } else if (event.key === "ArrowUp" || event.key === "ArrowDown") {
        const scope = table.closest("[data-csv-navigation-scope]");
        const tables = scope ? Array.from(scope.querySelectorAll<HTMLTableElement>("table[data-csv-editor]")) : [];
        const tableIndex = tables.indexOf(table);
        const nextTable = tables[tableIndex + (event.key === "ArrowUp" ? -1 : 1)];
        const candidates = nextTable
          ? Array.from(nextTable.querySelectorAll<HTMLInputElement>("input:not([readonly])"))
          : [];
        const rowIndexes = candidates.map((input) => Number(input.dataset.csvRow));
        const targetRowIndex = event.key === "ArrowUp" ? Math.max(...rowIndexes) : Math.min(...rowIndexes);
        const targetRowInputs = candidates
          .filter((input) => Number(input.dataset.csvRow) === targetRowIndex)
          .sort(
            (a, b) =>
              Math.abs(Number(a.dataset.csvColumn) - nextColumnIndex) -
              Math.abs(Number(b.dataset.csvColumn) - nextColumnIndex)
          );
        nextInput = targetRowInputs[0];
      }
      if (!nextInput) return;

      event.preventDefault();
      nextInput.focus();
      nextInput.select();
    },
    [dataRows.length, headers, readOnlyColumnIndexes]
  );

  if (headers.length === 0) {
    return (
      <div className={`rounded-medium border border-default-200 p-4 text-sm text-default-500 ${className}`}>
        No CSV columns found.
      </div>
    );
  }

  return (
    <div
      className={`w-full overflow-auto rounded-medium border border-default-200 bg-content1 ${className}`}
      style={maxHeight === undefined ? undefined : { maxHeight }}
    >
      <table className="min-w-full border-separate border-spacing-0 text-sm" aria-label={ariaLabel} data-csv-editor>
        <thead className="sticky top-0 z-10 bg-default-100">
          <tr>
            {headers.map((header, columnIndex) => (
              <th
                key={`${header}-${columnIndex}`}
                scope="col"
                className="border-b border-r border-default-200 px-3 py-2 text-center font-semibold text-default-700 last:border-r-0"
              >
                {header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {dataRows.length === 0 ? (
            <tr>
              <td className="px-3 py-4 text-default-500" colSpan={headers.length}>
                No editable rows found.
              </td>
            </tr>
          ) : (
            dataRows.map((row, rowIndex) => (
              <tr key={rowIndex} className="even:bg-default-50">
                {headers.map((_, columnIndex) => {
                  const isReadOnly = readOnlyColumnIndexes.has(columnIndex);
                  const suffix = inputSuffix?.(row, headers[columnIndex], columnIndex);
                  return (
                    <td key={columnIndex} className="border-b border-r border-default-200 p-0 last:border-r-0">
                      <div className="relative">
                        <input
                          aria-label={`${headers[columnIndex]} row ${rowIndex + 1}`}
                          className={`block w-full bg-transparent px-3 py-2 text-default-900 outline-none focus:bg-primary-50 focus:ring-2 focus:ring-inset focus:ring-primary ${suffix ? "pr-16" : ""} ${inputClassName?.(row, headers[columnIndex], isReadOnly) ?? ""} ${
                            headers[columnIndex] === "Species" ? "min-w-56 text-left" : "min-w-32 text-right"
                          }`}
                          readOnly={isReadOnly}
                          placeholder={inputPlaceholder?.(row, headers[columnIndex], columnIndex)}
                          value={
                            isReadOnly && formatReadOnlyValue
                              ? formatReadOnlyValue(row[columnIndex] ?? "", headers[columnIndex])
                              : (row[columnIndex] ?? "")
                          }
                          onChange={(event) => updateCell(rowIndex, columnIndex, event.target.value)}
                          onKeyDown={(event) => handleArrowNavigation(event, rowIndex, columnIndex)}
                          data-csv-row={rowIndex}
                          data-csv-column={columnIndex}
                        />
                        {suffix && (
                          <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs text-default-500">
                            {suffix}
                          </span>
                        )}
                      </div>
                    </td>
                  );
                })}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}
