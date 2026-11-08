# Content reaches main through automatic gates, without the owner's review

Until now a human checked every draft Word before it moved into `editions/uk/content/words/`. On 2026-11-06 the owner waived that review for agent-sourced content: a content wave of new Entries may reach `main` once automatic gates pass, without the owner reading the drafts.

**Amended by ADR 0090.** Agent-sourced content no longer reaches `main` at all: `pnpm content add|edit|flag` writes it to the Deployment's Postgres through the admin API with an Агент token, the fast rules of `content check` run on the backend at every save, the quote check runs as a background job, and the owner reviews each batch afterwards in the Content queue with a one-click rollback. The quoting rule of ADR 0012 and the drafting commands stay; the pull request, the coordinator, `build:pack --record`, `ids.json` and `manifest.json` go with the repo content files.

- The rule of ADR 0012 stays: every Definition, Example and explanation is quoted word for word from the cited dictionary, never written by a model, and an article a source attributes to a language model is never used.
- `pnpm source:words` drafts Words, and `pnpm source:idioms`, `pnpm source:corrections` and `pnpm source:synonyms` draft Idioms, Corrections and Synonym Rows where goroh has their section (amended by [ADR 0084](0084-quotes-are-verified-in-ci-and-every-goroh-kind-is-sourced.md)); only drafts a command marks ready are taken, never incomplete ones. Entries no command sources (Tips, Word Histories, Literary Uses, place-name Idioms) are quoted from their cited sources by agents.
- The gates are `pnpm content check` (the Language Pack build's own rules and the content targets), `pnpm content verify` (every quote on its source page, ADR 0084) and CI. A wave adds no Entry whose text is already in the Edition and none without a source.
- One coordinator records the content (`pnpm build:pack <edition> --record`) once per wave, so parallel agents never write `ids.json` or `manifest.json`.

## Considered options

- **The owner reviews every draft**: rejected by the owner. It makes the owner the bottleneck of every wave.
