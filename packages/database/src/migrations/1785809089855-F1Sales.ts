import { MigrationInterface, QueryRunner } from "typeorm";

export class F1Sales1785809089855 implements MigrationInterface {
    name = 'F1Sales1785809089855'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE "customers" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "deleted_at" TIMESTAMP WITH TIME ZONE, "tenant_id" uuid NOT NULL, "code" character varying(40) NOT NULL, "trade_name" character varying(255) NOT NULL, "legal_name" character varying(255), "tax_id" character varying(40), "email" character varying(190), "phone" character varying(40), "address" character varying(255), "currency" character varying(3) NOT NULL DEFAULT 'USD', "credit_limit" numeric(14,2) NOT NULL DEFAULT '0', "price_category" character varying(60), "active" boolean NOT NULL DEFAULT true, "version" integer NOT NULL DEFAULT '1', CONSTRAINT "UQ_31e385cc0f0f40cc6a0149b9806" UNIQUE ("tenant_id", "code"), CONSTRAINT "PK_133ec679a801fab5e070f73d3ea" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_97913f35ac2e435a4463fb50a0" ON "customers" ("tenant_id") `);
        await queryRunner.query(`CREATE INDEX "IDX_6a1d20a1ca90c48dd400d9a2a6" ON "customers" ("tax_id") `);
        await queryRunner.query(`CREATE TYPE "public"."document_series_kind_enum" AS ENUM('quote', 'order', 'invoice', 'credit_note')`);
        await queryRunner.query(`CREATE TABLE "document_series" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "deleted_at" TIMESTAMP WITH TIME ZONE, "tenant_id" uuid NOT NULL, "kind" "public"."document_series_kind_enum" NOT NULL, "prefix" character varying(10) NOT NULL, "next_number" bigint NOT NULL DEFAULT '1', "active" boolean NOT NULL DEFAULT true, CONSTRAINT "UQ_845e32f0cc66cb934575eb8b25f" UNIQUE ("tenant_id", "kind"), CONSTRAINT "PK_187a27e33f96d78f669301cf572" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_28704afcb4bd38310549e0ce28" ON "document_series" ("tenant_id") `);
        await queryRunner.query(`CREATE TABLE "idempotency_keys" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "key" character varying(190) NOT NULL, "request_hash" character varying(64) NOT NULL, "response" jsonb, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "UQ_0afd83cbf08c9d12089a9bffc5e" UNIQUE ("key"), CONSTRAINT "PK_8ad20779ad0411107a56e53d0f6" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TABLE "invoice_items" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "deleted_at" TIMESTAMP WITH TIME ZONE, "tenant_id" uuid NOT NULL, "invoice_id" uuid NOT NULL, "product_id" uuid NOT NULL, "description" character varying(255) NOT NULL, "quantity" numeric(18,4) NOT NULL, "unit_price" numeric(14,2) NOT NULL DEFAULT '0', "discount" numeric(14,2) NOT NULL DEFAULT '0', "tax_rate" numeric(6,4) NOT NULL DEFAULT '0', "tax_amount" numeric(14,2) NOT NULL DEFAULT '0', "line_total" numeric(14,2) NOT NULL DEFAULT '0', CONSTRAINT "PK_53b99f9e0e2945e69de1a12b75a" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_deaeb7940633a09af4c6c14df8" ON "invoice_items" ("tenant_id") `);
        await queryRunner.query(`CREATE INDEX "IDX_dc991d555664682cfe892eea2c" ON "invoice_items" ("invoice_id") `);
        await queryRunner.query(`CREATE TYPE "public"."payments_method_enum" AS ENUM('cash', 'card', 'transfer', 'other')`);
        await queryRunner.query(`CREATE TABLE "payments" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "deleted_at" TIMESTAMP WITH TIME ZONE, "tenant_id" uuid NOT NULL, "invoice_id" uuid NOT NULL, "method" "public"."payments_method_enum" NOT NULL, "amount" numeric(14,2) NOT NULL, "received_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "reference" character varying(120), "notes" text, CONSTRAINT "PK_197ab7af18c93fbb0c9b28b4a59" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_9109b53fca5cef7720aca72974" ON "payments" ("tenant_id") `);
        await queryRunner.query(`CREATE INDEX "IDX_563a5e248518c623eebd987d43" ON "payments" ("invoice_id") `);
        await queryRunner.query(`CREATE TYPE "public"."invoices_type_enum" AS ENUM('invoice', 'credit_note')`);
        await queryRunner.query(`CREATE TYPE "public"."invoices_status_enum" AS ENUM('draft', 'issued', 'cancelled')`);
        await queryRunner.query(`CREATE TABLE "invoices" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "deleted_at" TIMESTAMP WITH TIME ZONE, "tenant_id" uuid NOT NULL, "number" character varying(30) NOT NULL, "series_id" uuid NOT NULL, "type" "public"."invoices_type_enum" NOT NULL DEFAULT 'invoice', "status" "public"."invoices_status_enum" NOT NULL DEFAULT 'draft', "customer_id" uuid NOT NULL, "order_id" uuid, "warehouse_id" uuid, "issue_date" date NOT NULL DEFAULT ('now'::text)::date, "due_date" date, "currency" character varying(3) NOT NULL DEFAULT 'USD', "subtotal" numeric(14,2) NOT NULL DEFAULT '0', "discount" numeric(14,2) NOT NULL DEFAULT '0', "tax" numeric(14,2) NOT NULL DEFAULT '0', "total" numeric(14,2) NOT NULL DEFAULT '0', "paid_amount" numeric(14,2) NOT NULL DEFAULT '0', "balance_due" numeric(14,2) NOT NULL DEFAULT '0', "notes" text, "version" integer NOT NULL DEFAULT '1', CONSTRAINT "UQ_82cbaf60f0fc5324290bd3d9a92" UNIQUE ("tenant_id", "number"), CONSTRAINT "PK_668cef7c22a427fd822cc1be3ce" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_440f531f452dcc4389d201b9d4" ON "invoices" ("tenant_id") `);
        await queryRunner.query(`CREATE INDEX "IDX_65e3145f317bd655481d3f96c7" ON "invoices" ("customer_id") `);
        await queryRunner.query(`CREATE TABLE "sales_order_items" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "deleted_at" TIMESTAMP WITH TIME ZONE, "tenant_id" uuid NOT NULL, "order_id" uuid NOT NULL, "product_id" uuid NOT NULL, "description" character varying(255) NOT NULL, "quantity" numeric(18,4) NOT NULL, "unit_price" numeric(14,2) NOT NULL DEFAULT '0', "discount" numeric(14,2) NOT NULL DEFAULT '0', "tax_rate" numeric(6,4) NOT NULL DEFAULT '0', "tax_amount" numeric(14,2) NOT NULL DEFAULT '0', "line_total" numeric(14,2) NOT NULL DEFAULT '0', CONSTRAINT "PK_a5f8d983ae4db44dcc923faf2ef" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_4c3e4caead591cdf288bcb4177" ON "sales_order_items" ("tenant_id") `);
        await queryRunner.query(`CREATE INDEX "IDX_03b37c70136abdfd3841f176cd" ON "sales_order_items" ("order_id") `);
        await queryRunner.query(`CREATE TYPE "public"."sales_orders_kind_enum" AS ENUM('quote', 'order')`);
        await queryRunner.query(`CREATE TYPE "public"."sales_orders_status_enum" AS ENUM('draft', 'confirmed', 'invoiced', 'cancelled')`);
        await queryRunner.query(`CREATE TABLE "sales_orders" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "deleted_at" TIMESTAMP WITH TIME ZONE, "tenant_id" uuid NOT NULL, "number" character varying(30) NOT NULL, "kind" "public"."sales_orders_kind_enum" NOT NULL DEFAULT 'order', "status" "public"."sales_orders_status_enum" NOT NULL DEFAULT 'draft', "customer_id" uuid NOT NULL, "warehouse_id" uuid NOT NULL, "issue_date" date NOT NULL DEFAULT ('now'::text)::date, "due_date" date, "currency" character varying(3) NOT NULL DEFAULT 'USD', "subtotal" numeric(14,2) NOT NULL DEFAULT '0', "discount" numeric(14,2) NOT NULL DEFAULT '0', "tax" numeric(14,2) NOT NULL DEFAULT '0', "total" numeric(14,2) NOT NULL DEFAULT '0', "notes" text, "version" integer NOT NULL DEFAULT '1', CONSTRAINT "UQ_4f39a31a09a8dea6a43c00f497a" UNIQUE ("tenant_id", "number"), CONSTRAINT "PK_5328297e067ca929fbe7cf989dd" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_77e3868b735c09c41f48951170" ON "sales_orders" ("tenant_id") `);
        await queryRunner.query(`CREATE INDEX "IDX_1fb56bee917dfd98ada56d626d" ON "sales_orders" ("customer_id") `);
        await queryRunner.query(`CREATE TYPE "public"."taxes_kind_enum" AS ENUM('sales', 'purchase')`);
        await queryRunner.query(`CREATE TABLE "taxes" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "deleted_at" TIMESTAMP WITH TIME ZONE, "tenant_id" uuid NOT NULL, "name" character varying(60) NOT NULL, "rate" numeric(6,4) NOT NULL, "kind" "public"."taxes_kind_enum" NOT NULL DEFAULT 'sales', "active" boolean NOT NULL DEFAULT true, CONSTRAINT "PK_6c58c9cbb420c4f65e3f5eb8162" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_c5cc34555d7f1ac9a63d3af944" ON "taxes" ("tenant_id") `);
        await queryRunner.query(`ALTER TABLE "invoice_items" ADD CONSTRAINT "FK_dc991d555664682cfe892eea2c1" FOREIGN KEY ("invoice_id") REFERENCES "invoices"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "invoice_items" ADD CONSTRAINT "FK_5a76734b5eead0967cf6ee3abc0" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "payments" ADD CONSTRAINT "FK_563a5e248518c623eebd987d43e" FOREIGN KEY ("invoice_id") REFERENCES "invoices"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "invoices" ADD CONSTRAINT "FK_65e3145f317bd655481d3f96c74" FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "sales_order_items" ADD CONSTRAINT "FK_03b37c70136abdfd3841f176cd7" FOREIGN KEY ("order_id") REFERENCES "sales_orders"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "sales_order_items" ADD CONSTRAINT "FK_a26c8d9474f682fcb603797e78d" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "sales_orders" ADD CONSTRAINT "FK_1fb56bee917dfd98ada56d626de" FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "sales_orders" ADD CONSTRAINT "FK_d06febc93fc604568a79b11474d" FOREIGN KEY ("warehouse_id") REFERENCES "warehouses"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "sales_orders" DROP CONSTRAINT "FK_d06febc93fc604568a79b11474d"`);
        await queryRunner.query(`ALTER TABLE "sales_orders" DROP CONSTRAINT "FK_1fb56bee917dfd98ada56d626de"`);
        await queryRunner.query(`ALTER TABLE "sales_order_items" DROP CONSTRAINT "FK_a26c8d9474f682fcb603797e78d"`);
        await queryRunner.query(`ALTER TABLE "sales_order_items" DROP CONSTRAINT "FK_03b37c70136abdfd3841f176cd7"`);
        await queryRunner.query(`ALTER TABLE "invoices" DROP CONSTRAINT "FK_65e3145f317bd655481d3f96c74"`);
        await queryRunner.query(`ALTER TABLE "payments" DROP CONSTRAINT "FK_563a5e248518c623eebd987d43e"`);
        await queryRunner.query(`ALTER TABLE "invoice_items" DROP CONSTRAINT "FK_5a76734b5eead0967cf6ee3abc0"`);
        await queryRunner.query(`ALTER TABLE "invoice_items" DROP CONSTRAINT "FK_dc991d555664682cfe892eea2c1"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_c5cc34555d7f1ac9a63d3af944"`);
        await queryRunner.query(`DROP TABLE "taxes"`);
        await queryRunner.query(`DROP TYPE "public"."taxes_kind_enum"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_1fb56bee917dfd98ada56d626d"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_77e3868b735c09c41f48951170"`);
        await queryRunner.query(`DROP TABLE "sales_orders"`);
        await queryRunner.query(`DROP TYPE "public"."sales_orders_status_enum"`);
        await queryRunner.query(`DROP TYPE "public"."sales_orders_kind_enum"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_03b37c70136abdfd3841f176cd"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_4c3e4caead591cdf288bcb4177"`);
        await queryRunner.query(`DROP TABLE "sales_order_items"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_65e3145f317bd655481d3f96c7"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_440f531f452dcc4389d201b9d4"`);
        await queryRunner.query(`DROP TABLE "invoices"`);
        await queryRunner.query(`DROP TYPE "public"."invoices_status_enum"`);
        await queryRunner.query(`DROP TYPE "public"."invoices_type_enum"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_563a5e248518c623eebd987d43"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_9109b53fca5cef7720aca72974"`);
        await queryRunner.query(`DROP TABLE "payments"`);
        await queryRunner.query(`DROP TYPE "public"."payments_method_enum"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_dc991d555664682cfe892eea2c"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_deaeb7940633a09af4c6c14df8"`);
        await queryRunner.query(`DROP TABLE "invoice_items"`);
        await queryRunner.query(`DROP TABLE "idempotency_keys"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_28704afcb4bd38310549e0ce28"`);
        await queryRunner.query(`DROP TABLE "document_series"`);
        await queryRunner.query(`DROP TYPE "public"."document_series_kind_enum"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_6a1d20a1ca90c48dd400d9a2a6"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_97913f35ac2e435a4463fb50a0"`);
        await queryRunner.query(`DROP TABLE "customers"`);
    }

}
