# Contributing

Thanks for helping improve `@truefoundry/assistant-ui-runtime`.

## Setup

```bash
pnpm install
pnpm typecheck
pnpm test
pnpm build
```

Requires Node 24+ (matches CI) and the repo `packageManager` pin (Corepack /
pnpm).

## Package layout

| Path | Notes |
|------|--------|
| `packages/truefoundry-agents-assistant-ui-runtime` | Published runtime (`@truefoundry/assistant-ui-runtime`) |
| `packages/.../src/plugins/truefoundry-agent-server-adapter` | Optional TrueFoundry gateway plugin |
| `examples/*` | Demos only — prefer not to mix product changes with example polish |

Core chat API talks to `AgentChatServer`. TrueFoundry-specific wiring stays in
the plugin (`createTrueFoundry*`). Do not redefine gateway wire types outside
the plugin.

## Checks before opening a PR

From the repo root:

```bash
pnpm typecheck
pnpm test
pnpm build
```

Scoped shortcuts:

```bash
pnpm --filter "@truefoundry/assistant-ui-runtime" test
pnpm --filter "@truefoundry/assistant-ui-runtime" typecheck
```

## Guidelines

- Prefer small, focused diffs. Match existing style; avoid drive-by refactors.
- Do not commit `.env`, API keys, or credentials. Demo env docs belong in
  README / QuickStart without real secrets.
- Breaking public API renames belong in `CHANGELOG.md` under a Breaking
  section (see `0.2.0`).
- Runtime package tests use Vitest. Prefer fixing shared helpers over
  duplicating guards per caller.

## Reporting bugs / requesting features

Use the GitHub issue templates. For security issues, see [SECURITY.md](SECURITY.md).

## Code of conduct

Participation is governed by [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md).
