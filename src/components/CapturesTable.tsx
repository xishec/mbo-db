import { Table, TableBody, TableCell, TableColumn, TableHeader, TableRow } from "@heroui/react";

type Row = Record<string, string | number | boolean | null | undefined>;

export default function CapturesTable({
  columns,
  rows,
  ariaLabel,
}: {
  columns: string[];
  rows: Row[];
  ariaLabel: string;
}) {
  return (
    <Table isHeaderSticky aria-label={ariaLabel} isVirtualized maxTableHeight={600}>
      <TableHeader>
        {columns.map((c) => (
          <TableColumn key={c}>{c}</TableColumn>
        ))}
      </TableHeader>
      <TableBody emptyContent="No data">
        {rows.map((row, idx) => (
          <TableRow key={idx}>
            {columns.map((c) => (
              <TableCell key={c}>{String(row[c] ?? "")}</TableCell>
            ))}
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
