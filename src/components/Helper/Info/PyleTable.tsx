import { Table, TableBody, TableCell, TableColumn, TableHeader, TableRow } from "@heroui/react";
import { memo } from "react";
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

function PyleTableInner({
  title,
  speciesCode,
  speciesRange,
  disabled = false,
  className,
  withCard = false,
}: PyleTableProps) {
  const containerClassName = className ? `flex flex-col h-full ${className}` : "flex flex-col h-full";
  const titleText = speciesCode.length === 4 ? `${speciesCode} info - ${title}` : `Species info - ${title}`;

  const formatRange = (lower: number, upper: number) => {
    // If values are valid, show them
    if (lower > 0 && upper > 0 && !isNaN(lower) && !isNaN(upper)) {
      return `${lower} - ${upper}`;
    }
    return "n/a";
  };

  const table = (
    <Table
      aria-label={titleText}
      isHeaderSticky={withCard}
      isVirtualized={withCard}
      maxTableHeight={185}
      classNames={{
        base: "table-fixed",
        table: "table-fixed",
        wrapper: withCard ? "h-[185px] shadow-none border border-default-200" : "shadow-none",
        th: speciesRange ? "" : "text-default-400",
        td: "text-sm",
      }}
      removeWrapper={!withCard}
    >
      <TableHeader>
        <TableColumn>Sex</TableColumn>
        <TableColumn>Weight</TableColumn>
        <TableColumn>Wing</TableColumn>
      </TableHeader>
      <TableBody emptyContent="">
        {speciesRange
          ? [
              <TableRow key="male">
                <TableCell>Male</TableCell>
                <TableCell>{formatRange(speciesRange.mWeightLower, speciesRange.mWeightUpper)}</TableCell>
                <TableCell>{formatRange(speciesRange.mWingLower, speciesRange.mWingUpper)}</TableCell>
              </TableRow>,
              <TableRow key="female">
                <TableCell>Female</TableCell>
                <TableCell>{formatRange(speciesRange.fWeightLower, speciesRange.fWeightUpper)}</TableCell>
                <TableCell>{formatRange(speciesRange.fWingLower, speciesRange.fWingUpper)}</TableCell>
              </TableRow>,
              <TableRow key="unknown">
                <TableCell>Unknown</TableCell>
                <TableCell>{formatRange(speciesRange.unknownWeightLower, speciesRange.unknownWeightUpper)}</TableCell>
                <TableCell>{formatRange(speciesRange.unknownWingLower, speciesRange.unknownWingUpper)}</TableCell>
              </TableRow>,
            ]
          : []}
      </TableBody>
    </Table>
  );

  return (
    <div className={containerClassName}>
      <h4 className="text-sm font-medium text-default-900 mb-4">
        {speciesCode.length === 4 ? (
          <>
            <SpeciesTooltip speciesCode={speciesCode} disabled={disabled} /> info - {title}
          </>
        ) : (
          titleText
        )}
      </h4>
      <div className="flex-1 flex flex-col">{table}</div>
    </div>
  );
}

// HeroUI Table is heavy (~48ms per render). Skip re-rendering when props
// haven't actually changed — speciesRange is a stable reference from
// magicTable.pyle[code] until the code changes.
const PyleTable = memo(PyleTableInner);
export default PyleTable;
