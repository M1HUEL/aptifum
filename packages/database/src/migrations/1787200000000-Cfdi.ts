import { MigrationInterface, QueryRunner } from 'typeorm';

export class Cfdi1787200000000 implements MigrationInterface {
  name = 'Cfdi1787200000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "tenants" ADD "fiscal_regime" character varying(5)`);
    await queryRunner.query(`ALTER TABLE "tenants" ADD "fiscal_address" jsonb`);
    await queryRunner.query(`ALTER TABLE "customers" ADD "uso_cfdi" character varying(4)`);
    await queryRunner.query(`ALTER TABLE "customers" ADD "regimen_fiscal" character varying(5)`);
    await queryRunner.query(
      `CREATE TABLE "cfdi_certificates" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "deleted_at" TIMESTAMP WITH TIME ZONE, "tenant_id" uuid NOT NULL, "kind" character varying(10) NOT NULL, "rfc" character varying(13) NOT NULL, "name" character varying(255) NOT NULL, "serial_number" character varying(40) NOT NULL, "valid_from" date NOT NULL, "valid_to" date NOT NULL, "certificate_pem" text NOT NULL, "private_key_pem" text NOT NULL, "active" boolean NOT NULL DEFAULT true, CONSTRAINT "UQ_cfdi_cert_tenant_kind" UNIQUE ("tenant_id", "kind"), CONSTRAINT "PK_cfdi_certificates" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."cfdi_documents_status_enum" AS ENUM('pending', 'stamped', 'cancelled')`,
    );
    await queryRunner.query(
      `CREATE TABLE "cfdi_documents" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "deleted_at" TIMESTAMP WITH TIME ZONE, "tenant_id" uuid NOT NULL, "invoice_id" uuid NOT NULL, "uuid" uuid NOT NULL, "serie" character varying(25), "folio" character varying(40), "version" character varying(3) NOT NULL DEFAULT '4.0', "type" character varying(1) NOT NULL, "status" "public"."cfdi_documents_status_enum" NOT NULL DEFAULT 'pending', "emitter_rfc" character varying(13) NOT NULL, "emitter_name" character varying(255) NOT NULL, "emitter_regime" character varying(5) NOT NULL, "receiver_rfc" character varying(13) NOT NULL, "receiver_name" character varying(255) NOT NULL, "receiver_uso" character varying(4), "payment_form" character varying(2) NOT NULL, "payment_method" character varying(3) NOT NULL, "exportacion" character varying(2) NOT NULL DEFAULT '01', "place_of_expedition" character varying(5) NOT NULL, "currency" character varying(3) NOT NULL, "exchange_rate" numeric(18,6) NOT NULL DEFAULT '1', "subtotal" numeric(14,2) NOT NULL DEFAULT '0', "discount" numeric(14,2) NOT NULL DEFAULT '0', "tax" numeric(14,2) NOT NULL DEFAULT '0', "total" numeric(14,2) NOT NULL DEFAULT '0', "xml" text NOT NULL, "cadena_original" text NOT NULL, "sello" text NOT NULL, "cert_number" character varying(40) NOT NULL, "rfc_prov_certif" character varying(13) NOT NULL, "cert_sat_number" character varying(40) NOT NULL, "stamped_at" TIMESTAMP WITH TIME ZONE, "cancelled_at" TIMESTAMP WITH TIME ZONE, CONSTRAINT "UQ_cfdi_tenant_invoice" UNIQUE ("tenant_id", "invoice_id"), CONSTRAINT "UQ_cfdi_tenant_uuid" UNIQUE ("tenant_id", "uuid"), CONSTRAINT "PK_cfdi_documents" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(`CREATE INDEX "IDX_cfdi_tenant_id" ON "cfdi_documents" ("tenant_id") `);
    await queryRunner.query(`CREATE INDEX "IDX_cfdi_invoice_id" ON "cfdi_documents" ("invoice_id") `);
    await queryRunner.query(`CREATE INDEX "IDX_cfdi_uuid" ON "cfdi_documents" ("uuid") `);
    await queryRunner.query(`CREATE INDEX "IDX_cfdi_status" ON "cfdi_documents" ("status") `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "public"."IDX_cfdi_status"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_cfdi_uuid"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_cfdi_invoice_id"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_cfdi_tenant_id"`);
    await queryRunner.query(`DROP TABLE "cfdi_documents"`);
    await queryRunner.query(`DROP TYPE "public"."cfdi_documents_status_enum"`);
    await queryRunner.query(`DROP TABLE "cfdi_certificates"`);
    await queryRunner.query(`ALTER TABLE "customers" DROP COLUMN "regimen_fiscal"`);
    await queryRunner.query(`ALTER TABLE "customers" DROP COLUMN "uso_cfdi"`);
    await queryRunner.query(`ALTER TABLE "tenants" DROP COLUMN "fiscal_address"`);
    await queryRunner.query(`ALTER TABLE "tenants" DROP COLUMN "fiscal_regime"`);
  }
}
