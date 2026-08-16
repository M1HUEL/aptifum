import { MigrationInterface, QueryRunner } from 'typeorm';

export class ReportIndexes1786100000000 implements MigrationInterface {
  name = 'ReportIndexes1786100000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE INDEX "IDX_invoices_tenant_status_issue_date" ON "invoices" ("tenant_id", "status", "issue_date") `,
    );
    await queryRunner.query(`CREATE INDEX "IDX_invoice_items_product_id" ON "invoice_items" ("product_id") `);
    await queryRunner.query(`CREATE INDEX "IDX_sales_order_items_product_id" ON "sales_order_items" ("product_id") `);
    await queryRunner.query(
      `CREATE INDEX "IDX_purchase_order_items_product_id" ON "purchase_order_items" ("product_id") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_goods_receipt_items_product_id" ON "goods_receipt_items" ("product_id") `,
    );
    await queryRunner.query(`CREATE INDEX "IDX_products_category_id" ON "products" ("category_id") `);
    await queryRunner.query(
      `CREATE INDEX "IDX_stock_movements_tenant_occurred_at" ON "stock_movements" ("tenant_id", "occurred_at") `,
    );
    await queryRunner.query(`CREATE INDEX "IDX_journal_entries_period_id" ON "journal_entries" ("period_id") `);
    await queryRunner.query(
      `CREATE INDEX "IDX_journal_entries_tenant_entry_date" ON "journal_entries" ("tenant_id", "entry_date") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_purchase_orders_tenant_status" ON "purchase_orders" ("tenant_id", "status") `,
    );
    await queryRunner.query(`CREATE INDEX "IDX_sales_orders_tenant_status" ON "sales_orders" ("tenant_id", "status") `);
    await queryRunner.query(`CREATE INDEX "IDX_hr_payroll_lines_employee_id" ON "hr_payroll_lines" ("employee_id") `);
    await queryRunner.query(`CREATE INDEX "IDX_hr_employees_department_id" ON "hr_employees" ("department_id") `);
    await queryRunner.query(
      `CREATE INDEX "IDX_audit_logs_tenant_created_at" ON "audit_logs" ("tenant_id", "created_at") `,
    );
    await queryRunner.query(`CREATE INDEX "IDX_audit_logs_entity_entity_id" ON "audit_logs" ("entity", "entity_id") `);
    await queryRunner.query(`CREATE INDEX "IDX_refresh_sessions_expires_at" ON "refresh_sessions" ("expires_at") `);
    await queryRunner.query(`CREATE INDEX "IDX_refresh_sessions_revoked_at" ON "refresh_sessions" ("revoked_at") `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "public"."IDX_refresh_sessions_revoked_at"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_refresh_sessions_expires_at"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_audit_logs_entity_entity_id"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_audit_logs_tenant_created_at"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_hr_employees_department_id"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_hr_payroll_lines_employee_id"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_sales_orders_tenant_status"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_purchase_orders_tenant_status"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_journal_entries_tenant_entry_date"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_journal_entries_period_id"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_stock_movements_tenant_occurred_at"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_products_category_id"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_goods_receipt_items_product_id"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_purchase_order_items_product_id"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_sales_order_items_product_id"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_invoice_items_product_id"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_invoices_tenant_status_issue_date"`);
  }
}
