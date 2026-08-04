# Contributing to @opoha/plugin-dhl

Thanks for helping improve `@opoha/plugin-dhl`.

## Boundaries (non-negotiable)

- Register via `@opoha/plugin-sdk` and core public APIs — never edit core tables or core source.
- Core must not statically import this package; load plugins dynamically (`OPOHA_PLUGINS` / `opoha.config.json`).
- Do **not** commit secrets (`.env`, API keys, credentials) — use `.env.example` only.

## Local development

```bash
pnpm install
pnpm typecheck
pnpm test
pnpm build
```

## Ecosystem context

Org-wide notes: [CONTRIBUTING](https://github.com/Opoha/.github/blob/main/CONTRIBUTING.md). Architecture: [opoha-workspace](https://github.com/Opoha/opoha-workspace). Plugin contracts: [opoha-plugin-sdk](https://github.com/Opoha/opoha-plugin-sdk).

## License

MIT — see [LICENSE](./LICENSE).
