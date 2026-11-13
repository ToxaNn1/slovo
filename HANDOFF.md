# HANDOFF review-fixes-1113

STATUS: ACTIVE (PR #1820 open; CI Lint red, needs a fix; perf reword needs a force-push grant)

## Task
Owner 13.11: fix all 176 items of review-1113/items.json in the cloud; commits, pushes, one PR fix/1113-code-review -> main, CI green, no auto-merge, no merge, no tickets. verified=false items (27) checked against code first; items that don't hold, are wrong/harmful or conflict with an ADR are skipped with a one-line reason. ADR numbers 0121-0124 reserved. Never wait for the owner: defaults go under «Questions for the owner» in the PR.

## Setup notes
- Session env carried the wrong commit email; GitHub refuses it. The owner identity is .github/owner-email: export GIT_AUTHOR_EMAIL/GIT_COMMITTER_EMAIL from that file in the shell snapshot (never type it).
- Postgres 18 cluster had to be created: `pg_createcluster 18 main -p 5432`, then rerun .claude/hooks/cloud-setup.sh.
- mattpocock-skills plugin is not installed in the cloud container: implement-spec followed from docs/agents/waves.md.

## Lanes
Items per lane: review-1113/lanes/<lane>.json. Lane branch fix/1113-code-review-<lane> from fix/1113-code-review. Status commit on lane branch: `chore: DONE|STUCK <lane>` with report body (fixed ids, skipped id+reason).

| lane | folders | items | status |
| ---- | ------- | ----- | ------ |
| L1 | packages/core | 15 | DONE 13, merged |
| L2 | packages/content-rules, packages/language-pack | 17 | DONE 14, merged |
| L3a | packages/ui/src/{game,entries,primitives} | 27 | DONE 19, merged |
| L3b | rest of packages/ui | 25 | DONE 21, merged |
| L4 | apps/mobile | 24 | DONE 20, merged |
| L5 | apps/backend, packages/server-core, packages/contracts | 32 | DONE 30, merged |
| L6 | apps/admin, apps/video, tools, scripts | 23 | DONE 22, merged |
| LXa | cross-folder (lanes/LXa.json) | 14 | running |
| LXb | cross-folder+infra (lanes/LXb.json) | 10 | DONE 10, merged |

## Log
- 2026-11-13T18:31:04Z step 0: HANDOFF, lane files, WAVES.md on coord/safety-net
- 2026-11-13T18:32:14Z launched L1 (Fable), L3a, L5, L6 (Opus) as background subagents in /home/user/wt/<l>; L2 L3b L4 queued
- WAITING until 20:02Z for L1 L3a L5 L6
- L6 STUCK after 10 fixed (R44 R45 R132 R130 R65 R81 R82 R46 R47 R131); R79 moved to LX (needs SwitchRefusalSchema/AccessRefusalSchema exported from @slovo/contracts/admin-api). L6 relaunched on its branch; L2 launched.
- Coordinator how-to: lane subagents are background Agents in worktrees /home/user/wt/<l> (deps installed). Wait with /tmp/claude-0/wait.sh <min> <lanes> (polls origin lane tips for DONE/STUCK). On DONE: merger subagent merges origin/fix/1113-code-review-<l> into fix/1113-code-review (--no-ff, `chore: merge lane <L>`), runs checks of the lane's packages, pushes. Queue: L3b, L4 (worktrees ready), then LX, then code review, merge origin/main, PR.
- A fresh coordinator in a new container must redo the Setup notes (identity from .github/owner-email via shell snapshot; Postgres cluster) and recreate worktrees from the pushed lane branches.
- 18:42Z L3a STUCK at 5/27 (R6 R10 R68 R69 R12 fixed, R11 skipped: Pressable sets accessibilityState.disabled); relaunched. Note: lane subagents hit ~120k after 5-10 items; expect relaunches.
- 18:44Z L1 DONE 10/15 (R52 R54 R55 still to do: relaunch L1 when a slot frees; R153 R170 skipped ok). L5 STUCK 6/32 (R3 R34 R4 R117 R30 R119), relaunched incl. R79 contracts export. Running: L2 L3a L5 L6.
- 2026-11-13 L2 STUCK 8/17 (R36 R40 R41 R122 R123 R144 R145 R146; R166 part), relaunched.
## HANDOFF to the next coordinator (previous one near its context limit)
Live implementers of the previous coordinator (in the old container) on: L2, L3a, L5, L6. Do NOT relaunch those lanes until their origin tip is a NEW `chore: DONE|STUCK <L>` commit dated after this line; a STUCK tip older than this line is already being continued.
Your next steps:
1. Setup notes above (identity via .github/owner-email exported in the shell snapshot, Postgres). Clone lane branches into worktrees /home/user/wt/<l>, `pnpm install --frozen-lockfile --offline`. Copy the lane brief and lane files: they are in this branch at review-1113/ (brief paths /home/user/wt/coord/... expect this branch checked out at /home/user/wt/coord).
2. Relaunch L1 now on its branch for R52 R54 R55 (R54/R55 were skipped only for context, must be done; R52 needs a new Entries seam: build it). L1 tip is `chore: DONE L1`; new work goes on top, end with a new DONE L1.
3. Launch L3b and L4 (branches not yet pushed: create fix/1113-code-review-l3b/l4 from origin/fix/1113-code-review). Max ~4 lanes at once.
4. Merge every DONE lane (merger subagent, one at a time). Then LX (review-1113/lanes/LX.json, 14 items incl. R79 admin side using L5's export, plus R127 if contracts allow). Then code review of the integration diff, fixes, `git merge origin/main`, PR (body per the task), REPORT.md, STATUS: FINISHED, WAVES.md finished.
Notes: lane subagents reach ~130k after 5-10 items; always relaunch from the STUCK body. Commit author is the noreply owner address: correct. L1 used one `perf(core)` commit (hook accepted it).
- 18:45Z coordinator (2) started as cloud session session_01VefVQUAKPt8Ak4bxrvvsRC; old container keeps its 4 live lane implementers (L2 L3a L5 L6) until they push a status commit.
- 18:47Z coordinator (2): setup redone (Postgres, identity in snapshot); main repo on fix/1113-code-review, coord branch at /home/user/wt/coord; worktrees l1 l3b l4; launched L1 (R52 R54 R55, Fable), L3b, L4 (Opus). Old container still runs L2 L3a L5 L6. Wait script /tmp/claude-0/wait.sh <min> <since> <lanes>.
- 18:51Z L6 DONE 20 fixed (old container); R134 R135 not attempted -> L6 relaunched here; merger merging L6 into integration.
- 18:55Z L6 merged (tip 14d1403d) and DONE again with R134 R135 (22 fixed): second merge running. L5 STUCK (13 fixed + R38 part) -> relaunched HERE (coord 2, /home/user/wt/l5), migrations 0026-0028. Running here: L1 L3b L4 L5. Old container: L2 L3a. Author of commits is the noreply owner address from .github/owner-email (as noted): correct.
- 18:57Z L6 second merge done (integration tip f8cf18ab). L3a STUCK 14 fixed -> relaunched HERE for R49 R89 R95 R96 R97 R137 R138 R156 R174. To LX: R13 (apps/mobile quick-question-on-screen.test.tsx:182). At L3a merge: fix apps/mobile/src/feed/word-tabs-on-screen.test.tsx:313 to expect «2. Покірний.» (R10/R68). Running here: L1 L3a L3b L4 L5; old container: L2.
- 2026-11-13 old container: all its implementers have ended; nothing live there any more. Lane tips are final status commits; relaunch freely.
  - L2 DONE (14 fixed + R166 part; skipped R127 needs contracts change, R128 unreachable, ID_PREFIX of R166 no contracts export). Handbook: Tip exceptions page (R129 new rule unique-tip-exceptions). R148 changes behaviour: an opened Edition reads Entries once.
  - L6 DONE but R134 (withStandardFormMarked: compare words without stress marks) and R135 (tools/content writes.ts: `add` with no records opens a batch; `edit` ignores non-numeric recordVersion) NOT done: relaunch L6 for those two. R84 only partly (Shouter differs per composition). Default taken: failed admin queries no longer retry.
  - L5 STUCK again: fixed R3 R34 R4 R117 R30 R119 R33 R29 R31 R32 R35 R39, R38 partly (Patch/Snapshot strict schemas still need non-strict output twins). Migration 0026_sign_in_method_unique.sql added: check no clash. Not started: R60-R63 R113-R116 R118 R120 R121 R124 R125 R136 R162 R164 R165 R172 R173 + R79 contracts export. Relaunch from STUCK body.
  - L3a STUCK: fixed R6 R10 R68 R69 R12 R14 R56 R67 R71 R90-R94; skipped R11 (Pressable sets disabled), R48 (RN 0.88 new arch: measureLayout sync); R13 needs mobile test quick-question-on-screen.test.tsx:182 changed -> LX; R70 needs packages/ui/eslint.config.js Reanimated opt-out list (+ADR 0059 list) -> infra lane. Not started: R49 R89 R95 R96 R97 R137 R138 R156 R174. Breaks mobile test apps/mobile/src/feed/word-tabs-on-screen.test.tsx:313 (expects «1. Покірний.», now «2. Покірний.»): fix in L4 or at merge.
- 18:59Z L1 DONE 13/15 (R52 new seam Entries.wordsLinking; Question: hide+restore of one Entry within one Cycle read can leave a card without the link until next change). L2 DONE. Merger merging L1 then L2. L3b STUCK 14 -> relaunched here (remaining R20 R57 R58 R73 R75 R76 R105 R157; skipped R98 R107 need Edition string -> LX/infra, R158 in L3a folder -> LX). LX/infra adds: R70 (packages/ui/eslint.config.js Reanimated opt-out), R13, R98, R107, R158, R127, R166 ID_PREFIX export. Note: R106 commit message has a Ukrainian button name (pushed, left).
- 19:05Z L4 STUCK 9 (R21 R26 R27 R28 R109 R111 R141 R160 R175; skipped R86 kept for owner DESIGN-06, R59 needs infra build config, R85 needs core -> LX) relaunched here. L5 STUCK 18 (+R38 R60 R61 R62) relaunched here. Backend tests need DATABASE_URL=postgres://slovo:slovo@localhost:5432/slovo. Running here: L3a L3b L4 L5 + merger L1/L2.
- 19:17Z L3a DONE 19, L3b DONE 21 -> merger merging both (+ mobile test 2. Покірний). L1 L2 merged (tip 9087d42b; language-pack/mobile tests flaky only in parallel turbo runs: run per package). L5 STUCK 25 -> relaunched (remaining R136 R162 R164 R165 R172 R173 R79-export). L4 running. Out-of-lane items collected in review-1113/LX-extra.md.
- NEXT: when L4 L5 DONE: merge each; then LX (lanes/LX.json + LX-extra.md, one Opus implementer on branch fix/1113-code-review-lx, infra items last in it); then code-review of `git diff origin/main...fix/1113-code-review`, fix real findings; `git merge origin/main`; PR; REPORT.md; STATUS FINISHED; WAVES.md on coord/safety-net.
- 19:30Z L3a+L3b merged (tip 53c36501; mobile tests adjusted: word-tabs numbering, togglebutton role, feed-notices scroll). L5 DONE 30 (skipped R118 R125 R165 R172; Question R136: PATCH_FORMAT stays 2, owner decides bump; R162 part) -> merger merging L5 (coord 2 subagent). L4 STUCK 11 -> relaunched (remaining R77 rest, R22 R50 R78 R108 R112 R142 R159 R161 R171). Skipped-needing-ADR add R165 (ADR 0031).
- Coordinator 2 near its context soft limit: HANDS OFF after this line. Live in coord-2 container: L4 implementer and L5 merger (both push to origin). Next coordinator: wait for origin/fix/1113-code-review tip `chore: merge lane L5` (or later) AND L4 tip a new DONE/STUCK after this line; then continue NEXT above. Lane status bodies hold every Fixed/Skipped/Questions list for the PR and REPORT.md.
- 19:44Z L5 merged (integration tip 10842587, all checks green). L4 STUCK 17 (f91fe72a; skipped R86 R59 R85 R142; remaining R22 R161 R171; R22 hide state lives in EntryCard in packages/ui). NOTHING LIVE now. Coordinator 3 next: setup notes; relaunch L4 for R22 R161 R171 (may touch packages/ui EntryCard for R22 since L3a/L3b are done), merge L4, then LX (lanes/LX.json + LX-extra.md), code review, merge origin/main, PR, REPORT, FINISHED.
- 19:47Z coordinator (3) started; setup redone (Postgres, identity in ~/.bashrc from .github/owner-email); worktrees coord l4; L4 relaunched for R22 R161 R171 (may touch packages/ui EntryCard). Question for owner: perf commits 032a3347c 45abddebc d9034973b fail commitlint (no force-push, no commitlint change until owner decides).
- 19:48Z LX split: LXa (core/mobile/ui, lanes/LXa.json, 14) and LXb (contracts/admin/backend/infra, lanes/LXb.json, 10) launched in parallel with L4 on fix/1113-code-review-lxa/lxb; may touch any folder their items name; LXb may touch infra files (not package.json/lockfile/.github).
- 20:00Z LXb STUCK 3 (R37 R166 R127; Question R127: contentChecksum optional) -> relaunched for R79 R72 R98 R107 R70 R156 R59. Running: L4 LXa LXb.
- 20:00Z coordinator (3) saw OWNER-ANSWERS.md (perf answer A, relayed by a local coordinator). Coordinator 3's own grant forbids force-push, so it does NOT do the reword; the PR/REPORT keep it as a Question unless a session with that grant does it after all lanes merge.
- 20:06Z L4 DONE 20 (0b883571; R22 adds EntryCard prop `page`; Question R171 moved selfCheck/wordTabs into SwipedEntryCard) merged by coord 3 (tip 240b1d97, mobile+ui green). Running: LXa LXb.
- 20:07Z LXa STUCK 4 (R5 R13 R18 R158; skipped R110 needs infra apps/mobile/package.json expo-crypto, R150 needs infra jest configs) -> relaunched for R24 R23 R66 R85 R149 R151 R169 R176 after merging integration. Running: LXa LXb.
- 20:15Z LXb STUCK 7 (R37 R166 R127 R79 R72 R98 R107; handbook Колекції, Повідомлення про помилку) -> relaunched for R70 R156 R59. Running: LXa LXb.
- 20:20Z LXa STUCK 7 (+R24 R23 R66; Question R24 module-level last request) -> relaunched for R85 R149 R151 R169 R176 + check 2 mobile test failures. Running: LXa LXb.
- 20:32Z LXb DONE 10 (c787ce28; R59 Metro reads bundled version via packMetadataOf, prints node:sqlite ExperimentalWarning) merged (tip after content lint fix); all touched packages green (backend test flaky in turbo, 549/549 alone). Running: LXa.
- 20:35Z review (core+backend) -> review-1113/REVIEW-FINDINGS.md (3 backend findings); lane RV (branch fix/1113-code-review-rv, /home/user/wt/rv) fixing them; mobile/ui reviewer appending to the same file. PR body draft review-1113/PR-DRAFT.md (LXa pending). Running: LXa, RV, mobile/ui review.
- 21:14Z safety net takeover (last commit 2026-11-13T20:55Z)
- 21:20Z safety coord: LXa and RV both merged; integration has all of main. Mobile/ui review+fix lane RV2 launched (branch fix/1113-code-review-rv2, /home/user/wt/rv2). PR-DRAFT updated; opening the PR. Perf reword NOT done (this session's rules forbid force-push): stays a Question.
- 21:24Z safety coord STEPS BACK: coordinator 3 is alive (cf869fbd2 21:15Z, PR #1820 21:16Z). Its RV2 mobile/ui reviewer was stopped; nothing of it was pushed. My PR-DRAFT.md edit (LXa/RV results, perf Question) is at 2d review-1113/PR-DRAFT.md; ignore the 21:20Z line. Coordinator 3: push a log line or WAITING line every <15 min so the safety net does not take over again.
- 21:16Z LXa DONE 12, RV DONE (2 fixed, 1 did not hold) merged; core unused exports removed; origin/main included; integration tip cf869fbd; PR #1820 opened (no auto-merge). REPORT.md written. Left: perf reword (force-push, needs grant), WAVES.md on coord/safety-net, watching CI of #1820. Coordinator 3 at context limit: FINISHED.
- Coordinator 3 stops (context limit). Nothing live. PR #1820 open, no auto-merge. Open: perf reword (needs a force-push grant), WAVES.md on coord/safety-net, CI of #1820 not watched.
- 21:17Z PR #1820 CI on cf869fbd: «Commit messages» red (perf commits, expected) and «Lint» red (job 132174657365; local pnpm lint was green: find the CI lint step, e.g. format/markdown/commit-scope, and fix). Coordinator 3 at hard context limit, nothing live: next coordinator fixes Lint, watches #1820.
- 21:19Z also red on cf869fbd: «Lint, typecheck, test and Language Pack» (job 132176011199). Next coordinator: read both failed job logs, fix, push.
- 21:19Z CI-fix session: filter-branch --msg-filter over origin/main..fix/1113-code-review (224 commits, 22 merges kept): R53/R63/R138 subjects perf( -> refactor(; git diff cf869fbd..new tip empty; same authors, committers, dates, trees; no perf subject left.
- 21:21Z Lint fix: tools/sourcing/src/corrections.ts:308 new Array(n).fill(0) -> Array.from({ length }, () => 0), commit fix(sourcing). Local pnpm lint also showed Prettier failing on 9 files: commit style: format nine files with Prettier. pnpm lint green, pnpm typecheck green, tools/sourcing tests 103 passed.
- 21:24Z One push: --force-with-lease=fix/1113-code-review:cf869fbd -> eacb04f0. No other force-push.
- 21:40Z PR #1820 CI on eacb04f0: all 21 checks success (CI history, Deploy to Railway skipped). REPORT.md: perf question resolved by owner answer A.
CI-FIX DONE: PR #1820 head eacb04f04e34c77a498edeffc8fce079a960902f, checks green
- 21:42Z PATCH3: started; branch fix/1113-patch-format-3, PATCH_FORMAT 3, ADR 0121 written
