import { pathToFileURL } from 'node:url';

import type { EntityManager } from 'typeorm';

import {
  computeTotals,
  DocumentSeriesKind,
  InvoiceStatus,
  InvoiceType,
  MovementType,
  PaymentMethod,
  PurchaseOrderStatus,
  round2,
  SalesOrderKind,
  SalesOrderStatus,
} from '@aptifum/core';

import { createDataSource, DataSourceOverrides } from '../data-source.js';
import { Category } from '../entities/category.entity.js';
import { Customer } from '../entities/customer.entity.js';
import { GoodsReceiptItem } from '../entities/goods-receipt-item.entity.js';
import { GoodsReceipt } from '../entities/goods-receipt.entity.js';
import { InvoiceItem } from '../entities/invoice-item.entity.js';
import { Invoice } from '../entities/invoice.entity.js';
import { Payment } from '../entities/payment.entity.js';
import { ProductStock } from '../entities/product-stock.entity.js';
import { Product } from '../entities/product.entity.js';
import { PurchaseOrderItem } from '../entities/purchase-order-item.entity.js';
import { PurchaseOrder } from '../entities/purchase-order.entity.js';
import { SalesOrderItem } from '../entities/sales-order-item.entity.js';
import { SalesOrder } from '../entities/sales-order.entity.js';
import { Supplier } from '../entities/supplier.entity.js';
import { Tenant } from '../entities/tenant.entity.js';
import { Warehouse } from '../entities/warehouse.entity.js';
import type { JournalLineInput } from '../services/accounting.js';
import { ACCOUNT_CODES, postJournalEntry } from '../services/accounting.js';
import { nextDocumentNumber } from '../services/document-numbering.js';
import { applyStockMovement } from '../services/stock.js';

import { DEFAULT_TENANT_ID } from './seed-data.js';

const dateOffset = (days: number): string => {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
};

const backdate = async (manager: EntityManager, table: string, id: string, date: string): Promise<void> => {
  await manager.query(`UPDATE ${table} SET created_at = $1::timestamptz, updated_at = $1::timestamptz WHERE id = $2`, [
    `${date}T12:00:00.000Z`,
    id,
  ]);
};

interface SaleLineInput {
  product: Product;
  quantity: number;
  unitPrice?: number;
  discount?: number;
  taxRate?: number;
}

interface Ctx {
  tenantId: string;
  mainWarehouse: Warehouse;
  productsBySku: Map<string, Product>;
  customersByCode: Map<string, Customer>;
  suppliersByCode: Map<string, Supplier>;
  backdates: Array<{ table: string; id: string; date: string }>;
}

const toInvoiceItems = (manager: EntityManager, ctx: Ctx, lines: SaleLineInput[]): InvoiceItem[] =>
  lines.map((line) => {
    const unitPrice = line.unitPrice ?? line.product.salePrice;
    const quantity = line.quantity;
    return manager.getRepository(InvoiceItem).create({
      tenantId: ctx.tenantId,
      productId: line.product.id,
      description: line.product.name,
      quantity,
      unitPrice,
      discount: line.discount ?? 0,
      taxRate: line.taxRate ?? 0,
      taxAmount: round2(quantity * unitPrice * (line.taxRate ?? 0)),
      lineTotal: round2(quantity * unitPrice - (line.discount ?? 0)),
    });
  });

const toOrderItems = (manager: EntityManager, ctx: Ctx, lines: SaleLineInput[]): SalesOrderItem[] =>
  lines.map((line) => {
    const unitPrice = line.unitPrice ?? line.product.salePrice;
    const quantity = line.quantity;
    return manager.getRepository(SalesOrderItem).create({
      tenantId: ctx.tenantId,
      productId: line.product.id,
      description: line.product.name,
      quantity,
      unitPrice,
      discount: line.discount ?? 0,
      taxRate: line.taxRate ?? 0,
      taxAmount: round2(quantity * unitPrice * (line.taxRate ?? 0)),
      lineTotal: round2(quantity * unitPrice - (line.discount ?? 0)),
    });
  });

