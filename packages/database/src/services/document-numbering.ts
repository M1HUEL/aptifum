import { DocumentSeriesKind } from '@aptifum/core';
import { EntityManager } from 'typeorm';
import { DocumentSeries } from '../entities/document-series.entity';

export class DocumentSeriesNotFoundError extends Error {
  constructor(kind: DocumentSeriesKind) {
    super(`No document series configured for ${kind}`);
    this.name = 'DocumentSeriesNotFoundError';
  }
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
    throw new DocumentSeriesNotFoundError(kind);
  }
  const current = series.nextNumber;
  series.nextNumber = current + 1;
  await repo.save(series);
  return { number: `${series.prefix}-${String(current).padStart(6, '0')}`, seriesId: series.id };
}
