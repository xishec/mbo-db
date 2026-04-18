import { Card, CardBody, Table, TableBody, TableCell, TableColumn, TableHeader, TableRow } from "@heroui/react";
import type { SpeciesRange } from "../../../types";
import SpeciesTooltip from "./SpeciesTooltip";

interface PyleTableProps {
  title: string;
  speciesCode: string;
  speciesRange: SpeciesRange | null;
  disabled?: boolean;
  className?: string;
  withCard?: boolean;
}

export default function PyleTable({
  title,
  speciesCode,
  speciesRange,
  disabled = false,
  className,
  withCard = false,
}: PyleTableProps) {
  const containerClassName = className ? `flex flex-col h-full ${className}` : "flex flex-col h-full";

  const formatRange = (lower: number, upper: number) => {
    // If values are valid, show them
    if (lower > 0 && upper > 0 && !isNaN(lower) && !isNaN(upper)) {
      return `${lower} - ${upper}`;
    }
    return "n/a";
  };

  if (!speciesRange) {
    return (
      <div className={`${containerClassName} border border-default-200 rounded-medium p-3`}>
        <h4 className="text-sm font-bold mb-2">
          {title}: <span className="font-normal"><SpeciesTooltip speciesCode={speciesCode} disabled={disabled} /></span>
        </h4>
        <p className="text-sm text-default-400">No data available</p>
      </div>
    );
  }

  const table = (
    <Table classNames={{ th: "text-xs", td: "text-xs py-2" }} removeWrapper>
      <TableHeader>
        <TableColumn>Sex</TableColumn>
        <TableColumn>Weight</TableColumn>
        <TableColumn>Wing</TableColumn>
      </TableHeader>
      <TableBody>
        <TableRow key="male">
          <TableCell>Male</TableCell>
          <TableCell>{formatRange(speciesRange.mWeightLower, speciesRange.mWeightUpper)}</TableCell>
          <TableCell>{formatRange(speciesRange.mWingLower, speciesRange.mWingUpper)}</TableCell>
        </TableRow>
        <TableRow key="female">
          <TableCell>Female</TableCell>
          <TableCell>{formatRange(speciesRange.fWeightLower, speciesRange.fWeightUpper)}</TableCell>
          <TableCell>{formatRange(speciesRange.fWingLower, speciesRange.fWingUpper)}</TableCell>
        </TableRow>
        <TableRow key="unknown">
          <TableCell>Unknown</TableCell>
          <TableCell>{formatRange(speciesRange.unknownWeightLower, speciesRange.unknownWeightUpper)}</TableCell>
          <TableCell>{formatRange(speciesRange.unknownWingLower, speciesRange.unknownWingUpper)}</TableCell>
        </TableRow>
      </TableBody>
    </Table>
  );

  return (
    <div className={containerClassName}>
      <h4 className="text-sm mb-2">
        <SpeciesTooltip speciesCode={speciesCode} disabled={disabled} /> info - {title}
      </h4>
      <div className="flex-1 flex flex-col">
        {withCard ? (
          <Card className="flex-1 flex flex-col" shadow="sm">
            <CardBody className="p-3 flex-1">{table}</CardBody>
          </Card>
        ) : (
          table
        )}
      </div>
    </div>
  );
}
