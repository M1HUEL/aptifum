import { MigrationInterface, QueryRunner } from "typeorm";

export class UsSalesTax1787300000000 implements MigrationInterface {
    name = 'UsSalesTax1787300000000'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "customers" ADD "state" character varying(2)`);
        await queryRunner.query(`ALTER TABLE "customers" ADD "tax_exempt" boolean NOT NULL DEFAULT false`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "customers" DROP COLUMN "tax_exempt"`);
        await queryRunner.query(`ALTER TABLE "customers" DROP COLUMN "state"`);
    }

}
