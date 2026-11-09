# Triage: content, sourcing, editions, docs, fix-wave (Medium/Low) vs main bd94d6b2

Context that changes value: ADR 0090 moves content to Postgres; repo content files become read-only and
`tools/content`'s file readers/writers are deleted later. check-content rules stay (they run on the backend at save).
Tickets on `tools/content` (T-content-1, the import half of T-sourcing-1) fix code with a limited life: the coordinator decides.
H4/H5 (High, polite-client) and content-H7 (= sourcing-M1, raised) are outside this triage; T-sourcing-1 IS H7's fix and
T-sourcing-3 shares `polite-client.ts` with H4/H5: run them in series.

## Classification

| id | class | reason |
|---|---|---|
| content-M1 | FIX (part) / SKIP-OWNER (part) | No duplicate rule for Corrections/Synonym Rows/Tips in check-content; within-kind rules pass on current data (0 dups scanned). The cross-kind rule (Tip vs Correction) fails on t_6cfl3m today: needs retiring a Tip (owner). |
| content-M2 | FIX | import.ts keys a Word on Lemma alone, check-content on Lemma + primary Definition; glossary: homonyms are separate Words. Joined with sourcing-M1. |
| content-M3 | FIX | polite-client still caches 404 (`CACHEABLE_STATUSES` 200, 404); verify reports cached 404 as fetch-failed. |
| content-M4 | SKIP-OWNER | 40-char quote prefix is sanctioned by ADR 0084; changing it amends the ADR. |
| content-M5 | FIX (with care) | `TextSchema = z.string().min(1)` unchanged. RISK: a global `.trim()`/refusal breaks UA `strings.json` `hidden.labelSeparator` ", " and `stats.knownJoiner` " · " (both TextSchema). Edition content scan: 0 padded, 0 blank strings, so an Entry-only schema passes. Backend/server-core parse the same schemas (SKIP-PATH, but they get the stricter rule). |
| content-M6 | FIX (tool) / SKIP-OWNER (backfill) | tools/sourcing sets no `shortName`. Now 1335 Words + 84 Idioms cite СУМ-20/СУМ-11 without one (grew since review). Backfilling them and a check that requires shortName are Entry edits. |
| content-M7 | FIX | = sourcing-M2 + sourcing-M3, both open. |
| content-M8 | SKIP-OWNER | = editions-M2; re-authoring Tips as Corrections is a content wording/kind call. |
| content-L1 | FIX | retire regex `"retired":\s*false` still misses a space before the colon (content.ts:169). Tool bound for removal (ADR 0090). |
| content-L2 | SKIP-OWNER | pack-reader `.parse`; ADR 0032 is superseded by 0090 (patches), the pack/open design is in flux; needs a design call and a Shell error. |
| content-L3 | n/a | Not a finding ("nothing vacuous found"). |
| sourcing-M1 | FIX | pipeline.ts:150-165 keys repeats and existing on `matchKey(text)` = bare Lemma; homonyms after the first go to incomplete/. (= content-H7.) |
| sourcing-M2 | FIX | idioms.ts:129 copies the line's idiomType to every block. Fixtures have no per-block proverb marker; derive from the dictionary title («Словник прислів'їв та приказок» → proverb) and flag a disagreement. |
| sourcing-M3 | FIX | pipeline.ts:140-143 wipes drafts first, report written last (:185). |
| sourcing-M4 | FIX | cli-common.ts printSummary returns 0 for any ok run. |
| sourcing-M5 | SKIP-OWNER | Edits to quoted text vs ADR 0012/0094: owner decides record-or-stop. |
| sourcing-M6 | FIX | source-words.ts:629-634 `compact()` ends in `as T`. |
| sourcing-L1 | FIX | Same root as content-M3 (404 cached forever). |
| sourcing-L2 | FIX | sum.ts:39 `auto` skips the site whenever a CDX listing is cached, even an empty one. |
| sourcing-L3 | FIX | sum.ts:165-172 `sumSlugs` still 2^n. |
| sourcing-L4 | FIX | pipeline.ts:238 `for(;;)` in idMaker, no cap. |
| sourcing-L5 | FIX | goroh.ts:88 parseDefinitions uses `matchKey`, the other parsers `isSameWord`. |
| sourcing-L6 | FIX | Casts in tests still at source-words.test.ts:211, 336, 362, 763; idioms.test.ts:94. |
| sourcing-L7 | SKIP-OWNER | Contact in the User-Agent (an address in a public repo) and robots/terms policy: owner. |
| editions-M1 | FIX (tool) / SKIP-OWNER (backfill) | = content-M6. |
| editions-M2 | SKIP-OWNER | t_6cfl3m duplicate, t_955t4n/t_hwwxb7/t_rgg3rd kind call: Entry edits; all four still live. |
| editions-M3 | FIXED | ADR 0094 + «Джерела» paragraph in terms.md:40 (owner decision 4). |
| editions-L1 | SKIP-VISUAL | купина homonyms need a distinguishing label on card/search row. |
| editions-L2 | SKIP-OWNER | One-word Definitions: content. |
| editions-L3 | SKIP-OWNER | Idioms without etymology: content. |
| editions-L4 | SKIP-OWNER | Sources without URL / http links: Entry edits. |
| editions-L5 | SKIP-OWNER | r_vqj8q7 still links Retired w_yt2x1z: Entry edit (build already drops the link). |
| editions-L6 | SKIP-OWNER | Crossword pool size: content. |
| editions-L7 | SKIP-OWNER | Awkward c_dl6nld clue; days frozen (ADR 0052). |
| editions-L8 | SKIP-OWNER | Two Words without Examples: content. |
| editions-L9 | FIX | `.gitkeep` still in non-empty synonym-rows/ and tips/. |
| docs-M2 | FIXED | README.md:87 has the 0083 line. |
| docs-M3 | FIX | 0066 index line and body carry no "amended by 0074" (0 hits). |
| docs-M4 | FIX | 12 missing back-refs in the index: 0054<-0072, 0067<-0072, 0016<-0076, 0067<-0076, 0075<-0077, 0076<-0079, 0019/0033/0076<-0081, 0066<-0085, 0017<-0091, 0076<-0093 (plus 0066<-0074); 0033/0076 bodies lack 0081. |
| docs-M5 | FIXED | «SLOVO ID» out of _Avoid_ in CONTEXT.md (owner decision 7, PR #1749). |
| docs-L6 | FIX | "Ukrainian Edition" still in ADR 0070:16, build.test.ts:2373, content-port.test.ts:241, SwipeMarks.test.tsx:88, ActiveDaysCalendar.test.tsx:76, tokens.test.ts:59, hidden-screen.test.ts:131. |
| docs-L7 | FIX | `rarityFloor` (content-targets.ts:51, index.ts:12, have.ts:14,86) reuses the removed Rarity Floor name. |
| docs-L8 | SKIP-OWNER | waves.md names the owner's plugin skill; the owner picks the scheme/version. |
| docs-L9 | SKIP-OWNER | ADR 0027 folder names: which way (rename vs amend) is an owner/ADR call. |
| docs-L10 | FIX | 0082 index line still says "Mix toggle" (_Avoid_ "Toggle"). |
| docs-L11 | SKIP-OWNER | Rule vs softening ADR 0012 is the owner's call (the review says so). |
| fw-H1 | FIXED | 0094 marked as amending 0012/0084; "Current content" paragraph; terms.md worded as a rule. |
| fw-M1 | FIXED | All four sites now use `colors.accentText`. |
| fw-M2 | FIXED | edition-files.test.ts:1740-1743 has the accentText pairs. |
| fw-M3 | FIXED | ADR 0070:12 lists `accentText` with its 4.5:1 rule. |
| fw-M4 | FIXED | refreshLinks builds in parallel, renews only changed cards, skips tell (feed.ts:713-727). |
| fw-L1 | FIXED | PR merged; nothing left to do in code. |
| fw-L2 | FIXED | terms.md:40 lists СУМ-11 and names Караванський. |
| fw-L3 | FIXED | ADR 0094:16 says the death-year check needs a schema change first. |
| fw-L4 | FIX | entries.ts:443-458 `linkedCorrections` restates the Correction part of `eligible()`; one predicate. Core logic: Fable. |

Counts: FIXED 11, FIX 26 (content-M1, M6, editions-M1 have an owner half too), SKIP-OWNER 16, SKIP-VISUAL 1, SKIP-PATH 0, n/a 1. Tickets: 11.

## Tickets

T-lp-1: Corrections, Synonym Rows and Tips are named once each
- findings: content-M1 (within-kind part)
- files: packages/language-pack/src/check-content.ts, check-synonym-rows.ts, check-tips.ts, their tests
- fix: as the Idiom rule: a live Correction's nonStandardForm, a Synonym Row's dominant, a Tip's title (locale lower case, trimmed) name one live Entry of their kind; Retired ones are skipped. Cross-kind Tip/Correction rule left out (fails on t_6cfl3m until the owner retires it).
- test: two live Corrections with «Міроприємство»/«міроприємство» → one error naming the first file; one Retired → passes; existing "UA Edition passes" build test stays green.

T-contracts-1: An Entry text is never blank or padded
- findings: content-M5
- files: packages/contracts/src/shared.ts, word.ts, correction.ts, idiom.ts, synonym-row.ts, tip.ts, curated-collection.ts (+ shared.test.ts)
- fix: add `EntryTextSchema` that refuses (refine, no silent transform) blank and leading/trailing whitespace; use it in the Entry schemas only. Edition strings keep `TextSchema` (", " and " · " separators are padded by design).
- test: `" "`, `" захід"`, `"захід "` fail with a message, `"захід"` passes; the UA Edition build test passes (scan: 0 padded content strings). Run backend tests too (server-core parses these schemas).

T-sourcing-1: Homonyms are drafted ready, as the build counts them
- findings: sourcing-M1 (= content-H7), content-M2
- files: tools/sourcing/src/pipeline.ts (repeat/existing keys, `entriesByText`), tools/sourcing/src/report.ts:46, packages/language-pack/src/edition-folder.ts (`EntryText` of a Word carries its primary Definition), tools/content/src/import.ts, source-words.test.ts (homonym tests)
- fix: one Word key, Lemma + trimmed primary Definition, shared by sourcing, import and check-content; other kinds keep the text key; report stops calling a repeat "missing required data".
- test: коса fixture with 4 homonyms → assert 4 ready (not ready+incomplete merged); an Edition Word коса with another Definition does not block a new one; same Lemma + Definition still refused in import.

T-sourcing-2: A run survives an interruption and fails loudly
- findings: sourcing-M3, sourcing-M4, sourcing-L4
- files: tools/sourcing/src/pipeline.ts (run folder, idMaker), tools/sourcing/src/cli-common.ts. Same file as T-sourcing-1: after it.
- fix: write drafts and report into a temporary sibling folder and rename over the kind folder at the end; exit 3 when a line is fetch-failed or goroh.pp.ua is unreachable; idMaker throws after N attempts.
- test: a draft fn that throws mid-run leaves the previous drafts and report intact; printSummary of an all-fetch-failed result returns 3; constant `random` with the id taken → throws, does not hang.

T-sourcing-3: A re-run asks the site again
- findings: content-M3, sourcing-L1, sourcing-L2, sourcing-L3
- files: tools/sourcing/src/polite-client.ts, tools/sourcing/src/sum.ts, tools/content/src/verify.ts. Serial with the H4/H5 fixes (same client).
- fix: cache 200 only (or 404 with a TTL via injected clock); `auto` skips sum.in.ua only on a cached non-empty CDX listing; cap the slug variants (e.g. 8).
- test: a 404 then a 200 for one url → the second call hits the network; verify after a cached 404 refetches; empty cached CDX → site is asked; a Lemma with 4 ґ/apostrophes yields ≤ cap slugs.

T-sourcing-4: Idiom Type and headwords as the dictionary gives them
- findings: sourcing-M2, sourcing-L5, sourcing-L6 (idioms.test.ts part)
- files: tools/sourcing/src/idioms.ts, tools/sourcing/src/goroh.ts, idioms.test.ts
- fix: a block from «Словник прислів'їв та приказок» is `proverb`; a type that disagrees with the line raises a flag; parseDefinitions uses `isSameWord`; test parses drafts with the schema instead of `as Record`.
- test: лити fixture → «Ранні пташки росу п'ють…» drafted `proverb` with a flag; a capitalised proper-name article is not drafted as a homonym.

T-sourcing-5: Typed drafts and short source names
- findings: sourcing-M6, content-M6/editions-M1 (tool part), sourcing-L6 (source-words.test.ts part)
- files: tools/sourcing/src/source-words.ts, a small table in tools/sourcing/src/text.ts (or sources.ts), idioms.ts source line (after T-sourcing-4), source-words.test.ts:211,336,362,763
- fix: replace `compact() as T` with conditional spreads; map the СУМ-20/СУМ-11 titles to the shortNames already in the Edition («Тлумачний словник (томи 1–15)», «Словник української мови в 11 томах»). Backfill of 1335 Words + 84 Idioms and a check that requires the shortName: owner (Entry edits).
- test: a sourced Word/Idiom from the СУМ-20 fixture carries the shortName; typecheck passes with no `as` in the touched code.

T-content-1: retire flips the flag whatever the spacing
- findings: content-L1
- files: tools/content/src/content.ts, content.test.ts
- fix: match `"retired"\s*:\s*false`. Tool deleted later under ADR 0090; skip if the coordinator prefers.
- test: a file with `"retired" : false` → one `retired` key, value true.

T-docs-1: ADR index records every amendment both ways
- findings: docs-M3, docs-M4, docs-L10
- files: docs/adr/README.md, 0066, 0033, 0076 bodies (one-line note each)
- fix: append "amended by NNNN" to the 13 lines listed above; a note at the top of 0066 (0074) and 0033/0076 (0081); "Mix toggle" → "Mix button".
- test: the node scan of README "amends N" → "N's line names the amender" reports 0 missing; `grep -i 'mix toggle' docs/adr/README.md` empty.

T-docs-2: Glossary words in code and docs
- findings: docs-L6, docs-L7
- files: docs/adr/0070-*.md:16, packages/language-pack/src/build.test.ts, content-port.test.ts, packages/ui/src/entries/SwipeMarks.test.tsx, progress/ActiveDaysCalendar.test.tsx, tokens.test.ts, apps/mobile/src/mix/hidden-screen.test.ts; packages/language-pack/src/content-targets.ts, index.ts, tools/content/src/have.ts
- fix: "Ukrainian Edition" → "UA Edition"; `rarityFloor` → `wordsPerRarityFloor`.
- test: `git grep -n 'Ukrainian Edition' -- ':!CONTEXT.md'` and `git grep -n '\brarityFloor\b' -- packages/language-pack tools` empty; typecheck, lint, tests green.

T-edition-1: Drop stray .gitkeep files
- findings: editions-L9
- files: editions/uk/content/synonym-rows/.gitkeep, editions/uk/content/tips/.gitkeep
- fix: git rm both.
- test: `pnpm content check` and the language-pack build test pass.

T-core-1: Linked Corrections and eligibility share one predicate
- findings: fw-L4
- files: packages/core/src/entries/entries.ts (+ entries test)
- fix: derive the Correction part of `eligible()` and `linkedCorrections` from one predicate (shown kind, Category in Mix, not Hidden, live). Fable.
- test: existing feed/entries tests; one new: a Correction made ineligible by any of the four reasons is both out of `eligible()` and not linked.
