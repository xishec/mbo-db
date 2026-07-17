export function parseCsv(csv: string): string[][] {
  const normalizedCsv = csv
    .replace(/^\uFEFF/, "")
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n");
  if (normalizedCsv.length === 0) return [];

  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let inQuotes = false;

  for (let index = 0; index < normalizedCsv.length; index++) {
    const char = normalizedCsv[index];
    const nextChar = normalizedCsv[index + 1];

    if (char === '"') {
      if (inQuotes && nextChar === '"') {
        cell += '"';
        index++;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (char === "," && !inQuotes) {
      row.push(cell);
      cell = "";
      continue;
    }

    if (char === "\n" && !inQuotes) {
      row.push(cell);
      rows.push(row);
      row = [];
      cell = "";
      continue;
    }

    cell += char;
  }

  row.push(cell);
  rows.push(row);

  const lastRow = rows[rows.length - 1];
  if (lastRow?.length === 1 && lastRow[0] === "" && normalizedCsv.endsWith("\n")) {
    rows.pop();
  }

  return rows;
}

export function stringifyCsv(rows: string[][]): string {
  return rows
    .map((row) =>
      row
        .map((cell) => {
          if (cell.includes(",") || cell.includes('"') || cell.includes("\n") || cell.includes("\r")) {
            return `"${cell.replace(/"/g, '""')}"`;
          }
          return cell;
        })
        .join(",")
    )
    .join("\n");
}
