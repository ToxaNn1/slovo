STATUS: WAITING owner phone test (Metro 8082). Review fixes merged (4aff78f01), handbook + PR #1860 body done, CI green. No cloud session running. #1860 on merge-hold until the phone test.
# Wave #1850 (board 09 Saved/Search) — coordinator #10 handoff (rewrite whole, never append)
Owner ran /mattpocock-skills:implement-spec on #1850, «роби максимум в хмарі», wants SPEED. Follow that SKILL.md + docs/agents/waves.md «Steps».
Grants: ~/.slovo-coord/grant-saved-1114.md (commit, push, PR, auto-merge squash to main on green, this branch only, after End steps). Force-push USED UP. No branch deletion (ask).

## State (20:05Z, coord 10)
- Integration feat/1114-saved-search-design tip 4aff78f01 pushed: ALL tickets #1851–#1859 merged + review fixes (fix/1850-review: 4 findings + owner decisions a–c). Local checks core/ui/mobile 12/12 green. Draft PR #1860 body has Closes #1851–#1859. No cloud session running.
- review/1850-findings = findings file only, never merge (in watchdog/handled).
- PR 1860 is in ~/.slovo-coord/watchdog/merge-hold: REMOVE that line right before enabling auto-merge.
- Reports: ~/.slovo-coord/saved-compare/wave/reports/ (1851–1853, 1855–1859 .md/.txt, fix-1850.md, REVIEW-1850.md). #1854 report: `git log --grep='DONE #1854'` on the integration branch.
- Metro 8082 runs (started 19:16Z, `npx expo start --go --port 8082 --lan` in apps/mobile); exp://192.168.0.49:8082. Reuse; never a second one.

## End steps left (do now, fast)
1. DONE (coord 10): handbook мікс.md, пошук-і-слово-дня.md, перевір-себе.md. Was: Handbook ~/Downloads/WORD/handbook/: мікс.md «Колекції» — replace line «Видалення і поширення колекції — допишемо після #1857» from reports/1857.md; пошук-і-слово-дня.md — «Нічого не знайдено» from 3 letters / «Продовжуй вводити», cascade (reports/fix-1850.md «Довідник»).
2. DONE (coord 10): PR #1860 body rewritten; CI 21 pass. Was: PR #1860 body (mattpocock-skills:pr): Checks; «Questions for the owner» from every report; «Owner checks» (phone: Saved, Collections grid/sheets/delete undo/share, Search, Due Quiz ПОЧАТИ 48, VoiceOver, cascade; copy-link needs next EAS build with expo-clipboard, then switch collectionLinkCopy on); new texts: none.
3. Owner phone test on Metro 8082 → fix what he finds (cloud implementer, brief ≤1.5 KB).
4. gh pr ready 1860; remove merge-hold line; gh pr merge 1860 --auto --squash; wait green. Then status: finished in origin/coord/safety-net:WAVES.md (wave saved-1850) and `STATUS: FINISHED` atop origin/coord/saved-1114:HANDOFF.md (push via plumbing; zsh: write "${c}:refs/..." with braces).

## Side track: board 11 Settings
- Owner's «83–97» = board 11 steps in his QA Walkthrough. Differences D1–D49: ~/Downloads/WORD/plans/board11-differences.md. Owner decisions so far: ~/Downloads/WORD/plans/board11-owner-decisions.md (8 lines). Owner asked: «задай мені ще питання» — keep asking AskUserQuestion (≤4 per call) on the remaining D's, record each answer there, offer a picker artifact if he prefers. Owner runs to-spec himself (never write the spec).

## Rules learned
- Cloud implementers push in one batch at the end; a quiet branch is not stuck. Silent-guard: plan-guard.sh <branch> <min>. Big tickets hit 180k: keep successor briefs narrow.
- Watchdog CI «RED» comes from a stale hook: always check `gh pr checks 1860`.
- Thread titles: yours «🟢 🧭 Координатор · дошка 09»; rename predecessor to «💤 старий · Координатор · дошка 09».
