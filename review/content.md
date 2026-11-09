# Global review of SLOVO main (bf792f89): content area

Scope: packages/language-pack, packages/contracts (Entry schemas), tools/content, tools/sourcing, editions/uk. Read-only, no builds, no tests run.
Companion reports with the full detail of two sub-areas: `content-sourcing.md` (tools/sourcing: 0 critical, 3 high, 6 medium, 7 low) and `content-editions.md` (editions/uk: 1 critical, 2 high, 3 medium, 9 low). Their top items are ranked here with the rest.
Confidence: confirmed = read in the code or the data; plausible = consequence inferred, not reproduced.

Totals across the three reports: 1 critical, 7 high, 9 medium, 19 low.

## Critical

### C1. Test Curated Collections ship in the production Edition
- `editions/uk/content/curated-collections/cc_test1.json` … `cc_test4.json`: titles «ТЕСТ N», description «Не для релізу», publish dates 01–04.11 already passed; `curatedCollections` and `contentUpdates` are on in `editions/uk/edition.json`. Added by commit 2e9606fc (#1585).
- Failure: the next Language Pack built from main shows four «ТЕСТ» collections on the «Добірки» rail.
- Fix: see H5; until then set their publish dates far in the future or switch the feature off in `edition.json`.
- Confidence: confirmed.

## High

### H1. The quote gate can be skipped by leaving out, or reordering, a source url
- `tools/content/src/verify.ts:67-69, 80-82, 99`; `packages/contracts/src/shared.ts:28-33`; no url rule in `packages/language-pack/src/check-content.ts`.
- `verify` reads `sources[0].url` only. An Entry whose first source has no `url` is `unverified`, and `unverified` fails only with `--book`. `Source.url` is optional and no check asks a goroh/СУМ-titled source for a page. CI (`.github/workflows/ci.yml:142`) runs `verify --changed` without `--book`.
- Failure: a content-wave agent writes a Word whose Definition is its own prose and cites `{ "title": "СУМ-20" }` with no url, or puts a url-less source first. Schema, `content check`, the pack build and `content verify` all pass. ADR 0084 promised that CI checks every added Entry's quote; it checks nothing here.
- Fix: in CI fail on `unverified` unless `--book` is given (a `--strict` flag), or a check-content rule: a source whose title names goroh/СУМ (or a `Source.kind`) must carry a `url`. Verify every source with a url, not only the first.
- Confidence: confirmed (code path); bypass scenario plausible.

### H2. Curated Collections cannot be removed under the current rules
- `editions/uk/content/ids.json` lists `cc_test1..4` (ADR 0010: ids never dropped); `packages/language-pack/src/record.ts:60-64` refuses a registry id without a file; `packages/contracts/src/curated-collection.ts` has no Retired state.
- Failure: deleting the four files fails the build; keeping them ships C1.
- Fix: an ADR giving Curated Collections a Retired state as Words, Corrections and Idioms have; then retire `cc_test1..4`. Owner decision.
- Confidence: confirmed.

### H3. Legal pages carry a literal `{CONTACT}` placeholder
- `editions/uk/legal/terms.md:46`, `editions/uk/legal/privacy.md:151`; nothing in the repo substitutes it (grep for `{CONTACT}` finds only these two).
- Failure: the published privacy policy names no contact, an App Review rejection risk.
- Fix: fill the contact, or substitute it at build time from `edition.json`.
- Confidence: confirmed.

### H4. goroh 403/5xx answers are taken as "no such page" (content-sourcing.md H1)
- `tools/sourcing/src/polite-client.ts:137`, `tools/sourcing/src/goroh.ts:32`.
- Statuses other than 200/429/503 return as a normal response; goroh.ts reads them as "no entry": a Word gets the `no-entry` flag, synonyms and etymology silently vanish. No test covers 403 or 500. `verify.ts:188` handles the same answers correctly.
- Fix: treat any status other than 200/404 as `fetch-failed` with a retry; fixture tests for 403 and 500.
- Confidence: confirmed.

### H5. A 200 bot-check or error page is cached for ever as "nothing here" (content-sourcing.md H2)
- `tools/sourcing/src/polite-client.ts:64, 131-134`; goroh and sum.in.ua callers pass no `accept`.
- `accept` defaults to `() => true`, so a 200 page without the article markup is cached; every later run, including `content verify` in CI (which restores the `sourcing-` cache, `ci.yml:120-127`), sees "no block holds the quote". The Wayback fallback for sum.in.ua is never reached.
- Fix: each caller passes an `accept` that requires the article markup; never cache a 200 that fails it.
- Confidence: plausible.

### H6. No recorded basis for quoting СУМ-20, ЕСУМ, Караванський, Пономарів, Антоненко-Давидович and modern Examples (content-sourcing.md H3, content-editions.md)
- `packages/contracts/src/shared.ts:28-33` (Source has title and url only); ADR 0012 and 0084 say where text comes from, not under what terms; the public-domain check covers Literary Uses only (ADR 0045, `build.ts:55`); `editions/uk/legal/terms.md` has no clause.
- Entries copy dictionary text verbatim; Examples by living authors keep the author's name only, one cited from a journal keeps none.
- Fix: owner decision recorded as an ADR: what may be quoted, how much, which attribution the Entry card and `legal/` show. A rule gap, not a legal opinion.
- Confidence: plausible.

### H7. Sourcing marks homonyms after the first as never ready (content-sourcing.md M1, raised: glossary conflict)
- `tools/sourcing/src/source-words.ts` (see companion report for lines): the repeat check keys on Lemma alone, so the second homonym is a "duplicate" for ever. CONTEXT.md: homonyms are separate Words. Tests do not count ready drafts and miss it.
- Fix: key on Lemma + primary Definition as `check-content.ts:101` does.
- Confidence: confirmed.

## Medium

### M1. check-content has no duplicate rule for Corrections, Synonym Rows or Tips
- `packages/language-pack/src/check-content.ts:188-266` (Corrections: no map of nonStandardForm), `check-synonym-rows.ts:13-55` (per-row only), `check-tips.ts`.
- Words dedupe by Lemma+Definition and Idioms by expression; the other kinds not at all. `pnpm content import` refuses a repeated text (`import.ts:104-112`), but `pnpm content new`, a hand edit, or two wave branches that each import the same Correction and merge, pass `content check`, the build and CI. Already real: Tip `t_6cfl3m` (міроприємство → захід) duplicates Correction `c_tdlwgq` (content-editions.md).
- Fix: the Idiom rule for every kind: a live Correction's nonStandardForm, a Synonym Row's dominant, a Tip's title (lower case) name one Entry each, across kinds where the glossary says they overlap.
- Confidence: confirmed (rule absent, one duplicate in the data).

### M2. Two tools disagree on what a duplicate Word is
- `check-content.ts:98-110` (same Lemma and same trimmed primary Definition) vs `tools/content/src/import.ts:104-112` (same Lemma text, any Definition).
- Two threads drafting one Word with reworded Definitions both pass `check`; only `import` on one machine would catch it, and merges bypass that.
- Fix: in check-content report a second live Word with the same Lemma as a warning (error unless marked a homonym); import and check share one key.
- Confidence: confirmed (difference); failure plausible.

### M3. A cached 404 makes "re-run the step" useless in CI
- `tools/sourcing/src/polite-client.ts:64` caches 404; `verify.ts:188-190` reports any non-200 as `fetch-failed`; `ci.yml:120-127` restores the cache for the verify step.
- A goroh page that answered 404 once stays `fetch-failed HTTP 404` in CI until the cache key rolls. ADR 0084 says "a re-run is the answer"; the cache defeats it.
- Fix: do not cache 404 for verify, or refetch non-200 entries ignoring the cache.
- Confidence: plausible.

### M4. The quote check compares 40 normalised characters only
- `tools/content/src/verify.ts:249-251`. ADR 0084 sanctions the prefix, so an accepted risk, not a violation. A Definition whose first 40 characters are goroh's and whose tail is an agent's prose passes as "quoted" (ADR 0012).
- Fix: check the whole squashed field; amend ADR 0084.
- Confidence: confirmed (code), risk plausible.

### M5. `TextSchema` accepts whitespace-only and padded texts
- `packages/contracts/src/shared.ts:4` (`z.string().min(1)`); the Lemma is guarded (space is not a lemma token, `check-content.ts:56, 89`), Definitions, Examples, explanations and meanings are not.
- A field left as `" "` passes schema and check; the card shows an empty line. `draftEntry` relies on "an untouched draft never passes" (`content.ts:378`); a single space breaks it.
- Fix: `z.string().trim().min(1)` and a check for leading or trailing whitespace.
- Confidence: confirmed (schema); failure plausible.

### M6. Sourced Words carry no `shortName`, so the card prints the dictionary's full title
- `tools/sourcing` never sets `Source.shortName`; 100 wave-A Words in `editions/uk/content/words/` show the long title in the «Джерело:» line (content-editions.md). Every wave adds more.
- Fix: the sourcing tool maps each known source to its short name (СУМ-20, СУМ-11, ЕСУМ).
- Confidence: confirmed.

### M7. Sourcing: Idiom Type copied from the list line, proverbs land as `idiom`; a run deletes old drafts first and writes its report last (content-sourcing.md M2, M3)
- An interrupted run leaves a report naming drafts that are gone. See companion report for lines.
- Confidence: plausible.

### M8. Three Tips are Corrections by the glossary (content-editions.md)
- Besides `t_6cfl3m` (M1), three Tips in `editions/uk/content/tips/` describe a non-standard form with a standard equivalent, which CONTEXT.md defines as a Correction. The gates cannot see the kind mismatch.
- Fix: re-author as Corrections and retire the Tips.
- Confidence: plausible (judgement call on kind).

## Low

### L1. `retire` patches the file with a regex
- `tools/content/src/content.ts:167-171`. `"retired" : false` (space before the colon) is not matched, so a second `"retired": true` key is appended; JSON.parse keeps the last key, so it works by accident.
- Fix: match `"retired"\s*:\s*false`.
- Confidence: confirmed, harmless today.

### L2. Rows are parsed with `.parse` inside the app
- `packages/language-pack/src/pack-reader.ts:346-614`. A schema made stricter without a pack-format rise throws inside the app on an older pack instead of being refused at open (ADR 0032).
- Fix: check the pack format at open; `safeParse` with a typed error the Shell can show.
- Confidence: plausible.

### L3. Tests: nothing vacuous found in tools/content or language-pack
- `verify.test.ts`, `import.test.ts`, `content.test.ts` assert on written files, exit codes and outcomes. `build.test.ts` covers the registry, checksum, Retired Entries and homonyms (lines 207-2472). `ukrainian-idioms.test.ts:62`, `ukrainian-paronyms.test.ts:60` loop over sources but are guarded by count assertions above. Sourcing tests that miss H4 and H7 are listed in `content-sourcing.md`.

### L4–L19. See `content-sourcing.md` (7 low) and `content-editions.md` (9 low).

## Checked and found sound
- Edition content is parsed once at the boundary: `edition-folder.ts:519-549` (`safeParse`, errors by field, unknown keys named); the single `as` at `:366` is a justified generic narrowing; dotfiles skipped (`:497`); file name must equal id (`:507`).
- Pack written to a temp file and renamed (`write-pack.ts:14-300`); build writes nothing on errors (`build.ts:69-71`); pack layout has keys and foreign keys on every Entry table (`pack-layout.ts:19-85`).
- `import` rolls back files and record files on any failure (`import.ts:122-150`); `--no-record` restores ids and manifest; ids come from injected `random` (`content.ts:364-371`).
- ADR 0009: missed targets exit 1 (`language-pack/src/cli.ts:107-112`, `content.ts:196`); the report and targets leave Retired Entries out (`report.ts:65-67`). ADR 0010: registry append-only, refuses a missing registry once recorded (`record.ts:31-64, 102`). ADR 0011: checksum and version checked (`build.ts:115-116`).
- editions/uk data: `ids.json` (996) matches the files; no duplicate ids; no dead crossword references; `crosswordDaysChecksum` recomputed and matches. Counts: Words 758 (711 live), Corrections 113, Idioms 61, Synonym Rows 30, Tips 30, Curated Collections 4, crossword days 411.
- No `!`, `@ts-expect-error` or stray `as` in `tools/content/src` or `language-pack/src` beyond `crossword.ts:307` and `read-pack.ts:23`, both justified.

## Not verified
- `contentChecksum` of the manifest (needs a build) and the quotes themselves (need the network).
