# Quotes are verified in CI, and every kind goroh carries is sourced by a command

ADR 0080 let a content wave reach `main` without the owner reading the drafts, through `pnpm content check` and CI. Neither checked that a Definition really is the dictionary's words: in the 06.11 wave the coordinator ran a throw-away quote check by hand, and agents quoted Idioms, Corrections and Synonym Rows from goroh pages by hand with the wave's scripts as their only help (spec #1622). This amends ADR 0080.

**Amended by ADR 0094.** A quoted text is at most one sentence of a dictionary article; the check stays word for word over what is quoted.

**Amended by ADR 0090.** `pnpm content verify` runs as a background job on the Deployment over the records added or changed since its last run, keeps its sourcing cache in a Postgres table and flags a failing record in the Content queue; the CI step stays only until the repo content files go.

- `pnpm content verify` checks, for every Entry it is given, one quoted field per kind (a Word's or an Idiom's primary Definition, a Correction's explanation, a Synonym Row's meaning line, a Tip's explanation): its first 40 characters, normalised, must be on the page the Entry's first source names, and on goroh in a block not attributed to «Велика мовна модель». Pages come through the sourcing tool's polite client and shared cache. `miss`, `llm` and `fetch-failed` fail; an Entry whose first source has no page is `unverified`, and `--book` checks it against the book.
- CI runs `pnpm content verify --changed <base>` on every pull request over the UA Edition's Entries it adds or changes, after the Language Pack build; a pull request that changes no Entry skips the step. A `fetch-failed` fails the step; a re-run is the answer. Pull requests are the gate: `verify` does not run on `main` or on a schedule.
- Idioms, Corrections and Synonym Rows are drafted by `pnpm source:idioms`, `pnpm source:corrections` and `pnpm source:synonyms` from goroh «Фразеологія», «Слововживання» and «Синонімія», the way `pnpm source:words` drafts Words: quoted word for word, cited, checked against the Edition, ready drafts apart from incomplete ones. Agents quote by hand only what no command sources: Tips, Word Histories, Literary Uses and place-name Idioms.
- A content wave runs by `docs/agents/content-wave.md` and its launcher, `scripts/content-wave/launch.sh`.

## Considered options

- **The coordinator verifies quotes by hand, as in the 06.11 wave**: rejected. A gate that depends on someone remembering to run it is habit, not a gate, and ADR 0080 removed the owner's reading.
- **Verify on `main` after merge or on a schedule**: rejected. A bad quote would already be on `main`; the pull request is where it can still be refused.
- **Keep quoting Idioms, Corrections and Synonym Rows by hand**: rejected. Every agent rewrote the same page parsing, and nothing checked the drafts against the Edition before the build did.
