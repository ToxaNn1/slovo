# Repo map for agents

The short map. `README.md` is for people; grep it for one section when you need it.

| Path                     | Role                                                             |
| ------------------------ | ---------------------------------------------------------------- |
| `apps/mobile`            | The Expo app; the environment variable selects the Edition.      |
| `apps/widget`            | The SwiftUI home-screen widget.                                  |
| `apps/backend`           | The API: HTTP shell, adapters, composition root.                 |
| `apps/site`              | The Astro site on Pages: the landing and the legal pages.        |
| `packages/core`          | Pure TypeScript domain logic, no React or React Native.          |
| `packages/ui`            | Screens, components, design tokens, the Mascot.                  |
| `packages/contracts`     | Zod schemas: Entries, Edition config, Language Pack.             |
| `packages/server-core`   | Backend rules and ports, no HTTP, SQL or language.               |
| `packages/language-pack` | Builds and reads the SQLite Language Pack.                       |
| `editions/<edition>`     | Config, strings, tokens, Decor, content, assets, legal pages.    |
| `tools/sourcing`         | Drafts Entries for review (`pnpm source:*`).                     |
| `tools/content`          | Drafts, imports, verifies and checks Entries (`pnpm content`).   |
| `scripts/content-wave`   | The content wave launcher and two page helpers.                  |
| `docs/adr/`              | Decisions; `docs/adr/README.md` has one line per ADR.            |
| `docs/agents/`           | This map, the ticket brief, spec and content waves, test states. |

Truth: `CONTEXT.md` (glossary) and `docs/adr/` override everything. Read both with `grep -n`, never whole.

Commands (repo root): `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm deps`, `pnpm format`. While working, run one package: `pnpm turbo run lint typecheck test --filter=<pkg> --output-logs=errors-only`. CI runs everything.

Content commands (repo root, each with `--edition <id>`): `pnpm source:words`, `pnpm source:idioms`, `pnpm source:corrections`, `pnpm source:synonyms` draft Entries from goroh into `tools/sourcing/review/<kind>/`; `pnpm content have` lists what the Edition has, `pnpm content counts` shows Words and Corrections against the content targets, `pnpm content import` turns drafts into Entries with fresh ids, `pnpm content verify` checks every quote against its source page (CI runs it on pull requests), `pnpm content check` runs the Language Pack build's rules. A content wave runs by [content-wave.md](content-wave.md) with `scripts/content-wave/launch.sh`.

Token budget: `.claude/hooks/token-budget.mjs` caps the context, blocks forks of a long context and whole-file dumps, here and in the cloud. At the hard limit, hand off; never `/compact`.
