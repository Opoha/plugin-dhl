# DHL Shipping Plugin

Official `@opoha/plugin-dhl` — registers a DHL Express carrier shipping method with the Opoha shipping engine (Phase 2 B-04).

## What it registers

- Shipping method `dhl` — `quoteRates` returns rates shaped from a DHL Express rate-response stub (`products[].totalPrice[]` / `deliveryCapabilities`), so a live DHL SDK/API can replace the stub later without changing engine contracts
- GraphQL query/mutation contribution `dhlShippingConfig` / `updateDhlShippingConfig`
- Admin settings + nav under `/plugins/dhl`
- Permissions `plugin:dhl:read` / `plugin:dhl:configure`

## Scope

Account credentials (API key/secret) are env-only and never persisted or logged. This scaffold uses DHL-shaped stub responses only — no live DHL SDK/API call is made (Phase 2 B-04 exit: carrier plugin registers quotes).

## Load

```bash
pnpm install && pnpm build
export OPOHA_PLUGINS="$(pwd)"
```

Core discovers via `OPOHA_PLUGINS` / `OPOHA_PLUGINS_PATH` and dynamically imports `dist/index.js` — core never statically imports this package.

## Env

| Var                        | Purpose                                                      |
| -------------------------- | ------------------------------------------------------------ |
| `OPOHA_DHL_ACCOUNT_NUMBER` | DHL account number (non-secret identifier)                   |
| `OPOHA_DHL_ORIGIN_COUNTRY` | 2-letter ISO origin country code for rate stubs              |
| `OPOHA_DHL_TEST_MODE`      | `true`/`false` — stub always runs test-mode shaped responses |
| `OPOHA_DHL_ENABLED`        | `true`/`false` — disable to stop returning rates             |
