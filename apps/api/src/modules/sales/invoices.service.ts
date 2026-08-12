import { createHash } from 'node:crypto';
import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { DataSource, EntityManager, FindOptionsWhere, In, Not, Repository } from 'typeorm';
import {
  DocumentSeriesKind,
  InvoiceStatus,
  InvoiceType,
  MovementType,
  SalesOrderKind,
  SalesOrderStatus,
} from '@aptifum/core';
import {
  ACCOUNT_CODES,
  applyStockMovement,
  ChartAccountNotFoundError,
  Customer,
  IdempotencyKey,
  InsufficientStockError,
  Invoice,
  InvoiceItem,
  JournalEntryPeriodClosedError,
  JournalEntryUnbalancedError,
  Payment,
  postJournalEntry,
  Product,
  ProductStock,
  ProductVariant,
  SalesOrder,
  Tenant,
  WALK_IN_CUSTOMER,
  Warehouse,
} from '@aptifum/database';
import type { JournalLineInput } from '@aptifum/database';
import { OutboxService } from '../outbox/outbox.service';
import { ExchangeRatesService } from '../exchange-rates/exchange-rates.service';
import { searchDocumentIds } from '../../common/query/document-search';
import { computeTotals, nextDocumentNumber, round2, today } from './helpers';
import { CreateInvoiceDto } from './dto/create-invoice.dto';
import { CreatePaymentDto } from './dto/create-payment.dto';

@Injectable()
export class InvoicesService {
  constructor(
    @InjectRepository(Invoice) private readonly invoicesRepo: Repository<Invoice>,
    @InjectRepository(Warehouse) private readonly warehousesRepo: Repository<Warehouse>,
    @InjectRepository(Product) private readonly productsRepo: Repository<Product>,
    @InjectRepository(ProductVariant)
    private readonly variantsRepo: Repository<ProductVariant>,
    @InjectRepository(IdempotencyKey)
    private readonly idempotencyRepo: Repository<IdempotencyKey>,
    @InjectDataSource() private readonly dataSource: DataSource,
    private readonly outbox: OutboxService,
    private readonly exchangeRates: ExchangeRatesService,
  ) {}

  private scoped(tenantId: string | null): FindOptionsWhere<Invoice> {
    return tenantId ? { tenantId } : {};
  }

  async findAll(
    tenantId: string | null,
    page: number,
    limit: number,
    opts: { q?: string; status?: string; type?: string } = {},
  ) {
    if (opts.status && !(Object.values(InvoiceStatus) as string[]).includes(opts.status)) {
      throw new BadRequestException(`Invalid status: ${opts.status}`);
    }
    if (opts.type && !(Object.values(InvoiceType) as string[]).includes(opts.type)) {
      throw new BadRequestException(`Invalid type: ${opts.type}`);
    }
    const where: FindOptionsWhere<Invoice> = this.scoped(tenantId);
    if (opts.status) where.status = opts.status as InvoiceStatus;
    if (opts.type) where.type = opts.type as InvoiceType;
    if (opts.q) {
      const ids = await searchDocumentIds(this.invoicesRepo, tenantId, opts.q, {
        partyColumn: 'customer_id',
        partyTable: 'customers',
        itemTable: 'invoice_items',
        itemFkColumn: 'invoice_id',
      });
      if (ids.length === 0) {
        return { data: [], meta: { page, limit, total: 0 } };
      }
      where.id = In(ids);
    }
    const [rows, total] = await this.invoicesRepo.findAndCount({
      where,
      skip: (page - 1) * limit,
      take: limit,
      order: { createdAt: 'DESC' },
      relations: { customer: true },
    });
    return { data: rows, meta: { page, limit, total } };
  }

  async findOne(tenantId: string | null, id: string) {
    const invoice = await this.invoicesRepo.findOne({
      where: { id, ...this.scoped(tenantId) },
      relations: { customer: true, items: { product: true }, payments: true },
    });
    if (!invoice) {
      throw new NotFoundException('Invoice not found');
    }
    return invoice;
  }

  async create(
    tenantId: string | null,
    userId: string | null,
    dto: CreateInvoiceDto,
    idempotencyKey?: string,
  ) {
    return this.withIdempotency(
      idempotencyKey,
      `invoice:${JSON.stringify(dto)}`,
      async () => {
        this.assertTenant(tenantId);
        if (dto.orderId) {
          return this.createFromOrder(tenantId, userId, dto);
        }
        return this.createDirect(tenantId, userId, dto);
      },
    );
  }

