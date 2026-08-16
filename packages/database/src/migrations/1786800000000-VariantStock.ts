import { MigrationInterface, QueryRunner } from 'typeorm';

export class VariantStock1786800000000 implements MigrationInterface {
  name = 'VariantStock1786800000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "product_stock" ADD "variant_id" uuid`);
    await queryRunner.query(`ALTER TABLE "stock_movements" ADD "variant_id" uuid`);
    await queryRunner.query(`ALTER TABLE "invoice_items" ADD "variant_id" uuid`);
    await queryRunner.query(`ALTER TABLE "sales_order_items" ADD "variant_id" uuid`);
    await queryRunner.query(`ALTER TABLE "product_stock" DROP CONSTRAINT "UQ_af10c750cc260127b5a13176135"`);
    await queryRunner.query(
      `CREATE UNIQUE INDEX "UQ_product_stock_tenant_product_warehouse" ON "product_stock" ("tenant_id", "product_id", "warehouse_id") WHERE "variant_id" IS NULL`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "UQ_product_stock_tenant_variant_warehouse" ON "product_stock" ("tenant_id", "product_id", "variant_id", "warehouse_id") WHERE "variant_id" IS NOT NULL`,
    );
    await queryRunner.query(`CREATE INDEX "IDX_product_stock_variant_id" ON "product_stock" ("variant_id") `);
    await queryRunner.query(`CREATE INDEX "IDX_stock_movements_variant_id" ON "stock_movements" ("variant_id") `);
    await queryRunner.query(`CREATE INDEX "IDX_invoice_items_variant_id" ON "invoice_items" ("variant_id") `);
    await queryRunner.query(`CREATE INDEX "IDX_sales_order_items_variant_id" ON "sales_order_items" ("variant_id") `);
    await queryRunner.query(
      `ALTER TABLE "product_stock" ADD CONSTRAINT "FK_product_stock_variant" FOREIGN KEY ("variant_id") REFERENCES "product_variants"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "stock_movements" ADD CONSTRAINT "FK_stock_movements_variant" FOREIGN KEY ("variant_id") REFERENCES "product_variants"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "invoice_items" ADD CONSTRAINT "FK_invoice_items_variant" FOREIGN KEY ("variant_id") REFERENCES "product_variants"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "sales_order_items" ADD CONSTRAINT "FK_sales_order_items_variant" FOREIGN KEY ("variant_id") REFERENCES "product_variants"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "sales_order_items" DROP CONSTRAINT "FK_sales_order_items_variant"`);
    await queryRunner.query(`ALTER TABLE "invoice_items" DROP CONSTRAINT "FK_invoice_items_variant"`);
    await queryRunner.query(`ALTER TABLE "stock_movements" DROP CONSTRAINT "FK_stock_movements_variant"`);
    await queryRunner.query(`ALTER TABLE "product_stock" DROP CONSTRAINT "FK_product_stock_variant"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_sales_order_items_variant_id"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_invoice_items_variant_id"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_stock_movements_variant_id"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_product_stock_variant_id"`);
    await queryRunner.query(`DROP INDEX "public"."UQ_product_stock_tenant_variant_warehouse"`);
    await queryRunner.query(`DROP INDEX "public"."UQ_product_stock_tenant_product_warehouse"`);
    await queryRunner.query(
      `ALTER TABLE "product_stock" ADD CONSTRAINT "UQ_af10c750cc260127b5a13176135" UNIQUE ("tenant_id", "product_id", "warehouse_id")`,
    );
    await queryRunner.query(`ALTER TABLE "sales_order_items" DROP COLUMN "variant_id"`);
    await queryRunner.query(`ALTER TABLE "invoice_items" DROP COLUMN "variant_id"`);
    await queryRunner.query(`ALTER TABLE "stock_movements" DROP COLUMN "variant_id"`);
    await queryRunner.query(`ALTER TABLE "product_stock" DROP COLUMN "variant_id"`);
  }
}
