import type { Response } from 'express';

import { setPdfHeaders } from '../pdf/pdf.util.js';

import { CsvSection, sectionsToCsv, setCsvHeaders, toCsv } from './csv.util.js';
import { sectionsToXlsxBuffer, setXlsxHeaders, toXlsxBuffer } from './xlsx.util.js';

export function sendCsv(res: Response, filename: string, rows: Array<Record<string, unknown>>): string {
  setCsvHeaders(res, filename);
  return toCsv(rows);
}

export function sendSectionsCsv(res: Response, filename: string, sections: CsvSection[]): string {
  setCsvHeaders(res, filename);
  return sectionsToCsv(sections);
}

export async function sendXlsx(res: Response, filename: string, rows: Array<Record<string, unknown>>): Promise<void> {
  setXlsxHeaders(res, filename);
  res.send(await toXlsxBuffer(rows));
}

export async function sendSectionsXlsx(res: Response, filename: string, sections: CsvSection[]): Promise<void> {
  setXlsxHeaders(res, filename);
  res.send(await sectionsToXlsxBuffer(sections));
}

export async function sendPdf(res: Response, filename: string, build: () => Promise<Buffer>): Promise<void> {
  setPdfHeaders(res, filename);
  res.send(await build());
}