  async recordPayment(
    tenantId: string | null,
    userId: string | null,
    invoiceId: string,
    dto: CreatePaymentDto,
    idempotencyKey?: string,
  ) {
    return this.withIdempotency(
      idempotencyKey,
      `payment:${JSON.stringify(dto)}`,
      async () => {
        this.assertTenant(tenantId);
        return this.dataSource.transaction(async (manager) => {
          const invoicesRepo = manager.getRepository(Invoice);
          const invoice = await invoicesRepo
            .createQueryBuilder('invoice')
            .setLock('pessimistic_write')
            .where('invoice.tenant_id = :tenantId', { tenantId })
            .andWhere('invoice.id = :id', { id: invoiceId })
            .andWhere('invoice.type = :type', { type: InvoiceType.INVOICE })
            .getOne();
          if (!invoice) {
            throw new NotFoundException('Invoice not found');
          }
          if (invoice.status === InvoiceStatus.CANCELLED) {
            throw new BadRequestException('Cannot pay a cancelled invoice');
          }
          if (dto.currency && dto.currency !== invoice.currency) {
            throw new BadRequestException('Payment currency does not match invoice currency');
          }
          const newPaid = round2(invoice.paidAmount + dto.amount);
          if (newPaid - invoice.total > 0.005) {
            throw new BadRequestException('Payment exceeds invoice balance');
          }
          invoice.paidAmount = newPaid;
          invoice.balanceDue = round2(invoice.total - newPaid);
          await invoicesRepo.save(invoice);
          const functional = await this.functionalCurrency(manager, tenantId);
          const receivedAt = dto.receivedAt ? new Date(dto.receivedAt) : new Date();
          const rate =
            dto.exchangeRate ??
            (await this.exchangeRates.resolveRate(
              tenantId,
              functional,
              invoice.currency,
              receivedAt.toISOString().slice(0, 10),
            ));
          const payment = await manager.getRepository(Payment).save(
            manager.getRepository(Payment).create({
              tenantId,
              invoiceId: invoice.id,
              method: dto.method,
              amount: dto.amount,
              receivedAt,
              exchangeRate: rate,
              reference: dto.reference ?? null,
              notes: dto.notes ?? null,
            }),
          );
          await this.postPaymentEntry(manager, tenantId, userId, invoice, payment, rate, functional);
          await this.outbox.emit(manager, tenantId, {
            eventType: 'payment.received',
            aggregateType: 'payment',
            aggregateId: payment.id,
            payload: { invoiceId: invoice.id, amount: payment.amount, method: payment.method },
            tenantId,
            userId,
          });
          return {
            id: payment.id,
            invoiceId: invoice.id,
            method: payment.method,
            amount: payment.amount,
            paidAmount: invoice.paidAmount,
            balanceDue: invoice.balanceDue,
          };
        });
      },
    );
  }

