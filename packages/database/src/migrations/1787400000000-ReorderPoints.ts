import { MigrationInterface, QueryRunner } from 'typeorm';

export class ReorderPoints1787400000000 implements MigrationInterface {
  name = 'ReorderPoints1787400000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "products" ADD "reorder_point" numeric(18,4)`);
    await queryRunner.query(`ALTER TABLE "products" ADD "reorder_quantity" numeric(18,4)`);
    await queryRunner.query(
      `CREATE TABLE "product_suppliers" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "deleted_at" TIMESTAMP WITH TIME ZONE, "tenant_id" uuid NOT NULL, "product_id" uuid NOT NULL, "supplier_id" uuid NOT NULL, "supplier_sku" character varying(60), "unit_cost" numeric(14,2), "lead_time_days" integer, "is_preferred" boolean NOT NULL DEFAULT false, CONSTRAINT "UQ_product_supplier_tenant_product_supplier" UNIQUE ("tenant_id", "product_id", "supplier_id"), CONSTRAINT "PK_product_suppliers" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(`CREATE INDEX "IDX_product_suppliers_tenant_id" ON "product_suppliers" ("tenant_id") `);
    await queryRunner.query(`CREATE INDEX "IDX_product_suppliers_product_id" ON "product_suppliers" ("product_id") `);
    await queryRunner.query(`CREATE INDEX "IDX_product_suppliers_supplier_id" ON "product_suppliers" ("supplier_id") `);
    await queryRunner.query(
      `ALTER TABLE "product_suppliers" ADD CONSTRAINT "FK_product_suppliers_tenant" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "product_suppliers" ADD CONSTRAINT "FK_product_suppliers_product" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "product_suppliers" ADD CONSTRAINT "FK_product_suppliers_supplier" FOREIGN KEY ("supplier_id") REFERENCES "suppliers"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "product_suppliers" DROP CONSTRAINT "FK_product_suppliers_supplier"`);
    await queryRunner.query(`ALTER TABLE "product_suppliers" DROP CONSTRAINT "FK_product_suppliers_product"`);
    await queryRunner.query(`ALTER TABLE "product_suppliers" DROP CONSTRAINT "FK_product_suppliers_tenant"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_product_suppliers_supplier_id"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_product_suppliers_product_id"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_product_suppliers_tenant_id"`);
    await queryRunner.query(`DROP TABLE "product_suppliers"`);
    await queryRunner.query(`ALTER TABLE "products" DROP COLUMN "reorder_quantity"`);
    await queryRunner.query(`ALTER TABLE "products" DROP COLUMN "reorder_point"`);
  }
}