const applyOutbound = async (
  manager: EntityManager,
  ctx: Ctx,
  productId: string,
  warehouseId: string,
  quantity: number,
  referenceId: string,
): Promise<number> => {
  const stock = await manager.getRepository(ProductStock).findOneBy({ tenantId: ctx.tenantId, productId, warehouseId });
  const unitCost = stock?.averageCost ?? 0;
  await applyStockMovement(manager, {
    tenantId: ctx.tenantId,
    movementType: MovementType.OUTBOUND,
    productId,
    warehouseId,
    quantity,
    unitCost,
    referenceType: 'invoice',
    referenceId,
  });
  return unitCost;
};

const applyReturn = async (
  manager: EntityManager,
  ctx: Ctx,
  productId: string,
  warehouseId: string | null,
  quantity: number,
  creditNoteId: string,
): Promise<number> => {
  if (!warehouseId) {
    return 0;
  }
  await applyStockMovement(manager, {
    tenantId: ctx.tenantId,
    movementType: MovementType.RETURN,
    productId,
    warehouseId,
    quantity,
    unitCost: 0,
    referenceType: 'credit_note',
    referenceId: creditNoteId,
  });
  const stock = await manager.getRepository(ProductStock).findOneBy({ tenantId: ctx.tenantId, productId, warehouseId });
  return stock?.averageCost ?? 0;
};

const postSaleEntry = async (manager: EntityManager, ctx: Ctx, invoice: Invoice, cogs: number): Promise<void> => {
  const lines: JournalLineInput[] =
    invoice.type === InvoiceType.CREDIT_NOTE
      ? [
          { accountCode: ACCOUNT_CODES.SALES_RETURNS, debit: round2(invoice.subtotal - invoice.discount) },
          { accountCode: ACCOUNT_CODES.OUTPUT_VAT, debit: invoice.tax },
          { accountCode: ACCOUNT_CODES.ACCOUNTS_RECEIVABLE, credit: invoice.total },
        ]
      : [
          { accountCode: ACCOUNT_CODES.ACCOUNTS_RECEIVABLE, debit: invoice.total },
          { accountCode: ACCOUNT_CODES.SALES_REVENUE, credit: round2(invoice.subtotal - invoice.discount) },
          { accountCode: ACCOUNT_CODES.OUTPUT_VAT, credit: invoice.tax },
        ];
  if (cogs > 0) {
    if (invoice.type === InvoiceType.CREDIT_NOTE) {
      lines.push(
        { accountCode: ACCOUNT_CODES.INVENTORY, debit: cogs },
        { accountCode: ACCOUNT_CODES.COST_OF_GOODS_SOLD, credit: cogs },
      );
    } else {
      lines.push(
        { accountCode: ACCOUNT_CODES.COST_OF_GOODS_SOLD, debit: cogs },
        { accountCode: ACCOUNT_CODES.INVENTORY, credit: cogs },
      );
    }
  }
  const cleanLines = lines.filter((line) => (line.debit ?? 0) > 0 || (line.credit ?? 0) > 0);
  if (cleanLines.length === 0) {
    return;
  }
  await postJournalEntry(manager, ctx.tenantId, {
    entryDate: invoice.issueDate,
    description:
      invoice.type === InvoiceType.CREDIT_NOTE ? `Credit note ${invoice.number}` : `Invoice ${invoice.number}`,
    referenceType: invoice.type === InvoiceType.CREDIT_NOTE ? 'credit_note' : 'invoice',
    referenceId: invoice.id,
    currency: invoice.currency,
    lines: cleanLines,
  });
};

