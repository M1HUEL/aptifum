import { MigrationInterface, QueryRunner } from 'typeorm';

export class ProductVariants1786700000000 implements MigrationInterface {
  name = 'ProductVariants1786700000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "product_variants" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "deleted_at" TIMESTAMP WITH TIME ZONE, "tenant_id" uuid NOT NULL, "product_id" uuid NOT NULL, "sku" character varying(60) NOT NULL, "barcode" character varying(64), "attributes" jsonb NOT NULL DEFAULT '{}', "purchase_price" numeric(14,2) NOT NULL DEFAULT '0', "sale_price" numeric(14,2) NOT NULL DEFAULT '0', CONSTRAINT "UQ_product_variants_tenant_sku" UNIQUE ("tenant_id", "sku"), CONSTRAINT "PK_product_variants" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(`CREATE INDEX "IDX_product_variants_tenant_id" ON "product_variants" ("tenant_id") `);
    await queryRunner.query(`CREATE INDEX "IDX_product_variants_product_id" ON "product_variants" ("product_id") `);
    await queryRunner.query(
      `ALTER TABLE "product_variants" ADD CONSTRAINT "FK_product_variants_product" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "product_variants" DROP CONSTRAINT "FK_product_variants_product"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_product_variants_product_id"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_product_variants_tenant_id"`);
    await queryRunner.query(`DROP TABLE "product_variants"`);
  }
}
