# Content sourcing review: tools/sourcing (main @ bf792f89)

Read-only review. Scope: `tools/sourcing/src/*.ts`, `package.json`, `README.md`, fixtures by grep; ADR 0012, 0045, 0080, 0084; glossary terms in `CONTEXT.md`.
Counts: critical 0, high 3, medium 6, low 7.

## High

### H1. 403/5xx from goroh is silently read as "goroh has no page"; synonyms/etymology just disappear
- `src/polite-client.ts:137`: `if (!BACK_OFF_STATUSES.has(response.status) && response.status !== 200) return response;` returns 403, 500, 502, 504 straight away: no retry, no back-off, no `unreachable` mark.
- `src/goroh.ts:32`: `fetchGoroh` turns every status except 200 into `undefined`, which callers read as "no entry".
- Failure scenario: goroh answers 502 for a minute during a wave.
  - «Тлумачення» returns 502. The Word falls back to СУМ or gets a `no-entry` flag instead of `fetch-failed` (`source-words.ts:136-157`). An agent that drops `no-entry` lines loses the Lemma.
  - «Синонімія» or «Етимологія» returns 502 (`source-words.ts:180-186`). The draft is ready with no Synonyms and no etymology, and no flag is raised at all.
  - Idioms, Corrections and Synonym Rows report `no-entry` (`idioms.ts:81-86`, `corrections.ts:101-106`, `synonyms.ts:89-91`).
- No test covers 403/5xx. Every fake 404s or 429s.
- Fix:
  - Have `fetchGoroh` return a discriminated result `{found} | {missing} | {failed, status}`, with only 404 meaning missing.
  - Treat 5xx as a back-off status in `PoliteClient`. Callers map `failed` to a `fetch-failed` flag. `tools/content/src/verify.ts:188` already does this right.
- Confidence: confirmed (code path).

### H2. A bot check or error page returned with 200 is cached forever and parsed as "nothing here"
- `fetchGoroh` (`goroh.ts:29`) and `SumDictionary.fromSite` (`sum.ts:72`) call `client.get` without `accept`. Only the Wayback snapshot has one (`sum.ts:95`).
- `polite-client.ts:131-135` caches any 200 for good. `readCache` (`:161`) never re-checks it.
- Failure scenario: goroh, or a parked or Cloudflare sum.in.ua, serves a 200 challenge or maintenance page.
  - The parsers find no `div.article-block` or `[itemprop="articleBody"]` and return `[]`.
  - The Lemma becomes `no-entry`, or a Word without Synonyms or etymology. This persists across every run and worktree that shares `~/.cache/slovo-sourcing`, and `content verify` reads the same cache.
  - On sum.in.ua in `auto` mode, a 200 page with no article counts as "found nothing" rather than "unreachable", so the Wayback fallback is never tried (`sum.ts:41-46`).
- Markup drift fails the same silent way. If goroh renames `h2 .uppercase` or `.source-info`, `parseDefinitions` skips every block (`goroh.ts:88`) with no "page had N blocks, 0 parsed" signal.
- Fix:
  - Give every goroh and sum.in.ua get an `accept` that requires the page's structural marker (`div.article-block`, or the known not-found markup in `fixtures/goroh/not-found.html`; `articleBody` for sum.in.ua).
  - Treat "200 with blocks, 0 parsed" as a `fetch-failed`/`check` flag, not as no-entry.
- Confidence: plausible (no live bot page observed; the code path is confirmed).

### H3. No recorded licence basis for verbatim copying of СУМ-20, ЕСУМ, Караванський and modern-author Examples
- The ADR index has no ADR on licences or permission for the sourced dictionaries. ADR 0012 only says to quote word for word and cite. Outside fonts, the only public-domain rule is for Literary Uses (ADR 0045).
- `SourceSchema` (`packages/contracts/src/shared.ts:28`) has `title`, `url` and `archivedUrl`, but no licence or rights field.
- `README.md` does not mention licence, terms or robots.
- What the tool copies verbatim into a shipped app:
  - Definitions from СУМ-20: copyrighted, published by УМІФ (goroh links `sum20ua.com`).
  - ЕСУМ etymologies (`source-words.ts:573`).
  - Synonym articles from Караванський and «Цифрові лексикографічні системи».
  - Phraseology from Єфімова 2011 (`fixtures/goroh/phraseology-lyty.html`).
