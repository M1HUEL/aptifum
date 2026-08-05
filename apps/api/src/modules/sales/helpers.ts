import { NotFoundException } from '@nestjs/common';
import { DocumentSeriesKind } from '@aptifum/core';
import {
  DocumentSeriesNotFoundError,
  nextDocumentNumber as dbNextDocumentNumber,
} from '@aptifum/database';
import { EntityManager } from 'typeorm';

export { computeTotals, round2, today } from '@aptifum/core';
export type { TotalsItem } from '@aptifum/core';

export async function nextDocumentNumber(
  manager: EntityManager,
  tenantId: string,
  kind: DocumentSeriesKind,
): Promise<{ number: string; seriesId: string }> {
  try {
    return await dbNextDocumentNumber(manager, tenantId, kind);
  } catch (error) {
    if (error instanceof DocumentSeriesNotFoundError) {
      throw new NotFoundException(error.message);
    }
    throw error;
  }
}
