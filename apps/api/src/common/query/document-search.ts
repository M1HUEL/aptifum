import type { Repository } from 'typeorm';

export interface DocumentSearchConfig {
  partyColumn: 'customer_id' | 'supplier_id';
  partyTable: 'customers' | 'suppliers';
  itemTable: 'invoice_items' | 'sales_order_items' | 'purchase_order_items';
  itemFkColumn: 'invoice_id' | 'order_id';
}

export async function searchDocumentIds(
  repo: Repository<{ id: string }>,
  tenantId: string | null,
  q: string,
  cfg: DocumentSearchConfig,
): Promise<string[]> {
  const term = `%${q}%`;
  const qb = repo.createQueryBuilder('d').select('d.id', 'id');
  if (tenantId) {
    qb.where('d.tenant_id = :tenantId', { tenantId });
  }
  qb.andWhere(
    `(d.number ILIKE :term
      OR EXISTS (SELECT 1 FROM ${cfg.partyTable} p
                  WHERE p.id = d.${cfg.partyColumn} AND p.trade_name ILIKE :term)
      OR EXISTS (SELECT 1 FROM ${cfg.itemTable} ii
                  JOIN products pr ON pr.id = ii.product_id
                  WHERE ii.${cfg.itemFkColumn} = d.id
                    AND (pr.sku ILIKE :term OR pr.name ILIKE :term)))`,
    { term },
  );
  const rows = await qb.getRawMany<{ id: string }>();
  return rows.map((row) => row.id);
}
