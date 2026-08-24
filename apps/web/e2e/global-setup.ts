import { getEnv, resetEnv, setEnv } from '@aptifum/config';
import { createDataSource, seed } from '@aptifum/database';

export default async function globalSetup(): Promise<void> {
  resetEnv();
  const base = getEnv();
  setEnv({ ...base, DB_NAME: base.DB_NAME_TEST });

  const dataSource = createDataSource();
  await dataSource.initialize();
  await dataSource.runMigrations();
  await dataSource.query(`
    DELETE FROM invoice_items;
    DELETE FROM payments;
    DELETE FROM cfdi_documents;
    DELETE FROM invoices;
    DELETE FROM sales_order_items;
    DELETE FROM sales_orders;
    DELETE FROM crm_activities;
    DELETE FROM crm_opportunities;
    DELETE FROM crm_leads;
    DELETE FROM crm_contacts;
    DELETE FROM customers;
    DELETE FROM goods_receipt_items;
    DELETE FROM goods_receipts;
    DELETE FROM purchase_order_items;
    DELETE FROM purchase_orders;
    DELETE FROM suppliers;
    DELETE FROM production_order_lines;
    DELETE FROM production_orders;
    DELETE FROM production_bom_lines;
    DELETE FROM production_boms;
    DELETE FROM stock_movements;
    DELETE FROM product_stock;
    DELETE FROM product_lots;
    DELETE FROM product_variants;
    DELETE FROM products;
    DELETE FROM warehouse_locations;
    DELETE FROM warehouses;
    DELETE FROM hr_attendance;
    DELETE FROM hr_leaves;
    DELETE FROM hr_payroll_lines;
    DELETE FROM hr_payrolls;
    DELETE FROM hr_employees;
    DELETE FROM hr_departments;
    DELETE FROM journal_entry_lines;
    DELETE FROM journal_entries;
    DELETE FROM audit_logs;
    DELETE FROM idempotency_keys;
    DELETE FROM refresh_sessions;
    UPDATE document_series SET next_number = 1;
  `);
  await dataSource.destroy();
  await seed();
}
