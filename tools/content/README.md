# Content CLI

A thin client of the content write API (ADR 0090): it writes an Edition's content in the backend's Postgres with an Агент token and never writes the Edition folder. `SLOVO_API_URL` names the backend's `/v1` base, `SLOVO_AGENT_TOKEN` the Агент token (`pnpm --filter @slovo/backend admin agent add <name>`). A run without a token prints the API's `UNAUTHORIZED` answer and exits 1.

Kinds: `word`, `correction`, `idiom`, `synonymRow`, `tip`, `curatedCollection`.

## Write: `add`, `edit`, `retire`, `flag`

```sh
pnpm content add <kind> <array.json | drafts folder> --edition uk
pnpm content edit <kind> <id> <file.json> --edition uk
pnpm content retire <kind> <id> --edition uk
pnpm content flag <kind> <id> --reason <text> --edition uk
```

Each run opens one batch; the batch publishes at once and lands «не перевірено» in the Черга контенту. Every written record prints one line, `<id> v<record version> content v<content version> batch <batch id>`, with `needs new Recording` when a Word's text changed. A refusal prints on stderr, one line per rule (`REFUSED <rule> (<field>): <message>`), or `STALE, the current record version is <n>`; any refusal exits 1.

- `add` sends each record of a JSON array, or each `*.json` draft of a folder; the backend issues the ids, so an id in a draft is left out.
- `edit` replaces the record's fields with the file's. The file names the record version it was made from as `recordVersion` (the version a write printed); without it the edit is made from the current one.
- `retire` retires the record at its current version: it stays, marked retired.
- `flag` changes no content: the reason is an Action log row the Черга контенту lists.

## Check drafts: `check`

```sh
pnpm content check <kind> <array.json | drafts folder> --edition uk
```

Runs the shared content rules (`@slovo/content-rules`) on each record against the Edition's current content snapshot, as a save would be checked, and prints every refusal. It sends nothing.

## What the Edition has: `have` and `counts`

```sh
pnpm content have --edition uk [--kind <kind>]
pnpm content counts --edition uk
```

`have` prints the live records of the content snapshot, one per line: id, kind and text, tab-separated. `counts` prints the content report: the live Words per Category, rarity and coverage, the Corrections per Category and type, the Idioms per type, and each content target the content falls short of.

## Verify quotes: `verify`

<!-- #1626 -->

```sh
pnpm content verify w_k3x9qa content/words/w_m2p7rd.json --edition uk
pnpm content verify content/tips --edition uk
pnpm content verify --changed origin/main --edition uk
pnpm content verify content/tips --book osvita.txt --edition uk
```

Checks that the quoted text of each Entry is on the page its first source cites (ADR 0012, 0080): a Word's or an Idiom's primary definition, a Correction's explanation, a Synonym Row's meaning, a Tip's explanation. Name Entries by id, by Entry file or by a folder of them; `--changed <ref>` takes every Entry file that differs from the ref or is new to git. A goroh page is read block by block as the sourcing tool reads it; any other page is its plain text. Pages come through the sourcing tool's polite client and its cache folder (`--cache` names another), so a page is fetched once across runs. The comparison ignores case, spaces, quotation marks, apostrophes and dashes.

It prints one line per Entry, `<outcome>\t<id>\t<file>[\t<detail>]`, then the count per outcome, such as `158 ok, 2 miss`:

- `ok`: the quote is in a dictionary block of the page.
- `miss`: the page does not hold the quote; the detail is the quote.
- `llm`: only a language model's block of the page holds the quote.
- `fetch-failed`: the page could not be fetched, such as `HTTP 404`.
- `unverified`: the first source has no page.

`--book <file>` checks an Entry without a page against a book as the osvita downloader writes it, one paragraph per line, `<page>\t<text>`: every field the Entry quotes, for a Tip its title, forms, explanation and example, must be in the book, and `ok` prints the page, such as `page 112`. It exits 1 on any `miss`, `llm` or `fetch-failed`, and with `--book` also on any `unverified`; an unknown name exits 2. CI runs `--changed` against the pull request's base whenever a pull request changes Entry files, and prints the lines in the job summary.

<!-- /#1626 -->

## Import the Edition folder: `import --edition`

```sh
pnpm content import --edition uk [--snapshot <file>] [--override]
```

Imports the Edition folder into the backend's Postgres through the backend's own command, which reads `DATABASE_URL` and `EDITIONS_DIR`. With `--snapshot <file>` it imports a content snapshot saved to a file instead, through the same content rules: CI, Maestro and `pnpm dev` seed an empty database from `editions/uk/seed-snapshot.json`.
