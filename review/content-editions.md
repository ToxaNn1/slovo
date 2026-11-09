# Content audit: UA Edition (`editions/uk`), main @ bf792f89, 2026-11-06

Read-only. Measured with node scripts over the JSON (no jq on the machine). No build, no `pnpm content verify`.

## Counts measured

| Kind | Files | Retired | Notes |
|---|---|---|---|
| Words | 758 | 47 (711 live) | rarity 1–5: 122/163/175/174/124; 16 Categories, every one over its target; 3339 Examples (2747 with author); 477 etymology, 30 history, 15 illustrations (all present) |
| Corrections | 113 | 2 | 7 Correction Types; 7 Categories; 16 Literary Uses (all authors dead before 1955) |
| Idioms | 61 | 0 | 23 idiom, 23 proverb, 15 placeName |
| Synonym Rows | 30 | 0 | 5–12 members; 50 `wordId` links |
| Tips | 30 | 0 | all have a gameQuestion |
| Curated Collections | 4 | n/a | all `cc_test1..4` |
| ids.json | 996 | | = files exactly, both ways; no repeats |
| crossword-days.json | 411 days | | 2026-10-27 .. 2027-12-11, 1730 words, 126 distinct Entries (116 Words + 10 Corrections) |

Source URL hosts: goroh.pp.ua 2157, osvita.ua 24, web.archive.org 18, ukrlib 16, myslenedrevo 15, movahistory 15 (http), hrinchenko.com 11, sum.in.ua 3.

Checked and clean: no id used in two files; every file name matches its id; no Entry missing from ids.json and no ids.json id without a file; no empty or whitespace-padded string, no double spaces; no TODO/lorem/placeholder text outside the Curated Collections; every crossword `entryId` exists, none is Retired, every answer matches its Lemma or standard form, every Word clue equals the current primary Definition; `crosswordDaysChecksum` in manifest.json matches the checksum I recomputed with the `canonicalJson` from content-manifest.ts; every `categoryId` and `origin` is in edition.json; `categoriesRequiringHistory` Words all have history; Curated Collections name no missing or Retired Entry.

Not verified: `contentChecksum` (needs the pack build); quote fidelity against goroh (`pnpm content verify`, needs network).

## Critical