const createInvoice = async (
  manager: EntityManager,
  ctx: Ctx,
  opts: {
    customer: Customer;
    issueOffset: number;
    dueOffset: number | null;
    lines: SaleLineInput[];
    notes?: string;
  },
): Promise<Invoice> => {
  const { number, seriesId } = await nextDocumentNumber(manager, ctx.tenantId, DocumentSeriesKind.INVOICE);
  const items = toInvoiceItems(manager, ctx, opts.lines);
  const totals = computeTotals(items, 0);
  const invoice = manager.getRepository(Invoice).create({
    tenantId: ctx.tenantId,
    number,
    seriesId,
    type: InvoiceType.INVOICE,
    status: InvoiceStatus.ISSUED,
    customerId: opts.customer.id,
    orderId: null,
    warehouseId: ctx.mainWarehouse.id,
    issueDate: dateOffset(opts.issueOffset),
    dueDate: opts.dueOffset == null ? null : dateOffset(opts.dueOffset),
    currency: opts.customer.currency,
    ...totals,
    paidAmount: 0,
    balanceDue: totals.total,
    notes: opts.notes ?? null,
    items,
  });
  const saved = await manager.getRepository(Invoice).save(invoice);
  let cogs = 0;
  for (const line of opts.lines) {
    const avgCost = await applyOutbound(manager, ctx, line.product.id, ctx.mainWarehouse.id, line.quantity, saved.id);
    cogs = round2(cogs + line.quantity * avgCost);
  }
  await postSaleEntry(manager, ctx, saved, cogs);
  ctx.backdates.push({ table: 'invoices', id: saved.id, date: saved.issueDate });
  return saved;
};

const recordPayment = async (
  manager: EntityManager,
  ctx: Ctx,
  invoice: Invoice,
  amount: number,
  method: PaymentMethod,
  receivedOffset: number,
): Promise<void> => {
  const newPaid = round2(invoice.paidAmount + amount);
  if (newPaid - invoice.total > 0.005) {
    throw new Error(`Payment exceeds balance for ${invoice.number}`);
  }
  invoice.paidAmount = newPaid;
  invoice.balanceDue = round2(invoice.total - newPaid);
  await manager.getRepository(Invoice).save(invoice);
  const receivedAt = dateOffset(receivedOffset);
  const payment = await manager.getRepository(Payment).save(
    manager.getRepository(Payment).create({
      tenantId: ctx.tenantId,
      invoiceId: invoice.id,
      method,
      amount,
      receivedAt: new Date(`${receivedAt}T12:00:00.000Z`),
      reference: null,
      notes: null,
    }),
  );
  await postJournalEntry(manager, ctx.tenantId, {
    entryDate: receivedAt,
    description: `Payment ${invoice.number}`,
    referenceType: 'payment',
    referenceId: payment.id,
    currency: invoice.currency,
    lines: [
      { accountCode: ACCOUNT_CODES.CASH, debit: amount },
      { accountCode: ACCOUNT_CODES.ACCOUNTS_RECEIVABLE, credit: amount },
    ],
  });
  ctx.backdates.push({ table: 'payments', id: payment.id, date: receivedAt });
};

const createCreditNote = async (
  manager: EntityManager,
  ctx: Ctx,
  original: Invoice,
  lines: SaleLineInput[],
  issueOffset: number,
): Promise<Invoice> => {
  const { number, seriesId } = await nextDocumentNumber(manager, ctx.tenantId, DocumentSeriesKind.CREDIT_NOTE);
  const items = toInvoiceItems(manager, ctx, lines);
  const totals = computeTotals(items, 0);
  const creditNote = manager.getRepository(Invoice).create({
    tenantId: ctx.tenantId,
    number,
    seriesId,
    type: InvoiceType.CREDIT_NOTE,
    status: InvoiceStatus.ISSUED,
    customerId: original.customerId,
    orderId: null,
    warehouseId: original.warehouseId,
    issueDate: dateOffset(issueOffset),
    dueDate: null,
    currency: original.currency,
    ...totals,
    paidAmount: 0,
    balanceDue: 0,
    notes: `Credit note for invoice ${original.number}`,
    items,
  });
  const saved = await manager.getRepository(Invoice).save(creditNote);
  let cogs = 0;
  for (const line of lines) {
    const avgCost = await applyReturn(manager, ctx, line.product.id, original.warehouseId, line.quantity, saved.id);
    cogs = round2(cogs + line.quantity * avgCost);
  }
  await postSaleEntry(manager, ctx, saved, cogs);
  ctx.backdates.push({ table: 'invoices', id: saved.id, date: saved.issueDate });
  return saved;
};

