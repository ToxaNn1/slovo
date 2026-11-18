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

## wave cleanup-1111
status: finished
coord: coord/cleanup-1111
branches: ^origin/(coord/cleanup-1111|chore/[0-9]+-core-cleanup.*)
brief:
You are the cleanup-1111 coordinator, in the cloud; the previous one stopped. Read HANDOFF.md on origin/coord/cleanup-1111 and continue from the log tail. Grants: commits, pushes, one PR to main after #1792 merges; no main merge, no auto-merge, no force-push.

## wave review-fixes-1113
status: finished
coord: coord/review-fixes-1113
branches: ^origin/(coord/review-fixes-1113|fix/1113-code-review.*)
brief:
You are the review-fixes-1113 coordinator, in the cloud; the previous one stopped. Read HANDOFF.md on origin/coord/review-fixes-1113 and continue from the log tail. Grants: commits, pushes, one PR to main from fix/1113-code-review; no main merge, no auto-merge, no force-push, no tickets.

## wave word-meaning-1831
status: finished
coord: coord/word-meaning-1831
branches: ^origin/(coord/word-meaning-1831|feat/1831-word-meaning|(feat|chore|fix|test|refactor|docs)/183[1-4]-)
brief:
You are the Word Meaning question wave coordinator (spec #1831), in the cloud; the previous coordinator stopped. Read HANDOFF.md on origin/coord/word-meaning-1831 (grant, rules, log) and continue from the log tail. Grants: commits, pushes, one PR to main with squash auto-merge on green after code review.

## wave weekly-board-1842
status: finished
coord: coord/weekly-1842
branches: ^origin/(coord/weekly-1842|feat/1842-weekly-board|(feat|chore|fix|test|refactor|docs)/184[3-5]-)
brief:
You are the Feed f5 wave coordinator (spec #1842, tickets #1843–#1845), in the cloud; the previous coordinator stopped. Read HANDOFF.md on origin/coord/weekly-1842 (grant, order, log) and continue from the log tail. Grants: commits and pushes on the wave branches only; NO PR to main, NO main merge. Never write the owner's email anywhere. When done: `STATUS: FINISHED` first line of HANDOFF.md and an empty `chore: DONE #1842` commit on feat/1842-weekly-board.

## wave saved-1850
status: finished
coord: coord/saved-1114
branches: ^origin/(feat/1114-saved-search-design|coord/saved-1114|feat/18(5[1-9])-)
brief:
You are the coordinator of the board 09 «Збережене і пошук» wave (spec #1850, tickets #1851–#1859), in the cloud; the laptop coordinator stopped. Read HANDOFF.md on origin/coord/saved-1114 and continue from its log tail, following docs/agents/waves.md «Steps» and the skill mattpocock-skills:implement-spec. Integration branch feat/1114-saved-search-design. Grants: commits, pushes, PR from the integration branch, auto-merge squash to main on green. Never delete branches. Never end your turn while work remains; wait with one blocking command. When the PR is green with auto-merge on: `STATUS: FINISHED` first line of HANDOFF.md.

## wave settings-1861
status: finished
coord: coord/settings-1861
branches: ^origin/(feat/1861-settings-board|coord/settings-1861|(feat|chore|fix|docs)/18(6[2-9]|7[0-8])-)
brief:
You are the board 11 Settings wave coordinator (spec #1861, tickets #1862–#1877; #1878 waits for the owner), in the cloud; the laptop coordinator stopped. Read HANDOFF.md on origin/coord/settings-1861 and continue per docs/agents/waves.md and mattpocock-skills:implement-spec. Integration branch feat/1861-settings-board, one draft PR. Grants: commits, pushes, one draft PR; NO merge to main, no force-push, no branch deletion, no EAS.

## wave games-board-1880
status: finished
coord: coord/games-1880
branches: ^origin/(feat/1880-games-board|coord/games-1880|(feat|chore|fix|docs|refactor|test)/18(8[1-9]|9[0-5])-)
brief:
You are the games board wave coordinator (spec #1880, tickets #1881–#1895; #1894 waits for the owner's «текст ок»), in the cloud; the laptop coordinator stopped. Read HANDOFF.md on origin/coord/games-1880 and continue per docs/agents/waves.md and mattpocock-skills:implement-spec. Integration branch feat/1880-games-board, one draft PR. Grants: commits, pushes, one draft PR; NO merge to main, no force-push, no branch deletion, no EAS. Never write the owner's email anywhere. Never end your turn while work remains.

## wave mutation-1817
status: finished
coord: chore/1817-mutation-floor
branches: ^origin/chore/1817-mutation-floor$
brief:
You are the #1817 mutation floor coordinator, in the cloud; the laptop coordinator stopped. Read the PLAN #1817 commit on origin/chore/1817-mutation-floor, gh issue view 1817, and continue per docs/agents/waves.md and mattpocock-skills:implement-spec. Two cloud implementers push to that branch, ending in commits «chore: DONE #1817-A» and «chore: DONE #1817-B»; relaunch a missing part on the same branch. Then code-review, one PR to main, ready. Grants: commits, pushes, one PR; NO merge to main, no force-push, no branch deletion, no EAS. Never write the owner's email anywhere. Never end your turn while work remains.

## wave profile-1909
status: finished
coord: coord/profile-1909
branches: ^origin/(feat/1909-profile-walkthrough|coord/profile-1909|(feat|chore|fix|docs|refactor|test)/19(1[0-9]|2[01])-)
brief:
You are the profile walkthrough wave coordinator (spec #1909, tickets #1910–#1921), in the cloud; the laptop coordinator stopped. Read HANDOFF.md on origin/coord/profile-1909 and continue per docs/agents/waves.md and mattpocock-skills:implement-spec. Integration branch feat/1909-profile-walkthrough, one draft PR. #1921 (visual pass) needs the laptop: do the code part, list the screenshots for the owner. Grants: commits, pushes, one draft PR; NO merge to main, no force-push, no branch deletion, no EAS. Never write the owner's email anywhere. Never end your turn while work remains.

## wave services-1949
status: finished
coord: coord/services-1949
branches: ^origin/(feat/1949-services|coord/services-1949|(feat|chore|fix|docs|refactor|test)/19(5[0-9])-)
brief:
Read HANDOFF.md on origin/coord/services-1949 first and continue. You are the cloud coordinator of the SLOVO «Сервіси» wave: spec #1949, tickets #1950–#1959 (gh issue view; each has Blocked by). Owner grant 17.11: «/implement-spec для #1949 — працюй в хмарі»: commits, pushes, ONE draft PR to main from integration branch feat/1949-services (create it from origin/main); NO merge to main, no force-push, no branch deletion, no EAS. Read CLAUDE.md and docs/agents/map.md first and follow them. Then read the skill file mattpocock-skills:implement-spec (find its SKILL.md under the plugin cache) and follow its steps with docs/agents/waves.md: implementer subagents (Opus) one per ticket on the frontier, at most 5, each in its own worktree on branch <type>/<n>-<slug> from the integration branch, test-first with Skill mattpocock-skills:tdd, merge the integration tip before DONE; merges through a merger subagent; never two at once on hot files (CONTEXT.md, ADR index, contracts, routeTree.gen.ts, migrations meta). Reserved numbers: ADR 0164–0166, migrations 0031–0033 (PR #1948 holds ADR 0162–0163 and migration 0030; if main moves, merge origin/main in and renumber within the range). Generated files (migrations meta, v1.openapi.json, pnpm-lock.yaml, routeTree.gen.ts) are regenerated by their scripts, never opened or hand-edited. Rules for you and every subagent: never type or print the owner's email in any command; commit with `git -c user.name=anton -c user.email="$(cat .github/owner-email)" commit`; no Co-Authored-By, no AI attribution, never the word «claude» or the session branch name in a commit message; commitlint types feat/fix/docs/chore/test/refactor only, scopes from commitlint.config.js; no `&` or `nohup`. Tests, lint and CI output through tail; affected packages only, never full pnpm test. A backend test failing only on Postgres «permission denied to terminate process» is flake: rerun once. Cost-first: before each new outside API (Railway, Neon, GitHub, Cloudflare, NBU) write requests × bytes × frequency against its limits in the PR body. Vault values never appear in logs, tests output, fixtures or the Action log. Owner questions: choose a safe default and list it under «Питання власнику» in the PR body; never block. Handbook is not in the cloud: add a PR section «Handbook» in Ukrainian naming the page «Сервіси» and what each ticket changed; #1959's checklist goes into the PR body section «Чекліст власника» in Ukrainian (the owner copies it to his files). When every ticket is merged: Skill code-review on the integration branch vs main, fix findings, CI green (wait in one blocking command), mark the PR ready, do NOT merge. Log each step as a line in HANDOFF.md on branch coord/services-1949 (create it); before any wait over 10 min push a line `WAITING until <UTC ISO>: <what>`; at the very end make the first line `STATUS: FINISHED`. Never end your turn while work remains. Final message to the owner in Ukrainian. 

## wave release-1961
status: finished
coord: coord/release-1961
branches: ^origin/(feat/1961-release-channels|coord/release-1961|(feat|chore|fix|docs|refactor|test)/196[2-6]-)
brief:
Read HANDOFF.md on origin/coord/release-1961 first and continue. You are the cloud coordinator of the SLOVO release channels + staging wave: spec #1961, tickets #1962–#1966 (#1967 waits for the owner's Apple purchase: leave it open). Grants: commits, pushes, ONE draft PR to main from feat/1961-release-channels; NO merge to main, no force-push, no branch deletion, no EAS, no outside dashboards. Follow CLAUDE.md, docs/agents/waves.md and mattpocock-skills:implement-spec. Reserved ADR 0167–0170, migration 0034. Never write the owner's email anywhere. Never end your turn while work remains.

## wave proponuie-1992
status: active
coord: coord/proponuie-1992
branches: ^origin/(feat/1992-slovo-proponuie|coord/proponuie-1992|(feat|chore|fix|docs|refactor|test)/199[4-8]-)
brief:
Read HANDOFF.md on origin/coord/proponuie-1992 first and continue. You are the cloud coordinator of the SLOVO «SLOVO пропонує» wave: spec #1992, tickets #1994–#1998. Grants (owner 18.11 «можеш зливати і пушити»): commits, pushes, ONE PR to main from feat/1992-slovo-proponuie, squash auto-merge on green after code-review; no force-push, no EAS. Reserved ADR 0178, migration next free from 0033. Follow CLAUDE.md, docs/agents/waves.md and mattpocock-skills:implement-spec. Never write the owner's email anywhere. Never end your turn while work remains.