### C1. Four test Curated Collections ship in the production Edition
- Files: `editions/uk/content/curated-collections/cc_test1.json` .. `cc_test4.json` (line 3 `name`, line 4 `description`); ids at `editions/uk/content/ids.json` (from index 832).
- What is wrong: `name` is «ТЕСТ 1: Старовина» .. «ТЕСТ 4: Почуття», `description` is «Тестова добірка для перевірки блоку «Категорії». Не для релізу.». `publishedOn` is 2026-11-01 .. 2026-11-04, so all four are already unlocked. `edition.json:103` `curatedCollections: true`, `edition.json:26` `contentUpdates: true`. Added by 2e9606fc (owner test-pass fixes, #1585).
- Failure scenario: every reader of the next store build, or of the next content update delivered to installed apps, sees four «ТЕСТ N» tiles on the Dashboard's «Добірки» rail with the text «Не для релізу». «+ Додати» copies them into the reader's own Collections, and the copies sync and remember their source, so they stay after the files are fixed.
- Suggested fix: replace them with real editorial Curated Collections before any release or content update. Removing them is blocked by H2, so fix H2 in the same change. Optionally add a content check that refuses `name`/`description` matching `/ТЕСТ|Тестов|Не для релізу/`.
- Confidence: confirmed (content and switches); that users see them depends on a release or content update going out.

## High

### H1. Legal pages publish a literal `{CONTACT}` token
- Files: `editions/uk/legal/terms.md:46`, `editions/uk/legal/privacy.md:151`.
- What is wrong: both «Контакт» sections end with `надсилайте на {CONTACT}.` Nothing in the repo substitutes `{CONTACT}`: a grep outside `node_modules`/`dist` finds it only in these two files and in worktree copies. `apps/site` renders the Markdown as written (ADR 0049).
- Failure scenario: the privacy policy URL given to App Store Connect shows no way to reach the developer. That is grounds for App Review rejection and breaks GDPR's contact requirement. terms.md:32 also sends readers to this section to report mistakes.
- Suggested fix: put in the real address once the mail domain is chosen (memory: email architecture, domain pending). Until then, add a site build check that fails on `{[A-Z]+}` in `editions/*/legal/*.md`, so the token can't go out by accident.
- Confidence: confirmed.

### H2. A Curated Collection can't be withdrawn under the id registry rules
- Files: `packages/contracts/src/curated-collection.ts` (`CuratedCollectionSchema` has no `retired`), `packages/language-pack/src/id-registry.ts:30-48` (`missingEntryErrors`), `packages/language-pack/src/edition-folder.ts:88` (`cc:` mapped to `content/curated-collections`), `read-edition.ts:118-126`.
- What is wrong: ids.json registers `cc_` ids, and a registered id whose file is gone fails the build with "ids are never reused, so retire a Word instead of deleting it". Curated Collections have no Retired state, so there is no legal way to remove cc_test1..4. The only options are editing ids.json by hand, which breaks the "never reused" invariant, or keeping the files.
- Failure scenario: whoever fixes C1 deletes the files, the build fails, and they then either hand-edit ids.json or rename the collections in place, keeping `cc_test*` ids forever. Readers' synced copies still point at the old source id.
- Suggested fix: decide in an ADR. Either give CuratedCollection `retired: boolean` (dropped from the rail, kept for copies' source links), matching Retired Word/Idiom in CONTEXT.md, or explicitly allow unregistering never-released ids. Add the glossary term if a Retired Curated Collection is chosen.
- Confidence: confirmed by reading the code; the build itself wasn't run.

## Medium

### M1. 100 Words cite the dictionary under its full long title; the sourcing tool never sets `shortName`
- Files: e.g. `editions/uk/content/words/w_01lv2n.json`, `w_0kj2jj`, `w_0tw0gj`, `w_0uehb9` (100 in total, all from 192820a9 «content wave A»). Tool: `tools/sourcing/src/*.ts` has no `shortName` at all.
- What is wrong: the first source of 75 Words has only `title: "Тлумачний словник української мови. Томи 1-15 (А-П'ЯТЬ)"`, and 25 have only `"Тлумачний словник української мови в 11-ти томах"`. The other 655 use the short names that #1281 introduced («Тлумачний словник (томи 1–15)», «Словник української мови в 11 томах»). The card's «Джерело:» line falls back to `title` (shared.ts SourceSchema doc).
- Failure scenario: one card in seven shows a long, differently worded source line that may wrap or truncate on the card or share card. Every future `source:words` wave adds more of them.
- Suggested fix: map the known СУМ-20/СУМ-11 titles to their shortName in the sourcing tool (one table), backfill the 100 files, and add a content check that a known long title carries its shortName.
- Confidence: confirmed.

### M2. Same Entry in two kinds; Tips that are by definition Corrections
- Files: `editions/uk/content/tips/t_6cfl3m.json` (міроприємство → захід) duplicates `editions/uk/content/corrections/c_tdlwgq.json` (міроприємство → захід). Also one-form swaps filed as Tips: `t_955t4n` (пануючий → панівний), `t_hwwxb7` (вогнетривала → вогнетривка), `t_rgg3rd` (переписка → листування).
- What is wrong: CONTEXT.md:137 says "one form swapped for one standard form is a Correction; a rule, a construction, etiquette or punctuation is a Tip". Four Tips are single-form swaps, and one of them already exists as a Correction.
- Failure scenario: the reader meets «міроприємство» twice in the Feed and Game, as two kinds with different cards and progress. Correction Type tiles and Correction Category screens miss the three Tip-only swaps.
- Suggested fix: retire t_6cfl3m. Move the other three to Corrections (officialese/calque/paronym) or rewrite them as rules, if their source treats them as one.
- Confidence: confirmed for the duplicate; plausible for the other three, since their explanations may cover a wider rule.

### M3. No recorded licence basis for reproducing copyrighted dictionaries; Terms name no source
- Files: `editions/uk/legal/terms.md:32-34`; ADRs 0012, 0080, 0084 (a grep of docs/adr for copyright/licence/public domain finds only ADR 0045, on Literary Uses).
- What is wrong: content quotes word for word from СУМ-20 (2010–, © Інститут української мови НАНУ) via goroh, from Бурячок (synonyms, 15 rows), Гринчишин–Сербенська (paronyms, 15), Пономарів «Культура слова» 1999 (13 Tips), Антоненко-Давидович (d. 1984, protected to 2054; 15 Entries), Єфімова (16 proverbs) and Янко (13 place names). ADR 0045 applies the public-domain rule only to Literary Uses. terms.md names none of the sources and says "добірку слів не можна копіювати". The per-card «Джерело:» line is the only attribution.
- Failure scenario: a rights holder (НАНУ institute, a publisher, or an estate) objects to a free commercial-store app reproducing thousands of definitions and 2747 authored Examples. There's no ADR or permission to point to, and the Terms make an exclusive-looking claim over the same text.
- Suggested fix: owner decision recorded as an ADR (quotation/fair-use basis, or permissions). Add a «Джерела» section to terms.md, or a separate legal page, listing the dictionaries and goroh. Soften the "не можна копіювати" claim so it covers only the app's own work.
- Confidence: plausible (legal judgement, not a code fact).

## Low

- L1. Duplicate Lemma «купина»: `w_4c9ui8` (hummock, stress [1,5]) and `w_ibo31d` (plant, stress [5]), both `nature-weather`. They are real homonyms, but Search and the Game's "guess the word" show two identical headwords with no distinguishing label. Fix: a homonym index or gloss in the card and search row. Confidence: confirmed duplicate; impact plausible.
- L2. 23 Words have a one-word primary Definition, e.g. `w_0wr2ne` вертеп «Печера.», `w_4fcbdj` просинець «Січень.», `w_eoeqkx` файний «Гарний.». They are verbatim per ADR 0012, but weak as crossword clues and Game options. Fix: prefer a fuller sense or an extra Definition when sourcing. Confirmed.
- L3. 38 of 46 non-placeName Idioms have no etymology, e.g. `i_cqexje` «правда очі коле». The schema allows it; the card is thin. Confirmed.
- L4. 81 sources have no URL (idioms 25, corrections 15, synonym rows 15, tips 26). They can only be checked `--book` (ADR 0084). 15 movahistory.org.ua URLs use `http://`. Fix: archive.org or https copies where they exist. Confirmed.
- L5. `synonym-rows/r_vqj8q7.json:18` links `wordId: w_yt2x1z` («кепкувати»), a Retired Word. The build drops the link (check-synonym-rows.ts:10), so this is clean-up only: drop the `wordId`. Confirmed.
- L6. The crossword pool is small: only 118 live Words have a 3–5 letter Lemma, plus 15 Corrections. Over 411 days each word returns every 20+ days, and the top ones (агора, лати, абак) appear 19 times. The fix is content: more short rare Words. Confirmed.
- L7. `c_dl6nld` clue in crossword-days.json:15856 area reads «…на стилістично кращий варіант: (для того,) …; для.»: the masked explanation is awkward. The explanation is verbatim from goroh, so a fix means picking another Correction for the day's grid. Already-published days are frozen (ADR 0052). Confirmed.
- L8. Two Words have no Examples: `w_8h6rgf` равелін, `w_sg60ew` сизигія. Confirmed.
- L9. `synonym-rows/.gitkeep` and `tips/.gitkeep` are left in non-empty folders. Harmless. Confirmed.
