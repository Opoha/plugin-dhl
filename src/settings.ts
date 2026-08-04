import type { Repository } from 'typeorm';
import { z } from 'zod';

import { DhlSettingsEntity } from './entities/dhl-settings.entity.js';

/** Zod schema for DHL admin settings (API secrets stay in env — never persisted). */
export const dhlShippingConfigSchema = z.object({
  accountNumber: z.string().default(''),
  originCountryCode: z
    .string()
    .length(2)
    .regex(/^[A-Za-z]{2}$/)
    .transform((v) => v.toUpperCase())
    .default('DE'),
  testMode: z.boolean().default(true),
  enabled: z.boolean().default(true),
});

export type DhlShippingConfig = z.infer<typeof dhlShippingConfigSchema>;

/** Default config when no row / env / mutation has configured the method. */
export const DEFAULT_DHL_SHIPPING_CONFIG: DhlShippingConfig = dhlShippingConfigSchema.parse({});

let runtimeConfig: DhlShippingConfig = { ...DEFAULT_DHL_SHIPPING_CONFIG };

let settingsRepo: Repository<DhlSettingsEntity> | null = null;

function parseBoolEnv(raw: string, varName: string): boolean {
  const normalized = raw.trim().toLowerCase();
  if (['1', 'true', 'yes', 'on'].includes(normalized)) return true;
  if (['0', 'false', 'no', 'off'].includes(normalized)) return false;
  throw new Error(`${varName} must be a boolean-like value (got ${raw})`);
}

/**
 * Optional env bootstrap (OPOHA_DHL_*). Applied at boot when present.
 * Account API key/secret never read into persisted config — env-only at call time later.
 */
export function dhlConfigFromEnv(env: NodeJS.ProcessEnv = process.env): Partial<DhlShippingConfig> {
  const partial: Partial<DhlShippingConfig> = {};
  const account = env.OPOHA_DHL_ACCOUNT_NUMBER?.trim();
  if (account) {
    partial.accountNumber = account;
  }
  const origin = env.OPOHA_DHL_ORIGIN_COUNTRY?.trim().toUpperCase();
  if (origin) {
    if (!/^[A-Z]{2}$/.test(origin)) {
      throw new Error(`OPOHA_DHL_ORIGIN_COUNTRY must be a 2-letter ISO code (got ${origin})`);
    }
    partial.originCountryCode = origin;
  }
  const testModeRaw = env.OPOHA_DHL_TEST_MODE;
  if (testModeRaw !== undefined && testModeRaw !== '') {
    partial.testMode = parseBoolEnv(testModeRaw, 'OPOHA_DHL_TEST_MODE');
  }
  const enabledRaw = env.OPOHA_DHL_ENABLED;
  if (enabledRaw !== undefined && enabledRaw !== '') {
    partial.enabled = parseBoolEnv(enabledRaw, 'OPOHA_DHL_ENABLED');
  }
  return partial;
}

/** Current in-memory config (sync). Prefer `loadDhlShippingConfig` when TypeORM may be bound. */
export function getDhlShippingConfig(): DhlShippingConfig {
  return { ...runtimeConfig };
}

/** Merge + validate into the runtime config (does not persist). */
export function setDhlShippingConfig(input: Partial<DhlShippingConfig>): DhlShippingConfig {
  runtimeConfig = dhlShippingConfigSchema.parse({
    ...runtimeConfig,
    ...input,
  });
  return getDhlShippingConfig();
}

/**
 * Bind plugin-owned TypeORM repository so load/persist use `dhl_settings`
 * (ADR-0005 / ADR-0010). Host may call after DataSource is ready.
 */
export function bindDhlSettingsRepository(repo: Repository<DhlSettingsEntity>): void {
  settingsRepo = repo;
}

/** Load from TypeORM when bound; otherwise return runtime config. */
export async function loadDhlShippingConfig(): Promise<DhlShippingConfig> {
  if (!settingsRepo) {
    return getDhlShippingConfig();
  }
  const rows = await settingsRepo.find({
    order: { updatedAt: 'DESC' },
    take: 1,
  });
  const row = rows[0];
  if (!row) {
    return getDhlShippingConfig();
  }
  runtimeConfig = dhlShippingConfigSchema.parse({
    accountNumber: row.accountNumber,
    originCountryCode: row.originCountryCode,
    testMode: row.testMode,
    enabled: row.enabled,
  });
  return getDhlShippingConfig();
}

/** Persist runtime config to TypeORM when bound; always updates memory. */
export async function persistDhlShippingConfig(
  input?: Partial<DhlShippingConfig>,
): Promise<DhlShippingConfig> {
  if (input) {
    setDhlShippingConfig(input);
  }
  if (settingsRepo) {
    const rows = await settingsRepo.find({ take: 1 });
    let row = rows[0];
    if (!row) {
      row = settingsRepo.create({
        accountNumber: runtimeConfig.accountNumber,
        originCountryCode: runtimeConfig.originCountryCode,
        testMode: runtimeConfig.testMode,
        enabled: runtimeConfig.enabled,
      });
    } else {
      row.accountNumber = runtimeConfig.accountNumber;
      row.originCountryCode = runtimeConfig.originCountryCode;
      row.testMode = runtimeConfig.testMode;
      row.enabled = runtimeConfig.enabled;
    }
    await settingsRepo.save(row);
  }
  return getDhlShippingConfig();
}

/** Test helper — reset module state between Vitest cases. */
export function resetDhlShippingConfigForTests(): void {
  runtimeConfig = { ...DEFAULT_DHL_SHIPPING_CONFIG };
  settingsRepo = null;
}
