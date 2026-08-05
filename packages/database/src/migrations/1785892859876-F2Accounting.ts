import { MigrationInterface, QueryRunner } from "typeorm";

export class F2Accounting1785892859876 implements MigrationInterface {
    name = 'F2Accounting1785892859876'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TYPE "public"."document_series_kind_enum" ADD VALUE IF NOT EXISTS 'journal_entry'`);
        await queryRunner.query(`CREATE TYPE "public"."chart_accounts_type_enum" AS ENUM('asset', 'liability', 'equity', 'revenue', 'expense')`);
        await queryRunner.query(`CREATE TYPE "public"."chart_accounts_normal_balance_enum" AS ENUM('debit', 'credit')`);
        await queryRunner.query(`CREATE TYPE "public"."accounting_periods_status_enum" AS ENUM('open', 'closed')`);
        await queryRunner.query(`CREATE TYPE "public"."journal_entries_status_enum" AS ENUM('draft', 'posted', 'reversed')`);
        await queryRunner.query(`CREATE TABLE "chart_accounts" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "deleted_at" TIMESTAMP WITH TIME ZONE, "tenant_id" uuid NOT NULL, "code" character varying(20) NOT NULL, "name" character varying(255) NOT NULL, "type" "public"."chart_accounts_type_enum" NOT NULL, "normal_balance" "public"."chart_accounts_normal_balance_enum" NOT NULL, "parent_id" uuid, "active" boolean NOT NULL DEFAULT true, "description" character varying(255), "version" integer NOT NULL DEFAULT '1', CONSTRAINT "UQ_chart_accounts_tenant_code" UNIQUE ("tenant_id", "code"), CONSTRAINT "PK_chart_accounts" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_chart_accounts_tenant_id" ON "chart_accounts" ("tenant_id") `);
        await queryRunner.query(`CREATE INDEX "IDX_chart_accounts_code" ON "chart_accounts" ("code") `);
        await queryRunner.query(`CREATE TABLE "accounting_periods" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "deleted_at" TIMESTAMP WITH TIME ZONE, "tenant_id" uuid NOT NULL, "period" character varying(7) NOT NULL, "label" character varying(120) NOT NULL, "start_date" date NOT NULL, "end_date" date NOT NULL, "status" "public"."accounting_periods_status_enum" NOT NULL DEFAULT 'open', "closed_at" TIMESTAMP WITH TIME ZONE, "closed_by" uuid, CONSTRAINT "UQ_accounting_periods_tenant_period" UNIQUE ("tenant_id", "period"), CONSTRAINT "PK_accounting_periods" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_accounting_periods_tenant_id" ON "accounting_periods" ("tenant_id") `);
        await queryRunner.query(`CREATE INDEX "IDX_accounting_periods_period" ON "accounting_periods" ("period") `);
        await queryRunner.query(`CREATE TABLE "journal_entries" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "deleted_at" TIMESTAMP WITH TIME ZONE, "tenant_id" uuid NOT NULL, "number" character varying(30) NOT NULL, "period_id" uuid NOT NULL, "entry_date" date NOT NULL, "status" "public"."journal_entries_status_enum" NOT NULL DEFAULT 'posted', "reference_type" character varying(120), "reference_id" uuid, "currency" character varying(3) NOT NULL DEFAULT 'USD', "description" text, "debit_total" numeric(14,2) NOT NULL DEFAULT '0', "credit_total" numeric(14,2) NOT NULL DEFAULT '0', "posted_at" TIMESTAMP WITH TIME ZONE, "posted_by" uuid, "reversed_by_entry_id" uuid, "version" integer NOT NULL DEFAULT '1', CONSTRAINT "UQ_journal_entries_tenant_number" UNIQUE ("tenant_id", "number"), CONSTRAINT "PK_journal_entries" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_journal_entries_tenant_id" ON "journal_entries" ("tenant_id") `);
        await queryRunner.query(`CREATE INDEX "IDX_journal_entries_number" ON "journal_entries" ("number") `);
        await queryRunner.query(`CREATE TABLE "journal_entry_lines" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "deleted_at" TIMESTAMP WITH TIME ZONE, "tenant_id" uuid NOT NULL, "entry_id" uuid NOT NULL, "account_id" uuid NOT NULL, "line_index" integer NOT NULL, "description" character varying(255), "debit" numeric(14,2) NOT NULL DEFAULT '0', "credit" numeric(14,2) NOT NULL DEFAULT '0', CONSTRAINT "PK_journal_entry_lines" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_jel_tenant_id" ON "journal_entry_lines" ("tenant_id") `);
        await queryRunner.query(`CREATE INDEX "IDX_jel_entry_id" ON "journal_entry_lines" ("entry_id") `);
        await queryRunner.query(`CREATE INDEX "IDX_jel_account_id" ON "journal_entry_lines" ("account_id") `);
        await queryRunner.query(`ALTER TABLE "journal_entry_lines" ADD CONSTRAINT "FK_jel_entry" FOREIGN KEY ("entry_id") REFERENCES "journal_entries"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "journal_entry_lines" ADD CONSTRAINT "FK_jel_account" FOREIGN KEY ("account_id") REFERENCES "chart_accounts"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "journal_entries" ADD CONSTRAINT "FK_je_period" FOREIGN KEY ("period_id") REFERENCES "accounting_periods"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "journal_entries" DROP CONSTRAINT "FK_je_period"`);
        await queryRunner.query(`ALTER TABLE "journal_entry_lines" DROP CONSTRAINT "FK_jel_account"`);
        await queryRunner.query(`ALTER TABLE "journal_entry_lines" DROP CONSTRAINT "FK_jel_entry"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_jel_account_id"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_jel_entry_id"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_jel_tenant_id"`);
        await queryRunner.query(`DROP TABLE "journal_entry_lines"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_journal_entries_number"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_journal_entries_tenant_id"`);
        await queryRunner.query(`DROP TABLE "journal_entries"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_accounting_periods_period"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_accounting_periods_tenant_id"`);
        await queryRunner.query(`DROP TABLE "accounting_periods"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_chart_accounts_code"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_chart_accounts_tenant_id"`);
        await queryRunner.query(`DROP TABLE "chart_accounts"`);
        await queryRunner.query(`DROP TYPE "public"."journal_entries_status_enum"`);
        await queryRunner.query(`DROP TYPE "public"."accounting_periods_status_enum"`);
        await queryRunner.query(`DROP TYPE "public"."chart_accounts_normal_balance_enum"`);
        await queryRunner.query(`DROP TYPE "public"."chart_accounts_type_enum"`);
    }

}
