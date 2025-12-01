import { Table, TableBody, TableCell, TableColumn, TableHeader, TableRow } from "@heroui/react";
import type { SpeciesRange } from "../../../../services/DataContext";

interface SpeciesRangeTableProps {
  title: string;
  speciesCode: string;
  range: SpeciesRange | null;
}

export default function SpeciesRangeTable({ title, speciesCode, range }: SpeciesRangeTableProps) {
  if (!range) {
    return (
      <div className="flex-1 border border-default-200 rounded-lg p-3">
        <h4 className="text-sm font-semibold mb-2">
          {title}: <span className="font-normal">{speciesCode}</span>
        </h4>
        <p className="text-sm text-default-400">No data available</p>
      </div>
    );
  }

  return (
    <div className="flex-1">
      <h4 className="text-sm mb-2">{speciesCode} statistics - {title}</h4>
      <Table aria-label={`${title} species range`} classNames={{ th: "text-xs", td: "text-xs py-1" }}>
        <TableHeader>
          <TableColumn>Sex</TableColumn>
          <TableColumn>Weight</TableColumn>
          <TableColumn>Wing</TableColumn>
        </TableHeader>
        <TableBody>
          <TableRow key="male">
            <TableCell>Male</TableCell>
            <TableCell>
              {range.mWeightLower} - {range.mWeightUpper}
            </TableCell>
            <TableCell>
              {range.mWingLower} - {range.mWingUpper}
            </TableCell>
          </TableRow>
          <TableRow key="female">
            <TableCell>Female</TableCell>
            <TableCell>
              {range.fWeightLower} - {range.fWeightUpper}
            </TableCell>
            <TableCell>
              {range.fWingLower} - {range.fWingUpper}
            </TableCell>
          </TableRow>
        </TableBody>
      </Table>
    </div>
  );
}
