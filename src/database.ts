import 'reflect-metadata';

/**
 * Plugin-owned TypeORM surface for CLI / host migration aggregation (ADR-0005).
 * Core never imports this package statically — hosts load via dynamic import.
 */

import { DhlSettingsEntity } from './entities/dhl-settings.entity.js';
import { dhlEntities } from './entities/index.js';
import { DhlInit1722696200000 } from './migrations/1722696200000-DhlInit.js';
import { dhlMigrations } from './migrations/index.js';

export const PLUGIN_ID = 'dhl' as const;

/** Namespaced migrations table — never shares core `migrations`. */
export const MIGRATIONS_TABLE_NAME = 'opoha_migrations_dhl' as const;

export const entities = dhlEntities;
export const migrations = dhlMigrations;

export { DhlSettingsEntity, DhlInit1722696200000, dhlEntities, dhlMigrations };