const createSalesOrder = async (
  manager: EntityManager,
  ctx: Ctx,
  opts: {
    kind: SalesOrderKind;
    status: SalesOrderStatus;
    customer: Customer;
    issueOffset: number;
    dueOffset: number | null;
    lines: SaleLineInput[];
    notes?: string;
  },
): Promise<SalesOrder> => {
  const { number } = await nextDocumentNumber(
    manager,
    ctx.tenantId,
    opts.kind === SalesOrderKind.QUOTE ? DocumentSeriesKind.QUOTE : DocumentSeriesKind.ORDER,
  );
  const items = toOrderItems(manager, ctx, opts.lines);
  const totals = computeTotals(items, 0);
  const order = manager.getRepository(SalesOrder).create({
    tenantId: ctx.tenantId,
    number,
    kind: opts.kind,
    status: opts.status,
    customerId: opts.customer.id,
    warehouseId: ctx.mainWarehouse.id,
    issueDate: dateOffset(opts.issueOffset),
    dueDate: opts.dueOffset == null ? null : dateOffset(opts.dueOffset),
    currency: opts.customer.currency,
    ...totals,
    notes: opts.notes ?? null,
    items,
  });
  const saved = await manager.getRepository(SalesOrder).save(order);
  ctx.backdates.push({ table: 'sales_orders', id: saved.id, date: saved.issueDate });
  return saved;
};

const createInvoiceFromOrder = async (
  manager: EntityManager,
  ctx: Ctx,
  order: SalesOrder,
  issueOffset: number,
): Promise<Invoice> => {
  const { number, seriesId } = await nextDocumentNumber(manager, ctx.tenantId, DocumentSeriesKind.INVOICE);
  const items = order.items.map((item) =>
    manager.getRepository(InvoiceItem).create({
      tenantId: ctx.tenantId,
      productId: item.productId,
      description: item.description,
      quantity: item.quantity,
      unitPrice: item.unitPrice,
      discount: item.discount,
      taxRate: item.taxRate,
      taxAmount: item.taxAmount,
      lineTotal: item.lineTotal,
    }),
  );
  const totals = computeTotals(items, 0);
  const invoice = manager.getRepository(Invoice).create({
    tenantId: ctx.tenantId,
    number,
    seriesId,
    type: InvoiceType.INVOICE,
    status: InvoiceStatus.ISSUED,
    customerId: order.customerId,
    orderId: order.id,
    warehouseId: order.warehouseId,
    issueDate: dateOffset(issueOffset),
    dueDate: order.dueDate,
    currency: order.currency,
    ...totals,
    paidAmount: 0,
    balanceDue: totals.total,
    notes: null,
    items,
  });
  const saved = await manager.getRepository(Invoice).save(invoice);
  let cogs = 0;
  for (const item of order.items) {
    const avgCost = await applyOutbound(manager, ctx, item.productId, order.warehouseId, item.quantity, saved.id);
    cogs = round2(cogs + item.quantity * avgCost);
  }
  await postSaleEntry(manager, ctx, saved, cogs);
  order.status = SalesOrderStatus.INVOICED;
  await manager.getRepository(SalesOrder).save(order);
  ctx.backdates.push({ table: 'invoices', id: saved.id, date: saved.issueDate });
  return saved;
};

