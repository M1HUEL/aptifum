import { MigrationInterface, QueryRunner } from 'typeorm';

export class RefreshSessions1786000000000 implements MigrationInterface {
  name = 'RefreshSessions1786000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "refresh_sessions" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "user_id" uuid NOT NULL, "family_id" uuid NOT NULL, "token_hash" character varying(64) NOT NULL, "user_agent" character varying(255), "ip" character varying(45), "revoked_at" TIMESTAMP WITH TIME ZONE, "expires_at" TIMESTAMP WITH TIME ZONE NOT NULL, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "UQ_refresh_sessions_token_hash" UNIQUE ("token_hash"), CONSTRAINT "PK_refresh_sessions" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(`CREATE INDEX "IDX_refresh_sessions_user_id" ON "refresh_sessions" ("user_id") `);
    await queryRunner.query(`CREATE INDEX "IDX_refresh_sessions_family_id" ON "refresh_sessions" ("family_id") `);
    await queryRunner.query(
      `ALTER TABLE "refresh_sessions" ADD CONSTRAINT "FK_refresh_sessions_user" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "refresh_sessions" DROP CONSTRAINT "FK_refresh_sessions_user"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_refresh_sessions_family_id"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_refresh_sessions_user_id"`);
    await queryRunner.query(`DROP TABLE "refresh_sessions"`);
  }
}
