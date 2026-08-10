import PDFDocument from 'pdfkit';
import type { Response } from 'express';

const PAGE_WIDTH = 612; // LETTER portrait
const PAGE_HEIGHT = 792;
const MARGIN = 40;
const BODY_WIDTH = PAGE_WIDTH - MARGIN * 2;
const ROW_MIN = 18;
const HEADER_HEIGHT = 24;

export function setPdfHeaders(res: Response, filename: string): void {
  res.set({
    'Content-Type': 'application/pdf',
    'Content-Disposition': `attachment; filename="${filename}"`,
  });
}

export function formatMoney(value: number): string {
  return value.toLocaleString('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
  });
}

export function formatNumber(value: number): string {
  return value.toLocaleString('en-US');
}

export function rangeText(opts?: { from?: string; to?: string }): string {
  return opts?.from && opts?.to ? `Period: ${opts.from} to ${opts.to}` : 'All dates';
}

export interface PdfTable {
  title: string;
  subtitle?: string;
  columns: Array<{ header: string; align?: 'left' | 'right' }>;
  rows: string[][];
  totalsRow?: string[];
}

export interface PdfFinancialRow {
  code: string;
  name: string;
  balance: number;
}

export interface PdfFinancialSection {
  name: string;
  rows: PdfFinancialRow[];
  total: number;
}

export interface PdfFinancial {
  title: string;
  subtitle?: string;
  sections: PdfFinancialSection[];
}

interface InternalColumn {
  header: string;
  width: number;
  align?: 'left' | 'right';
}

function equalColumns(columns: PdfTable['columns']): InternalColumn[] {
  const base = Math.floor(BODY_WIDTH / columns.length);
  return columns.map((column, index) => ({
    header: column.header,
    align: column.align,
    width: index === columns.length - 1 ? BODY_WIDTH - base * (columns.length - 1) : base,
  }));
}

function createDocument() {
  const doc = new PDFDocument({ size: 'LETTER', margin: MARGIN });
  const chunks: Buffer[] = [];
  doc.on('data', (chunk: Buffer) => chunks.push(chunk));
  const done = new Promise<Buffer>((resolve, reject) => {
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);
  });
  return { doc, done };
}

function renderTitle(doc: PDFKit.PDFDocument, title: string, subtitle?: string): void {
  doc.fontSize(18).fillColor('#111827').text(title, { align: 'center' });
  doc.fontSize(10).fillColor('#6b7280');
  if (subtitle) {
    doc.text(subtitle, { align: 'center' });
  }
  doc.text(`Generated: ${new Date().toLocaleString()}`, { align: 'center' });
  doc.moveDown(1.5);
}

function drawHeader(doc: PDFKit.PDFDocument, columns: InternalColumn[]): void {
  const y = doc.y;
  doc.fillColor('#1f2937').rect(MARGIN, y, BODY_WIDTH, HEADER_HEIGHT).fill();
  doc.fillColor('#ffffff').font('Helvetica-Bold').fontSize(9);
  let x = MARGIN;
  for (const column of columns) {
    doc.text(column.header, x + 6, y + 7, {
      width: column.width - 12,
      align: column.align ?? 'left',
    });
    x += column.width;
  }
  doc.y = y + HEADER_HEIGHT + 4;
}

function ensureSpace(doc: PDFKit.PDFDocument, columns: InternalColumn[], height: number): void {
  if (doc.y + height > PAGE_HEIGHT - MARGIN) {
    doc.addPage();
    drawHeader(doc, columns);
  }
}

function drawRow(
  doc: PDFKit.PDFDocument,
  columns: InternalColumn[],
  values: string[],
  opts?: { bold?: boolean; background?: boolean },
): void {
  const pad = 6;
  const heights = columns.map((column, i) =>
    doc.heightOfString(values[i] ?? '', { width: column.width - pad * 2 }),
  );
  const height = Math.max(ROW_MIN, ...heights);
  ensureSpace(doc, columns, height);
  const y = doc.y;
  if (opts?.background) {
    doc.fillColor('#f3f4f6').rect(MARGIN, y, BODY_WIDTH, height).fill();
  }
  doc.fillColor('#111827').font(opts?.bold ? 'Helvetica-Bold' : 'Helvetica').fontSize(9);
  let x = MARGIN;
  for (let i = 0; i < columns.length; i++) {
    doc.text(values[i] ?? '', x + pad, y + 4, {
      width: columns[i].width - pad * 2,
      align: columns[i].align ?? 'left',
    });
    x += columns[i].width;
  }
  doc.y = y + height + 2;
}

export async function buildTablePdf(opts: PdfTable): Promise<Buffer> {
  const { doc, done } = createDocument();
  renderTitle(doc, opts.title, opts.subtitle);
  const columns = equalColumns(opts.columns);
  drawHeader(doc, columns);
  for (const row of opts.rows) {
    drawRow(doc, columns, row);
  }
  if (opts.totalsRow) {
    drawRow(doc, columns, opts.totalsRow, { bold: true, background: true });
  }
  doc.end();
  return done;
}

const FINANCIAL_COLUMNS: InternalColumn[] = [
  { header: 'Code', width: 80 },
  { header: 'Account', width: BODY_WIDTH - 80 - 100 },
  { header: 'Balance', width: 100, align: 'right' },
];

function drawSectionHeader(doc: PDFKit.PDFDocument, name: string): void {
  ensureSpace(doc, FINANCIAL_COLUMNS, ROW_MIN);
  const y = doc.y;
  doc.fillColor('#111827').font('Helvetica-Bold').fontSize(10).text(name, MARGIN, y);
  doc
    .moveTo(MARGIN, y + 14)
    .lineTo(MARGIN + BODY_WIDTH, y + 14)
    .strokeColor('#d1d5db')
    .stroke();
  doc.y = y + 22;
}

export async function buildFinancialPdf(opts: PdfFinancial): Promise<Buffer> {
  const { doc, done } = createDocument();
  renderTitle(doc, opts.title, opts.subtitle);
  for (const section of opts.sections) {
    drawSectionHeader(doc, section.name);
    for (const row of section.rows) {
      drawRow(doc, FINANCIAL_COLUMNS, [row.code, row.name, formatMoney(row.balance)]);
    }
    drawRow(doc, FINANCIAL_COLUMNS, ['', `Total ${section.name.toLowerCase()}`, formatMoney(section.total)], {
      bold: true,
      background: true,
    });
    doc.moveDown(0.8);
  }
  doc.end();
  return done;
}
