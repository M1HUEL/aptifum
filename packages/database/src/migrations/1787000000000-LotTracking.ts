import { MigrationInterface, QueryRunner } from "typeorm";

export class LotTracking1787000000000 implements MigrationInterface {
    name = 'LotTracking1787000000000'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE "product_lots" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "deleted_at" TIMESTAMP WITH TIME ZONE, "tenant_id" uuid NOT NULL, "product_id" uuid NOT NULL, "variant_id" uuid, "warehouse_id" uuid NOT NULL, "lot_number" character varying(80) NOT NULL, "expiry_date" date, "quantity" numeric(18,4) NOT NULL DEFAULT '0', CONSTRAINT "PK_product_lots_id" PRIMARY KEY ("id"))`);
        await queryRunner.query(`ALTER TABLE "stock_movements" ADD "lot_id" uuid`);
        await queryRunner.query(`CREATE INDEX "IDX_product_lots_tenant_id" ON "product_lots" ("tenant_id") `);
        await queryRunner.query(`CREATE INDEX "IDX_product_lots_product_id" ON "product_lots" ("product_id") `);
        await queryRunner.query(`CREATE INDEX "IDX_product_lots_variant_id" ON "product_lots" ("variant_id") `);
        await queryRunner.query(`CREATE INDEX "IDX_product_lots_warehouse_id" ON "product_lots" ("warehouse_id") `);
        await queryRunner.query(`CREATE INDEX "IDX_product_lots_lot_number" ON "product_lots" ("lot_number") `);
        await queryRunner.query(`CREATE INDEX "IDX_product_lots_expiry_date" ON "product_lots" ("expiry_date") `);
        await queryRunner.query(`CREATE UNIQUE INDEX "UQ_product_lots_tenant_product_warehouse_lot" ON "product_lots" ("tenant_id", "product_id", "warehouse_id", "lot_number") WHERE "variant_id" IS NULL`);
        await queryRunner.query(`CREATE UNIQUE INDEX "UQ_product_lots_tenant_variant_warehouse_lot" ON "product_lots" ("tenant_id", "product_id", "variant_id", "warehouse_id", "lot_number") WHERE "variant_id" IS NOT NULL`);
        await queryRunner.query(`CREATE INDEX "IDX_stock_movements_lot_id" ON "stock_movements" ("lot_id") `);
        await queryRunner.query(`ALTER TABLE "product_lots" ADD CONSTRAINT "FK_product_lots_product" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "product_lots" ADD CONSTRAINT "FK_product_lots_variant" FOREIGN KEY ("variant_id") REFERENCES "product_variants"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "product_lots" ADD CONSTRAINT "FK_product_lots_warehouse" FOREIGN KEY ("warehouse_id") REFERENCES "warehouses"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "product_lots" DROP CONSTRAINT "FK_product_lots_warehouse"`);
        await queryRunner.query(`ALTER TABLE "product_lots" DROP CONSTRAINT "FK_product_lots_variant"`);
        await queryRunner.query(`ALTER TABLE "product_lots" DROP CONSTRAINT "FK_product_lots_product"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_stock_movements_lot_id"`);
        await queryRunner.query(`DROP INDEX "public"."UQ_product_lots_tenant_variant_warehouse_lot"`);
        await queryRunner.query(`DROP INDEX "public"."UQ_product_lots_tenant_product_warehouse_lot"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_product_lots_expiry_date"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_product_lots_lot_number"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_product_lots_warehouse_id"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_product_lots_variant_id"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_product_lots_product_id"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_product_lots_tenant_id"`);
        await queryRunner.query(`ALTER TABLE "stock_movements" DROP COLUMN "lot_id"`);
        await queryRunner.query(`DROP TABLE "product_lots"`);
    }

}