const createPurchaseOrder = async (
  manager: EntityManager,
  ctx: Ctx,
  opts: {
    supplier: Supplier;
    issueOffset: number;
    expectedOffset: number | null;
    lines: Array<{ product: Product; quantity: number; unitCost?: number }>;
    notes?: string;
  },
): Promise<PurchaseOrder> => {
  const { number } = await nextDocumentNumber(manager, ctx.tenantId, DocumentSeriesKind.PURCHASE_ORDER);
  const items = opts.lines.map((line) => {
    const unitCost = line.unitCost ?? line.product.purchasePrice;
    return manager.getRepository(PurchaseOrderItem).create({
      tenantId: ctx.tenantId,
      productId: line.product.id,
      description: line.product.name,
      quantity: line.quantity,
      unitCost,
      discount: 0,
      taxRate: 0,
      taxAmount: 0,
      lineTotal: round2(line.quantity * unitCost),
      receivedQuantity: 0,
    });
  });
  const totals = purchaseTotals(items);
  const order = manager.getRepository(PurchaseOrder).create({
    tenantId: ctx.tenantId,
    number,
    status: PurchaseOrderStatus.DRAFT,
    supplierId: opts.supplier.id,
    warehouseId: ctx.mainWarehouse.id,
    issueDate: dateOffset(opts.issueOffset),
    expectedAt: opts.expectedOffset == null ? null : dateOffset(opts.expectedOffset),
    currency: opts.supplier.currency,
    ...totals,
    notes: opts.notes ?? null,
    items,
  });
  const saved = await manager.getRepository(PurchaseOrder).save(order);
  ctx.backdates.push({ table: 'purchase_orders', id: saved.id, date: saved.issueDate });
  return saved;
};

const purchaseTotals = (
  items: Pick<PurchaseOrderItem, 'quantity' | 'unitCost' | 'discount' | 'taxRate' | 'taxAmount' | 'lineTotal'>[],
) => {
  const subtotal = round2(items.reduce((sum, i) => sum + i.lineTotal, 0));
  const tax = round2(items.reduce((sum, i) => sum + i.taxAmount, 0));
  return { subtotal, discount: 0, tax, total: round2(subtotal + tax) };
};

const receivePurchaseOrder = async (
  manager: EntityManager,
  ctx: Ctx,
  order: PurchaseOrder,
  receivedOffset: number,
): Promise<GoodsReceipt> => {
  const { number } = await nextDocumentNumber(manager, ctx.tenantId, DocumentSeriesKind.GOODS_RECEIPT);
  const receiptItems = order.items.map((item) =>
    manager.getRepository(GoodsReceiptItem).create({
      tenantId: ctx.tenantId,
      productId: item.productId,
      orderItemId: item.id,
      quantity: item.quantity,
      unitCost: item.unitCost,
    }),
  );
  const receivedAt = dateOffset(receivedOffset);
  const receipt = manager.getRepository(GoodsReceipt).create({
    tenantId: ctx.tenantId,
    number,
    orderId: order.id,
    supplierId: order.supplierId,
    warehouseId: order.warehouseId,
    receivedAt: new Date(`${receivedAt}T12:00:00.000Z`),
    notes: null,
    items: receiptItems,
  });
  const saved = await manager.getRepository(GoodsReceipt).save(receipt);

  let receivedAmount = 0;
  for (const item of order.items) {
    item.receivedQuantity = round2(item.receivedQuantity + item.quantity);
    await manager.getRepository(PurchaseOrderItem).save(item);
    await applyStockMovement(manager, {
      tenantId: ctx.tenantId,
      movementType: MovementType.INBOUND,
      productId: item.productId,
      warehouseId: order.warehouseId,
      quantity: item.quantity,
      unitCost: item.unitCost,
      referenceType: 'purchase_receipt',
      referenceId: saved.id,
    });
    receivedAmount = round2(receivedAmount + item.unitCost * item.quantity);
  }

  const allReceived = order.items.every((item) => item.receivedQuantity + 1e-9 >= item.quantity);
  if (allReceived) {
    order.status = PurchaseOrderStatus.RECEIVED;
    await manager.getRepository(PurchaseOrder).save(order);
  }
  const lines: JournalLineInput[] = [
    { accountCode: ACCOUNT_CODES.INVENTORY, debit: receivedAmount },
    { accountCode: ACCOUNT_CODES.ACCOUNTS_PAYABLE, credit: receivedAmount },
  ];
  const cleanLines = lines.filter((line) => (line.debit ?? 0) > 0 || (line.credit ?? 0) > 0);
  if (cleanLines.length > 0) {
    await postJournalEntry(manager, ctx.tenantId, {
      entryDate: receivedAt,
      description: `Goods receipt ${saved.number}`,
      referenceType: 'purchase_receipt',
      referenceId: saved.id,
      currency: order.currency,
      lines: cleanLines,
    });
  }
  ctx.backdates.push({ table: 'goods_receipts', id: saved.id, date: receivedAt });
  return saved;
};

