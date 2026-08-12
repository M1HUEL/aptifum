import type { Invoice, InvoiceItem } from '@aptifum/database';
import { BODY_WIDTH, MARGIN, PAGE_HEIGHT, ROW_MIN, createDocument } from '../../common/pdf/pdf.util';

interface TenantBrief {
  name: string;
  taxId: string | null;
  defaultCurrency: string;
  country: string;
}

export interface InvoicePdfOptions {
  tenant: TenantBrief | null;
  invoice: Invoice;
}

interface Column {
  header: string;
  width: number;
  align?: 'left' | 'right';
}

const ITEM_COLUMNS: Column[] = [
  { header: 'Item', width: BODY_WIDTH - 130 - 90 - 70 - 110 },
  { header: 'Qty', width: 130, align: 'right' },
  { header: 'Unit Price', width: 90, align: 'right' },
  { header: 'Discount', width: 70, align: 'right' },
  { header: 'Amount', width: 110, align: 'right' },
];

function formatCurrency(value: number, currency: string): string {
  return value.toLocaleString('en-US', {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
  });
}

function formatPercent(value: number): string {
  return `${(value * 100).toLocaleString('en-US', { maximumFractionDigits: 2 })}%`;
}

function drawItemHeader(doc: PDFKit.PDFDocument): void {
  const y = doc.y;
  doc.fillColor('#1f2937').rect(MARGIN, y, BODY_WIDTH, ROW_MIN).fill();
  doc.fillColor('#ffffff').font('Helvetica-Bold').fontSize(9);
  let x = MARGIN;
  for (const column of ITEM_COLUMNS) {
    doc.text(column.header, x + 6, y + 6, {
      width: column.width - 12,
      align: column.align ?? 'left',
    });
    x += column.width;
  }
  doc.y = y + ROW_MIN + 4;
}

function drawItemRow(doc: PDFKit.PDFDocument, item: InvoiceItem, currency: string): void {
  const pad = 6;
  const description = item.description || item.product?.name || '';
  const taxLabel = item.taxRate ? ` (${formatPercent(item.taxRate)})` : '';
  const values = [
    `${description}${taxLabel}`,
    String(item.quantity),
    formatCurrency(item.unitPrice, currency),
    formatCurrency(item.discount, currency),
    formatCurrency(item.lineTotal, currency),
  ];
  const heights = ITEM_COLUMNS.map((column, i) =>
    doc.heightOfString(values[i] ?? '', { width: column.width - pad * 2 }),
  );
  const height = Math.max(ROW_MIN, ...heights);
  if (doc.y + height > PAGE_HEIGHT - MARGIN) {
    doc.addPage();
    drawItemHeader(doc);
  }
  const y = doc.y;
  doc.fillColor('#111827').font('Helvetica').fontSize(9);
  let x = MARGIN;
  for (let i = 0; i < ITEM_COLUMNS.length; i++) {
    doc.text(values[i] ?? '', x + pad, y + 4, {
      width: ITEM_COLUMNS[i].width - pad * 2,
      align: ITEM_COLUMNS[i].align ?? 'left',
    });
    x += ITEM_COLUMNS[i].width;
  }
  doc
    .moveTo(MARGIN, y + height + 2)
    .lineTo(MARGIN + BODY_WIDTH, y + height + 2)
    .strokeColor('#e5e7eb')
    .lineWidth(0.5)
    .stroke();
  doc.y = y + height + 6;
}

function drawTotals(doc: PDFKit.PDFDocument, invoice: Invoice): void {
  const labelWidth = 160;
  const valueWidth = 120;
  const startX = MARGIN + BODY_WIDTH - labelWidth - valueWidth;
  const rows: Array<[string, string, boolean]> = [
    ['Subtotal', formatCurrency(invoice.subtotal, invoice.currency), false],
    ['Discount', formatCurrency(invoice.discount, invoice.currency), false],
    ['Tax', formatCurrency(invoice.tax, invoice.currency), false],
    ['Total', formatCurrency(invoice.total, invoice.currency), true],
    ['Paid', formatCurrency(invoice.paidAmount, invoice.currency), false],
    ['Balance Due', formatCurrency(invoice.balanceDue, invoice.currency), true],
  ];
  doc.moveDown(0.8);
  for (const [label, value, bold] of rows) {
    doc
      .fillColor(bold ? '#111827' : '#374151')
      .font(bold ? 'Helvetica-Bold' : 'Helvetica')
      .fontSize(10)
      .text(label, startX, doc.y, { width: labelWidth });
    doc.text(value, startX + labelWidth, doc.y - 12, {
      width: valueWidth,
      align: 'right',
    });
    doc.moveDown(0.2);
  }
}

