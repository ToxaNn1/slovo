# Cloud safety net: active waves (coordination branch, never merged)

The safety routine reads this file every 30 minutes. One `## wave` block per wave.
Coordinators: add your wave when it starts; set `status: finished` when its PR is green with auto-merge on (or its draft PR is complete).
Before a blocking wait over 20 min, push a line `WAITING until <UTC ISO time>: <what>` at the end of your HANDOFF.md.

## wave admin-1709
status: finished
coord: coord/admin-wave
branches: ^origin/(feat/1709-admin|coord/admin-wave|(feat|chore|fix)/17[0-3][0-9]-)
brief:
You are the admin wave coordinator (specs #1708/#1709, PR #1746), in the cloud; the previous coordinator stopped. Read HANDOFF.md on origin/coord/admin-wave (its log tail says where the work is) and continue; read docs/agents/map.md and the skill mattpocock-skills:implement-spec (implementers = Opus subagents with tdd in own worktrees; merger subagents). Goal: #1746 merges origin/main, #1728's ADR moves to the next free number, migrations renumbered after main's (`pnpm --filter @slovo/backend db:generate` reports no changes), content-rules fixture fixed, code-review (medium) fixes, green CI, ready + `gh pr merge 1746 --auto --squash`. #1735 stays open. Owner questions: safe default under «Питання власнику» in the PR body, never block. Grants: commits, pushes, PRs.

## wave review-tails
status: finished
coord: coord/global-review-tails
branches: ^origin/(coord/global-review-tails|(feat|chore|fix|docs|test|refactor)/.*1109-)
brief:
You are the coordinator of the «global review tails» wave, in the cloud; the previous coordinator stopped. Read HANDOFF.md on origin/coord/global-review-tails (input review/REPORT.md, review/OWNER-DECISIONS-1106.md, progress log) and continue. Scope: Medium/Low findings fixable and provable by tests/typecheck/lint; SKIP visual, owner decisions, and every file under apps/admin, apps/backend, packages/server-core, packages/content-rules. Integration branch fix/1109-global-review-tails; implementers = Opus subagents with tdd in own worktrees; one DRAFT PR to main «fix: global review tails (Medium/Low)» listing fixed / skipped + why; leave it draft, NO merge to main. Grants: commits, pushes, one draft PR. When every finding in scope is done or skipped: `STATUS: FINISHED` first line of HANDOFF.md.

## wave infra-1109
status: finished
coord: coord/infra-1109
branches: ^origin/(coord/infra-1109|docs/1109-conflict-free-waves|(chore|docs|test)/1109-)
brief:
You are the infra wave coordinator, in the cloud; the previous coordinator stopped. Read HANDOFF.md on origin/coord/infra-1109 (tasks, grants, log) and continue from the log tail. Grants: commits, pushes, PRs; no main merge except #1752's existing auto-merge. Never touch feat/1108-video or apps/video.

## wave ci-affected-1109
status: finished
coord: coord/ci-affected-1109
branches: ^origin/(coord/ci-affected-1109|chore/1109-ci-affected-tests)
brief:
You are the CI affected tests coordinator, in the cloud; the previous coordinator stopped. Read HANDOFF.md on origin/coord/ci-affected-1109 and continue from the log tail. Grants: commits, pushes, one PR; no main merge, no auto-merge. Never touch feat/1108-video, apps/video or #1756.

## wave pr-footer-1109
status: finished
coord: coord/pr-footer-1109
branches: ^origin/(coord/pr-footer-1109|chore/1109-strip-pr-footer|chore/1109-stryker)
brief:
You are the PR footer coordinator, in the cloud; the previous coordinator stopped. Read HANDOFF.md on origin/coord/pr-footer-1109 and continue from the log tail. Grants: commits, pushes, one PR; no main merge, no auto-merge, no force-push. Never touch feat/1108-video, apps/video or #1762.

## wave core-audit-1778
status: finished
coord: chore/1778-core-rules-one-place
branches: ^origin/(chore/1778-core-rules-one-place|(chore|refactor|fix|test)/17(79|8[0-9]|90)-)
brief:
You are the Core audit wave coordinator (spec #1778, tickets #1779–#1790, draft PR #1791), in the cloud; the laptop coordinator stopped. Follow the mattpocock-skills implement-spec skill and docs/agents/waves.md. Merged so far: see `git log origin/chore/1778-core-rules-one-place --merges`. Ticket branches end in `chore: DONE|FAILED|STUCK #n` commits whose body is the report. Graph: #1782←#1781; #1785←#1784; #1786←#1785; #1788 #1789 after #1787 (same files, one at a time); #1790 last; then code-review, one fixer, PR ready. Grants: commits, pushes, the one PR; NO merge to main (ask the owner). Plain `git commit`, never an email in a command. When the PR is ready and green: set this block's status to finished.

## wave media-1764
status: finished
coord: coord/media-1764
branches: ^origin/(feat/1764-media-store|coord/media-1764|(feat|chore|docs|fix)/17(6[5-9]|7[0-2])-)
brief:
You are the Media Store wave coordinator (spec #1764, tickets #1765–#1772), in the cloud; the previous coordinator stopped. Read HANDOFF.md on origin/coord/media-1764 (graph, grants, log tail) and continue with mattpocock-skills:implement-spec: Opus implementer subagents with tdd in own worktrees, merger subagents, integration branch feat/1764-media-store, one PR to main. NO main merge without the owner's word. Never write the owner's email anywhere. Grants: commits, pushes, one PR. When done: `STATUS: FINISHED` first line of HANDOFF.md.
