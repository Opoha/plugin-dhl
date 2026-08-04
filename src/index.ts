import { definePlugin } from '@opoha/plugin-sdk';
import type {
  ShippingLabelInput,
  ShippingLabelResult,
  ShippingMethodProvider,
  ShippingQuoteInput,
  ShippingRateQuote,
  ShippingVoidLabelInput,
  ShippingVoidLabelResult,
} from '@opoha/plugin-sdk';

import {
  DEFAULT_DHL_SHIPPING_CONFIG,
  dhlConfigFromEnv,
  dhlShippingConfigSchema,
  getDhlShippingConfig,
  loadDhlShippingConfig,
  persistDhlShippingConfig,
  setDhlShippingConfig,
  type DhlShippingConfig,
} from './settings.js';

export {
  DEFAULT_DHL_SHIPPING_CONFIG,
  bindDhlSettingsRepository,
  dhlConfigFromEnv,
  dhlShippingConfigSchema,
  getDhlShippingConfig,
  loadDhlShippingConfig,
  persistDhlShippingConfig,
  resetDhlShippingConfigForTests,
  setDhlShippingConfig,
  type DhlShippingConfig,
} from './settings.js';

/**
 * DHL Express MyDHL API–shaped rate product stub (no DHL SDK).
 * Live API can replace stub body without changing ShippingRateQuote mapping.
 */
export type DhlExpressProductStub = {
  productName: string;
  productCode: string;
  localProductCode?: string;
  totalPrice: Array<{
    currencyType: 'BILLC' | 'PULCL' | 'BASEC';
    priceCurrency: string;
    price: number;
  }>;
  deliveryCapabilities?: {
    totalTransitDays?: number;
    deliveryTypeCode?: string;
  };
};

/** DHL Express rates response stub envelope. */
export type DhlExpressRatesResponseStub = {
  products: DhlExpressProductStub[];
};

/** Stub EXPRESS products returned when enabled (amounts in major units in DHL shape). */
export function buildDhlExpressRatesStub(
  currencyCode: string,
  weightGrams: number,
): DhlExpressRatesResponseStub {
  const weightKg = Math.max(0.5, weightGrams / 1000);
  const expressWorldwide = Math.round((18.5 + weightKg * 4.25) * 100) / 100;
  const express1200 = Math.round((24.0 + weightKg * 5.1) * 100) / 100;
  const currency = currencyCode.toUpperCase();
  return {
    products: [
      {
        productName: 'EXPRESS WORLDWIDE',
        productCode: 'P',
        localProductCode: 'P',
        totalPrice: [
          {
            currencyType: 'BILLC',
            priceCurrency: currency,
            price: expressWorldwide,
          },
        ],
        deliveryCapabilities: {
          totalTransitDays: 3,
          deliveryTypeCode: 'QDDC',
        },
      },
      {
        productName: 'EXPRESS 12:00',
        productCode: 'Y',
        localProductCode: 'Y',
        totalPrice: [
          {
            currencyType: 'BILLC',
            priceCurrency: currency,
            price: express1200,
          },
        ],
        deliveryCapabilities: {
          totalTransitDays: 2,
          deliveryTypeCode: 'QDDC',
        },
      },
    ],
  };
}

function majorToMinorString(major: number): string {
  return String(Math.round(major * 100));
}

/** Map DHL Express products → ShippingEngine rate quotes. */
export function mapDhlProductsToRateQuotes(
  response: DhlExpressRatesResponseStub,
): ShippingRateQuote[] {
  const quotes: ShippingRateQuote[] = [];
  for (const product of response.products) {
    const bill =
      product.totalPrice.find((p) => p.currencyType === 'BILLC') ?? product.totalPrice[0];
    if (!bill) continue;
    const transit = product.deliveryCapabilities?.totalTransitDays;
    quotes.push({
      code: product.productCode,
      displayName: `DHL ${product.productName}`,
      amount: {
        amountMinor: majorToMinorString(bill.price),
        currencyCode: bill.priceCurrency.toUpperCase(),
      },
      minTransitDays: transit,
      maxTransitDays: transit,
      metadata: {
        dhlProduct: product,
        localProductCode: product.localProductCode,
      },
    });
  }
  return quotes;
}

