import { MigrationInterface, QueryRunner } from 'typeorm';

export class FiscalConfig1785900000000 implements MigrationInterface {
  name = 'FiscalConfig1785900000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "tenants" ADD "country" character varying(2) NOT NULL DEFAULT 'US'`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "tenants" DROP COLUMN "country"`);
  }
}
