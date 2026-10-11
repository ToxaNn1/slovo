# Content sourcing tool

Dev-only tooling, never shipped in an app. It turns a list of Lemmas into draft Words for the Ukrainian Edition, taken from real dictionaries:

- **СУМ-11** on [sum.in.ua](https://sum.in.ua): Definitions, Examples with their authors, register labels, part of speech and gender. When the site doesn't answer, the newest copy in the [Wayback Machine](https://web.archive.org) is used and both addresses go into the Word's sources (`url` and `archivedUrl`).
- **[goroh.pp.ua](https://goroh.pp.ua)**: Stress, part of speech and gender (inflection dictionary), Synonyms (Karavansky's and the mphdict synonym dictionaries only) and etymology (ЕСУМ).

Every field comes from one of these sources. What they leave open stays empty and is flagged. A human checks every draft and moves it into `editions/uk/content/words/` by hand.

## Run it

Write a Lemma list, one Lemma per line, with the Category and rarity you chose for it. `#` starts a comment.

```text
# lemma     category id      rarity
мжичка      nature-weather   2
коса        household-crafts 1
```

```sh
pnpm source:words path/to/lemmas.txt
```

| Option                        | Default                 | Meaning                                                                      |
| ----------------------------- | ----------------------- | ---------------------------------------------------------------------------- |
| `--edition <id>`              | `uk`                    | The Edition whose Categories, Stress rules and taken ids apply.              |
| `--out <dir>`                 | `tools/sourcing/review` | The review folder.                                                           |
| `--cache <dir>`               | `tools/sourcing/.cache` | Fetched pages. Delete it to fetch everything again.                          |
| `--sum auto\|direct\|wayback` | `auto`                  | Try sum.in.ua and fall back to the Wayback Machine, or use only one of them. |

The tool sends at most one request every 2 seconds and keeps every answer on disk, so a re-run doesn't touch the network. Both folders are git-ignored.

## What comes out

- `review/drafts/<id>.json`: drafts that pass the Word schema and the Edition's Stress rules. Each has a new opaque `w_` id that the Edition doesn't use yet.
- `review/incomplete/<id>.json`: drafts that lack required data (for example, no source marks the Stress). The report says what is missing.
- `review/review-report.md`: everything a human must decide, per Lemma and per draft:

| Flag                | Meaning                                                                                         |
| ------------------- | ----------------------------------------------------------------------------------------------- |
| `no-entry`          | СУМ-11 has no article for the Lemma (the addresses tried are listed). No draft is written.      |
| `fetch-failed`      | A site kept failing; run again later.                                                           |
| `homonym`           | СУМ has several articles; each became its own draft. Synonyms and etymology are left to assign. |
| `needs-assignment`  | Synonym groups or ЕСУМ articles the tool can't tie to one draft.                                |
| `several-stresses`  | The Lemma has more than one valid Stress; all are kept.                                         |
| `stress-unresolved` | No source marks the Stress, or goroh lists different ones.                                      |
| `sources-disagree`  | СУМ and goroh differ on Stress, part of speech or gender.                                       |
| `missing-data`      | No source names the part of speech or the gender.                                               |
| `plural-only`       | A noun with no singular; its gender is `plural-only`.                                           |
| `unmarked-examples` | СУМ prints the Examples without italics; they are left out and the Definition is cut.           |
| `other-labels`      | СУМ labels with no register to map to, listed so nothing is lost silently.                      |
| `spelling-differs`  | СУМ-11 spells the headword differently (it predates the letter ґ).                              |
| `check`             | Something worth a glance, e.g. an etymology taken from the ЕСУМ article of a related word.      |

## Tests

`pnpm --filter @slovo/sourcing test` runs the tool against pages saved in `fixtures/` (sum.in.ua through the Wayback Machine, goroh, and the Wayback Machine's index). The tests never touch the network.