function totalWeightGrams(input: ShippingQuoteInput): number {
  return input.items.reduce((sum, item) => {
    const unit = item.weightGrams ?? 500;
    return sum + unit * Math.max(1, item.quantity);
  }, 0);
}

/**
 * DHL shipping method — quoteRates stubs shaped like MyDHL rates.
 * createLabel / voidLabel are stub hooks for later carrier label work.
 */
export const dhlShippingMethod: ShippingMethodProvider = {
  code: 'dhl',
  displayName: 'DHL Express',
  configSchema: dhlShippingConfigSchema,

  async quoteRates(input: ShippingQuoteInput): Promise<ShippingRateQuote[]> {
    const config = await loadDhlShippingConfig();
    if (!config.enabled) {
      return [];
    }
    const stub = buildDhlExpressRatesStub(input.currencyCode, totalWeightGrams(input));
    return mapDhlProductsToRateQuotes(stub);
  },

  async createLabel(input: ShippingLabelInput): Promise<ShippingLabelResult> {
    const tracking = `JDSTUB${input.orderId.replace(/-/g, '').slice(0, 12).toUpperCase()}`;
    return {
      status: 'created',
      trackingNumber: tracking,
      externalId: `dhl_shp_stub_${input.orderId.replace(/-/g, '').slice(0, 16)}`,
      labelUrl: `https://example.invalid/dhl/labels/${tracking}.pdf`,
      raw: {
        shipmentTrackingNumber: tracking,
        packages: [{ trackingNumber: tracking }],
      },
    };
  },

  async voidLabel(input: ShippingVoidLabelInput): Promise<ShippingVoidLabelResult> {
    return {
      status: 'voided',
      raw: {
        shipmentTrackingNumber: input.trackingNumber,
        dispatchConfirmationNumber: input.externalId,
      },
    };
  },
};

/**
 * Official DHL carrier plugin.
 * Registers shipping method rate-quote stubs + admin settings + GraphQL config.
 * Live DHL SDK / secrets are intentionally out of scope for this scaffold.
 */
export default definePlugin({
  id: 'dhl',
  boot(ctx) {
    const fromEnv = dhlConfigFromEnv();
    if (Object.keys(fromEnv).length > 0) {
      setDhlShippingConfig(fromEnv);
    }

    ctx.registerShippingMethod(dhlShippingMethod);

    ctx.registerProvider({
      token: 'dhl.settings',
      provider: {
        getConfig: getDhlShippingConfig,
        setConfig: setDhlShippingConfig,
        load: loadDhlShippingConfig,
        persist: persistDhlShippingConfig,
      },
    });

    ctx.registerGraphQL({
      name: 'dhlShippingConfig',
      kind: 'query',
      descriptor: {
        resolve: (): DhlShippingConfig => getDhlShippingConfig(),
      },
    });
    ctx.registerGraphQL({
      name: 'updateDhlShippingConfig',
      kind: 'mutation',
      descriptor: {
        resolve: async (
          _parent: unknown,
          args: { input?: Partial<DhlShippingConfig> },
        ): Promise<DhlShippingConfig> => persistDhlShippingConfig(args.input ?? {}),
      },
    });

    ctx.registerAdmin({
      navigation: [
        {
          id: 'dhl-nav',
          label: 'DHL',
          path: '/plugins/dhl',
          permission: 'plugin:dhl:read',
        },
      ],
      settings: [
        {
          id: 'dhl-settings',
          title: 'DHL',
          path: '/plugins/dhl/settings',
          permission: 'plugin:dhl:configure',
        },
      ],
      permissions: ['plugin:dhl:read', 'plugin:dhl:configure'],
    });
  },
});
