import { useCallback, useMemo } from "react";
import type { Net, NetHours } from "../../../types/DET";
import CsvEditor from "../../Helper/CsvEditor";
import { parseCsv, stringifyCsv } from "../../../utils/csv";

interface DETNetHoursSectionProps {
  netHours: NetHours;
  onChange: (netHours: NetHours) => void;
}

const NET_HOURS_HEADERS = ["Nets", "Open 1", "Closed 1", "Open 2", "Closed 2", "Open 3", "Closed 3", "Net hours"];
const DEFAULT_NET_IDS = [
  "A1",
  "A2",
  "B2",
  "B3",
  "C1",
  "C2",
  "D1",
  "D2",
  "D3",
  "D4",
  "E1",
  "E2",
  "H1",
  "H2",
  "N1",
  "N3",
];
const HUMMINGBIRD_TRAP_ID = "Hummingbird-trap";

function parseNumber(value: string | number | undefined): number {
  if (typeof value === "number") return Number.isFinite(value) ? value : 0;
  if (!value) return 0;
  if (value.includes(":")) {
    const [hours, minutes] = value.split(":").map(Number);
    if (!Number.isFinite(hours) || !Number.isFinite(minutes)) return 0;
    return hours + minutes / 60;
  }
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function parseTimeToMinutes(time: string | undefined): number | null {
  if (!time) return null;
  const [hours, minutes] = time.split(":").map(Number);
  if (!Number.isInteger(hours) || !Number.isInteger(minutes)) return null;
  if (hours < 0 || hours > 23 || minutes < 0 || minutes > 59) return null;
  return hours * 60 + minutes;
}

function calculateHours(open: string | undefined, closed: string | undefined): number {
  const openMinutes = parseTimeToMinutes(open);
  const closedMinutes = parseTimeToMinutes(closed);
  if (openMinutes === null || closedMinutes === null || closedMinutes <= openMinutes) return 0;
  return (closedMinutes - openMinutes) / 60;
}

function calculateNetHours(net: Pick<Net, "open" | "closed" | "open2" | "closed2" | "open3" | "closed3">): number {
  return (
    calculateHours(net.open, net.closed) +
    calculateHours(net.open2, net.closed2) +
    calculateHours(net.open3, net.closed3)
  );
}

function formatDecimal(value: number): string {
  if (!Number.isFinite(value)) return "0";
  return Number(value.toFixed(2)).toString();
}

function netHoursToCsv(netHours: NetHours): string {
  const netsById = new Map((netHours.nets ?? []).map((net) => [net.id, net]));
  const ids = [
    ...DEFAULT_NET_IDS,
    ...(netHours.nets ?? []).map((net) => net.id).filter((id) => !DEFAULT_NET_IDS.includes(id)),
  ];
  const rows = ids.map((id) => {
    const net = netsById.get(id);
    const hours = calculateNetHours(net ?? {});
    return [
      id,
      net?.open ?? "",
      net?.closed ?? "",
      net?.open2 ?? "",
      net?.closed2 ?? "",
      net?.open3 ?? "",
      net?.closed3 ?? "",
      formatDecimal(hours),
    ];
  });

  const trapHours = parseNumber(netHours.hummingbirdTrapTotal);
  rows.push([HUMMINGBIRD_TRAP_ID, "", "", "", "", "", "", formatDecimal(trapHours)]);

  return stringifyCsv([NET_HOURS_HEADERS, ...rows]);
}

function csvToNetHours(csv: string): NetHours {
  let hummingbirdTrapTotal = "0";
  const nets: Net[] = parseCsv(csv)
    .slice(1)
    .flatMap((row) => {
      const id = (row[0] ?? "").trim();
      const open = (row[1] ?? "").trim();
      const closed = (row[2] ?? "").trim();
      const open2 = (row[3] ?? "").trim();
      const closed2 = (row[4] ?? "").trim();
      const open3 = (row[5] ?? "").trim();
      const closed3 = (row[6] ?? "").trim();

      if (id === HUMMINGBIRD_TRAP_ID) {
        hummingbirdTrapTotal = formatDecimal(parseNumber(row[7]));
        return [];
      }

      const hours = calculateNetHours({ open, closed, open2, closed2, open3, closed3 });
      if (!id && !open && !closed && !open2 && !closed2 && !open3 && !closed3 && hours === 0) return [];
      if (!open && !closed && !open2 && !closed2 && !open3 && !closed3 && hours === 0) return [];

      return [
        {
          id,
          open,
          closed,
          open2,
          closed2,
          open3,
          closed3,
          hours: formatDecimal(hours),
          multiplier: 1,
          total: formatDecimal(hours),
        },
      ];
    });

  const total = nets.reduce((sum, net) => sum + parseNumber(net.total), 0);
  return {
    nets,
    hummingbirdTrapTotal,
    total: formatDecimal(total),
  };
}

export default function DETNetHoursSection({ netHours, onChange }: DETNetHoursSectionProps) {
  const netHoursCsv = useMemo(() => netHoursToCsv(netHours), [netHours]);
  const calculatedTotal = useMemo(
    () => (netHours.nets ?? []).reduce((sum, net) => sum + calculateNetHours(net), 0),
    [netHours.nets]
  );

  const handleNetHoursCsvChange = useCallback(
    (csv: string) => {
      onChange(csvToNetHours(csv));
    },
    [onChange]
  );

  return (
    <div>
      <p className="text-small pb-1">Net Hours</p>
      <CsvEditor
        csvTemplate={netHoursCsv}
        onChange={handleNetHoursCsvChange}
        ariaLabel="Net hours table"
        readOnlyColumns={["Net hours"]}
      />
      <div className="mt-2 flex justify-between gap-3 text-small pb-1 mr-3">
        <span>Total Net Hours</span>
        <span>{formatDecimal(calculatedTotal)}</span>
      </div>
      <div className="flex justify-between gap-3 text-small pb-1 mr-3">
        <span>Hummingbird Trap Hours</span>
        <span>{formatDecimal(parseNumber(netHours.hummingbirdTrapTotal))}</span>
      </div>
    </div>
  );
}
