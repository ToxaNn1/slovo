# Property tests

The Core keeps example tests as its main tests. Add a property test with [fast-check](https://fast-check.dev) (a devDependency of `packages/core` and `packages/language-pack` only) when a rule must hold for every input of a pure seam, and a few examples would leave whole classes of input unchecked: dates across daylight-saving changes, the Feed's turn order over any Cycle size, the grid of any Daily Crossword day.

- Name the file `<module>.property.test.ts`, next to the module's example tests, so `pnpm test` runs it.
- Go through the public seams (`@slovo/core`, `../index`), as every Core test does. Inject time and randomness as usual; fast-check draws only the inputs.
- Pass a fixed `seed` (and a `numRuns` that keeps the file under a second) to every `fc.assert`, so CI checks the same inputs on every run.
- State each property as the rule `CONTEXT.md` or an ADR words, small, one rule an `it`. Check that it fails when you break the rule in the code before you keep it.
- When a property finds a real bug, keep it out of the suite, report the bug with fast-check's counterexample and fix the logic in its own change, with an example test for the counterexample.
