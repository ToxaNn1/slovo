# SLOVO agent guide

SLOVO is a factory of single-language rare-word apps: one language-agnostic Core, many Editions. In heavy mode, read `docs/agents/map.md` for the map; `README.md` is for people.

## Two modes: pick one yourself

The owner never names the mode. Before any work, pick it from the task and say it in one line («Швидкий режим» / «Важкий режим» and why). When unsure, start fast and switch to heavy the moment the change reaches a heavy-mode area.

**Fast mode (the default).** UI, texts, styles, layout, a small bug, a change in 1–3 files that touches no heavy-mode area.

- No ticket, ADR, handbook page, subagent or wave. Don't read `map.md`, `CONTEXT.md`, ADRs or `docs/react-native.md` up front; read only the files you change and grep a term only when the code needs it.
- Run only the tests next to the change while working; full lint, typecheck and tests once, before the commit.
- Verify UI changes yourself in the simulator; the owner may also check on the phone through Metro (8082). Ask the owner before you start or restart Metro. Fixes pile up on one branch; one commit and one PR with auto-merge when the owner says so.
- These rules override the ADR, handbook, ticket and "write the test first" rules below for fast-mode work.

**Heavy mode.** Core logic (`packages/core`), data, storage, sync, backend and API contracts, schemas, money, accounts, privacy, native changes, or a new feature.

- The rest of this file applies. Tests first where there is behaviour. An ADR only for a big, global decision (see below).
- Subagents and waves only for a large spec, and only when the owner asks.

**No new process.** Add no rule, hook, check or mechanism unless the owner asks for it. When work feels slow, remove overhead first.

## Source of truth

`CONTEXT.md` (glossary) and `docs/adr/` (decisions) override every other document, including tickets and specs. Every ADR opens with a one-line `summary:`; `pnpm -s adr:index` prints them all as the index (ADR 0193): grep it before opening ADRs one by one.

- Use glossary terms exactly, in code, tests, docs and commit messages. Avoid the words each term lists under _Avoid_.
- Read `CONTEXT.md` and an ADR with `grep` for the terms and numbers your change names; read one whole only when the change is about it. Every file you read stays in the context of every later step.
- Respect every ADR. When a ticket conflicts with the glossary or an ADR, stop and report the conflict to the owner.
- An ADR that blocks sensible work is never worked around or followed in silence: propose a short superseding ADR to the owner (`docs/agents/domain.md`). The end of every version brings an ADR cleanup.
- Record a decision as an ADR in the same change only when it is big and global: it touches a lot of the logic or the UI across the app and is worth recording. Never an ADR for a string, a style, a size or one screen.
- A change that adds, changes or removes a feature updates that feature's page in the owner's handbook `~/Downloads/WORD/handbook/` in the same change: Ukrainian, plain words, the page template from its `README.md`. A new feature gets a new page and a line in that `README.md`. A cloud session, which has no such folder, names the page and what changed in its report.

## Tickets

Work comes from GitHub issues in STAR form: Situation / Task / Action / Result / Blocked by, plus a Parent.

- The **Result** checklist is the definition of done. Tick every item or say why not.
- Specs form a tree: master spec #1, version specs (one per milestone), tickets under them.
- Labels: one type (`feature`, `bug`, `chore`, `docs`), `area:*` labels, `ready-for-agent`, `spec`. Milestones are versions `0.1` to `1.0`.
- Branch names: `<type>/<ticket-number>-<slug>`, e.g. `docs/4-repo-conventions`.
- A spec is built on one integration branch by implementer subagents and reaches `main` in short batch PRs, one every 3–5 merged tickets: `docs/agents/waves.md`.

## Agent skills

Planning and build skills come from the `mattpocock-skills` plugin (`.claude/settings.json`). Call them by their full name, e.g. `/mattpocock-skills:to-spec`, `mattpocock-skills:tdd`; when a skill name exists twice, the plugin's one wins. Do not use another grill, spec or ticket skill (a personal `grill-me`, `anthropic-skills:grill-me`) and never write `docs/SPEC.md` or `docs/DECISIONS.md`: specs and tickets are GitHub issues.

