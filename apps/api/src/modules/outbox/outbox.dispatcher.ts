import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { OutboxEvent } from '@aptifum/database';
import { EmailNotificationsService } from '../email/email-notifications.service';
import { CfdiService } from '../tax/cfdi.service';
import { OutboxService } from './outbox.service';

@Injectable()
export class OutboxDispatcher {
  private readonly logger = new Logger(OutboxDispatcher.name);

  constructor(
    private readonly outbox: OutboxService,
    private readonly notifications: EmailNotificationsService,
    private readonly cfdi: CfdiService,
  ) {}

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
    await this.notifications.handle(event);
    await this.cfdi.handle(event);
  }
}