export async function buildInvoicePdf(opts: InvoicePdfOptions): Promise<Buffer> {
  const { tenant, invoice } = opts;
  const { doc, done } = createDocument();
  const currency = invoice.currency || tenant?.defaultCurrency || 'USD';
  const isCreditNote = invoice.type === 'credit_note';
  const title = isCreditNote ? 'CREDIT NOTE' : 'INVOICE';

  doc.fontSize(20).fillColor('#111827').font('Helvetica-Bold');
  doc.text(tenant?.name ?? 'Aptifum', MARGIN, 48);
  if (tenant?.taxId) {
    doc.fontSize(9).fillColor('#6b7280').font('Helvetica');
    doc.text(`Tax ID: ${tenant.taxId}`, MARGIN, 74);
    doc.text(`Country: ${tenant.country}`, MARGIN, 86);
  }
  doc.fillColor('#111827').font('Helvetica-Bold').fontSize(18);
  doc.text(title, MARGIN, 48, { align: 'right', width: BODY_WIDTH });
  doc.fontSize(12);
  doc.text(invoice.number, MARGIN, 72, { align: 'right', width: BODY_WIDTH });
  doc.font('Helvetica').fontSize(9).fillColor('#6b7280');
  doc.text(`Issued: ${invoice.issueDate}`, MARGIN, 92, { align: 'right', width: BODY_WIDTH });
  if (invoice.dueDate) {
    doc.text(`Due: ${invoice.dueDate}`, MARGIN, 104, { align: 'right', width: BODY_WIDTH });
  }
  doc.text(`Status: ${invoice.status}`, MARGIN, invoice.dueDate ? 116 : 104, {
    align: 'right',
    width: BODY_WIDTH,
  });

  doc.moveDown(3);
  const partiesY = doc.y;
  const customer = invoice.customer;
  doc.fillColor('#6b7280').font('Helvetica-Bold').fontSize(9).text('BILL TO', MARGIN, partiesY);
  doc.fillColor('#111827').font('Helvetica').fontSize(10);
  doc.text(customer?.tradeName ?? '', MARGIN, partiesY + 12);
  doc.fontSize(9).fillColor('#374151');
  if (customer?.legalName) doc.text(customer.legalName, MARGIN, doc.y + 2);
  if (customer?.taxId) doc.text(`Tax ID: ${customer.taxId}`, MARGIN, doc.y + 2);
  if (customer?.address) doc.text(customer.address, MARGIN, doc.y + 2);
  if (customer?.email) doc.text(customer.email, MARGIN, doc.y + 2);
  if (customer?.phone) doc.text(`Phone: ${customer.phone}`, MARGIN, doc.y + 2);

  doc.moveDown(1.5);
  doc.y = Math.max(doc.y, partiesY + 78);
  drawItemHeader(doc);
  for (const item of invoice.items ?? []) {
    drawItemRow(doc, item, currency);
  }
  drawTotals(doc, invoice);

  if (invoice.payments?.length) {
    doc.moveDown(1);
    doc.fillColor('#6b7280').font('Helvetica-Bold').fontSize(9).text('PAYMENTS', MARGIN, doc.y);
    doc.font('Helvetica').fontSize(9).fillColor('#374151');
    for (const payment of invoice.payments) {
      doc.moveDown(0.3);
      const date = payment.receivedAt
        ? new Date(payment.receivedAt).toLocaleDateString('en-US')
        : '';
      doc.text(`${date}  ${formatCurrency(payment.amount, currency)}  ${payment.method}`, MARGIN, doc.y);
    }
  }

  if (invoice.notes) {
    doc.moveDown(1);
    doc.fillColor('#6b7280').font('Helvetica-Bold').fontSize(9).text('NOTES', MARGIN, doc.y);
    doc.font('Helvetica').fontSize(9).fillColor('#374151').text(invoice.notes, MARGIN, doc.y + 10);
  }

  doc.end();
  return done;
}
