import { MigrationInterface, QueryRunner } from 'typeorm';

export class F2Purchasing1785891385283 implements MigrationInterface {
  name = 'F2Purchasing1785891385283';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TYPE "public"."document_series_kind_enum" ADD VALUE IF NOT EXISTS 'purchase_order'`);
    await queryRunner.query(`ALTER TYPE "public"."document_series_kind_enum" ADD VALUE IF NOT EXISTS 'goods_receipt'`);
    await queryRunner.query(
      `CREATE TYPE "public"."purchase_orders_status_enum" AS ENUM('draft', 'approved', 'received', 'cancelled')`,
    );
    await queryRunner.query(
      `CREATE TABLE "suppliers" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "deleted_at" TIMESTAMP WITH TIME ZONE, "tenant_id" uuid NOT NULL, "code" character varying(40) NOT NULL, "trade_name" character varying(255) NOT NULL, "legal_name" character varying(255), "tax_id" character varying(40), "email" character varying(190), "phone" character varying(40), "address" character varying(255), "currency" character varying(3) NOT NULL DEFAULT 'USD', "payment_terms" character varying(60), "credit_limit" numeric(14,2) NOT NULL DEFAULT '0', "active" boolean NOT NULL DEFAULT true, "version" integer NOT NULL DEFAULT '1', CONSTRAINT "UQ_suppliers_tenant_code" UNIQUE ("tenant_id", "code"), CONSTRAINT "PK_suppliers" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(`CREATE INDEX "IDX_suppliers_tenant_id" ON "suppliers" ("tenant_id") `);
    await queryRunner.query(`CREATE INDEX "IDX_suppliers_tax_id" ON "suppliers" ("tax_id") `);
    await queryRunner.query(
      `CREATE TABLE "purchase_orders" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "deleted_at" TIMESTAMP WITH TIME ZONE, "tenant_id" uuid NOT NULL, "number" character varying(30) NOT NULL, "status" "public"."purchase_orders_status_enum" NOT NULL DEFAULT 'draft', "supplier_id" uuid NOT NULL, "warehouse_id" uuid NOT NULL, "issue_date" date NOT NULL DEFAULT ('now'::text)::date, "expected_at" date, "currency" character varying(3) NOT NULL DEFAULT 'USD', "subtotal" numeric(14,2) NOT NULL DEFAULT '0', "discount" numeric(14,2) NOT NULL DEFAULT '0', "tax" numeric(14,2) NOT NULL DEFAULT '0', "total" numeric(14,2) NOT NULL DEFAULT '0', "notes" text, "version" integer NOT NULL DEFAULT '1', CONSTRAINT "UQ_purchase_orders_tenant_number" UNIQUE ("tenant_id", "number"), CONSTRAINT "PK_purchase_orders" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(`CREATE INDEX "IDX_purchase_orders_tenant_id" ON "purchase_orders" ("tenant_id") `);
    await queryRunner.query(`CREATE INDEX "IDX_purchase_orders_supplier_id" ON "purchase_orders" ("supplier_id") `);
    await queryRunner.query(
      `CREATE TABLE "purchase_order_items" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "deleted_at" TIMESTAMP WITH TIME ZONE, "tenant_id" uuid NOT NULL, "order_id" uuid NOT NULL, "product_id" uuid NOT NULL, "description" character varying(255) NOT NULL, "quantity" numeric(18,4) NOT NULL, "unit_cost" numeric(14,2) NOT NULL DEFAULT '0', "discount" numeric(14,2) NOT NULL DEFAULT '0', "tax_rate" numeric(6,4) NOT NULL DEFAULT '0', "tax_amount" numeric(14,2) NOT NULL DEFAULT '0', "line_total" numeric(14,2) NOT NULL DEFAULT '0', "received_quantity" numeric(18,4) NOT NULL DEFAULT '0', CONSTRAINT "PK_purchase_order_items" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(`CREATE INDEX "IDX_poi_tenant_id" ON "purchase_order_items" ("tenant_id") `);
    await queryRunner.query(`CREATE INDEX "IDX_poi_order_id" ON "purchase_order_items" ("order_id") `);
    await queryRunner.query(
      `CREATE TABLE "goods_receipts" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "deleted_at" TIMESTAMP WITH TIME ZONE, "tenant_id" uuid NOT NULL, "number" character varying(30) NOT NULL, "order_id" uuid NOT NULL, "supplier_id" uuid NOT NULL, "warehouse_id" uuid NOT NULL, "received_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "notes" text, CONSTRAINT "UQ_goods_receipts_tenant_number" UNIQUE ("tenant_id", "number"), CONSTRAINT "PK_goods_receipts" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(`CREATE INDEX "IDX_goods_receipts_tenant_id" ON "goods_receipts" ("tenant_id") `);
    await queryRunner.query(`CREATE INDEX "IDX_goods_receipts_order_id" ON "goods_receipts" ("order_id") `);
    await queryRunner.query(
      `CREATE TABLE "goods_receipt_items" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "deleted_at" TIMESTAMP WITH TIME ZONE, "tenant_id" uuid NOT NULL, "receipt_id" uuid NOT NULL, "order_item_id" uuid NOT NULL, "product_id" uuid NOT NULL, "quantity" numeric(18,4) NOT NULL, "unit_cost" numeric(14,2) NOT NULL DEFAULT '0', CONSTRAINT "PK_goods_receipt_items" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(`CREATE INDEX "IDX_gri_tenant_id" ON "goods_receipt_items" ("tenant_id") `);
    await queryRunner.query(`CREATE INDEX "IDX_gri_receipt_id" ON "goods_receipt_items" ("receipt_id") `);
    await queryRunner.query(
      `ALTER TABLE "purchase_order_items" ADD CONSTRAINT "FK_poi_order" FOREIGN KEY ("order_id") REFERENCES "purchase_orders"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "purchase_order_items" ADD CONSTRAINT "FK_poi_product" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "purchase_orders" ADD CONSTRAINT "FK_po_supplier" FOREIGN KEY ("supplier_id") REFERENCES "suppliers"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "purchase_orders" ADD CONSTRAINT "FK_po_warehouse" FOREIGN KEY ("warehouse_id") REFERENCES "warehouses"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "goods_receipts" ADD CONSTRAINT "FK_gr_order" FOREIGN KEY ("order_id") REFERENCES "purchase_orders"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "goods_receipts" ADD CONSTRAINT "FK_gr_supplier" FOREIGN KEY ("supplier_id") REFERENCES "suppliers"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "goods_receipts" ADD CONSTRAINT "FK_gr_warehouse" FOREIGN KEY ("warehouse_id") REFERENCES "warehouses"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "goods_receipt_items" ADD CONSTRAINT "FK_gri_receipt" FOREIGN KEY ("receipt_id") REFERENCES "goods_receipts"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "goods_receipt_items" ADD CONSTRAINT "FK_gri_order_item" FOREIGN KEY ("order_item_id") REFERENCES "purchase_order_items"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "goods_receipt_items" ADD CONSTRAINT "FK_gri_product" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "goods_receipt_items" DROP CONSTRAINT "FK_gri_product"`);
    await queryRunner.query(`ALTER TABLE "goods_receipt_items" DROP CONSTRAINT "FK_gri_order_item"`);
    await queryRunner.query(`ALTER TABLE "goods_receipt_items" DROP CONSTRAINT "FK_gri_receipt"`);
    await queryRunner.query(`ALTER TABLE "goods_receipts" DROP CONSTRAINT "FK_gr_warehouse"`);
    await queryRunner.query(`ALTER TABLE "goods_receipts" DROP CONSTRAINT "FK_gr_supplier"`);
    await queryRunner.query(`ALTER TABLE "goods_receipts" DROP CONSTRAINT "FK_gr_order"`);
    await queryRunner.query(`ALTER TABLE "purchase_orders" DROP CONSTRAINT "FK_po_warehouse"`);
    await queryRunner.query(`ALTER TABLE "purchase_orders" DROP CONSTRAINT "FK_po_supplier"`);
    await queryRunner.query(`ALTER TABLE "purchase_order_items" DROP CONSTRAINT "FK_poi_product"`);
    await queryRunner.query(`ALTER TABLE "purchase_order_items" DROP CONSTRAINT "FK_poi_order"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_gri_receipt_id"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_gri_tenant_id"`);
    await queryRunner.query(`DROP TABLE "goods_receipt_items"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_goods_receipts_order_id"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_goods_receipts_tenant_id"`);
    await queryRunner.query(`DROP TABLE "goods_receipts"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_poi_order_id"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_poi_tenant_id"`);
    await queryRunner.query(`DROP TABLE "purchase_order_items"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_purchase_orders_supplier_id"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_purchase_orders_tenant_id"`);
    await queryRunner.query(`DROP TABLE "purchase_orders"`);
    await queryRunner.query(`DROP TYPE "public"."purchase_orders_status_enum"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_suppliers_tax_id"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_suppliers_tenant_id"`);
    await queryRunner.query(`DROP TABLE "suppliers"`);
  }
}
