import { MigrationInterface, QueryRunner } from 'typeorm';

export class SupplierPayments1786300000000 implements MigrationInterface {
  name = 'SupplierPayments1786300000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TYPE "public"."supplier_payments_method_enum" AS ENUM('cash', 'card', 'transfer', 'other')`,
    );
    await queryRunner.query(
      `CREATE TABLE "supplier_payments" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "deleted_at" TIMESTAMP WITH TIME ZONE, "tenant_id" uuid NOT NULL, "supplier_id" uuid NOT NULL, "method" "public"."supplier_payments_method_enum" NOT NULL, "amount" numeric(14,2) NOT NULL, "paid_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "reference" character varying(120), "notes" text, CONSTRAINT "PK_supplier_payments" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(`CREATE INDEX "IDX_sp_tenant_id" ON "supplier_payments" ("tenant_id") `);
    await queryRunner.query(`CREATE INDEX "IDX_sp_supplier_id" ON "supplier_payments" ("supplier_id") `);
    await queryRunner.query(
      `ALTER TABLE "supplier_payments" ADD CONSTRAINT "FK_sp_supplier" FOREIGN KEY ("supplier_id") REFERENCES "suppliers"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "supplier_payments" DROP CONSTRAINT "FK_sp_supplier"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_sp_supplier_id"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_sp_tenant_id"`);
    await queryRunner.query(`DROP TABLE "supplier_payments"`);
    await queryRunner.query(`DROP TYPE "public"."supplier_payments_method_enum"`);
  }
}