- Examples quote 20th-century authors whose works are still protected, e.g. М. Томчаній and О. Ющенко in `idioms.test.ts:145-160`, and В. Кучер as cited in `article.ts:5`. Unlike Literary Uses, Examples have no death-year/public-domain check.
- Attribution is lossy:
  - `authorOf` (`source-words.ts:775`) keeps only a name-like first segment. The work, volume, year and page are dropped.
  - Newspaper or book citations (`із журналу`, `Літ. газ.`) leave the Example with no attribution at all (`source-words.ts:518-521`, `idioms.ts:122-125`).
- Failure scenario: a rights holder (УМІФ, the ЕСУМ publisher, an author's heirs) objects after release, and nothing records why the copying was believed allowed.
- Fix (an owner decision, record it as an ADR):
  - Write down the legal basis per source (permission, quotation exception, or public domain).
  - Add a licence/rights field per Source, or per dictionary in the Edition config.
  - Keep the full citation on Examples.
  - Decide whether Examples by protected authors get the ADR 0045 rule.
- Confidence: plausible. This is a policy gap, not legal advice.

## Medium

### M1. Homonyms after the first can never be "ready"; Edition homonyms block new ones
- `pipeline.ts:149-165` checks repeats on `summary.text`, which for Words is the bare Lemma (`source-words.ts:296`).
- With коса's 4–5 homonyms, the first ready draft claims `matchKey('коса')`. Every later one is flagged `existing-entry` ("already drafted in this run") and goes to `incomplete/`.
- `existing(draftText)` likewise refuses any new homonym when the Edition already has one Word коса.
- This contradicts the glossary ("Homonyms are separate Words") and the build. `checkNewWords` refuses only the same Lemma **and** the same primary Definition (`source-words.test.ts:395`).
- The tests mask it: `source-words.test.ts:400-450` and `:734-770` merge `ready` and `incomplete` and never assert how many are ready.
- The report also labels them "missing required data" (`report.ts:46`), which is wrong.
- Fix: for Words, key the repeat and existing check on Lemma plus primary Definition, as the build does. Assert the ready count in the homonym tests.
- Confidence: confirmed.

### M2. Idiom Type is taken from the list line for every phraseologism on the page
- `idioms.ts:129`: every draft of a «Фразеологія» page gets the line's `idiomType`.
- The fixture pages cite «Словник прислів'їв та приказок» and mix proverbs with idioms. With `лити` (default `idiom`), «Ранні пташки росу п'ють, а пізні слізки ллють» is drafted ready as `idiom` (`idioms.test.ts:185-190`).
- The glossary says a proverb is Idiom Type `proverb`. Since ADR 0080 removed owner reading, mis-typed chips ship.
- Fix: derive the type per block (goroh's `block-remark`, e.g. прислів'я/приказка versus фразеологізм) or from the dictionary. Flag a disagreement with the line.
- Confidence: confirmed (behaviour). How easy the per-block marker is to read is plausible.

### M3. A run wipes the previous drafts first and writes the report last
- `pipeline.ts:140-143` deletes `drafts/` and `incomplete/` before any fetch. `review-report.md` is only rewritten at the end (`:185-186`).
- Failure scenario: a crash or Ctrl-C mid-run (an unexpected throw in a parser, a disk error, or a long run interrupted) leaves:
  - the previous run's drafts gone;
  - half the new drafts written;
  - the **old** report, which names ids that no longer exist.
- Re-running gives new random ids for the same Lemmas, so ids a coordinator already noted (ADR 0080) go stale.
- Two runs sharing one `--out` (the default `tools/sourcing/review/`) delete each other's drafts.
- Fix: write into a temporary sibling folder and rename it over the kind folder at the end. Delete the stale report first, or write it into the same temporary folder.
- Confidence: confirmed.

### M4. Exit code 0 when every Lemma failed to fetch
- `cli-common.ts:67-92`: `printSummary` returns 0 for any `ok` result, even when every line is `fetch-failed` or the hosts were skipped as unreachable.
- Scripts and agents in content waves (`scripts/content-wave/launch.sh`) cannot tell a dead run from a good one without parsing the report.
- Fix: return a non-zero code (e.g. 3) when any line has `fetch-failed`, or when `unreachable` names goroh.pp.ua.
- Confidence: confirmed.

### M5. Quoted text is edited beyond what ADR 0012 allows ("the only edit is dropping the markers")
- `source-words.ts:792-794` `asSentence` appends `.` to every Example, goroh's too, though the comment says it is for sum.in.ua only.
- `source-words.ts:573` turns a trailing `;` of the ЕСУМ text into `.`.
- `synonyms.ts:184-187` truncates a member's shade note to `SHADE_NOTE_MAX_LENGTH` mid-gloss, so the quoted text is cut.
- `synonyms.ts:195-198` capitalises the meaning line and adds a full stop.
- `sum.ts:268` `firstSentence` cuts the Definition when Examples run into it.
- `text.ts:15` rewrites Latin look-alike letters. This one is defensible, but it is still an edit.
- `content verify` (ADR 0084) checks only one field per kind, normalised. Shade notes, Examples and etymology are never verified, so these edits go through unseen.
- Fix:
  - Either record these normalisations in ADR 0012 or 0084, or stop making them.
  - For shade notes, refuse or flag an over-long note rather than cutting it.
- Confidence: confirmed (edits). Whether they breach the ADR is the owner's call.

### M6. `compact()` uses an `as T` cast that hides a missing required field
- `source-words.ts:629-635`: `Object.fromEntries(...) as T` drops `[]` and `undefined` for any key, required keys included.
- The resulting `WordDraft` claims fields that are not there. Today the schema check at `:612` catches it, but the type no longer tells the truth, which is the class of cast CLAUDE.md forbids.
- Fix: build the draft with explicit conditional spreads (as `idioms.ts:126-134` does), or type the result as `Partial<WordInput>`.
- Confidence: confirmed (cast). Impact is low today.

## Low

### L1. A 404 is cached forever
- `polite-client.ts:64`: a Lemma goroh adds later, or a transient 404, is never fetched again.
- Fix: give a cached 404 a TTL or a `--refresh` flag.
- Confidence: confirmed.

### L2. A cached CDX listing makes `auto` mode skip sum.in.ua for good
- `sum.ts:39`: `auto` skips the direct site whenever the CDX listing for the slug is cached, even when the listing was empty or a 404. Once sum.in.ua is back, it is never asked again for those slugs.
- Confidence: confirmed.

### L3. `sumSlugs` grows as 2^n
- `sum.ts:165-172`: each ґ and each apostrophe doubles the slug count. Every slug is a separate request at a 2 s pace before the Lemma gives up.
- Confidence: confirmed (minor).

### L4. `idMaker` can loop forever
- `pipeline.ts:238`: `for(;;)` never ends if the injected `random` keeps producing taken ids (a constant random in a test, or a near-full space).
- Fix: cap the attempts and throw.
- Confidence: confirmed (edge case).

### L5. `parseDefinitions` compares headwords case-insensitively
- `goroh.ts:88` uses `matchKey`, which lowercases. The other parsers use `isSameWord`, which keeps letter case "so proper names stay apart" (`goroh.ts:424-426`).
- A capitalised proper-name article for the same spelling is drafted as one more homonym.
- Confidence: plausible.

### L6. Casts in tests
- `source-words.test.ts:763` uses `as {sources:...}[]`, and `idioms.test.ts:94` and `source-words.test.ts:211`, `:336` use `as Record<…>`. Parsing with the schema would be the better choice.
- `idioms.test.ts:197` (`incomplete.length > 0`) and `:269` are weak, though each is paired with a content assertion.
- Confidence: confirmed.

### L7. No robots.txt check, and the User-Agent has no contact
- `node-ports.ts:14` sends a User-Agent with no contact address, and the tool never reads robots.txt or the sites' terms.
- Confidence: confirmed.

## Glossary
- The code follows the glossary in general: Entry, Word, Idiom, Correction, Synonym Row, Definition, Example, Lemma and Stress are all used correctly.
- `article.ts:17` and the `DictionaryArticle` and `GorohInflection` fields say "headword", which `CONTEXT.md` lists under _Avoid_ for Lemma. Here it means the dictionary's printed headword, not the Lemma, so the use is defensible, but it is worth a glossary note.
- `Source` and `Quote` are not glossary terms. Literary Use says "Avoid: Quote".
