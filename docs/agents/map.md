# Repo map for agents

The short map. `README.md` is for people; grep it for one section when you need it.

| Path                     | Role                                                          |
| ------------------------ | ------------------------------------------------------------- |
| `apps/mobile`            | The Expo app; the environment variable selects the Edition.   |
| `apps/widget`            | The SwiftUI home-screen widget.                               |
| `apps/backend`           | The API: HTTP shell, adapters, composition root.              |
| `packages/core`          | Pure TypeScript domain logic, no React or React Native.       |
| `packages/ui`            | Screens, components, design tokens, Decor slots.              |
| `packages/contracts`     | Zod schemas: Entries, Edition config, Language Pack.          |
| `packages/server-core`   | Backend rules and ports, no HTTP, SQL or language.            |
| `packages/language-pack` | Builds and reads the SQLite Language Pack.                    |
| `editions/<edition>`     | Config, strings, tokens, Decor, content, assets, legal pages. |
| `tools/sourcing`         | Drafts Words for review (`pnpm source:words`).                |
| `tools/content`          | Drafts and checks Entries (`pnpm content`).                   |
| `docs/adr/`              | Decisions; `docs/adr/README.md` has one line per ADR.         |
| `docs/agents/`           | This map and the standing ticket brief.                       |

Truth: `CONTEXT.md` (glossary) and `docs/adr/` override everything. Read both with `grep -n`, never whole.

Commands (repo root): `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm deps`, `pnpm format`. While working, run one package: `pnpm turbo run lint typecheck test --filter=<pkg> --output-logs=errors-only`. CI runs everything.

Token budget: `.claude/hooks/token-budget.mjs` caps the context, blocks forks of a long context and whole-file dumps, here and in the cloud. At the hard limit, hand off; never `/compact`.
