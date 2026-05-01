const FORMULA_PREFIX = /^[=+\-@]/;

export function escapeCsvCell(value: unknown) {
  if (value === null || value === undefined) return "";
  let text = String(value);
  if (FORMULA_PREFIX.test(text)) {
    text = `'${text}`;
  }
  if (/[",\r\n;]/.test(text)) {
    return `"${text.replaceAll('"', '""')}"`;
  }
  return text;
}

export function toCsv(headers: string[], rows: unknown[][]) {
  return [
    headers.map(escapeCsvCell).join(";"),
    ...rows.map((row) => row.map(escapeCsvCell).join(";")),
  ].join("\r\n");
}

export function csvResponse(filename: string, csv: string) {
  return new Response(`\uFEFF${csv}`, {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="${filename}"`,
    },
  });
}

export function parseSimpleCsv(input: string) {
  const lines = input.replace(/^\uFEFF/, "").split(/\r?\n/).filter(Boolean);
  if (lines.length === 0) return { headers: [], rows: [] as Record<string, string>[] };
  const separator = lines[0].includes(";") ? ";" : ",";
  const headers = lines[0].split(separator).map((header) => header.trim());
  const rows = lines.slice(1).map((line) => {
    const cells = line.split(separator).map((cell) => cell.trim().replace(/^"|"$/g, ""));
    return Object.fromEntries(headers.map((header, index) => [header, cells[index] ?? ""]));
  });
  return { headers, rows };
}
