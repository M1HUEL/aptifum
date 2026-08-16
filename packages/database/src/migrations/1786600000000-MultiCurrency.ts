import { MigrationInterface, QueryRunner } from 'typeorm';

export class MultiCurrency1786600000000 implements MigrationInterface {
  name = 'MultiCurrency1786600000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "exchange_rates" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "deleted_at" TIMESTAMP WITH TIME ZONE, "tenant_id" uuid NOT NULL, "base_currency" character varying(3) NOT NULL, "quote_currency" character varying(3) NOT NULL, "rate_date" date NOT NULL DEFAULT CURRENT_DATE, "rate" numeric(18,6) NOT NULL, CONSTRAINT "UQ_exchange_rates_tenant_pair_date" UNIQUE ("tenant_id", "base_currency", "quote_currency", "rate_date"), CONSTRAINT "PK_exchange_rates" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(`CREATE INDEX "IDX_exchange_rates_tenant_id" ON "exchange_rates" ("tenant_id") `);
    await queryRunner.query(
      `CREATE INDEX "IDX_exchange_rates_tenant_pair_date" ON "exchange_rates" ("tenant_id", "base_currency", "quote_currency", "rate_date") `,
    );
    await queryRunner.query(`ALTER TABLE "invoices" ADD "exchange_rate" numeric(18,6) NOT NULL DEFAULT '1'`);
    await queryRunner.query(`ALTER TABLE "supplier_bills" ADD "exchange_rate" numeric(18,6) NOT NULL DEFAULT '1'`);
    await queryRunner.query(`ALTER TABLE "payments" ADD "exchange_rate" numeric(18,6) NOT NULL DEFAULT '1'`);
    await queryRunner.query(`ALTER TABLE "supplier_payments" ADD "exchange_rate" numeric(18,6) NOT NULL DEFAULT '1'`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "supplier_payments" DROP COLUMN "exchange_rate"`);
    await queryRunner.query(`ALTER TABLE "payments" DROP COLUMN "exchange_rate"`);
    await queryRunner.query(`ALTER TABLE "supplier_bills" DROP COLUMN "exchange_rate"`);
    await queryRunner.query(`ALTER TABLE "invoices" DROP COLUMN "exchange_rate"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_exchange_rates_tenant_pair_date"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_exchange_rates_tenant_id"`);
    await queryRunner.query(`DROP TABLE "exchange_rates"`);
  }
}
