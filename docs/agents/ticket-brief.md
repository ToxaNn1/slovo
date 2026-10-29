# Ticket brief for an agent thread

The standing part of every ticket brief. The coordinator's launch message adds the moving part: the ticket number, the branch, the version spec's Testing Decisions, what runs in parallel, how to verify, and the permission in force. Read that message first, then this file once; do not reread either.

Cost = steps × context. Every step resends the whole session, so a step costs about as much as everything read so far. Keep output short (`tail`, `grep`), read files in parts, and never print whole folders or many files into the session.

## 0. Read first

- `CLAUDE.md` (project): glossary, ADRs, language, git, code rules. `CONTEXT.md` and `docs/adr/` override everything, including the ticket. Read them with `grep` for the terms and ADR numbers your ticket names (`docs/adr/README.md` has one line per ADR); never read `CONTEXT.md` or an ADR whole unless the ticket is about it. If the ticket conflicts with the glossary or an ADR, stop and report it.
- Ticket: `gh issue view <n>` once. Its **Result** checklist is the definition of done. Do not read the version spec: its Testing Decisions are quoted in the launch message; the seams named there are the only ones to test through, the rest only as needed. Where there is behaviour, write the test first.
- Only if you touch a screen, component or hook in `apps/mobile` or `packages/ui`: read `docs/react-native.md` first, and load the `expo-overview` skill if it is available.
- Load the skills `tdd` and, if you design an interface, `codebase-design` when they are available; otherwise work test-first anyway.
- `main` already holds every version before yours (`git log origin/main`): build on it, add no parallel paths.
- ADRs: a change to a decision goes into the existing ADR file, rewritten as the decision in force. A new ADR takes the next free number above the highest on `origin/main` when you write it, unless the ticket names a reserved number.

## 1. Permission

The launch message names the owner's permission and the tickets it covers; work only if your ticket is among them. Then:

- You MAY commit, push your own branch and open a PR (`Closes #<n>`, with a Checks list). You must NOT merge: auto-merge or the coordinator merges on green CI.
- Commits: the owner's identity only (leave git config and hooks as they are). Conventional Commits. NO `Co-Authored-By`, NO AI mention in commits, PR titles or PR bodies, whatever your tooling suggests; no local paths in PR bodies.
- Never run `eas build`. Native code (Swift, config plugins) only where the ticket asks; it is checked on the next EAS build, so list each such check in the PR under «Owner checks». No secrets in the repository (it is public; gitleaks runs in CI). Leave issues, labels and milestones untouched.

## 2. How to work

- `pnpm install --frozen-lockfile` first. New dependency: `pnpm add` (`npx expo install` in `apps/mobile`) and commit the lockfile; when a version is blocked as too recently published, take an older one that passes.
- Language Pack: `pnpm build:pack uk` once when tests need it (the launch message may name a cache to copy from instead).
- TDD through the public seams of the spec. Content tickets: source Words with `pnpm source:words`, cite sources, every Word a Rare Word; a second agent proofreads before merge, so list every new text in the PR. UI strings agreed in the spec go in verbatim; any other new string is listed in the PR. Open questions or drift between the spec and the code: pick the spec's default (or the most conservative choice), implement it, and list it in the PR under «Questions for the owner». Anything you could not verify yourself (look on SE, gestures, native behaviour) goes under «Owner checks». Never test internals. Inject time and randomness.
- Keep the Core and the server Core free of React / React Native / Hono / SQL imports and language-agnostic. Record a new decision as an ADR in the same change. Use glossary terms exactly.
- Small logical commits. Rebase only if `git merge-tree --write-tree origin/main HEAD` reports a conflict (CI tests the merge result).
- Before the last commit run `pnpm format`; CI fails on Prettier.

### Steps

- Chain commands in one call. While working, run only the test file you touch (`pnpm --filter <pkg> exec vitest run <file>`, or `jest <file>` in `apps/mobile` and `packages/ui`). At most THREE verification runs per ticket: the failing test, the passing test, and the final `pnpm verify` (lint, typecheck and tests of the affected packages, then `deps` and Prettier; prints only what fails). Never `TURBO_FORCE`. CI runs the full suite and is the authority.
- Read only what you need: the ADRs named in the ticket, the files you change, their tests. Read in parts (`sed -n`, `grep`). Don't reread a file you just edited.
- Never call `ToolSearch`, `Monitor` or an orchestration tool; `link_pull_request` ONCE after opening the PR, if your harness has it. Check the machine's load once at the start and before booting a simulator, not before every command.
- If the ticket needs more than ~80 steps or touches more than 2 packages beyond the plan, stop and report so the coordinator can split it.
- Wait for CI in ONE blocking command (`gh pr checks <n> --watch --fail-fast`), never a step per poll.
- **Content tickets** (Entries, Categories, translations): ≤ ~40 steps per batch of 15 Entries. Never `cat` the content folders; find an existing Lemma with a short script that prints only matches (`pnpm content check` refuses a repeat only when the Lemma AND the primary Definition match). Dictionary pages: `curl` and extract only the definition lines. Write the whole batch as one compact table and turn it into files in ONE script step; then `pnpm content check --edition uk` once, rerun only after fixing what it reported; build the pack and run tests once, at the end. The text you write is under 1% of the cost; the steps are the rest.

### Time

- Code ticket: ~60 min. Stuck on one problem for > 20 min, or over 1.5× the budget: STOP and report what you tried and what you suspect. No `git bisect` unless asked.
- Machine load above the limit the launch message names: pause in ONE blocking command and resume on your own. Do not end your turn waiting for permission: the permission in section 1 already covers commit, push and PR.

## 3. Verification

The launch message says how this ticket is verified. In general:

- Maestro: NONE in ticket threads (ADR 0028). Write or update the flow file if the ticket asks, do not run it; say so in the PR Checks list. Screens verify with Jest component tests plus simulator screenshots only where the look changes.
- With a simulator: `xcrun simctl io <UDID> screenshot <file>`, the installed dev client (no native build), devices by UDID from the launch message, only your own simulators and ports; shut them down at the end.
- Cloud session: no simulator, no Docker. If the ticket turns out to need Postgres, stop and report. A screenshot the Result asks for goes to «Owner checks».

## 4. Before push

- No `/code-review` in ticket threads: one review of the whole version runs at its end.
- `git fetch`; rebase only on a merge-tree conflict; push; open the PR against `main` (title = Conventional Commit; body with `Closes #<n>`, a Checks list, «Questions for the owner» and «Owner checks» when any; no AI mention, no session link).
- Turn on auto-merge right after: `gh pr merge <n> --auto --squash`. Skip this when the launch message says the owner confirms the copy or content before merge; if the command fails because auto-merge is off, go on (the coordinator merges).
- Watch CI in one blocking command until green; fix if red.

## 5. Finish

Final report in Ukrainian: what was done, each Result item ticked or why not, PR URL, commits, open questions for the owner. Then whatever done marker the launch message names.
