# Content sourcing tool

Dev-only tooling, never shipped in an app. It turns a list of Lemmas into draft Words for the UA Edition, taken from real dictionaries:

- **[goroh.pp.ua](https://goroh.pp.ua)**, the main source:
  - «Тлумачення»: Definitions, Examples with their authors, register labels, part of speech, gender and Stress, from the explanatory dictionary the page cites (СУМ-20 up to П'ЯТЬ, СУМ-11 after it; see ADR 0012). The draft records that citation exactly as goroh prints it, with the goroh address. Definitions and Examples are copied word for word; only the markers СУМ puts in front of an Example (`* У порівн.`, `* Образно.`) are dropped, and the Latin look-alikes the dictionaries put into Cyrillic words (the `i` in `вiд`) are written in Cyrillic. Labels count whether goroh names them in full or prints them as bare abbreviations (`заст.`, `діал.`). A label on a meaning marks the Word only when every meaning carries it: СУМ may label just the first meaning `заст.`. Articles from other dictionaries or written by a language model are never drafted from.
  - «Словозміна»: Stress, part of speech and gender when the article lacks them (asked only then).
  - «Синонімія»: Synonyms, from Karavansky's and the mphdict synonym dictionaries only.
  - «Етимологія»: etymology from ЕСУМ.
- **СУМ-11** on [sum.in.ua](https://sum.in.ua), or the newest copy in the [Wayback Machine](https://web.archive.org): a fallback for Lemmas goroh has no explanatory article for. Both addresses go into the sources (`url` and `archivedUrl`). Each host gets one quick try per run; once it refuses or times out, it is skipped for the rest of the run.

The dictionaries are Ukrainian, so the tool refuses an Edition in any other language. Every field comes from one of these sources. What they leave open stays empty and is flagged. A human or an agent takes the ready drafts and moves them into `editions/uk/content/words/`; since ADR 0080 a content wave reaches `main` through `pnpm content check` and CI without the owner reading the drafts.

## Run it

Write a Lemma list, one Lemma per line, with the Category and rarity you chose for it. `#` starts a comment.

```text
# lemma     category id      rarity
мжичка      nature-weather   2
коса        household-crafts 1
```

```sh
pnpm source:words path/to/lemmas.txt --edition uk
```

| Option                             | Default                 | Meaning                                                                     |
| ---------------------------------- | ----------------------- | --------------------------------------------------------------------------- |
| `--edition <id>`                   | required                | The Edition whose Categories, Stress rules and id registry apply.           |
| `--out <dir>`                      | `tools/sourcing/review` | The review folder (git-ignored).                                            |
| `--cache <dir>`                    | see below               | Fetched pages and the shared request schedule.                              |
| `--sum auto\|direct\|wayback\|off` | `auto`                  | The sum.in.ua fallback: the site then the archive, one of them, or neither. |

### Running several at once

Every run on the machine shares one cache: `--cache`, else `$SLOVO_SOURCING_CACHE`, else `$XDG_CACHE_HOME/slovo-sourcing`, else `~/.cache/slovo-sourcing`. Through it, parallel runs (one per worktree, say) are polite together:

- a page is fetched once, by whichever run asks first, and read from disk by every other run, now and later;
- each host gets at most one request every 2 seconds across all runs, booked in a schedule file under `hosts/` behind a lock;
- on HTTP 429 or 503, or a failed connection, goroh gets a rest of 5, 10, 20 and then 40 seconds, which every run honours, before the Lemma is reported as `fetch-failed`. Each back-off is printed, and the totals are in the report.

## What comes out

Each kind of Entry writes into its own folder of the review folder; Words go to `review/words/`.

- `review/words/drafts/<id>.json`: drafts that pass the Word schema and the Language Pack build's own checks (Stress, alphabet, Category, Correction links, duplicate Lemma) against the Edition's existing content. Each has a new opaque `w_` id that the Edition doesn't use yet.
- `review/words/incomplete/<id>.json`: drafts that lack required data (for example, no source marks the Stress), and drafts whose Lemma is already a Word of the Edition, Retired or not. The report says what is missing.
- `review/words/review-report.md`: everything a human must decide, per Lemma and per draft. It ends with the «Ready drafts» list, one line per ready draft: id, Lemma, Category, Example count and the first 55 characters of the primary Definition.

| Flag                | Meaning                                                                                                                          |
| ------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| `no-entry`          | СУМ-11 has no article for the Lemma (the addresses tried are listed). No draft is written.                                       |
| `fetch-failed`      | goroh kept refusing or rate-limiting after the last back-off; run again later.                                                   |
| `homonym`           | СУМ has several articles; each became its own draft. Synonyms and etymology are left to assign.                                  |
| `needs-assignment`  | Synonym groups or ЕСУМ articles the tool can't tie to one draft.                                                                 |
| `several-stresses`  | The Lemma has more than one valid Stress; all are kept.                                                                          |
| `stress-unresolved` | No source marks the Stress, or goroh lists different ones.                                                                       |
| `sources-disagree`  | СУМ and goroh differ on Stress, part of speech or gender.                                                                        |
| `missing-data`      | No source names the part of speech or the gender.                                                                                |
| `plural-only`       | A noun with no singular; its gender is `plural-only`.                                                                            |
| `unmarked-examples` | СУМ prints the Examples without italics; they are left out and the Definition is cut.                                            |
| `other-labels`      | СУМ labels with no register to map to, and labels of the other meanings, listed so nothing is lost silently.                     |
| `spelling-differs`  | СУМ-11 spells the headword differently (it predates the letter ґ).                                                               |
| `existing-entry`    | The Lemma is already a Word of the Edition (its ids are listed, Retired ones marked); the draft goes to `incomplete/`.           |
| `check`             | Something worth a glance, e.g. an etymology taken from the ЕСУМ article of a related word (the source title names that article). |

## Filters of `source:words`

`source:words` keeps out of `drafts/` what passes the build but a human would refuse. Each such draft goes to `incomplete/` with an issue and one of these flags:

| Flag              | Meaning                                                                                                                                                                                 |
| ----------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `cross-reference` | The primary Definition only points at another article («Зменш. до вікно», «Див.…», «Те саме, що…»), with or without a register label in front, so it explains nothing on an Entry card. |
| `region-missing`  | A dialect Word (the dialectal register label) with no Region. The tool does not source a Region: add one from a cited source, or drop the Word.                                         |

The reference markers live in one list, `REFERENCE_MARKERS` in `src/word-filters.ts`; the next marker is one more line. They match case-insensitive at the start of the Definition.

A Lemma list line whose Category is one of the Edition's `categoriesRequiringHistory` (in the UA Edition `repressed-words` and `chameleon-words`) is refused like an unknown Category, naming the line, before anything is fetched: the tool does not source a Word History, so such a Word cannot pass the build.

## Idioms: `source:idioms`

<!-- #1628 -->

```sh
pnpm source:idioms <idiom-list> --edition <id> [--out <dir>] [--cache <dir>]
```

The list has one Lemma per line, `<lemma> [idiom|proverb]`; the Idiom Type is `idiom` when left out, and every draft of the line gets it. `#` starts a comment. For each Lemma the tool reads its goroh «Фразеологія» page (`https://goroh.pp.ua/Фразеологія/<lemma>`) and drafts one Idiom per phraseologism on it: the expression as printed, the first meaning as the primary Definition, further meanings as extra Definitions, the Examples with their authors, and as source the dictionary goroh names for the block with the page address. Drafts, incomplete drafts and `review-report.md` go to `<review>/idioms/`, on the same cache and throttle as `source:words`. A ready draft passes the Idiom schema and the Language Pack build's checks against the Edition.

What is left out, each with a flag in the report:

- a block, or a whole page, goroh attributes to «Велика мовна модель», or whose remark is only a grammar label: refused with `check` (ADR 0012, never a source);
- a proper name, such as a place name: not drafted, since its story is its etymology;
- a block no dictionary is cited for: `check`;
- a Lemma with no «Фразеологія» page: `no-entry`; a page that cannot be fetched: `fetch-failed`;
- an expression the Edition already has: the draft goes to `incomplete/` with `existing-entry`.

Example, from the tests (`fixtures/`): the line `лити` yields 14 drafts, among them

```json
{
  "expression": "Лити воду",
  "idiomType": "idiom",
  "primaryDefinition": "Говорити або писати неконкретно, беззмістовно, нецікаво і т. ін.; вести розмови замість того, щоб робити що-небудь.",
  "examples": [
    {
      "text": "Сподіваюся, що в новому році письменники будуть менше “лити воду”, а більше писати."
    }
  ],
  "sources": [
    {
      "title": "Словник прислів'їв та приказок з поясненнями. / Єфімова І. В., 2011",
      "url": "https://goroh.pp.ua/Фразеологія/лити"
    }
  ]
}
```

while the line `Дніпро` yields none: goroh attributes that page to a language model.

<!-- /#1628 -->

## Corrections: `source:corrections`

<!-- #1629 -->

```sh
pnpm source:corrections <form-list> --edition <id> [--out <dir>] [--cache <dir>]
```

The form list has one non-standard form per line, `<non-standard form> <correction type> <category id>`, with `#` comments; the form may be several words. The Correction Type and the Category are checked against the Edition before anything is fetched: an unknown one is refused with its line number, and nothing is fetched. The tool reads the goroh «Слововживання» page of the form, with the same cache and throttle as `source:words`.

Each article about the form becomes a draft:

- the article text is the explanation;
- the standard forms the article names are the standard equivalents;
- the article's example pair is the example pair;
- the source is the citation goroh prints under the article, with the page address.

Articles goroh marks as written by a language model are left out with a `check` flag; they are never a source. Output goes to `review/corrections/`, laid out as for Words: `drafts/` holds drafts that pass the Correction schema and the Language Pack build's checks against the Edition, `incomplete/` the rest, and `review-report.md` the decisions.

| Flag             | Meaning                                                                                                          |
| ---------------- | ---------------------------------------------------------------------------------------------------------------- |
| `no-entry`       | goroh has no «Слововживання» article for the form. No draft is written.                                          |
| `fetch-failed`   | goroh kept refusing or rate-limiting after the last back-off; run again later.                                   |
| `missing-data`   | The article prints no example pair or names no standard equivalent, or no article on the page is about the form. |
| `existing-entry` | The form is already a Correction of the Edition; the draft goes to `incomplete/`.                                |
| `check`          | goroh articles written by a language model were left out; the message names them.                                |

## Synonym Rows: `source:synonyms`

<!-- #1630 fills this section. -->

## Extending it

`runSourcing(list, options, kind)` is the one sourcing run every kind shares: it reads the list file (`#` comments, a repeated line refused), refuses an Edition in another language, fetches through the polite client, sends a draft whose text is already an Entry of the kind to `incomplete/`, and writes the kind's folder and review report. A kind (`SourcingKind`) only reads one list line and drafts it. The entry point also exports `PoliteClient` and `readArticleBlocks`, which reads every article block of a goroh page with the dictionary it cites and whether a language model wrote it, so the Content CLI needs no deep import.

## Tests

`pnpm --filter @slovo/sourcing test` runs the tool against pages saved in `fixtures/` (goroh, sum.in.ua through the Wayback Machine, and the Wayback Machine's index) on a virtual clock. The tests never touch the network.
