import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Headers,
  Param,
  ParseUUIDPipe,
  Post,
  Put,
  Req,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';

import { ModuleName, permission, PaymentProvider } from '@aptifum/core';

import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Public } from '../auth/decorators/public.decorator';
import { RequirePermissions } from '../rbac/decorators/require-permissions.decorator';

import { UpsertPaymentProviderDto } from './dto/upsert-payment-provider.dto';
import { PaymentsService } from './payments.service';

@ApiTags('payments')
@Controller('payments')
export class PaymentsController {
  constructor(private readonly payments: PaymentsService) {}

  @Get('providers')
  @RequirePermissions(permission(ModuleName.PAYMENTS, 'read'))
  @ApiOperation({ summary: 'List payment providers (masked)' })
  listProviders(@CurrentUser() user: { tenantId: string | null }) {
    return this.payments.listProviders(user.tenantId);
  }

  @Put('providers/:provider')
  @RequirePermissions(permission(ModuleName.PAYMENTS, 'write'))
  @ApiOperation({ summary: 'Create or update a payment provider' })
  upsertProvider(
    @CurrentUser() user: { tenantId: string | null },
    @Param('provider') provider: PaymentProvider,
    @Body() dto: UpsertPaymentProviderDto,
  ) {
    return this.payments.upsertProvider(user.tenantId, provider, dto);
  }

  @Post('invoices/:id/checkout')
  @RequirePermissions(permission(ModuleName.INVOICING, 'write'))
  @ApiOperation({ summary: 'Create a Stripe checkout session for an invoice' })
  createCheckout(
    @CurrentUser() user: { tenantId: string | null },
    @Param('id', new ParseUUIDPipe()) id: string,
    @Req() req: Request,
  ) {
    const origin = (req.headers.origin ?? req.headers.referer) as string | undefined;
    return this.payments.createCheckoutUrl(user.tenantId, id, origin);
  }
}

@ApiTags('webhooks')
@Controller('webhooks')
export class WebhooksController {
  constructor(private readonly payments: PaymentsService) {}

  @Post('stripe')
  @Public()
  @ApiOperation({ summary: 'Stripe webhook (signature-verified)' })
  stripeWebhook(@Req() req: Request, @Headers('stripe-signature') signature?: string) {
    const payload = ((req as Request & { rawBody?: Buffer }).rawBody as Buffer | undefined) ?? Buffer.from('');
    if (!signature || payload.length === 0) {
      throw new BadRequestException('Missing Stripe signature or payload');
    }
    return this.payments.handleStripeWebhook(payload, signature);
  }
}
