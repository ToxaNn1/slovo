# SLOVO agent guide

SLOVO is a factory of single-language rare-word apps: one language-agnostic Core, many Editions. Read `README.md` for the map.

## Core Principles

- **Simplicity First**: Make every change as simple as possible. Impact minimal code.
- **No Laziness**: Find root causes. No temporary fixes. Senior developer standards.
- **Minimal Impact**: Changes should only touch what's necessary. Avoid introducing bugs.

## Source of truth

`CONTEXT.md` (glossary) and `docs/adr/` (decisions) override every other document, including tickets and specs. `docs/adr/README.md` indexes every ADR in one line each; read it before opening ADRs one by one.

- Use glossary terms exactly, in code, tests, docs and commit messages. Avoid the words each term lists under _Avoid_.
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
