import { NotFoundException } from '@nestjs/common';
import { EntityManager } from 'typeorm';
import { DocumentSeriesKind } from '@aptifum/core';
import { DocumentSeries } from '@aptifum/database';

export const round2 = (n: number): number => Math.round(n * 100) / 100;

export const today = (): string => new Date().toISOString().slice(0, 10);

export interface TotalsItem {
  quantity: number;
  unitPrice: number;
  discount?: number;
  taxRate?: number;
}

export function computeTotals(items: TotalsItem[], globalDiscount = 0) {
  const subtotal = round2(
    items.reduce((sum, i) => sum + (i.quantity * i.unitPrice - (i.discount ?? 0)), 0),
  );
  const tax = round2(
    items.reduce((sum, i) => sum + i.quantity * i.unitPrice * (i.taxRate ?? 0), 0),
  );
  return {
    subtotal,
    discount: round2(globalDiscount),
    tax,
    total: round2(subtotal + tax - globalDiscount),
  };
}

export async function nextDocumentNumber(
  manager: EntityManager,
  tenantId: string,
  kind: DocumentSeriesKind,
): Promise<{ number: string; seriesId: string }> {
  const repo = manager.getRepository(DocumentSeries);
  const series = await repo
    .createQueryBuilder('series')
    .setLock('pessimistic_write')
    .where('series.tenant_id = :tenantId', { tenantId })
    .andWhere('series.kind = :kind', { kind })
    .getOne();
  if (!series) {
    throw new NotFoundException(`No document series configured for ${kind}`);
  }
  const current = series.nextNumber;
  series.nextNumber = current + 1;
  await repo.save(series);
  return { number: `${series.prefix}-${String(current).padStart(6, '0')}`, seriesId: series.id };
}
