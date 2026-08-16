import { MigrationInterface, QueryRunner } from 'typeorm';

export class F3Crm1785895565712 implements MigrationInterface {
  name = 'F3Crm1785895565712';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TYPE "public"."document_series_kind_enum" ADD VALUE IF NOT EXISTS 'lead'`);
    await queryRunner.query(
      `CREATE TYPE "public"."crm_leads_status_enum" AS ENUM('new', 'contacted', 'qualified', 'disqualified', 'converted')`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."crm_opportunities_stage_enum" AS ENUM('prospecting', 'qualification', 'proposal', 'negotiation', 'won', 'lost')`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."crm_activities_type_enum" AS ENUM('call', 'meeting', 'task', 'note')`,
    );
    await queryRunner.query(
      `CREATE TABLE "crm_contacts" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "deleted_at" TIMESTAMP WITH TIME ZONE, "tenant_id" uuid NOT NULL, "full_name" character varying(255) NOT NULL, "customer_id" uuid, "title" character varying(120), "email" character varying(190), "phone" character varying(40), "mobile" character varying(40), "address" character varying(255), "notes" text, "active" boolean NOT NULL DEFAULT true, CONSTRAINT "PK_crm_contacts" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(`CREATE INDEX "IDX_crm_contacts_tenant_id" ON "crm_contacts" ("tenant_id") `);
    await queryRunner.query(`CREATE INDEX "IDX_crm_contacts_customer_id" ON "crm_contacts" ("customer_id") `);
    await queryRunner.query(`CREATE INDEX "IDX_crm_contacts_full_name" ON "crm_contacts" ("full_name") `);
    await queryRunner.query(
      `CREATE TABLE "crm_leads" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "deleted_at" TIMESTAMP WITH TIME ZONE, "tenant_id" uuid NOT NULL, "number" character varying(30) NOT NULL, "source" character varying(120), "company_name" character varying(255), "contact_name" character varying(255) NOT NULL, "email" character varying(190), "phone" character varying(40), "status" "public"."crm_leads_status_enum" NOT NULL DEFAULT 'new', "estimated_amount" numeric(14,2) NOT NULL DEFAULT '0', "currency" character varying(3) NOT NULL DEFAULT 'USD', "assigned_user_id" uuid, "notes" text, "converted_customer_id" uuid, "version" integer NOT NULL DEFAULT '1', CONSTRAINT "UQ_crm_leads_tenant_number" UNIQUE ("tenant_id", "number"), CONSTRAINT "PK_crm_leads" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(`CREATE INDEX "IDX_crm_leads_tenant_id" ON "crm_leads" ("tenant_id") `);
    await queryRunner.query(`CREATE INDEX "IDX_crm_leads_number" ON "crm_leads" ("number") `);
    await queryRunner.query(`CREATE INDEX "IDX_crm_leads_status" ON "crm_leads" ("status") `);
    await queryRunner.query(
      `CREATE TABLE "crm_opportunities" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "deleted_at" TIMESTAMP WITH TIME ZONE, "tenant_id" uuid NOT NULL, "name" character varying(255) NOT NULL, "customer_id" uuid, "lead_id" uuid, "stage" "public"."crm_opportunities_stage_enum" NOT NULL DEFAULT 'prospecting', "amount" numeric(14,2) NOT NULL DEFAULT '0', "currency" character varying(3) NOT NULL DEFAULT 'USD', "probability" integer NOT NULL DEFAULT '0', "expected_close_date" date, "assigned_user_id" uuid, "won_at" TIMESTAMP WITH TIME ZONE, "lost_at" TIMESTAMP WITH TIME ZONE, "notes" text, "version" integer NOT NULL DEFAULT '1', CONSTRAINT "PK_crm_opportunities" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(`CREATE INDEX "IDX_crm_opportunities_tenant_id" ON "crm_opportunities" ("tenant_id") `);
    await queryRunner.query(`CREATE INDEX "IDX_crm_opportunities_customer_id" ON "crm_opportunities" ("customer_id") `);
    await queryRunner.query(`CREATE INDEX "IDX_crm_opportunities_stage" ON "crm_opportunities" ("stage") `);
    await queryRunner.query(`CREATE INDEX "IDX_crm_opportunities_name" ON "crm_opportunities" ("name") `);
    await queryRunner.query(
      `CREATE TABLE "crm_activities" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "deleted_at" TIMESTAMP WITH TIME ZONE, "tenant_id" uuid NOT NULL, "activity_type" "public"."crm_activities_type_enum" NOT NULL, "subject" character varying(255) NOT NULL, "description" text, "due_at" TIMESTAMP WITH TIME ZONE, "completed_at" TIMESTAMP WITH TIME ZONE, "assignee_id" uuid, "reference_type" character varying(120), "reference_id" uuid, CONSTRAINT "PK_crm_activities" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(`CREATE INDEX "IDX_crm_activities_tenant_id" ON "crm_activities" ("tenant_id") `);
    await queryRunner.query(`CREATE INDEX "IDX_crm_activities_reference_type" ON "crm_activities" ("reference_type") `);
    await queryRunner.query(`CREATE INDEX "IDX_crm_activities_reference_id" ON "crm_activities" ("reference_id") `);
    await queryRunner.query(
      `ALTER TABLE "crm_contacts" ADD CONSTRAINT "FK_crm_contacts_customer" FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "crm_leads" ADD CONSTRAINT "FK_crm_leads_converted_customer" FOREIGN KEY ("converted_customer_id") REFERENCES "customers"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "crm_opportunities" ADD CONSTRAINT "FK_crm_opportunities_customer" FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "crm_opportunities" ADD CONSTRAINT "FK_crm_opportunities_lead" FOREIGN KEY ("lead_id") REFERENCES "crm_leads"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "crm_opportunities" DROP CONSTRAINT "FK_crm_opportunities_lead"`);
    await queryRunner.query(`ALTER TABLE "crm_opportunities" DROP CONSTRAINT "FK_crm_opportunities_customer"`);
    await queryRunner.query(`ALTER TABLE "crm_leads" DROP CONSTRAINT "FK_crm_leads_converted_customer"`);
    await queryRunner.query(`ALTER TABLE "crm_contacts" DROP CONSTRAINT "FK_crm_contacts_customer"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_crm_activities_reference_id"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_crm_activities_reference_type"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_crm_activities_tenant_id"`);
    await queryRunner.query(`DROP TABLE "crm_activities"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_crm_opportunities_name"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_crm_opportunities_stage"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_crm_opportunities_customer_id"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_crm_opportunities_tenant_id"`);
    await queryRunner.query(`DROP TABLE "crm_opportunities"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_crm_leads_status"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_crm_leads_number"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_crm_leads_tenant_id"`);
    await queryRunner.query(`DROP TABLE "crm_leads"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_crm_contacts_full_name"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_crm_contacts_customer_id"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_crm_contacts_tenant_id"`);
    await queryRunner.query(`DROP TABLE "crm_contacts"`);
    await queryRunner.query(`DROP TYPE "public"."crm_activities_type_enum"`);
    await queryRunner.query(`DROP TYPE "public"."crm_opportunities_stage_enum"`);
    await queryRunner.query(`DROP TYPE "public"."crm_leads_status_enum"`);
  }
}
