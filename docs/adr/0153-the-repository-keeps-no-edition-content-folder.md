# The repository keeps no Edition content folder

Status: accepted (owner, 16.11). Amends ADR 0052 and 0090.

## Context

Since ADR 0090 an Edition's content lives in Postgres, and every automatic path reads it from there: app, site and EAS builds take the backend's content snapshot or `editions/<edition>/seed-snapshot.json`, CI and Maestro import the seed snapshot, and the backend image already left `editions/*/content/` out. The folder `editions/uk/content/` still sat in the repository, behind the live content (1993 Words against 2045 in production), and only two manual commands read it: `pnpm build:pack <edition> --record` and `pnpm content import` without `--snapshot`. A stale copy next to the live one invites an import over newer content.

## Decision

- `editions/<edition>/content/` is removed; an Edition folder holds its config, strings, tokens, assets, legal pages and seed snapshot.
- `pnpm content import` takes `--snapshot <file>` always; with no file it prints its usage and exits 2.
- `pnpm build:pack` has no `--record`: ids, the content version and the crossword days are the content database's, written through the content write API and the content editor (ADR 0090, 0052).
- The Language Pack's reading of a content folder (`readEdition`, `recordContent`, `generateDailyCrossword`, `buildLanguagePack`) and the backend's folder import stay as test seams only: tests write a temporary folder from the seed snapshot (`ukrainianSeedFolder`) or from fixtures, and check the same content rules the snapshot path uses.

## Consequences

- Content reaches the database only through a snapshot import of an empty database or the content write API.
- A change that tightens a content rule fixes the records Postgres holds through the content write API before it reaches `main`; there is no folder to fix and import again.
- No command tops up the crossword days to 400 ahead any more; the content editor adds days after today (ADR 0052).
