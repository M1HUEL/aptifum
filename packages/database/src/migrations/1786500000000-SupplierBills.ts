import { MigrationInterface, QueryRunner } from 'typeorm';

export class SupplierBills1786500000000 implements MigrationInterface {
  name = 'SupplierBills1786500000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TYPE "public"."document_series_kind_enum" ADD VALUE IF NOT EXISTS 'supplier_bill'`);
    await queryRunner.query(
      `CREATE TYPE "public"."supplier_bills_status_enum" AS ENUM('draft', 'issued', 'paid', 'cancelled')`,
    );
    await queryRunner.query(
      `CREATE TABLE "supplier_bills" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "deleted_at" TIMESTAMP WITH TIME ZONE, "tenant_id" uuid NOT NULL, "number" character varying(30), "supplier_id" uuid NOT NULL, "order_id" uuid, "receipt_id" uuid, "status" "public"."supplier_bills_status_enum" NOT NULL DEFAULT 'draft', "bill_date" date NOT NULL DEFAULT CURRENT_DATE, "due_date" date, "currency" character varying(3) NOT NULL DEFAULT 'USD', "subtotal" numeric(14,2) NOT NULL DEFAULT '0', "tax" numeric(14,2) NOT NULL DEFAULT '0', "total" numeric(14,2) NOT NULL DEFAULT '0', "paid_amount" numeric(14,2) NOT NULL DEFAULT '0', "balance_due" numeric(14,2) NOT NULL DEFAULT '0', "notes" text, "issued_at" TIMESTAMP WITH TIME ZONE, "version" integer NOT NULL DEFAULT '1', CONSTRAINT "UQ_supplier_bills_tenant_number" UNIQUE ("tenant_id", "number"), CONSTRAINT "PK_supplier_bills" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(`CREATE INDEX "IDX_supplier_bills_tenant_id" ON "supplier_bills" ("tenant_id") `);
    await queryRunner.query(`CREATE INDEX "IDX_supplier_bills_supplier_id" ON "supplier_bills" ("supplier_id") `);
    await queryRunner.query(
      `CREATE TABLE "supplier_bill_items" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "deleted_at" TIMESTAMP WITH TIME ZONE, "tenant_id" uuid NOT NULL, "bill_id" uuid NOT NULL, "product_id" uuid, "description" character varying(255) NOT NULL, "quantity" numeric(18,4) NOT NULL, "unit_price" numeric(14,2) NOT NULL, "tax_rate" numeric(6,4) NOT NULL DEFAULT '0', "line_total" numeric(14,2) NOT NULL, CONSTRAINT "PK_supplier_bill_items" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(`CREATE INDEX "IDX_sbi_tenant_id" ON "supplier_bill_items" ("tenant_id") `);
    await queryRunner.query(`CREATE INDEX "IDX_sbi_bill_id" ON "supplier_bill_items" ("bill_id") `);
    await queryRunner.query(
      `ALTER TABLE "supplier_bills" ADD CONSTRAINT "FK_sb_supplier" FOREIGN KEY ("supplier_id") REFERENCES "suppliers"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "supplier_bill_items" ADD CONSTRAINT "FK_sbi_bill" FOREIGN KEY ("bill_id") REFERENCES "supplier_bills"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "supplier_bill_items" ADD CONSTRAINT "FK_sbi_product" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(`ALTER TABLE "supplier_payments" ADD "bill_id" uuid`);
    await queryRunner.query(`CREATE INDEX "IDX_sp_bill_id" ON "supplier_payments" ("bill_id") `);
    await queryRunner.query(
      `ALTER TABLE "supplier_payments" ADD CONSTRAINT "FK_sp_bill" FOREIGN KEY ("bill_id") REFERENCES "supplier_bills"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "supplier_payments" DROP CONSTRAINT "FK_sp_bill"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_sp_bill_id"`);
    await queryRunner.query(`ALTER TABLE "supplier_payments" DROP COLUMN "bill_id"`);
    await queryRunner.query(`ALTER TABLE "supplier_bill_items" DROP CONSTRAINT "FK_sbi_product"`);
    await queryRunner.query(`ALTER TABLE "supplier_bill_items" DROP CONSTRAINT "FK_sbi_bill"`);
    await queryRunner.query(`ALTER TABLE "supplier_bills" DROP CONSTRAINT "FK_sb_supplier"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_sbi_bill_id"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_sbi_tenant_id"`);
    await queryRunner.query(`DROP TABLE "supplier_bill_items"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_supplier_bills_supplier_id"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_supplier_bills_tenant_id"`);
    await queryRunner.query(`DROP TABLE "supplier_bills"`);
    await queryRunner.query(`DROP TYPE "public"."supplier_bills_status_enum"`);
  }
}
