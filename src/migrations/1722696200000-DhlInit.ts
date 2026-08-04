import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Initial settings table for DHL plugin (ADR-0005).
 * Table prefix: plugin id `dhl` → `dhl_*`.
 */
export class DhlInit1722696200000 implements MigrationInterface {
  name = 'DhlInit1722696200000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "dhl_settings" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "account_number" text NOT NULL DEFAULT '',
        "origin_country_code" varchar(2) NOT NULL DEFAULT 'DE',
        "test_mode" boolean NOT NULL DEFAULT true,
        "enabled" boolean NOT NULL DEFAULT true,
        "updated_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        CONSTRAINT "dhl_settings_pkey" PRIMARY KEY ("id")
      )
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "dhl_settings"`);
  }
}
