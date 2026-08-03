import {
  Column,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

/** OWNER: @opoha/plugin-dhl — settings row for DHL config (ADR-0005). */
@Entity({ name: 'dhl_settings' })
export class DhlSettingsEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  /** Account number placeholder — API secret/key stays env-only, never persisted. */
  @Column({ name: 'account_number', type: 'text', default: '' })
  accountNumber!: string;

  @Column({ name: 'origin_country_code', type: 'varchar', length: 2, default: 'DE' })
  originCountryCode!: string;

  @Column({ name: 'test_mode', type: 'boolean', default: true })
  testMode!: boolean;

  @Column({ type: 'boolean', default: true })
  enabled!: boolean;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}
