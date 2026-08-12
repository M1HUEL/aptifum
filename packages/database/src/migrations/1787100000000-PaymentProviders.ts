import { MigrationInterface, QueryRunner } from "typeorm";

export class PaymentProviders1787100000000 implements MigrationInterface {
    name = 'PaymentProviders1787100000000'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE "payment_providers" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "deleted_at" TIMESTAMP WITH TIME ZONE, "tenant_id" uuid NOT NULL, "provider" character varying(30) NOT NULL, "environment" character varying(10) NOT NULL DEFAULT 'test', "secret_key" text NOT NULL, "webhook_secret" text NOT NULL, "is_enabled" boolean NOT NULL DEFAULT false, CONSTRAINT "UQ_pp_tenant_provider" UNIQUE ("tenant_id", "provider"), CONSTRAINT "PK_payment_providers" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_pp_tenant_id" ON "payment_providers" ("tenant_id") `);
        await queryRunner.query(`CREATE INDEX "IDX_pp_is_enabled" ON "payment_providers" ("is_enabled") `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP INDEX "public"."IDX_pp_is_enabled"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_pp_tenant_id"`);
        await queryRunner.query(`DROP TABLE "payment_providers"`);
    }

}
