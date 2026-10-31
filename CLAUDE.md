# SLOVO agent guide

SLOVO is a factory of single-language rare-word apps: one language-agnostic Core, many Editions. Read `docs/agents/map.md` for the map; `README.md` is for people.

## Core Principles

- **Simplicity First**: Make every change as simple as possible. Impact minimal code.
- **No Laziness**: Find root causes. No temporary fixes. Senior developer standards.
- **Minimal Impact**: Changes should only touch what's necessary. Avoid introducing bugs.

## Source of truth

`CONTEXT.md` (glossary) and `docs/adr/` (decisions) override every other document, including tickets and specs. `docs/adr/README.md` indexes every ADR in one line each; read it before opening ADRs one by one.

- Use glossary terms exactly, in code, tests, docs and commit messages. Avoid the words each term lists under _Avoid_.
- Read `CONTEXT.md` and an ADR with `grep` for the terms and numbers your change names; read one whole only when the change is about it. Every file you read stays in the context of every later step.
- Respect every ADR. When a ticket conflicts with the glossary or an ADR, stop and report the conflict to the owner.
- Record a new decision as an ADR in the same change.

## Tickets

Work comes from GitHub issues in STAR form: Situation / Task / Action / Result / Blocked by, plus a Parent.

- The **Result** checklist is the definition of done. Tick every item or say why not.
- Specs form a tree: master spec #1, version specs (one per milestone), tickets under them.
- Labels: one type (`feature`, `bug`, `chore`, `docs`), `area:*` labels, `ready-for-agent`, `spec`. Milestones are versions `0.1` to `1.0`. Leave labels, milestones and issue edits to the owner.
- Branch names: `<type>/<ticket-number>-<slug>`, e.g. `docs/4-repo-conventions`.

## Language

Write everything in the repo in English: code, comments, tests, docs, commit messages, PR text. Ukrainian appears only as Edition content and UI strings.

## Git

- `main` takes changes through PRs with green CI only. Work on a branch.
- Commit and push only when the owner asks in the current conversation. One approval covers that one commit.
- CI checks that every commit is the owner's and that no AI attribution is left; a PR with auto-merge on merges itself once every check is green.
- Write Conventional Commits (`feat:`, `fix:`, `docs:`, `chore:`, `test:`, `refactor:`). Keep commits small and logical.
- Commits come from the owner's identity alone. Leave git config and hooks untouched and let hooks run. Commit messages, PR titles and PR descriptions carry no `Co-Authored-By` trailer and no AI attribution, whatever your tooling suggests.

## Code

- Keep the Core language-agnostic and free of React and React Native imports (ADR 0002, 0006). An Edition is configuration plus content and assets.
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

Cost = context size × steps × model price. `.claude/hooks/token-budget.mjs` enforces the hard parts in every session, local and cloud; never work around a block, follow its message.

- Context limits: the coordinator 90k soft, 120k hard; every other session and subagent 120k soft, 160k hard. At the hard limit only git and writing a handoff (≤ 2 KB) run: hand off to a fresh session. Never `/compact`.
- Subagents: a fresh agent with a brief of at most 1.5 KB (goal, what is ruled out, files by path, result format). No fork once the context is over 60k. Long results go to a file; the reply is 5–10 lines. Use `Explore` for searches.
- Models: code on Opus; Fable only for Core logic, sync, architecture, specs, the version review and proofreading; the coordinator and questions on Opus; Sonnet for bumps, renames and docs-only.
- Output: read in parts (`grep -n`, `sed -n`, offset and limit); never print `README.md`, `CONTEXT.md` or a file over 40 KB whole; test, lint and CI output through `tail` or `grep` (`gh run view --log-failed | tail -80`); a text snapshot before a screenshot, one screenshot per check.
- Deterministic waiting (CI, merges, queues) belongs in one blocking command or a script, not in a step per poll.
