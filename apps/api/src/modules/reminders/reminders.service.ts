import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { DataSource, MoreThanOrEqual, Repository } from 'typeorm';
import { OutboxEvent } from '@aptifum/database';
import { OutboxService } from '../outbox/outbox.service';

interface OverdueInvoiceRow {
  id: string;
  tenant_id: string;
  number: string;
  customer_id: string;
  total: string;
  balance_due: string;
  due_date: string | null;
  days_overdue: string;
}

interface OverdueBillRow {
  id: string;
  tenant_id: string;
  number: string | null;
  supplier_id: string;
  balance_due: string;
  due_date: string | null;
  days_overdue: string;
}

interface PendingApprovalRow {
  id: string;
  tenant_id: string;
  number: string;
  supplier_id: string;
  total: string;
  days_pending: string;
}

@Injectable()
export class RemindersService {
  private readonly logger = new Logger(RemindersService.name);

  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    @InjectRepository(OutboxEvent) private readonly outboxEventsRepo: Repository<OutboxEvent>,
    private readonly outbox: OutboxService,
  ) {}

  @Cron(CronExpression.EVERY_DAY_AT_4AM)
  async runDaily(): Promise<void> {
    const queued = {
      arOverdue: await this.remindOverdueReceivables(),
      apOverdue: await this.remindOverduePayables(),
      pendingApprovals: await this.remindPendingApprovals(),
    };
    this.logger.log(`Due-date reminders queued: ${JSON.stringify(queued)}`);
  }

  private async remindOverdueReceivables(): Promise<number> {
    const rows = await this.dataSource.query<OverdueInvoiceRow[]>(
      `SELECT i.id, i.tenant_id, i.number, i.customer_id, i.total, i.balance_due, i.due_date,
              (CURRENT_DATE - i.due_date::date) AS days_overdue
         FROM invoices i
        WHERE i.deleted_at IS NULL AND i.status = 'issued' AND i.type = 'invoice'
          AND i.balance_due > 0 AND i.due_date IS NOT NULL AND i.due_date::date < CURRENT_DATE`,
    );
    let emitted = 0;
    for (const row of rows) {
      const shouldEmit = await this.emitIfNotReminded({
        eventType: 'reminder.ar_overdue',
        aggregateType: 'invoice',
        aggregateId: row.id,
        tenantId: row.tenant_id,
        payload: {
          invoiceId: row.id,
          number: row.number,
          customerId: row.customer_id,
          total: Number(row.total),
          balanceDue: Number(row.balance_due),
          dueDate: row.due_date,
          daysOverdue: Number(row.days_overdue),
        },
      });
      if (shouldEmit) {
        emitted += 1;
      }
    }
    return emitted;
  }

  private async remindOverduePayables(): Promise<number> {
    const rows = await this.dataSource.query<OverdueBillRow[]>(
      `SELECT sb.id, sb.tenant_id, sb.number, sb.supplier_id, sb.balance_due, sb.due_date,
              (CURRENT_DATE - sb.due_date::date) AS days_overdue
         FROM supplier_bills sb
        WHERE sb.deleted_at IS NULL AND sb.status = 'issued' AND sb.balance_due > 0
          AND sb.due_date IS NOT NULL AND sb.due_date::date < CURRENT_DATE`,
    );
    let emitted = 0;
    for (const row of rows) {
      const shouldEmit = await this.emitIfNotReminded({
        eventType: 'reminder.ap_overdue',
        aggregateType: 'supplier_bill',
        aggregateId: row.id,
        tenantId: row.tenant_id,
        payload: {
          billId: row.id,
          number: row.number,
          supplierId: row.supplier_id,
          balanceDue: Number(row.balance_due),
          dueDate: row.due_date,
          daysOverdue: Number(row.days_overdue),
        },
      });
      if (shouldEmit) {
        emitted += 1;
      }
    }
    return emitted;
  }

  private async remindPendingApprovals(): Promise<number> {
    const rows = await this.dataSource.query<PendingApprovalRow[]>(
      `SELECT po.id, po.tenant_id, po.number, po.supplier_id, po.total,
              (CURRENT_DATE - po.created_at::date) AS days_pending
         FROM purchase_orders po
        WHERE po.deleted_at IS NULL AND po.status = 'draft'
          AND po.created_at::date <= CURRENT_DATE - 2`,
    );
    let emitted = 0;
    for (const row of rows) {
      const shouldEmit = await this.emitIfNotReminded({
        eventType: 'reminder.pending_approval',
        aggregateType: 'purchase_order',
        aggregateId: row.id,
        tenantId: row.tenant_id,
        payload: {
          orderId: row.id,
          number: row.number,
          supplierId: row.supplier_id,
          total: Number(row.total),
          daysPending: Number(row.days_pending),
        },
      });
      if (shouldEmit) {
        emitted += 1;
      }
    }
    return emitted;
  }

  private async emitIfNotReminded(input: {
    eventType: string;
    aggregateType: string;
    aggregateId: string;
    tenantId: string;
    payload: Record<string, unknown>;
  }): Promise<boolean> {
    if (await this.wasRemindedToday(input.eventType, input.tenantId, input.aggregateId)) {
      return false;
    }
    await this.outbox.emit(this.dataSource.manager, input.tenantId, input);
    return true;
  }

  private async wasRemindedToday(
    eventType: string,
    tenantId: string,
    aggregateId: string,
  ): Promise<boolean> {
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);
    const count = await this.outboxEventsRepo.count({
      where: { eventType, tenantId, aggregateId, occurredAt: MoreThanOrEqual(startOfDay) },
    });
    return count > 0;
  }
}
