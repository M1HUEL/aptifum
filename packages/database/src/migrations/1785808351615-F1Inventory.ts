import { MigrationInterface, QueryRunner } from "typeorm";

export class F1Inventory1785808351615 implements MigrationInterface {
    name = 'F1Inventory1785808351615'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE "warehouse_locations" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "deleted_at" TIMESTAMP WITH TIME ZONE, "tenant_id" uuid NOT NULL, "warehouse_id" uuid NOT NULL, "code" character varying(40) NOT NULL, "name" character varying(120) NOT NULL, "active" boolean NOT NULL DEFAULT true, CONSTRAINT "UQ_31d6c3824a21a1444e67900e635" UNIQUE ("tenant_id", "warehouse_id", "code"), CONSTRAINT "PK_03d900f32f1fcd299452d9eee7f" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_b4f4eb7faff15be3ff56ff83eb" ON "warehouse_locations" ("tenant_id") `);
        await queryRunner.query(`CREATE INDEX "IDX_850b86bd98dd7d3647d6466789" ON "warehouse_locations" ("warehouse_id") `);
        await queryRunner.query(`CREATE TABLE "warehouses" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "deleted_at" TIMESTAMP WITH TIME ZONE, "tenant_id" uuid NOT NULL, "code" character varying(40) NOT NULL, "name" character varying(120) NOT NULL, "address" character varying(255), "active" boolean NOT NULL DEFAULT true, CONSTRAINT "UQ_1f48faa2fc664871db889e7ef10" UNIQUE ("tenant_id", "code"), CONSTRAINT "PK_56ae21ee2432b2270b48867e4be" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_09106b8068aeaf74fa33666df8" ON "warehouses" ("tenant_id") `);
        await queryRunner.query(`CREATE TABLE "product_stock" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "deleted_at" TIMESTAMP WITH TIME ZONE, "tenant_id" uuid NOT NULL, "product_id" uuid NOT NULL, "warehouse_id" uuid NOT NULL, "quantity" numeric(18,4) NOT NULL DEFAULT '0', "reserved_quantity" numeric(18,4) NOT NULL DEFAULT '0', "average_cost" numeric(14,2) NOT NULL DEFAULT '0', "version" integer NOT NULL DEFAULT '1', CONSTRAINT "UQ_af10c750cc260127b5a13176135" UNIQUE ("tenant_id", "product_id", "warehouse_id"), CONSTRAINT "PK_557112c9955555e7d08fa913f3f" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_ccdc0da3cef227145a668a28b4" ON "product_stock" ("tenant_id") `);
        await queryRunner.query(`CREATE INDEX "IDX_62a8438c36b1a42790d3cd755a" ON "product_stock" ("product_id") `);
        await queryRunner.query(`CREATE INDEX "IDX_47fdcc7c3925b07f2d3a53cd9d" ON "product_stock" ("warehouse_id") `);
        await queryRunner.query(`CREATE TYPE "public"."stock_movements_movement_type_enum" AS ENUM('inbound', 'outbound', 'adjustment', 'transfer', 'return', 'disposal')`);
        await queryRunner.query(`CREATE TABLE "stock_movements" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "deleted_at" TIMESTAMP WITH TIME ZONE, "tenant_id" uuid NOT NULL, "movement_type" "public"."stock_movements_movement_type_enum" NOT NULL, "product_id" uuid NOT NULL, "warehouse_id" uuid NOT NULL, "location_id" uuid, "quantity" numeric(18,4) NOT NULL, "unit_cost" numeric(14,2) NOT NULL DEFAULT '0', "reference_type" character varying(120), "reference_id" uuid, "user_id" uuid, "notes" text, "occurred_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_57a26b190618550d8e65fb860e7" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_30dd9acc22dcb6ae51d7d34f16" ON "stock_movements" ("tenant_id") `);
        await queryRunner.query(`CREATE INDEX "IDX_2c1bb05b80ddcc562cd28d826c" ON "stock_movements" ("product_id") `);
        await queryRunner.query(`CREATE INDEX "IDX_e7831147f5a8ee3c42e6eaeee2" ON "stock_movements" ("warehouse_id") `);
        await queryRunner.query(`CREATE TABLE "products" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "deleted_at" TIMESTAMP WITH TIME ZONE, "tenant_id" uuid NOT NULL, "sku" character varying(60) NOT NULL, "name" character varying(255) NOT NULL, "description" text, "category_id" uuid, "brand" character varying(120), "unit_of_measure" character varying(20) NOT NULL DEFAULT 'unit', "barcode" character varying(64), "image_url" character varying(500), "purchase_price" numeric(14,2) NOT NULL DEFAULT '0', "sale_price" numeric(14,2) NOT NULL DEFAULT '0', "enabled" boolean NOT NULL DEFAULT true, "version" integer NOT NULL DEFAULT '1', CONSTRAINT "UQ_a4c7f7b62f3a50d5b71720ef03f" UNIQUE ("tenant_id", "sku"), CONSTRAINT "PK_0806c755e0aca124e67c0cf6d7d" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_9c365ebf78f0e8a6d9e4827ea7" ON "products" ("tenant_id") `);
        await queryRunner.query(`CREATE INDEX "IDX_4c9fb58de893725258746385e1" ON "products" ("name") `);
        await queryRunner.query(`CREATE TABLE "categories" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "deleted_at" TIMESTAMP WITH TIME ZONE, "tenant_id" uuid NOT NULL, "name" character varying(120) NOT NULL, "parent_id" uuid, "active" boolean NOT NULL DEFAULT true, CONSTRAINT "PK_24dbc6126a28ff948da33e97d3b" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_5d4fe23b360b1b9e16a3f41727" ON "categories" ("tenant_id") `);
        await queryRunner.query(`CREATE INDEX "IDX_88cea2dc9c31951d06437879b4" ON "categories" ("parent_id") `);
        await queryRunner.query(`ALTER TABLE "warehouse_locations" ADD CONSTRAINT "FK_850b86bd98dd7d3647d6466789f" FOREIGN KEY ("warehouse_id") REFERENCES "warehouses"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "product_stock" ADD CONSTRAINT "FK_62a8438c36b1a42790d3cd755a1" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "product_stock" ADD CONSTRAINT "FK_47fdcc7c3925b07f2d3a53cd9de" FOREIGN KEY ("warehouse_id") REFERENCES "warehouses"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "stock_movements" ADD CONSTRAINT "FK_2c1bb05b80ddcc562cd28d826c6" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "stock_movements" ADD CONSTRAINT "FK_e7831147f5a8ee3c42e6eaeee2e" FOREIGN KEY ("warehouse_id") REFERENCES "warehouses"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "products" ADD CONSTRAINT "FK_9a5f6868c96e0069e699f33e124" FOREIGN KEY ("category_id") REFERENCES "categories"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "categories" ADD CONSTRAINT "FK_88cea2dc9c31951d06437879b40" FOREIGN KEY ("parent_id") REFERENCES "categories"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "categories" DROP CONSTRAINT "FK_88cea2dc9c31951d06437879b40"`);
        await queryRunner.query(`ALTER TABLE "products" DROP CONSTRAINT "FK_9a5f6868c96e0069e699f33e124"`);
        await queryRunner.query(`ALTER TABLE "stock_movements" DROP CONSTRAINT "FK_e7831147f5a8ee3c42e6eaeee2e"`);
        await queryRunner.query(`ALTER TABLE "stock_movements" DROP CONSTRAINT "FK_2c1bb05b80ddcc562cd28d826c6"`);
        await queryRunner.query(`ALTER TABLE "product_stock" DROP CONSTRAINT "FK_47fdcc7c3925b07f2d3a53cd9de"`);
        await queryRunner.query(`ALTER TABLE "product_stock" DROP CONSTRAINT "FK_62a8438c36b1a42790d3cd755a1"`);
        await queryRunner.query(`ALTER TABLE "warehouse_locations" DROP CONSTRAINT "FK_850b86bd98dd7d3647d6466789f"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_88cea2dc9c31951d06437879b4"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_5d4fe23b360b1b9e16a3f41727"`);
        await queryRunner.query(`DROP TABLE "categories"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_4c9fb58de893725258746385e1"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_9c365ebf78f0e8a6d9e4827ea7"`);
        await queryRunner.query(`DROP TABLE "products"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_e7831147f5a8ee3c42e6eaeee2"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_2c1bb05b80ddcc562cd28d826c"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_30dd9acc22dcb6ae51d7d34f16"`);
        await queryRunner.query(`DROP TABLE "stock_movements"`);
        await queryRunner.query(`DROP TYPE "public"."stock_movements_movement_type_enum"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_47fdcc7c3925b07f2d3a53cd9d"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_62a8438c36b1a42790d3cd755a"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_ccdc0da3cef227145a668a28b4"`);
        await queryRunner.query(`DROP TABLE "product_stock"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_09106b8068aeaf74fa33666df8"`);
        await queryRunner.query(`DROP TABLE "warehouses"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_850b86bd98dd7d3647d6466789"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_b4f4eb7faff15be3ff56ff83eb"`);
        await queryRunner.query(`DROP TABLE "warehouse_locations"`);
    }

}