export async function seedDemoTransactions(overrides: DataSourceOverrides = {}): Promise<void> {
  const ds = createDataSource(overrides);
  await ds.initialize();
  try {
    const tenant = await ds.getRepository(Tenant).findOneBy({ id: DEFAULT_TENANT_ID });
    if (!tenant) {
      throw new Error('Tenant not found. Run `pnpm seed` first.');
    }

    const orderRepo = ds.getRepository(SalesOrder);
    const invoiceRepo = ds.getRepository(Invoice);
    const poRepo = ds.getRepository(PurchaseOrder);
    const hasTransactions =
      (await orderRepo.countBy({ tenantId: tenant.id })) > 0 ||
      (await invoiceRepo.countBy({ tenantId: tenant.id })) > 0 ||
      (await poRepo.countBy({ tenantId: tenant.id })) > 0;
    if (hasTransactions) {
      console.log(`Demo transactions already seeded for tenant: ${tenant.name} (skipped)`);
      return;
    }

    const warehouses = await ds.getRepository(Warehouse).findBy({ tenantId: tenant.id });
    const products = await ds.getRepository(Product).findBy({ tenantId: tenant.id });
    const customers = await ds.getRepository(Customer).findBy({ tenantId: tenant.id });
    const suppliers = await ds.getRepository(Supplier).findBy({ tenantId: tenant.id });

    const mainWarehouse = warehouses[0];
    if (!mainWarehouse || products.length === 0 || customers.length === 0 || suppliers.length === 0) {
      throw new Error('Run `pnpm db:seed:demo` first to create warehouses, products, customers and suppliers.');
    }

    const ctx: Ctx = {
      tenantId: tenant.id,
      mainWarehouse,
      productsBySku: new Map(products.map((p) => [p.sku, p])),
      customersByCode: new Map(customers.map((c) => [c.code, c])),
      suppliersByCode: new Map(suppliers.map((s) => [s.code, s])),
      backdates: [],
    };

    const bySku = (sku: string): Product => {
      const product = ctx.productsBySku.get(sku);
      if (!product) {
        throw new Error(`Product ${sku} not found in demo catalog`);
      }
      return product;
    };
    const customer = (code: string): Customer => {
      const found = ctx.customersByCode.get(code);
      if (!found) {
        throw new Error(`Customer ${code} not found`);
      }
      return found;
    };
    const supplier = (code: string): Supplier => {
      const found = ctx.suppliersByCode.get(code);
      if (!found) {
        throw new Error(`Supplier ${code} not found`);
      }
      return found;
    };

    const results = {
      quotes: 0,
      orders: 0,
      invoices: 0,
      creditNotes: 0,
      payments: 0,
      purchaseOrders: 0,
      receipts: 0,
      lowStockProducts: 0,
    };

    await ds.transaction(async (manager) => {
      results.quotes += 1;
      await createSalesOrder(manager, ctx, {
        kind: SalesOrderKind.QUOTE,
        status: SalesOrderStatus.DRAFT,
        customer: customer('C-003'),
        issueOffset: -5,
        dueOffset: null,
        lines: [
          { product: bySku('OFF-001'), quantity: 10 },
          { product: bySku('OFF-002'), quantity: 5 },
        ],
      });
      results.quotes += 1;
      await createSalesOrder(manager, ctx, {
        kind: SalesOrderKind.QUOTE,
        status: SalesOrderStatus.DRAFT,
        customer: customer('C-004'),
        issueOffset: -3,
        dueOffset: null,
        lines: [
          { product: bySku('FBT-004'), quantity: 20 },
          { product: bySku('FBT-002'), quantity: 10 },
        ],
      });

      results.orders += 1;
      await createSalesOrder(manager, ctx, {
        kind: SalesOrderKind.ORDER,
        status: SalesOrderStatus.CONFIRMED,
        customer: customer('C-002'),
        issueOffset: -8,
        dueOffset: 5,
        lines: [
          { product: bySku('CLN-001'), quantity: 30 },
          { product: bySku('CLN-002'), quantity: 25 },
          { product: bySku('CLN-003'), quantity: 12 },
        ],
      });
      results.orders += 1;
      await createSalesOrder(manager, ctx, {
        kind: SalesOrderKind.ORDER,
        status: SalesOrderStatus.CANCELLED,
        customer: customer('C-003'),
        issueOffset: -6,
        dueOffset: null,
        lines: [
          { product: bySku('HDW-001'), quantity: 5 },
          { product: bySku('HDW-002'), quantity: 4 },
        ],
      });
      results.orders += 1;
      await createSalesOrder(manager, ctx, {
        kind: SalesOrderKind.ORDER,
        status: SalesOrderStatus.CONFIRMED,
        customer: customer('C-005'),
        issueOffset: -4,
        dueOffset: 20,
        lines: [
          { product: bySku('FBT-003'), quantity: 20 },
          { product: bySku('FBT-004'), quantity: 10 },
        ],
      });

      results.invoices += 1;
      const inv1 = await createInvoice(manager, ctx, {
        customer: customer('C-001'),
        issueOffset: -45,
        dueOffset: -15,
        lines: [
          { product: bySku('FBT-001'), quantity: 10 },
          { product: bySku('FBT-002'), quantity: 5 },
        ],
      });
      results.payments += 1;
      await recordPayment(manager, ctx, inv1, inv1.total, PaymentMethod.TRANSFER, -40);

      results.invoices += 1;
      const inv2 = await createInvoice(manager, ctx, {
        customer: customer('C-002'),
        issueOffset: -35,
        dueOffset: -5,
        lines: [
          { product: bySku('CLN-001'), quantity: 20 },
          { product: bySku('CLN-003'), quantity: 10 },
        ],
      });
      results.payments += 1;
      await recordPayment(manager, ctx, inv2, round2(inv2.total / 2), PaymentMethod.TRANSFER, -30);

      results.invoices += 1;
      const inv3 = await createInvoice(manager, ctx, {
        customer: customer('C-003'),
        issueOffset: -20,
        dueOffset: -5,
        lines: [
          { product: bySku('OFF-001'), quantity: 30 },
          { product: bySku('OFF-002'), quantity: 12 },
          { product: bySku('OFF-003'), quantity: 15 },
        ],
      });
      results.payments += 1;
      await recordPayment(manager, ctx, inv3, inv3.total, PaymentMethod.CARD, -18);

      results.invoices += 1;
      await createInvoice(manager, ctx, {
        customer: customer('C-005'),
        issueOffset: -40,
        dueOffset: -10,
        lines: [
          { product: bySku('FBT-003'), quantity: 15 },
          { product: bySku('FBT-002'), quantity: 8 },
        ],
      });

      results.invoices += 1;
      const inv5 = await createInvoice(manager, ctx, {
        customer: customer('C-004'),
        issueOffset: -10,
        dueOffset: 20,
        lines: [
          { product: bySku('FBT-004'), quantity: 10 },
          { product: bySku('FBT-001'), quantity: 5 },
        ],
      });
      results.payments += 1;
      await recordPayment(manager, ctx, inv5, round2(inv5.total / 2), PaymentMethod.CASH, -8);

      results.orders += 1;
      const orderForInvoice = await createSalesOrder(manager, ctx, {
        kind: SalesOrderKind.ORDER,
        status: SalesOrderStatus.CONFIRMED,
        customer: customer('C-001'),
        issueOffset: -12,
        dueOffset: -2,
        lines: [
          { product: bySku('FBT-001'), quantity: 15 },
          { product: bySku('FBT-002'), quantity: 10 },
        ],
      });
      await createInvoiceFromOrder(manager, ctx, orderForInvoice, -5);
      results.invoices += 1;

      results.creditNotes += 1;
      await createCreditNote(manager, ctx, inv3, [{ product: bySku('OFF-002'), quantity: 5 }], -2);

      results.purchaseOrders += 1;
      await createPurchaseOrder(manager, ctx, {
        supplier: supplier('S-001'),
        issueOffset: -2,
        expectedOffset: 8,
        lines: [{ product: bySku('FBT-001'), quantity: 50 }],
      });

      results.purchaseOrders += 1;
      const po2 = await createPurchaseOrder(manager, ctx, {
        supplier: supplier('S-003'),
        issueOffset: -6,
        expectedOffset: 5,
        lines: [{ product: bySku('OFF-001'), quantity: 100 }],
      });
      po2.status = PurchaseOrderStatus.APPROVED;
      await manager.getRepository(PurchaseOrder).save(po2);

      results.purchaseOrders += 1;
      const po3 = await createPurchaseOrder(manager, ctx, {
        supplier: supplier('S-002'),
        issueOffset: -40,
        expectedOffset: -35,
        lines: [
          { product: bySku('CLN-001'), quantity: 60 },
          { product: bySku('CLN-002'), quantity: 50 },
        ],
      });
      po3.status = PurchaseOrderStatus.APPROVED;
      await manager.getRepository(PurchaseOrder).save(po3);
      results.receipts += 1;
      await receivePurchaseOrder(manager, ctx, po3, -35);

      const lowStockProduct = await manager.getRepository(Product).save(
        manager.getRepository(Product).create({
          tenantId: ctx.tenantId,
          sku: 'FBT-005',
          name: 'Sparkling Water 12-pack',
          categoryId:
            (
              await manager.getRepository(Category).findOneBy({
                tenantId: ctx.tenantId,
                name: 'Food & Beverage',
              })
            )?.id ?? null,
          brand: 'ClearSpring',
          unitOfMeasure: 'case',
          purchasePrice: 5.4,
          salePrice: 9.9,
          enabled: true,
        }),
      );
      await applyStockMovement(manager, {
        tenantId: ctx.tenantId,
        movementType: MovementType.INBOUND,
        productId: lowStockProduct.id,
        warehouseId: ctx.mainWarehouse.id,
        quantity: 5,
        unitCost: 5.4,
        referenceType: 'seed',
      });
      results.lowStockProducts += 1;

      for (const bd of ctx.backdates) {
        await backdate(manager, bd.table, bd.id, bd.date);
      }
    });

    console.log(`Seeded demo transactions for tenant: ${tenant.name}`);
    console.log(`  Quotes: ${results.quotes}`);
    console.log(`  Sales orders: ${results.orders}`);
    console.log(`  Invoices: ${results.invoices}`);
    console.log(`  Credit notes: ${results.creditNotes}`);
    console.log(`  Payments: ${results.payments}`);
    console.log(`  Purchase orders: ${results.purchaseOrders}`);
    console.log(`  Goods receipts: ${results.receipts}`);
    console.log(`  Low-stock demo products: ${results.lowStockProducts}`);
  } finally {
    await ds.destroy();
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  seedDemoTransactions().catch((error) => {
    console.error(error);
    process.exit(1);
  });
}
