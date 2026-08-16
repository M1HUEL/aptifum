import { MigrationInterface, QueryRunner } from 'typeorm';

export class F3Hr1785896523276 implements MigrationInterface {
  name = 'F3Hr1785896523276';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TYPE "public"."document_series_kind_enum" ADD VALUE IF NOT EXISTS 'payroll'`);
    await queryRunner.query(`CREATE TYPE "public"."hr_employees_status_enum" AS ENUM('active', 'inactive')`);
    await queryRunner.query(
      `CREATE TYPE "public"."hr_attendance_status_enum" AS ENUM('present', 'late', 'absent', 'leave')`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."hr_leaves_type_enum" AS ENUM('vacation', 'sick', 'personal', 'other')`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."hr_leaves_status_enum" AS ENUM('pending', 'approved', 'rejected', 'cancelled')`,
    );
    await queryRunner.query(`CREATE TYPE "public"."hr_payrolls_status_enum" AS ENUM('draft', 'posted', 'cancelled')`);
    await queryRunner.query(
      `CREATE TABLE "hr_departments" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "deleted_at" TIMESTAMP WITH TIME ZONE, "tenant_id" uuid NOT NULL, "code" character varying(40) NOT NULL, "name" character varying(255) NOT NULL, "manager_employee_id" uuid, "active" boolean NOT NULL DEFAULT true, CONSTRAINT "UQ_hr_departments_tenant_code" UNIQUE ("tenant_id", "code"), CONSTRAINT "PK_hr_departments" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(`CREATE INDEX "IDX_hr_departments_tenant_id" ON "hr_departments" ("tenant_id") `);
    await queryRunner.query(`CREATE INDEX "IDX_hr_departments_code" ON "hr_departments" ("code") `);
    await queryRunner.query(
      `CREATE TABLE "hr_employees" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "deleted_at" TIMESTAMP WITH TIME ZONE, "tenant_id" uuid NOT NULL, "employee_no" character varying(30) NOT NULL, "first_name" character varying(120) NOT NULL, "last_name" character varying(120) NOT NULL, "email" character varying(190), "phone" character varying(40), "department_id" uuid, "position" character varying(120), "hire_date" date NOT NULL, "termination_date" date, "salary" numeric(14,2) NOT NULL DEFAULT '0', "salary_frequency" character varying(20) NOT NULL DEFAULT 'monthly', "bank_name" character varying(120), "bank_account" character varying(60), "tax_id" character varying(60), "address" character varying(255), "status" "public"."hr_employees_status_enum" NOT NULL DEFAULT 'active', "version" integer NOT NULL DEFAULT '1', CONSTRAINT "UQ_hr_employees_tenant_employee_no" UNIQUE ("tenant_id", "employee_no"), CONSTRAINT "PK_hr_employees" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(`CREATE INDEX "IDX_hr_employees_tenant_id" ON "hr_employees" ("tenant_id") `);
    await queryRunner.query(`CREATE INDEX "IDX_hr_employees_employee_no" ON "hr_employees" ("employee_no") `);
    await queryRunner.query(`CREATE INDEX "IDX_hr_employees_status" ON "hr_employees" ("status") `);
    await queryRunner.query(
      `CREATE TABLE "hr_attendance" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "deleted_at" TIMESTAMP WITH TIME ZONE, "tenant_id" uuid NOT NULL, "employee_id" uuid NOT NULL, "work_date" date NOT NULL, "clock_in_at" TIMESTAMP WITH TIME ZONE, "clock_out_at" TIMESTAMP WITH TIME ZONE, "worked_minutes" integer NOT NULL DEFAULT '0', "status" "public"."hr_attendance_status_enum" NOT NULL DEFAULT 'present', "notes" text, CONSTRAINT "UQ_hr_attendance_tenant_employee_work_date" UNIQUE ("tenant_id", "employee_id", "work_date"), CONSTRAINT "PK_hr_attendance" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(`CREATE INDEX "IDX_hr_attendance_tenant_id" ON "hr_attendance" ("tenant_id") `);
    await queryRunner.query(`CREATE INDEX "IDX_hr_attendance_employee_id" ON "hr_attendance" ("employee_id") `);
    await queryRunner.query(`CREATE INDEX "IDX_hr_attendance_status" ON "hr_attendance" ("status") `);
    await queryRunner.query(
      `CREATE TABLE "hr_leaves" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "deleted_at" TIMESTAMP WITH TIME ZONE, "tenant_id" uuid NOT NULL, "employee_id" uuid NOT NULL, "leave_type" "public"."hr_leaves_type_enum" NOT NULL, "start_date" date NOT NULL, "end_date" date NOT NULL, "days" integer NOT NULL DEFAULT '1', "status" "public"."hr_leaves_status_enum" NOT NULL DEFAULT 'pending', "reason" text, "approved_by" uuid, "approved_at" TIMESTAMP WITH TIME ZONE, CONSTRAINT "PK_hr_leaves" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(`CREATE INDEX "IDX_hr_leaves_tenant_id" ON "hr_leaves" ("tenant_id") `);
    await queryRunner.query(`CREATE INDEX "IDX_hr_leaves_employee_id" ON "hr_leaves" ("employee_id") `);
    await queryRunner.query(`CREATE INDEX "IDX_hr_leaves_leave_type" ON "hr_leaves" ("leave_type") `);
    await queryRunner.query(`CREATE INDEX "IDX_hr_leaves_status" ON "hr_leaves" ("status") `);
    await queryRunner.query(
      `CREATE TABLE "hr_payrolls" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "deleted_at" TIMESTAMP WITH TIME ZONE, "tenant_id" uuid NOT NULL, "number" character varying(30) NOT NULL, "period" character varying(7) NOT NULL, "status" "public"."hr_payrolls_status_enum" NOT NULL DEFAULT 'draft', "currency" character varying(3) NOT NULL DEFAULT 'USD', "total_gross" numeric(14,2) NOT NULL DEFAULT '0', "total_deductions" numeric(14,2) NOT NULL DEFAULT '0', "total_net" numeric(14,2) NOT NULL DEFAULT '0', "paid_at" TIMESTAMP WITH TIME ZONE, "posted_entry_id" uuid, "posted_at" TIMESTAMP WITH TIME ZONE, "version" integer NOT NULL DEFAULT '1', CONSTRAINT "UQ_hr_payrolls_tenant_number" UNIQUE ("tenant_id", "number"), CONSTRAINT "PK_hr_payrolls" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(`CREATE INDEX "IDX_hr_payrolls_tenant_id" ON "hr_payrolls" ("tenant_id") `);
    await queryRunner.query(`CREATE INDEX "IDX_hr_payrolls_number" ON "hr_payrolls" ("number") `);
    await queryRunner.query(`CREATE INDEX "IDX_hr_payrolls_period" ON "hr_payrolls" ("period") `);
    await queryRunner.query(`CREATE INDEX "IDX_hr_payrolls_status" ON "hr_payrolls" ("status") `);
    await queryRunner.query(
      `CREATE TABLE "hr_payroll_lines" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "deleted_at" TIMESTAMP WITH TIME ZONE, "tenant_id" uuid NOT NULL, "payroll_id" uuid NOT NULL, "employee_id" uuid NOT NULL, "gross" numeric(14,2) NOT NULL DEFAULT '0', "bonus" numeric(14,2) NOT NULL DEFAULT '0', "overtime" numeric(14,2) NOT NULL DEFAULT '0', "deductions" numeric(14,2) NOT NULL DEFAULT '0', "net" numeric(14,2) NOT NULL DEFAULT '0', CONSTRAINT "UQ_hr_payroll_lines_tenant_payroll_employee" UNIQUE ("tenant_id", "payroll_id", "employee_id"), CONSTRAINT "PK_hr_payroll_lines" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(`CREATE INDEX "IDX_hr_payroll_lines_tenant_id" ON "hr_payroll_lines" ("tenant_id") `);
    await queryRunner.query(`CREATE INDEX "IDX_hr_payroll_lines_payroll_id" ON "hr_payroll_lines" ("payroll_id") `);
    await queryRunner.query(
      `ALTER TABLE "hr_employees" ADD CONSTRAINT "FK_hr_employees_department" FOREIGN KEY ("department_id") REFERENCES "hr_departments"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "hr_attendance" ADD CONSTRAINT "FK_hr_attendance_employee" FOREIGN KEY ("employee_id") REFERENCES "hr_employees"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "hr_leaves" ADD CONSTRAINT "FK_hr_leaves_employee" FOREIGN KEY ("employee_id") REFERENCES "hr_employees"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "hr_payroll_lines" ADD CONSTRAINT "FK_hr_payroll_lines_payroll" FOREIGN KEY ("payroll_id") REFERENCES "hr_payrolls"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "hr_payroll_lines" ADD CONSTRAINT "FK_hr_payroll_lines_employee" FOREIGN KEY ("employee_id") REFERENCES "hr_employees"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "hr_payrolls" ADD CONSTRAINT "FK_hr_payrolls_posted_entry" FOREIGN KEY ("posted_entry_id") REFERENCES "journal_entries"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "hr_payrolls" DROP CONSTRAINT "FK_hr_payrolls_posted_entry"`);
    await queryRunner.query(`ALTER TABLE "hr_payroll_lines" DROP CONSTRAINT "FK_hr_payroll_lines_employee"`);
    await queryRunner.query(`ALTER TABLE "hr_payroll_lines" DROP CONSTRAINT "FK_hr_payroll_lines_payroll"`);
    await queryRunner.query(`ALTER TABLE "hr_leaves" DROP CONSTRAINT "FK_hr_leaves_employee"`);
    await queryRunner.query(`ALTER TABLE "hr_attendance" DROP CONSTRAINT "FK_hr_attendance_employee"`);
    await queryRunner.query(`ALTER TABLE "hr_employees" DROP CONSTRAINT "FK_hr_employees_department"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_hr_payroll_lines_payroll_id"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_hr_payroll_lines_tenant_id"`);
    await queryRunner.query(`DROP TABLE "hr_payroll_lines"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_hr_payrolls_status"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_hr_payrolls_period"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_hr_payrolls_number"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_hr_payrolls_tenant_id"`);
    await queryRunner.query(`DROP TABLE "hr_payrolls"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_hr_leaves_status"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_hr_leaves_leave_type"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_hr_leaves_employee_id"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_hr_leaves_tenant_id"`);
    await queryRunner.query(`DROP TABLE "hr_leaves"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_hr_attendance_status"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_hr_attendance_employee_id"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_hr_attendance_tenant_id"`);
    await queryRunner.query(`DROP TABLE "hr_attendance"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_hr_employees_status"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_hr_employees_employee_no"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_hr_employees_tenant_id"`);
    await queryRunner.query(`DROP TABLE "hr_employees"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_hr_departments_code"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_hr_departments_tenant_id"`);
    await queryRunner.query(`DROP TABLE "hr_departments"`);
    await queryRunner.query(`DROP TYPE "public"."hr_payrolls_status_enum"`);
    await queryRunner.query(`DROP TYPE "public"."hr_leaves_status_enum"`);
    await queryRunner.query(`DROP TYPE "public"."hr_leaves_type_enum"`);
    await queryRunner.query(`DROP TYPE "public"."hr_attendance_status_enum"`);
    await queryRunner.query(`DROP TYPE "public"."hr_employees_status_enum"`);
  }
}
