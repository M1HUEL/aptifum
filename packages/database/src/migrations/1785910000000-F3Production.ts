import { MigrationInterface, QueryRunner } from "typeorm";

export class F3Production1785910000000 implements MigrationInterface {
    name = 'F3Production1785910000000'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TYPE "public"."document_series_kind_enum" ADD VALUE IF NOT EXISTS 'production_order'`);
        await queryRunner.query(`CREATE TYPE "public"."production_orders_status_enum" AS ENUM('planned', 'in_progress', 'completed', 'cancelled')`);
        await queryRunner.query(`CREATE TABLE "production_boms" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "deleted_at" TIMESTAMP WITH TIME ZONE, "tenant_id" uuid NOT NULL, "name" character varying(120) NOT NULL, "product_id" uuid NOT NULL, "output_quantity" numeric(18,4) NOT NULL DEFAULT '1', "active" boolean NOT NULL DEFAULT true, "version" integer NOT NULL DEFAULT '1', CONSTRAINT "PK_production_boms" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_production_boms_tenant_id" ON "production_boms" ("tenant_id") `);
        await queryRunner.query(`CREATE INDEX "IDX_production_boms_product_id" ON "production_boms" ("product_id") `);
        await queryRunner.query(`CREATE INDEX "IDX_production_boms_name" ON "production_boms" ("name") `);
        await queryRunner.query(`CREATE TABLE "production_bom_lines" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "deleted_at" TIMESTAMP WITH TIME ZONE, "tenant_id" uuid NOT NULL, "bom_id" uuid NOT NULL, "product_id" uuid NOT NULL, "quantity" numeric(18,4) NOT NULL, "waste_rate" numeric(6,2) NOT NULL DEFAULT '0', CONSTRAINT "PK_production_bom_lines" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_production_bom_lines_tenant_id" ON "production_bom_lines" ("tenant_id") `);
        await queryRunner.query(`CREATE INDEX "IDX_production_bom_lines_bom_id" ON "production_bom_lines" ("bom_id") `);
        await queryRunner.query(`CREATE INDEX "IDX_production_bom_lines_product_id" ON "production_bom_lines" ("product_id") `);
        await queryRunner.query(`CREATE TABLE "production_orders" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "deleted_at" TIMESTAMP WITH TIME ZONE, "tenant_id" uuid NOT NULL, "number" character varying(30) NOT NULL, "product_id" uuid NOT NULL, "bom_id" uuid, "quantity" numeric(18,4) NOT NULL, "status" "public"."production_orders_status_enum" NOT NULL DEFAULT 'planned', "warehouse_id" uuid NOT NULL, "currency" character varying(3) NOT NULL DEFAULT 'USD', "labor_cost" numeric(14,2) NOT NULL DEFAULT '0', "overhead" numeric(14,2) NOT NULL DEFAULT '0', "material_cost" numeric(14,2) NOT NULL DEFAULT '0', "total_cost" numeric(14,2) NOT NULL DEFAULT '0', "completed_at" TIMESTAMP WITH TIME ZONE, "notes" text, "version" integer NOT NULL DEFAULT '1', CONSTRAINT "UQ_production_orders_tenant_number" UNIQUE ("tenant_id", "number"), CONSTRAINT "PK_production_orders" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_production_orders_tenant_id" ON "production_orders" ("tenant_id") `);
        await queryRunner.query(`CREATE INDEX "IDX_production_orders_number" ON "production_orders" ("number") `);
        await queryRunner.query(`CREATE INDEX "IDX_production_orders_product_id" ON "production_orders" ("product_id") `);
        await queryRunner.query(`CREATE INDEX "IDX_production_orders_bom_id" ON "production_orders" ("bom_id") `);
        await queryRunner.query(`CREATE INDEX "IDX_production_orders_status" ON "production_orders" ("status") `);
        await queryRunner.query(`CREATE INDEX "IDX_production_orders_warehouse_id" ON "production_orders" ("warehouse_id") `);
        await queryRunner.query(`CREATE TABLE "production_order_lines" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "deleted_at" TIMESTAMP WITH TIME ZONE, "tenant_id" uuid NOT NULL, "order_id" uuid NOT NULL, "product_id" uuid NOT NULL, "planned_quantity" numeric(18,4) NOT NULL, "consumed_quantity" numeric(18,4) NOT NULL DEFAULT '0', "unit_cost" numeric(14,2) NOT NULL DEFAULT '0', "line_cost" numeric(14,2) NOT NULL DEFAULT '0', CONSTRAINT "UQ_production_order_lines_tenant_order_product" UNIQUE ("tenant_id", "order_id", "product_id"), CONSTRAINT "PK_production_order_lines" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_production_order_lines_tenant_id" ON "production_order_lines" ("tenant_id") `);
        await queryRunner.query(`CREATE INDEX "IDX_production_order_lines_order_id" ON "production_order_lines" ("order_id") `);
        await queryRunner.query(`CREATE INDEX "IDX_production_order_lines_product_id" ON "production_order_lines" ("product_id") `);
        await queryRunner.query(`ALTER TABLE "production_boms" ADD CONSTRAINT "FK_production_boms_product" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "production_bom_lines" ADD CONSTRAINT "FK_production_bom_lines_bom" FOREIGN KEY ("bom_id") REFERENCES "production_boms"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "production_bom_lines" ADD CONSTRAINT "FK_production_bom_lines_product" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "production_orders" ADD CONSTRAINT "FK_production_orders_product" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "production_orders" ADD CONSTRAINT "FK_production_orders_bom" FOREIGN KEY ("bom_id") REFERENCES "production_boms"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "production_orders" ADD CONSTRAINT "FK_production_orders_warehouse" FOREIGN KEY ("warehouse_id") REFERENCES "warehouses"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "production_order_lines" ADD CONSTRAINT "FK_production_order_lines_order" FOREIGN KEY ("order_id") REFERENCES "production_orders"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "production_order_lines" ADD CONSTRAINT "FK_production_order_lines_product" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "production_order_lines" DROP CONSTRAINT "FK_production_order_lines_product"`);
        await queryRunner.query(`ALTER TABLE "production_order_lines" DROP CONSTRAINT "FK_production_order_lines_order"`);
        await queryRunner.query(`ALTER TABLE "production_orders" DROP CONSTRAINT "FK_production_orders_warehouse"`);
        await queryRunner.query(`ALTER TABLE "production_orders" DROP CONSTRAINT "FK_production_orders_bom"`);
        await queryRunner.query(`ALTER TABLE "production_orders" DROP CONSTRAINT "FK_production_orders_product"`);
        await queryRunner.query(`ALTER TABLE "production_bom_lines" DROP CONSTRAINT "FK_production_bom_lines_product"`);
        await queryRunner.query(`ALTER TABLE "production_bom_lines" DROP CONSTRAINT "FK_production_bom_lines_bom"`);
        await queryRunner.query(`ALTER TABLE "production_boms" DROP CONSTRAINT "FK_production_boms_product"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_production_order_lines_product_id"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_production_order_lines_order_id"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_production_order_lines_tenant_id"`);
        await queryRunner.query(`DROP TABLE "production_order_lines"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_production_orders_warehouse_id"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_production_orders_status"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_production_orders_bom_id"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_production_orders_product_id"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_production_orders_number"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_production_orders_tenant_id"`);
        await queryRunner.query(`DROP TABLE "production_orders"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_production_bom_lines_product_id"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_production_bom_lines_bom_id"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_production_bom_lines_tenant_id"`);
        await queryRunner.query(`DROP TABLE "production_bom_lines"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_production_boms_name"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_production_boms_product_id"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_production_boms_tenant_id"`);
        await queryRunner.query(`DROP TABLE "production_boms"`);
        await queryRunner.query(`DROP TYPE "public"."production_orders_status_enum"`);
    }

}