  async createCreditNote(
    tenantId: string | null,
    userId: string | null,
    invoiceId: string,
    idempotencyKey?: string,
  ) {
    return this.withIdempotency(
      idempotencyKey,
      `credit-note:${invoiceId}`,
      async () => {
        this.assertTenant(tenantId);
        return this.dataSource.transaction(async (manager) => {
          const invoicesRepo = manager.getRepository(Invoice);
          const original = await invoicesRepo.findOne({
            where: {
              id: invoiceId,
              tenantId,
              type: InvoiceType.INVOICE,
              status: InvoiceStatus.ISSUED,
            },
            relations: { items: true },
          });
          if (!original) {
            throw new NotFoundException('Issued invoice not found');
          }
          const { number, seriesId } = await nextDocumentNumber(
            manager,
            tenantId,
            DocumentSeriesKind.CREDIT_NOTE,
          );
          const items = original.items.map((item) =>
            manager.getRepository(InvoiceItem).create({
              tenantId,
              productId: item.productId,
              variantId: item.variantId ?? null,
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
          const functional = await this.functionalCurrency(manager, tenantId);
          const creditNote = invoicesRepo.create({
            tenantId,
            number,
            seriesId,
            type: InvoiceType.CREDIT_NOTE,
            status: InvoiceStatus.ISSUED,
            customerId: original.customerId,
            orderId: null,
            warehouseId: original.warehouseId,
            issueDate: today(),
            dueDate: null,
            currency: original.currency,
            exchangeRate: original.exchangeRate ?? 1,
            ...totals,
            paidAmount: 0,
            balanceDue: 0,
            notes: `Credit note for invoice ${original.number}`,
            items,
          });
          const saved = await invoicesRepo.save(creditNote);
          let cogs = 0;
          for (const item of original.items) {
            const avgCost = await this.applyReturn(
              manager,
              tenantId,
              userId,
              item.productId,
              original.warehouseId,
              item.quantity,
              saved.id,
              item.variantId ?? null,
            );
            cogs = round2(cogs + item.quantity * avgCost);
          }
          await this.postSaleEntry(
            manager,
            tenantId,
            userId,
            saved,
            cogs,
            original.exchangeRate ?? 1,
            functional,
          );
          await this.outbox.emit(manager, tenantId, {
            eventType: 'credit_note.issued',
            aggregateType: 'invoice',
            aggregateId: saved.id,
        payload: {
          number: saved.number,
          customerId: saved.customerId,
          total: saved.total,
          invoiceId: saved.id,
        },
            tenantId,
            userId,
          });
          return this.invoiceView(saved, items);
        });
      },
    );
  }

  private async createFromOrder(
    tenantId: string,
    userId: string | null,
    dto: CreateInvoiceDto,
  ) {
    return this.dataSource.transaction(async (manager) => {
      const ordersRepo = manager.getRepository(SalesOrder);
      const invoicesRepo = manager.getRepository(Invoice);
      const order = await ordersRepo.findOne({
        where: { id: dto.orderId, tenantId },
        relations: { items: true },
      });
      if (!order) {
        throw new NotFoundException('Order not found');
      }
      if (order.kind !== SalesOrderKind.ORDER) {
        throw new BadRequestException('Quotes must be converted to orders before invoicing');
      }
      if (order.status !== SalesOrderStatus.CONFIRMED) {
        throw new BadRequestException('Order must be confirmed before invoicing');
      }
      const alreadyInvoiced = await invoicesRepo.findOne({
        where: {
          tenantId,
          orderId: order.id,
          type: InvoiceType.INVOICE,
          status: Not(InvoiceStatus.CANCELLED),
        },
      });
      if (alreadyInvoiced) {
        throw new ConflictException('Order has already been invoiced');
      }
      const { number, seriesId } = await nextDocumentNumber(
        manager,
        tenantId,
        DocumentSeriesKind.INVOICE,
      );
      const items = order.items.map((item) =>
        manager.getRepository(InvoiceItem).create({
          tenantId,
          productId: item.productId,
          variantId: item.variantId ?? null,
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
      const functional = await this.functionalCurrency(manager, tenantId);
      const currency = dto.currency ?? order.currency;
      const rate =
        dto.exchangeRate ??
        (await this.exchangeRates.resolveRate(tenantId, functional, currency, today()));
      const invoice = invoicesRepo.create({
        tenantId,
        number,
        seriesId,
        type: InvoiceType.INVOICE,
        status: InvoiceStatus.ISSUED,
        customerId: order.customerId,
        orderId: order.id,
        warehouseId: order.warehouseId,
        issueDate: today(),
        dueDate: order.dueDate,
        currency,
        exchangeRate: rate,
        ...totals,
        paidAmount: 0,
        balanceDue: totals.total,
        notes: dto.notes ?? null,
        items,
      });
      const saved = await invoicesRepo.save(invoice);
      let cogs = 0;
      for (const item of order.items) {
        const avgCost = await this.applyOutbound(
          manager,
          tenantId,
          userId,
          item.productId,
          order.warehouseId,
          item.quantity,
          saved.id,
          item.variantId ?? null,
        );
        cogs = round2(cogs + item.quantity * avgCost);
      }
      await this.postSaleEntry(manager, tenantId, userId, saved, cogs, rate, functional);
      await this.outbox.emit(manager, tenantId, {
        eventType: 'invoice.issued',
        aggregateType: 'invoice',
        aggregateId: saved.id,
        payload: { number: saved.number, customerId: saved.customerId, total: saved.total },
        tenantId,
        userId,
      });
      order.status = SalesOrderStatus.INVOICED;
      await ordersRepo.save(order);
      return this.invoiceView(saved, items);
    });
  }

  private async createDirect(
    tenantId: string,
    userId: string | null,
    dto: CreateInvoiceDto,
  ) {
    if (!dto.warehouseId || !dto.items) {
      throw new BadRequestException('Direct invoices require warehouseId and items');
    }
    const { warehouseId, items, notes, discount, dueDate } = dto;
    const warehouse = await this.warehousesRepo.findOneBy({
      id: warehouseId,
      tenantId,
    });
    if (!warehouse) {
      throw new NotFoundException('Warehouse not found');
    }
    const products = await this.loadProducts(
      tenantId,
      items.map((item) => item.productId),
    );
    const variants = await this.loadVariants(
      tenantId,
      items.filter((item) => item.variantId).map((item) => item.variantId as string),
    );

    return this.dataSource.transaction(async (manager) => {
      const invoicesRepo = manager.getRepository(Invoice);
      const customer = await this.resolveCustomer(manager, tenantId, dto.customerId);
      const { number, seriesId } = await nextDocumentNumber(
        manager,
        tenantId,
        DocumentSeriesKind.INVOICE,
      );
      const invoiceItems = items.map((item) => {
        const product = products.get(item.productId);
        if (!product) {
          throw new NotFoundException(`Product ${item.productId} not found`);
        }
        const variant = item.variantId ? variants.get(item.variantId) : undefined;
        if (item.variantId && !variant) {
          throw new NotFoundException(`Variant ${item.variantId} not found`);
        }
        if (variant && variant.productId !== product.id) {
          throw new BadRequestException(`Variant ${item.variantId} does not belong to product ${product.id}`);
        }
        const unitPrice = item.unitPrice ?? variant?.salePrice ?? product.salePrice;
        const quantity = item.quantity;
        return manager.getRepository(InvoiceItem).create({
          tenantId,
          productId: item.productId,
          variantId: item.variantId ?? null,
          description: item.description ?? product.name,
          quantity,
          unitPrice,
          discount: 0,
          taxRate: item.taxRate ?? 0,
          taxAmount: round2(quantity * unitPrice * (item.taxRate ?? 0)),
          lineTotal: round2(quantity * unitPrice),
        });
      });
      const totals = computeTotals(invoiceItems, discount ?? 0);
      const functional = await this.functionalCurrency(manager, tenantId);
      const currency = dto.currency ?? customer.currency;
      const rate =
        dto.exchangeRate ??
        (await this.exchangeRates.resolveRate(tenantId, functional, currency, today()));
      const invoice = invoicesRepo.create({
        tenantId,
        number,
        seriesId,
        type: InvoiceType.INVOICE,
        status: InvoiceStatus.ISSUED,
        customerId: customer.id,
        orderId: null,
        warehouseId,
        issueDate: today(),
        dueDate: dueDate ?? null,
        currency,
        exchangeRate: rate,
        ...totals,
        paidAmount: 0,
        balanceDue: totals.total,
        notes: notes ?? null,
        items: invoiceItems,
      });
      const saved = await invoicesRepo.save(invoice);
      let cogs = 0;
      for (const item of items) {
        const avgCost = await this.applyOutbound(
          manager,
          tenantId,
          userId,
          item.productId,
          warehouseId,
          item.quantity,
          saved.id,
          item.variantId ?? null,
        );
        cogs = round2(cogs + item.quantity * avgCost);
      }
      await this.postSaleEntry(manager, tenantId, userId, saved, cogs, rate, functional);
      await this.outbox.emit(manager, tenantId, {
        eventType: 'invoice.issued',
        aggregateType: 'invoice',
        aggregateId: saved.id,
        payload: { number: saved.number, customerId: saved.customerId, total: saved.total },
        tenantId,
        userId,
      });
      return this.invoiceView(saved, invoiceItems);
    });
  }

  private async resolveCustomer(
    manager: EntityManager,
    tenantId: string,
    customerId?: string,
  ): Promise<Customer> {
    const repo = manager.getRepository(Customer);
    if (customerId) {
      const customer = await repo.findOneBy({ id: customerId, tenantId });
      if (!customer) {
        throw new NotFoundException('Customer not found');
      }
      return customer;
    }
    let customer = await repo.findOneBy({
      code: WALK_IN_CUSTOMER.code,
      tenantId,
    });
    if (!customer) {
      try {
        customer = await repo.save(
          repo.create({
            tenantId,
            code: WALK_IN_CUSTOMER.code,
            tradeName: WALK_IN_CUSTOMER.tradeName,
            currency: WALK_IN_CUSTOMER.currency,
            active: true,
          }),
        );
      } catch {
        customer = await repo.findOneBy({
          code: WALK_IN_CUSTOMER.code,
          tenantId,
        });
        if (!customer) {
          throw new BadRequestException('Could not resolve walk-in customer');
        }
      }
    }
    return customer;
  }

  private async applyOutbound(
    manager: EntityManager,
    tenantId: string,
    userId: string | null,
    productId: string,
    warehouseId: string,
    quantity: number,
    invoiceId: string,
    variantId?: string | null,
  ): Promise<number> {
    const stock = await manager.getRepository(ProductStock).findOneBy({
      tenantId,
      productId,
      warehouseId,
      ...(variantId ? { variantId } : {}),
    });
    const unitCost = stock?.averageCost ?? 0;
    try {
      await applyStockMovement(manager, {
        tenantId,
        movementType: MovementType.OUTBOUND,
        productId,
        variantId: variantId ?? null,
        warehouseId,
        quantity,
        unitCost,
        referenceType: 'invoice',
        referenceId: invoiceId,
        userId,
      });
    } catch (error) {
      if (error instanceof InsufficientStockError) {
        throw new BadRequestException(`Insufficient stock for product ${productId}`);
      }
      throw error;
    }
    return unitCost;
  }

  private async applyReturn(
    manager: EntityManager,
    tenantId: string,
    userId: string | null,
    productId: string,
    warehouseId: string | null,
    quantity: number,
    creditNoteId: string,
    variantId?: string | null,
  ): Promise<number> {
    if (!warehouseId) {
      return 0;
    }
    await applyStockMovement(manager, {
      tenantId,
      movementType: MovementType.RETURN,
      productId,
      variantId: variantId ?? null,
      warehouseId,
      quantity,
      unitCost: 0,
      referenceType: 'credit_note',
      referenceId: creditNoteId,
      userId,
    });
    const stock = await manager.getRepository(ProductStock).findOneBy({
      tenantId,
      productId,
      warehouseId,
      ...(variantId ? { variantId } : {}),
    });
    return stock?.averageCost ?? 0;
  }

  private async functionalCurrency(manager: EntityManager, tenantId: string): Promise<string> {
    const tenant = await manager.getRepository(Tenant).findOneBy({ id: tenantId });
    return tenant?.defaultCurrency ?? 'USD';
  }

  private async postSaleEntry(
    manager: EntityManager,
    tenantId: string,
    userId: string | null,
    invoice: Invoice,
    cogs: number,
    rate: number,
    functionalCurrency: string,
  ): Promise<void> {
    const toF = (value: number): number => round2(value * rate);
    try {
      let lines: JournalLineInput[];
      if (invoice.type === InvoiceType.CREDIT_NOTE) {
        lines = [
          {
            accountCode: ACCOUNT_CODES.SALES_RETURNS,
            debit: toF(invoice.subtotal - invoice.discount),
          },
          { accountCode: ACCOUNT_CODES.OUTPUT_VAT, debit: toF(invoice.tax) },
          { accountCode: ACCOUNT_CODES.ACCOUNTS_RECEIVABLE, credit: toF(invoice.total) },
        ];
        if (cogs > 0) {
          lines.push(
            { accountCode: ACCOUNT_CODES.INVENTORY, debit: cogs },
            { accountCode: ACCOUNT_CODES.COST_OF_GOODS_SOLD, credit: cogs },
          );
        }
      } else {
        lines = [
          { accountCode: ACCOUNT_CODES.ACCOUNTS_RECEIVABLE, debit: toF(invoice.total) },
          {
            accountCode: ACCOUNT_CODES.SALES_REVENUE,
            credit: toF(invoice.subtotal - invoice.discount),
          },
          { accountCode: ACCOUNT_CODES.OUTPUT_VAT, credit: toF(invoice.tax) },
        ];
        if (cogs > 0) {
          lines.push(
            { accountCode: ACCOUNT_CODES.COST_OF_GOODS_SOLD, debit: cogs },
            { accountCode: ACCOUNT_CODES.INVENTORY, credit: cogs },
          );
        }
      }
      const cleanLines = lines.filter(
        (line) => (line.debit ?? 0) > 0 || (line.credit ?? 0) > 0,
      );
      if (cleanLines.length === 0) {
        return;
      }
      await postJournalEntry(manager, tenantId, {
        entryDate: invoice.issueDate,
        description:
          invoice.type === InvoiceType.CREDIT_NOTE
            ? `Credit note ${invoice.number}`
            : `Invoice ${invoice.number}`,
        referenceType: invoice.type === InvoiceType.CREDIT_NOTE ? 'credit_note' : 'invoice',
        referenceId: invoice.id,
        currency: functionalCurrency,
        userId,
        lines: cleanLines,
      });
    } catch (error) {
      this.mapPostError(error);
    }
  }

  private async postPaymentEntry(
    manager: EntityManager,
    tenantId: string,
    userId: string | null,
    invoice: Invoice,
    payment: Payment,
    rate: number,
    functionalCurrency: string,
  ): Promise<void> {
    try {
      const bookedRate = invoice.exchangeRate ?? 1;
      const received = round2(payment.amount * rate);
      const settled = round2(payment.amount * bookedRate);
      const fx = round2(received - settled);
      const lines: JournalLineInput[] = [
        { accountCode: ACCOUNT_CODES.CASH, debit: received },
        { accountCode: ACCOUNT_CODES.ACCOUNTS_RECEIVABLE, credit: settled },
      ];
      if (fx > 0.005) {
        lines.push({ accountCode: ACCOUNT_CODES.FOREIGN_EXCHANGE_GAIN, credit: fx });
      } else if (fx < -0.005) {
        lines.push({ accountCode: ACCOUNT_CODES.FOREIGN_EXCHANGE_LOSS, debit: -fx });
      }
      await postJournalEntry(manager, tenantId, {
        entryDate: payment.receivedAt.toISOString().slice(0, 10),
        description: `Payment ${invoice.number}`,
        referenceType: 'payment',
        referenceId: payment.id,
        currency: functionalCurrency,
        userId,
        lines,
      });
    } catch (error) {
      this.mapPostError(error);
    }
  }

  private mapPostError(error: unknown): never {
    if (error instanceof ChartAccountNotFoundError) {
      throw new BadRequestException(error.message);
    }
    if (error instanceof JournalEntryPeriodClosedError) {
      throw new ConflictException(error.message);
    }
    if (error instanceof JournalEntryUnbalancedError) {
      throw new ConflictException(error.message);
    }
    throw error;
  }

  private async loadProducts(tenantId: string, ids: string[]): Promise<Map<string, Product>> {
    const products = await this.productsRepo.findBy({ tenantId, id: In(ids) });
    return new Map(products.map((product) => [product.id, product]));
  }

  private async loadVariants(
    tenantId: string,
    ids: string[],
  ): Promise<Map<string, ProductVariant>> {
    if (ids.length === 0) {
      return new Map();
    }
    const variants = await this.variantsRepo.findBy({ tenantId, id: In(ids) });
    return new Map(variants.map((variant) => [variant.id, variant]));
  }

  private async withIdempotency<T>(
    key: string | undefined,
    requestHashInput: string,
    operation: () => Promise<T>,
  ): Promise<T> {
    if (!key) {
      return operation();
    }
    const existing = await this.idempotencyRepo.findOneBy({ key });
    if (existing) {
      return existing.response as T;
    }
    const result = await operation();
    const requestHash = createHash('sha256').update(requestHashInput).digest('hex').slice(0, 64);
    await this.idempotencyRepo.save(
      this.idempotencyRepo.create({ key, requestHash, response: result }),
    );
    return result;
  }

  private invoiceView(invoice: Invoice, items: InvoiceItem[]) {
    return {
      id: invoice.id,
      number: invoice.number,
      type: invoice.type,
      status: invoice.status,
      customerId: invoice.customerId,
      orderId: invoice.orderId,
      warehouseId: invoice.warehouseId,
      issueDate: invoice.issueDate,
      dueDate: invoice.dueDate,
      currency: invoice.currency,
      exchangeRate: invoice.exchangeRate,
      subtotal: invoice.subtotal,
      discount: invoice.discount,
      tax: invoice.tax,
      total: invoice.total,
      paidAmount: invoice.paidAmount,
      balanceDue: invoice.balanceDue,
      items: items.map((item) => ({
        productId: item.productId,
        variantId: item.variantId ?? null,
        description: item.description,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        taxRate: item.taxRate,
        taxAmount: item.taxAmount,
        lineTotal: item.lineTotal,
      })),
    };
  }

  private assertTenant(tenantId: string | null): asserts tenantId is string {
    if (!tenantId) {
      throw new BadRequestException('Tenant context required');
    }
  }
}
