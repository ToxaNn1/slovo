# Content reaches main through automatic gates, without the owner's review

Until now a human checked every draft Word before it moved into `editions/uk/content/words/`. On 2026-11-06 the owner waived that review for agent-sourced content: a content wave of new Entries may reach `main` once automatic gates pass, without the owner reading the drafts.

- The rule of ADR 0012 stays: every Definition, Example and explanation is quoted word for word from the cited dictionary, never written by a model, and an article a source attributes to a language model is never used.
- `pnpm source:words` drafts Words; only drafts it marks ready are taken, never incomplete ones. Other kinds of Entry are quoted from their dictionary pages by agents.
- The gates are `pnpm content check` (the Language Pack build's own rules and the content targets) and CI. A wave adds no Entry whose text is already in the Edition and none without a source.
- One coordinator records the content (`pnpm build:pack <edition> --record`) once per wave, so parallel agents never write `ids.json` or `manifest.json`.

## Considered options

- **The owner reviews every draft**: rejected by the owner. It makes the owner the bottleneck of every wave.