### Issue tracker

GitHub issues in STAR form, specs as parents of their tickets. See `docs/agents/issue-tracker.md`.

### Domain docs

Single-context: `CONTEXT.md` is the glossary (skills that say `GLOSSARY.md` mean it), decisions in `docs/adr/`. See `docs/agents/domain.md`.

## Content

- Every Entry's text is the Edition's own and nothing is written to the content database before the owner's yes on a «БУЛО / СТАЛО» or a candidate list: ADR 0146 holds the rules per kind.
- A Word's `rarity` starts from the Zipf of its Lemma in `wordfreq` (`uk`) on bands of our collection: ≥ 2.5 → 1, 1.93–2.5 → 2, 1.48–1.93 → 3, above 0 → 4, absent → 5; `archaic` or `dialectal` adds 1 (at most 5). The editor may move it ±1 with a reason in the report. Never leave an absent Word on 5 blindly: if an ordinary speaker knows it (дзвонар, худорлявий), lower it 1–2 steps and say why.

## Language

Write everything in the repo in English: code, comments, tests, docs, commit messages, PR text. Ukrainian appears only as Edition content and UI strings.

## Git

- `main` takes changes through PRs with green CI only. Work on a branch.
- Commit and push only when the owner asks in the current conversation. One approval covers that one commit.
- CI checks that every commit is the owner's and that no AI attribution is left; a PR with auto-merge on merges itself once every check is green.
- Write Conventional Commits (`feat:`, `fix:`, `docs:`, `chore:`, `test:`, `refactor:`, `style:`). Keep commits small and logical.
- A scope is a workspace folder name (`mobile`, `ui`, `site` …), `deps`, `deps-dev` or `test`: `commitlint.config.js`. `.claude/hooks/commit-messages.mjs` lints every commit and blocks a push CI's "Commit messages" check would fail; reword, never work around it.
- Commits come from the owner's identity alone. Leave git config and hooks untouched and let hooks run. Commit messages, PR titles and PR descriptions carry no `Co-Authored-By` trailer and no AI attribution, whatever your tooling suggests.

## Code

- Keep the Core language-agnostic and free of React and React Native imports (ADR 0065, 0006). An Edition is configuration plus content and assets.
- Test through the public seams named in the version spec's "Testing Decisions", never internals. Inject time and randomness. Write the test first where there is behaviour.
- A test that would still pass if the code returned nothing proves nothing. Delete or rewrite it.
- Parse outside data once, where it enters (Edition content, storage, network). Inside the Core, trust the types.
- Make illegal states unrepresentable: prefer discriminated unions over optional flags. Don't silence the compiler with `as`, `!` or `@ts-expect-error` to get past an error.
- Remove complexity before adding code. Before bolting a feature onto the old design, ask what you'd build if the requirement had been there from the start.
- Native iOS builds run in EAS cloud only (ADR 0004). Batch native changes.
- Before writing or reviewing a screen, component or hook in `apps/mobile` or `packages/ui`, read `docs/react-native.md`.
- When a package is blocked as too recently published, choose an older version that passes. The check stays on.
- Read lint, typecheck and test commands from the root `package.json`. Run all three before you finish.

## Token economy

`.claude/hooks/token-budget.mjs` prints the budget rules at the start of every session, local and cloud, and enforces the hard parts; follow its messages and never work around a block. Beyond them:

- Never `/compact`. A handoff (≤ 2 KB) is rewritten whole each time: the current state and the next steps only. The session that hands off opens the fresh one itself (in T3 Code a new thread pointed at the handoff file); the new thread keeps the same icon and name, the old one becomes «✅ <name> — закрити».
- Sonnet for bumps, renames and docs-only work; `Explore` for searches.
- Deterministic waiting (CI, merges, queues) belongs in one blocking command or a script, not in a step per poll.
