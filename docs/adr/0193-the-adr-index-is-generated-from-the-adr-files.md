---
summary: Every ADR carries its one-line decision in a frontmatter `summary:`; `pnpm adr:index` prints the index from the files and `docs/adr/retired.md`, `pnpm adr:index --next` the next free number; `docs/adr/README.md` is never committed; `pnpm lint` checks every number.
---

# The ADR index is generated from the ADR files

Owner request of 2026-11-18.

**Why.** Every new ADR added a line to the end of `docs/adr/README.md`, so two pull requests that each record a decision always conflicted there, and PRs queued for `main` stalled on that one file. The protection of `main` no longer requires a branch to be up to date, so the shared file was the cause.

**Decision.**

- Every `docs/adr/NNNN-<slug>.md` opens with a frontmatter whose `summary:` line is the decision in force, in one line. A change that amends or supersedes an ADR updates that line in the ADR's own file.
- A number with no file (unused, merged into another ADR, superseded and removed) has a line `- NNNN: <fate>.` in `docs/adr/retired.md`. That file changes only when a number is retired, never when an ADR is added.
- `pnpm adr:index` (`scripts/adr-index.mjs`) prints the index, one line per number in order; `pnpm adr:index --next` prints the next free number. `docs/adr/README.md` is gitignored: nothing in the repo commits or reads it.
- `pnpm lint` (and `pnpm verify`) runs `node scripts/adr-index.mjs --check`: it fails when an ADR has no `summary:`, two entries share a number, or a number up to the highest has neither a file nor a `retired.md` line.

**Considered.** A committed `README.md` regenerated after every rebase and checked by CI: it keeps the index on GitHub's folder page but still conflicts on every pair of new ADRs, only now with a mechanical fix. Generating it removes the conflict at its root; an agent greps the `summary:` lines or the command's output instead.
