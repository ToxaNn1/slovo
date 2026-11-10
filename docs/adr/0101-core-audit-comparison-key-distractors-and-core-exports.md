# The Core audit: one Comparison Key, Distractors by part of speech, the Core's main entry

The Core audit of spec #1778 put each rule of the Core in one place. Three of its changes amend earlier decisions; the ADRs they amend keep their text and point here.

**One Comparison Key (amends ADR 0052 and 0054).** The Core has one text comparison module, built once in the composition from the Edition and handed to every module that compares text. It gives the Comparison Key of a text for a purpose: a typed answer, a Search query, or a Definition or option among Distractors. Every Comparison Key folds case with the Edition's sort locale, takes out Stress marks, writes each character the Edition lists in its Language Traits as `apostrophes` as the first of them (ʼ ' ’ in the UA Edition) and drops spaces at the ends. A Search query's also reads the Edition's `searchLetters` alike, and a Definition's reads each run of spaces as one. The Game Modes that lay out letters or tiles ask the same module which characters are apostrophes and how a letter folds, so no mode hard-codes an apostrophe or folds case without the Edition's locale. Search imports nothing from the Game. The Game still keeps г and ґ, е and ё distinct.

**Distractors by part of speech (amends ADR 0024).** The Edition's Distractor rule leaves the Language Traits: it had one value, `same-part-of-speech`. «Вгадай слово» picks a Word's Distractors from the Words of the answer's part of speech first, then from the other eligible Words.

**The Core's main entry (amends ADR 0027).** `index.ts` exports only what the non-test code of another workspace package or app imports, so the shell cannot go around the composition (ADR 0018); an Extension Point (ADR 0006) is exported once an Edition's part uses it. `scripts/core-exports.mjs`, run by `pnpm deps` in CI beside the dependency-cruiser rules, fails on a name of `index.ts` that no non-test module outside the Core imports, since the cruiser reads modules, not the names they import. `testing.ts` (`@slovo/core/testing`) also exports the Core's functions, models and constants that only the tests of the app, the UI package and the Language Pack use.

## Considered Options

- **A comparison built in each module that needs it**: rejected. Six modules built their own from the Edition, so a module could compare by traits the others did not see.
- **Keep `distractorRule` for a future language**: rejected. A trait with one value is a branch no Edition takes; a new rule comes with the Edition that needs it.
- **Count the tests of other packages for `index.ts`**: rejected. Tests reach the Core's internals through `@slovo/core/testing`, and the main entry then let the shell go around the composition.
