import { Table, TableBody, TableCell, TableColumn, TableHeader, TableRow } from "@heroui/react";
import type { SpeciesRange } from "../../../../types";
import SpeciesPopover from "../../../SpeciesPopover";

interface SpeciesRangeTableProps {
  title: string;
  speciesCode: string;
  speciesRange: SpeciesRange | null;
}

export default function SpeciesRangeTable({ title, speciesCode, speciesRange }: SpeciesRangeTableProps) {
  const formatRange = (lower: number, upper: number) => {
    // If values are valid, show them
    if (lower > 0 && upper > 0 && !isNaN(lower) && !isNaN(upper)) {
      return `${lower} - ${upper}`;
    }
    return "n/a";
  };

  if (!speciesRange) {
    return (
      <div className="flex-1 border border-default-200 rounded-medium p-3">
        <h4 className="text-sm font-bold mb-2">
          {title}: <span className="font-normal"><SpeciesPopover speciesCode={speciesCode}>{speciesCode}</SpeciesPopover></span>
        </h4>
        <p className="text-sm text-default-400">No data available</p>
      </div>
    );
  }

  return (
    <div className="flex-1">
      <h4 className="text-sm mb-2">
        <SpeciesPopover speciesCode={speciesCode}>{speciesCode}</SpeciesPopover> statistics - <span className="font-bold">{title}</span>
      </h4>
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
              {formatRange(speciesRange.mWeightLower, speciesRange.mWeightUpper)}
            </TableCell>
            <TableCell>
              {formatRange(speciesRange.mWingLower, speciesRange.mWingUpper)}
            </TableCell>
          </TableRow>
          <TableRow key="female">
            <TableCell>Female</TableCell>
            <TableCell>
              {formatRange(speciesRange.fWeightLower, speciesRange.fWeightUpper)}
            </TableCell>
            <TableCell>
              {formatRange(speciesRange.fWingLower, speciesRange.fWingUpper)}
            </TableCell>
          </TableRow>
          <TableRow key="unknown">
            <TableCell>Unknown</TableCell>
            <TableCell>
              {formatRange(
                speciesRange.unknownWeightLower,
                speciesRange.unknownWeightUpper
              )}
            </TableCell>
            <TableCell>
              {formatRange(speciesRange.unknownWingLower, speciesRange.unknownWingUpper)}
            </TableCell>
          </TableRow>
        </TableBody>
      </Table>
    </div>
  );
}
