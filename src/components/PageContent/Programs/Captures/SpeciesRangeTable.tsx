import { Table, TableBody, TableCell, TableColumn, TableHeader, TableRow } from "@heroui/react";
import type { SpeciesRange } from "../../../../types";

interface SpeciesRangeTableProps {
  title: string;
  speciesCode: string;
  speciesRange: SpeciesRange | null;
}

export default function SpeciesRangeTable({ title, speciesCode, speciesRange }: SpeciesRangeTableProps) {
  const formatRange = (lower: number, upper: number, counter?: number) => {
    return counter === 0 ? "n/a" : `${lower} - ${upper}`;
  };

  if (!speciesRange) {
    return (
      <div className="flex-1 border border-default-200 rounded-lg p-3">
        <h4 className="text-sm font-bold mb-2">
          {title}: <span className="font-normal">{speciesCode}</span>
        </h4>
        <p className="text-sm text-default-400">No data available</p>
      </div>
    );
  }

  return (
    <div className="flex-1">
      <h4 className="text-sm mb-2">
        {speciesCode} statistics - <span className="font-bold">{title}</span>
      </h4>
      <Table aria-label={`${title} species range`} classNames={{ th: "text-xs", td: "text-xs py-1" }}>
        <TableHeader>
          <TableColumn>Sex</TableColumn>
          <TableColumn>Weight</TableColumn>
          <TableColumn>Wing</TableColumn>
        </TableHeader>
        <TableBody>
          <TableRow key="male">
            <TableCell>Male {speciesRange.mCounter ? ` (${speciesRange.mCounter})` : ""}</TableCell>
            <TableCell>{formatRange(speciesRange.mWeightLower, speciesRange.mWeightUpper, speciesRange.mCounter)}</TableCell>
            <TableCell>{formatRange(speciesRange.mWingLower, speciesRange.mWingUpper, speciesRange.mCounter)}</TableCell>
          </TableRow>
          <TableRow key="female">
            <TableCell>Female {speciesRange.fCounter ? ` (${speciesRange.fCounter})` : ""}</TableCell>
            <TableCell>{formatRange(speciesRange.fWeightLower, speciesRange.fWeightUpper, speciesRange.fCounter)}</TableCell>
            <TableCell>{formatRange(speciesRange.fWingLower, speciesRange.fWingUpper, speciesRange.fCounter)}</TableCell>
          </TableRow>
          <TableRow key="unknown">
            <TableCell>Unknown {speciesRange.unknownCounter ? ` (${speciesRange.unknownCounter})` : ""}</TableCell>
            <TableCell>{formatRange(speciesRange.unknownWeightLower, speciesRange.unknownWeightUpper, speciesRange.unknownCounter)}</TableCell>
            <TableCell>{formatRange(speciesRange.unknownWingLower, speciesRange.unknownWingUpper, speciesRange.unknownCounter)}</TableCell>
          </TableRow>
        </TableBody>
      </Table>
    </div>
  );
}
