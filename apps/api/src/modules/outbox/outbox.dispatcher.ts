import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { OutboxEvent } from '@aptifum/database';
import { OutboxService } from './outbox.service';

@Injectable()
export class OutboxDispatcher {
  private readonly logger = new Logger(OutboxDispatcher.name);

  constructor(private readonly outbox: OutboxService) {}

  @Cron(CronExpression.EVERY_10_SECONDS)
  async dispatchPending(): Promise<void> {
    let batch: OutboxEvent[] = [];
    try {
      batch = await this.outbox.findPending(100);
    } catch (error) {
      this.logger.error('Failed to read pending outbox events', error as Error);
      return;
    }
    if (batch.length === 0) {
      return;
    }
    for (const event of batch) {
      try {
        await this.handle(event);
        await this.outbox.markDispatched(event);
        this.logger.log(
          `Dispatched outbox event ${event.id} (${event.eventType}) for tenant ${event.tenantId}`,
        );
      } catch (error) {
        await this.outbox.markFailed(event, error);
      }
    }
  }

  private async handle(event: OutboxEvent): Promise<void> {
    switch (event.eventType) {
      case 'invoice.issued':
      case 'credit_note.issued':
      case 'payment.received':
      case 'purchase_receipt':
      case 'payroll.posted':
      case 'production.completed':
        this.logger.log(
          `[${event.eventType}] aggregate=${event.aggregateType}:${event.aggregateId}`,
        );
        return;
      default:
        this.logger.warn(`No handler for outbox event type "${event.eventType}"`);
        return;
    }
  }
}
