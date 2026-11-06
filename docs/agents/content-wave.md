# Content waves

How the coordinator runs a content wave: new Entries from the sourcing tool, quoted word for word (ADR 0012), reaching `main` through automatic gates without the owner reading the drafts (ADR 0080, 0084). A content wave is a spec wave ([waves.md](waves.md)) whose tickets are batches of Entries; what this page does not say, `waves.md` says.

## Plan

- **Kinds.** Words (`pnpm source:words`), Idioms (`pnpm source:idioms`), Corrections (`pnpm source:corrections`) and Synonym Rows (`pnpm source:synonyms`). Tips, Word Histories, Literary Uses and place-name Idioms have no sourcing command: an agent quotes them from a cited source and `pnpm content verify --book` checks a Tip against its book.
- **Where the Edition is short.** `pnpm content counts --edition uk` shows Words per Category and rarity and Corrections per Category against the content targets, each gap marked. `pnpm content have --edition uk [--kind <kind>]` lists what the Edition already has; a list line whose text is there is wasted.
- **Lists.** One list file per implementer, in the format its command reads (the sourcing README): a Lemma list `<lemma> <category> <rarity>` for Words, `<lemma> [idiom|proverb]` for Idioms, `<non-standard form> <correction type> <category id>` for Corrections, `<dominant>[:<sense>]` for Synonym Rows. Leave out Categories that require a Word History (`source:words` refuses them) and dialect Words (no source gives their Region). Write about a third more lines than the count: some drafts end incomplete.
- **Size.** About 15 Entries per implementer, at most 5 implementers at once, one kind each.

## Branches

- The wave branch `content/<issue>-wave`, cut from `origin/main` and pushed, carries the lists in `scripts/content-wave/lists/` until the PR; the commit before the PR removes them.
- One implementer branch per plan line, `content/<issue>-<kind>[-<letter>]`, cut from the wave branch by the implementer.

## Launcher

`scripts/content-wave/launch.sh [--dry-run] <plan file>` starts the wave. The plan file, with `#` comments:

```text
wave content/1107-wave 90
content/1107-words-a    words        scripts/content-wave/lists/words-a.txt    15
content/1107-idioms     idioms       scripts/content-wave/lists/idioms.txt     10
```

The first line names the wave branch and the minutes each implementer has before its waiter gives up. Each further line is one implementer: branch, kind (`words`, `idioms`, `corrections` or `synonyms`), list file from the repository root, count.

- `--dry-run` prints, per implementer, the filled brief, the cloud start command and the waiter, and starts nothing. Read it before every real run; its test is `tools/content/src/content-wave.test.ts`.
- A real run checks that every list is on `origin/<wave branch>`, writes each brief to `<temp>/slovo-wave-<wave>/<branch>.brief`, starts each session as `waves.md` prescribes (`script -q <log> claude --cloud "<brief>"`; the log holds the session URL), then starts one waiter per implementer and prints a line as each ends. Run it in one background Bash: its exit is the notification. It exits 1 unless every implementer is `DONE`.
- The brief template per kind lives in the launcher, so the dry run is the template: the same lines for every kind, with the kind's sourcing command, review folder (`tools/sourcing/review/<kind>/`) and `pnpm content import` kind (`word`, `idiom`, `correction`, `synonym-row`).
- One waiter per implementer: it fetches the branch into its own ref `refs/wave/<branch>` with `--no-write-fetch-head`, reads the last commit subject and ends on `chore: DONE`, `FAILED` or `STUCK`, or prints `STALE <branch>` at the deadline. For a single relaunched implementer, run the launcher with a one-line plan.

## Implementer

What the brief points at; the brief itself carries the grant, the branch and the steps.

