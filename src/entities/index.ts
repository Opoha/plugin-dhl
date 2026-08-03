import { DhlSettingsEntity } from './dhl-settings.entity.js';

/** TypeORM entities owned by this plugin (ADR-0005). */
export const dhlEntities = [DhlSettingsEntity] as const;

export { DhlSettingsEntity };
