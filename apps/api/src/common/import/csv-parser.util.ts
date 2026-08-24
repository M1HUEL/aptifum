export class CsvParseError extends Error {}

export interface ParsedCsv {
  headers: string[];
  rows: Array<Record<string, string>>;
  rowNumbers: number[];
}

export function parseCsv(content: string): ParsedCsv {
  const text = content
    .replace(/^\uFEFF/, '')
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n');
  if (text.trim() === '') {
    return { headers: [], rows: [], rowNumbers: [] };
  }

  const records: string[][] = [];
  const recordStartLines: number[] = [];
  let record: string[] = [];
  let field = '';
  let inQuotes = false;
  let line = 1;
  let startLine = 1;

  const pushRecord = () => {
    const isBlank = record.length === 1 && record[0]!.trim() === '';
    if (record.length > 0 && !isBlank) {
      records.push(record);
      recordStartLines.push(startLine);
    }
    record = [];
    field = '';
  };

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += ch;
        if (ch === '\n') {
          line++;
        }
      }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === ',') {
      record.push(field);
      field = '';
    } else if (ch === '\n') {
      record.push(field);
      pushRecord();
      line++;
      startLine = line;
    } else {
      field += ch;
    }
  }

  if (field !== '' || record.length > 0) {
    record.push(field);
    pushRecord();
  }

  if (records.length === 0) {
    return { headers: [], rows: [], rowNumbers: [] };
  }

  const headers = records[0]!.map(normalizeHeader);
  const duplicateHeaders = headers.filter((header, index) => headers.indexOf(header) !== index);
  if (duplicateHeaders.length > 0) {
    throw new CsvParseError(`Duplicate CSV columns: ${Array.from(new Set(duplicateHeaders)).join(', ')}`);
  }

  const rows: Array<Record<string, string>> = [];
  const rowNumbers: number[] = [];
  for (const [i, cells] of records.entries()) {
    if (i === 0) {
      continue;
    }
    if (cells.length !== headers.length) {
      throw new CsvParseError(
        `Row ${recordStartLines[i]} has ${cells.length} columns but the header has ${headers.length}`,
      );
    }
    const recordRow: Record<string, string> = {};
    for (const [c, header] of headers.entries()) {
      recordRow[header] = cells[c]!.trim();
    }
    if (Object.values(recordRow).every((value) => value === '')) {
      continue;
    }
    rows.push(recordRow);
    rowNumbers.push(recordStartLines[i]!);
  }

  return { headers, rows, rowNumbers };
}

function normalizeHeader(header: string): string {
  return header.trim().toLowerCase().replace(/\s+/g, '_');
}
