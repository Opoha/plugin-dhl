import { describe, expect, it, vi, beforeEach } from 'vitest';

import { MIGRATIONS_TABLE_NAME, PLUGIN_ID, entities, migrations } from './database.js';
import dhlPlugin, {
  DEFAULT_DHL_SHIPPING_CONFIG,
  buildDhlExpressRatesStub,
  dhlShippingConfigSchema,
  dhlShippingMethod,
  getDhlShippingConfig,
  mapDhlProductsToRateQuotes,
  persistDhlShippingConfig,
  resetDhlShippingConfigForTests,
  setDhlShippingConfig,
} from './index.js';
import { DhlInit1722696200000 } from './migrations/1722696200000-DhlInit.js';
import { createStubPluginContext } from '@opoha/plugin-sdk';

function createQueryRunnerMock() {
  const queries: string[] = [];
  return {
    queries,
    query: vi.fn(async (sql: string) => {
      queries.push(sql);
    }),
  };
}

describe('@opoha/plugin-dhl', () => {
  beforeEach(() => {
    resetDhlShippingConfigForTests();
  });

  it('exports definePlugin definition with dhl id', () => {
    expect(dhlPlugin.id).toBe('dhl');
    expect(typeof dhlPlugin.boot).toBe('function');
  });

  it('parses default config schema', () => {
    const parsed = dhlShippingConfigSchema.parse({});
    expect(parsed.enabled).toBe(true);
    expect(parsed.testMode).toBe(true);
    expect(parsed.originCountryCode).toBe('DE');
    expect(parsed.accountNumber).toBe('');
    expect(DEFAULT_DHL_SHIPPING_CONFIG).toEqual(parsed);
  });

  it('registers shipping method, GraphQL, provider, and admin via boot context', async () => {
    const shipping: Array<{
      code: string;
      displayName: string;
      hasQuote: boolean;
      hasCreateLabel: boolean;
    }> = [];
    const graphql: Array<{ name: string; kind: string }> = [];
    const providers: Array<{ token: string }> = [];
    const admin: unknown[] = [];

    dhlPlugin.boot?.(
      createStubPluginContext('dhl', {
        registerGraphQL(input) {
          graphql.push({ name: input.name, kind: input.kind });
        },
        registerProvider(input) {
          providers.push({ token: input.token });
        },
        registerListener() {},
        registerAdmin(contribution) {
          admin.push(contribution);
        },
        registerPaymentProvider() {},
        registerShippingMethod(method) {
          shipping.push({
            code: method.code,
            displayName: method.displayName,
            hasQuote: typeof method.quoteRates === 'function',
            hasCreateLabel: typeof method.createLabel === 'function',
          });
        },
        registerStorageAdapter() {},
      }),
    );

    expect(shipping).toEqual([
      {
        code: 'dhl',
        displayName: 'DHL Express',
        hasQuote: true,
        hasCreateLabel: true,
      },
    ]);
    expect(graphql).toEqual([
      { name: 'dhlShippingConfig', kind: 'query' },
      { name: 'updateDhlShippingConfig', kind: 'mutation' },
    ]);
    expect(providers).toEqual([{ token: 'dhl.settings' }]);
    expect(admin).toHaveLength(1);
  });

  it('quoteRates returns DHL Express–shaped stub rates (B-04)', async () => {
    const rates = await dhlShippingMethod.quoteRates({
      currencyCode: 'EUR',
      destination: { countryCode: 'US', postalCode: '10001' },
      items: [{ quantity: 1, unitAmountMinor: '5000', weightGrams: 1000 }],
    });
    expect(rates.length).toBe(2);
    expect(rates[0]?.code).toBe('P');
    expect(rates[0]?.displayName).toBe('DHL EXPRESS WORLDWIDE');
    expect(rates[0]?.amount.currencyCode).toBe('EUR');
    expect(Number(rates[0]?.amount.amountMinor)).toBeGreaterThan(0);
    expect(rates[0]?.metadata?.dhlProduct).toMatchObject({
      productCode: 'P',
      productName: 'EXPRESS WORLDWIDE',
    });
    expect(rates[1]?.code).toBe('Y');
    expect(rates[1]?.displayName).toBe('DHL EXPRESS 12:00');
  });

  it('quoteRates returns empty when disabled', async () => {
    setDhlShippingConfig({ enabled: false });
    const rates = await dhlShippingMethod.quoteRates({
      currencyCode: 'USD',
      destination: { countryCode: 'US' },
      items: [{ quantity: 1, unitAmountMinor: '1000' }],
    });
    expect(rates).toEqual([]);
  });

  it('maps DHL products stub into ShippingRateQuote amounts', () => {
    const stub = buildDhlExpressRatesStub('USD', 2000);
    const quotes = mapDhlProductsToRateQuotes(stub);
    expect(quotes).toHaveLength(2);
    for (const q of quotes) {
      expect(q.amount.amountMinor).toMatch(/^\d+$/);
      expect(q.amount.currencyCode).toBe('USD');
    }
  });

  it('createLabel / voidLabel return stub results', async () => {
    const label = await dhlShippingMethod.createLabel!({
      orderId: 'ord-123',
      rateCode: 'P',
      destination: { countryCode: 'US' },
      items: [{ quantity: 1, unitAmountMinor: '1000' }],
      amount: { amountMinor: '2500', currencyCode: 'USD' },
    });
    expect(label.status).toBe('created');
    expect(label.trackingNumber).toMatch(/^JDSTUB/);
    expect(label.externalId).toMatch(/^dhl_shp_stub_/);

    const voided = await dhlShippingMethod.voidLabel!({
      orderId: 'ord-123',
      externalId: label.externalId,
      trackingNumber: label.trackingNumber,
    });
    expect(voided.status).toBe('voided');
  });

  it('persists config via TypeORM repository when bound (B-04)', async () => {
    const saved: Array<Record<string, unknown>> = [];
    const repo = {
      find: vi.fn(async () => (saved.length ? [saved[0]] : [])),
      create: vi.fn((row: Record<string, unknown>) => ({ ...row })),
      save: vi.fn(async (row: Record<string, unknown>) => {
        saved[0] = { ...row, id: 'settings-1', updatedAt: new Date() };
        return saved[0];
      }),
    };

    const { bindDhlSettingsRepository } = await import('./settings.js');
    bindDhlSettingsRepository(repo as never);

    const next = await persistDhlShippingConfig({
      accountNumber: '123456789',
      originCountryCode: 'TH',
      testMode: false,
      enabled: true,
    });
    expect(next.accountNumber).toBe('123456789');
    expect(next.originCountryCode).toBe('TH');
    expect(repo.save).toHaveBeenCalled();
    expect(saved[0]?.accountNumber).toBe('123456789');
    expect(getDhlShippingConfig().originCountryCode).toBe('TH');
  });

  it('exposes plugin-owned entities and namespaced migrations table', () => {
    expect(PLUGIN_ID).toBe('dhl');
    expect(MIGRATIONS_TABLE_NAME).toBe('opoha_migrations_dhl');
    expect(entities).toHaveLength(1);
    expect(migrations).toHaveLength(1);
    expect(migrations[0]).toBe(DhlInit1722696200000);
  });

  it('migration up/down owns only dhl_settings (ADR-0005)', async () => {
    const migration = new DhlInit1722696200000();
    const upRunner = createQueryRunnerMock();
    await migration.up(upRunner as never);
    expect(upRunner.queries.join('\n')).toContain('CREATE TABLE "dhl_settings"');
    expect(upRunner.queries.join('\n')).not.toMatch(
      /ALTER TABLE "(users|roles|files|carts|orders)"/i,
    );

    const downRunner = createQueryRunnerMock();
    await migration.down(downRunner as never);
    expect(downRunner.queries.join('\n')).toContain('DROP TABLE IF EXISTS "dhl_settings"');
  });
});
