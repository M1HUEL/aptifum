import { MigrationInterface, QueryRunner } from "typeorm";

export class SchemaBaseline1786200000000 implements MigrationInterface {
    name = 'SchemaBaseline1786200000000'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER INDEX "public"."IDX_accounting_periods_tenant_id" RENAME TO "IDX_a4724622ba0625eec688ec9e50"`);
        await queryRunner.query(`ALTER INDEX "public"."IDX_chart_accounts_tenant_id" RENAME TO "IDX_c6b7385774b9327f0238b5a293"`);
        await queryRunner.query(`ALTER INDEX "public"."IDX_hr_departments_tenant_id" RENAME TO "IDX_4df9c2ae4585e90ea2f0b52c95"`);
        await queryRunner.query(`ALTER INDEX "public"."IDX_hr_employees_tenant_id" RENAME TO "IDX_ecc1827ca6fdea01681ca701df"`);
        await queryRunner.query(`ALTER INDEX "public"."IDX_suppliers_tenant_id" RENAME TO "IDX_b0d0350059126fa08fddc3c7a4"`);
        await queryRunner.query(`ALTER INDEX "public"."IDX_purchase_orders_tenant_id" RENAME TO "IDX_237678c98436e0abb48b3060c8"`);
        await queryRunner.query(`ALTER INDEX "public"."IDX_poi_tenant_id" RENAME TO "IDX_0f5b7d10c33fd6432f7b263604"`);
        await queryRunner.query(`ALTER INDEX "public"."IDX_gri_tenant_id" RENAME TO "IDX_5164f330018a8eed6ca3300cab"`);
        await queryRunner.query(`ALTER INDEX "public"."IDX_goods_receipts_tenant_id" RENAME TO "IDX_e8e9593e8a5df1114a25621d24"`);
        await queryRunner.query(`ALTER INDEX "public"."IDX_hr_attendance_tenant_id" RENAME TO "IDX_a3dce587512c680df80cfd8c5b"`);
        await queryRunner.query(`ALTER INDEX "public"."IDX_jel_tenant_id" RENAME TO "IDX_547246161e8893f22adace614b"`);
        await queryRunner.query(`ALTER INDEX "public"."IDX_journal_entries_tenant_id" RENAME TO "IDX_58fffc97d300e8164ccd16fc06"`);
        await queryRunner.query(`ALTER INDEX "public"."IDX_hr_leaves_tenant_id" RENAME TO "IDX_0695f0a3387ae27d0a0a1e2bed"`);
        await queryRunner.query(`ALTER INDEX "public"."IDX_hr_payroll_lines_tenant_id" RENAME TO "IDX_6edd4075024ebc6c453181972a"`);
        await queryRunner.query(`ALTER INDEX "public"."IDX_hr_payrolls_tenant_id" RENAME TO "IDX_73c24cdda789d248e3e4d056ad"`);
        await queryRunner.query(`ALTER INDEX "public"."IDX_production_bom_lines_tenant_id" RENAME TO "IDX_c396b32bc3c84fdc1a42580a6f"`);
        await queryRunner.query(`ALTER INDEX "public"."IDX_production_boms_tenant_id" RENAME TO "IDX_d46dad7936ffeb057785cb958f"`);
        await queryRunner.query(`ALTER INDEX "public"."IDX_production_order_lines_tenant_id" RENAME TO "IDX_e2abe373bfd8a2589ac324fef5"`);
        await queryRunner.query(`ALTER INDEX "public"."IDX_production_orders_tenant_id" RENAME TO "IDX_2d6f6db18df4896fe18cad3903"`);
        await queryRunner.query(`ALTER TYPE "public"."hr_leaves_type_enum" RENAME TO "hr_leaves_leave_type_enum"`);
        await queryRunner.query(`ALTER TABLE "chart_accounts" ADD CONSTRAINT "FK_chart_accounts_parent" FOREIGN KEY ("parent_id") REFERENCES "chart_accounts"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "chart_accounts" DROP CONSTRAINT "FK_chart_accounts_parent"`);
        await queryRunner.query(`ALTER TYPE "public"."hr_leaves_leave_type_enum" RENAME TO "hr_leaves_type_enum"`);
        await queryRunner.query(`ALTER INDEX "public"."IDX_2d6f6db18df4896fe18cad3903" RENAME TO "IDX_production_orders_tenant_id"`);
        await queryRunner.query(`ALTER INDEX "public"."IDX_e2abe373bfd8a2589ac324fef5" RENAME TO "IDX_production_order_lines_tenant_id"`);
        await queryRunner.query(`ALTER INDEX "public"."IDX_d46dad7936ffeb057785cb958f" RENAME TO "IDX_production_boms_tenant_id"`);
        await queryRunner.query(`ALTER INDEX "public"."IDX_c396b32bc3c84fdc1a42580a6f" RENAME TO "IDX_production_bom_lines_tenant_id"`);
        await queryRunner.query(`ALTER INDEX "public"."IDX_73c24cdda789d248e3e4d056ad" RENAME TO "IDX_hr_payrolls_tenant_id"`);
        await queryRunner.query(`ALTER INDEX "public"."IDX_6edd4075024ebc6c453181972a" RENAME TO "IDX_hr_payroll_lines_tenant_id"`);
        await queryRunner.query(`ALTER INDEX "public"."IDX_0695f0a3387ae27d0a0a1e2bed" RENAME TO "IDX_hr_leaves_tenant_id"`);
        await queryRunner.query(`ALTER INDEX "public"."IDX_58fffc97d300e8164ccd16fc06" RENAME TO "IDX_journal_entries_tenant_id"`);
        await queryRunner.query(`ALTER INDEX "public"."IDX_547246161e8893f22adace614b" RENAME TO "IDX_jel_tenant_id"`);
        await queryRunner.query(`ALTER INDEX "public"."IDX_a3dce587512c680df80cfd8c5b" RENAME TO "IDX_hr_attendance_tenant_id"`);
        await queryRunner.query(`ALTER INDEX "public"."IDX_e8e9593e8a5df1114a25621d24" RENAME TO "IDX_goods_receipts_tenant_id"`);
        await queryRunner.query(`ALTER INDEX "public"."IDX_5164f330018a8eed6ca3300cab" RENAME TO "IDX_gri_tenant_id"`);
        await queryRunner.query(`ALTER INDEX "public"."IDX_0f5b7d10c33fd6432f7b263604" RENAME TO "IDX_poi_tenant_id"`);
        await queryRunner.query(`ALTER INDEX "public"."IDX_237678c98436e0abb48b3060c8" RENAME TO "IDX_purchase_orders_tenant_id"`);
        await queryRunner.query(`ALTER INDEX "public"."IDX_b0d0350059126fa08fddc3c7a4" RENAME TO "IDX_suppliers_tenant_id"`);
        await queryRunner.query(`ALTER INDEX "public"."IDX_ecc1827ca6fdea01681ca701df" RENAME TO "IDX_hr_employees_tenant_id"`);
        await queryRunner.query(`ALTER INDEX "public"."IDX_4df9c2ae4585e90ea2f0b52c95" RENAME TO "IDX_hr_departments_tenant_id"`);
        await queryRunner.query(`ALTER INDEX "public"."IDX_c6b7385774b9327f0238b5a293" RENAME TO "IDX_chart_accounts_tenant_id"`);
        await queryRunner.query(`ALTER INDEX "public"."IDX_a4724622ba0625eec688ec9e50" RENAME TO "IDX_accounting_periods_tenant_id"`);
    }

}