- Source with the kind's command, take only the ready drafts in `drafts/`, never `incomplete/`, and keep at most the count. Flags such as `cross-reference`, `region-missing`, `missing-data` and `stress-unresolved` mean the draft is not taken; say how many in the report.
- `pnpm content import <kind> tools/sourcing/review/<kind>/drafts --edition uk --no-record` writes the Entries with fresh ids and checks the Edition; it never records.
- `pnpm content verify --changed origin/<wave branch> --edition uk` must print no `miss`, `llm` or `fetch-failed`; then `pnpm content check --edition uk`.
- Every text quoted word for word, never written; no article goroh marks «Велика мовна модель». Never `pnpm build:pack --record`, never edit `content/ids.json` or `manifest.json`: the coordinator records once.
- Pages only through the sourcing tool, which keeps one request per host every two seconds through the shared cache. For a page by hand, the helpers: `scripts/content-wave/fetch-article.mjs <url> [filter] [skip]` prints an article's text, at most 2 KB, with language-model blocks hidden; `scripts/content-wave/fetch-osvita.mjs <book url> <last page> <out.txt>` writes an osvita book one paragraph per line with its page, the file `verify --book` reads.
- Context: at most 10 mapping lookups (`grep -n`, `sed -n`), every output through `tail -20`, never print a content folder; commit and push after each step; at ~140k end with `STUCK`.
- Finish: one empty commit `chore: DONE <branch>` (or `FAILED` / `STUCK`) whose body is the report in Ukrainian, at most 25 lines: Entries added, dropped and why, problems. The owner's identity; no `Co-Authored-By`, no AI attribution.

## Merging

On each `DONE` line: `git fetch origin <branch>`, then `git merge --no-ff -m 'chore: merge <branch>' origin/<branch>` into the wave branch. Two implementers never write the same file (fresh ids), so merges are clean. `FAILED`, `STUCK` or `STALE`: relaunch from the report on the same branch with a one-line plan, or drop the line.

If the wave branch was force-pushed after an implementer branched from it, its old base is not an ancestor any more and a merge drags the old commits back. Apply the implementer's own diff from its base instead: `git diff $(git merge-base origin/<branch> <old wave tip>) origin/<branch> | git apply --index`, then commit it as the merge of that branch.

## Recording, checks and the PR

1. After the last merge, once, on the wave branch: `pnpm build:pack uk --record` writes `ids.json` and `manifest.json` for the whole wave (ADR 0080).
2. `pnpm content verify --changed origin/main --edition uk` and `pnpm content check --edition uk`; fix or drop every Entry they refuse.
3. Recordings of the wave's new Words (ADR 0083), once the Entries are final: write the wave branch into a `wave` field of `tools/recordings/request.json` (the workflow reads only `edition` and `only`; the new value is what starts it) (`edition` the wave's Edition, `only` `missing`), commit `chore: Recordings of <branch>`, push. The push starts the `Recordings` workflow on the wave branch: it records only the Words without a Recording, in every Narrator Voice, and commits them to that branch. Wait in one blocking command, `gh run watch --exit-status $(gh run list --workflow recordings.yml --branch <branch> --limit 1 --json databaseId -q '.[0].databaseId')`, then `git pull`. A failed run blocks nothing: a Word without a Recording passes `pnpm content check`, which counts it per voice, and the device's voice reads it; push a new `wave` value to run it again. A Word dropped after this step leaves Recordings of an unknown Word, which the build refuses: delete them.
4. Remove `scripts/content-wave/lists/`, `pnpm format`, push, open the PR against `main`. The workflow's own commit starts no CI, so this push is the one CI checks. CI runs `verify --changed` over the Entries the PR adds or changes and fails on any `miss`, `llm` or `fetch-failed`; after a `fetch-failed`, re-run the job.
5. PR body: Entries added per kind and Category, dropped lines and why, the `verify` and `check` lines with the «Words without a Recording» counts, «Questions for the owner». Auto-merge on green, as in `waves.md`.

## Lessons of the 06.11 wave

- **Politeness.** goroh is one small site that every implementer reads at once; the sourcing tool's client (one request per host every two seconds, back-off) and its shared cache are the only way to its pages, never `curl` loops.
- **Context budget.** A printed content folder or a whole page costs every later step; the brief's context line keeps implementers to `grep`, `sed -n` and `tail`.
- **Cross-references.** Definitions such as «Зменш. до…», «Див.…», «Те саме, що…» explain nothing on an Entry card; `source:words` flags them `cross-reference`.
- **Dialect Words.** A dialect Word without a Region is refused by the build; `source:words` flags it `region-missing`, and lists leave dialect Words out.
- **No shared `FETCH_HEAD`.** Parallel waiters fetching into one `FETCH_HEAD` read each other's branch; each waiter now has its own ref.
- **`${b}`.** `$b:refs` in a waiter ate part of the branch name; branch variables are always braced.
- **Record once.** `ids.json` and `manifest.json` are one file each per Edition; only the coordinator writes them, once per wave.
- **Paths through symlinks.** On macOS the temp folder `/var` is `/private/var`; compare paths after `realpath` / `pwd -P`, as `verify` and the launcher do.
