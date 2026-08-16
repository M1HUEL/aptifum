import { MigrationInterface, QueryRunner } from 'typeorm';

export class OutboxEvents1786400000000 implements MigrationInterface {
  name = 'OutboxEvents1786400000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TYPE "public"."outbox_events_status_enum" AS ENUM('pending', 'dispatched', 'failed')`,
    );
    await queryRunner.query(
      `CREATE TABLE "outbox_events" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "tenant_id" uuid NOT NULL, "event_type" character varying(120) NOT NULL, "aggregate_type" character varying(80) NOT NULL, "aggregate_id" uuid NOT NULL, "payload" jsonb NOT NULL DEFAULT '{}', "user_id" uuid, "occurred_at" TIMESTAMP WITH TIME ZONE NOT NULL, "status" "public"."outbox_events_status_enum" NOT NULL DEFAULT 'pending', "attempts" integer NOT NULL DEFAULT '0', "processed_at" TIMESTAMP WITH TIME ZONE, "last_error" text, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_outbox_events" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(`CREATE INDEX "IDX_oe_tenant_id" ON "outbox_events" ("tenant_id") `);
    await queryRunner.query(`CREATE INDEX "IDX_oe_event_type" ON "outbox_events" ("event_type") `);
    await queryRunner.query(`CREATE INDEX "IDX_oe_status" ON "outbox_events" ("status") `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "public"."IDX_oe_status"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_oe_event_type"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_oe_tenant_id"`);
    await queryRunner.query(`DROP TABLE "outbox_events"`);
    await queryRunner.query(`DROP TYPE "public"."outbox_events_status_enum"`);
  }
}
