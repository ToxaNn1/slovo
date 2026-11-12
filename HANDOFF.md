STATUS: ACTIVE (waiting for #1792)

# Wave cleanup-1111: code health after the Core audit

Coordinator: cloud session. Base: origin/feat/1764-media-store (main + #1792 media code).
Integration branch: chore/<spec#>-core-cleanup (from the base). One PR to main only after #1792 merges
(then `git merge origin/main`, no rebase). NO merge to main, NO auto-merge, NO force-push. ADRs 0106-0108 only.

Tickets (spec "Code health after the Core audit"):
- W1: T1 crossword test <1 s + fast-check grid properties; T2 Mix keys from EntryKind, Entry kinds in one place;
  T3 "time ran out = win" in one place; T4 XP Log `mode` typed union, parsed at the storage edge;
  T5 Feature Switch lint rule sees switches stored in variables; T6 no React Compiler rule disables in apps/mobile;
  T7 widget link replaces the open Word (no native code).
- W2: T8 shared code for the two crossword hooks (after T3); T9 commitlint: keep only the noreply address (after #1792).

Hard rules: plain `git commit`; never a command with the owner's email; no `&`/`nohup`; no AI attribution;
commitlint types/scopes; never touch feat/1108-video, apps/video, backend media code, feat/1764-media-store itself; no EAS.

## Log
- 2026-11-11T21:18:30Z step 0: coord branch created
- 2026-11-11T21:23:51Z spec #1800, tickets #1801 #1802 #1803 #1804 #1805 #1806(after 1803) #1807(after #1792); integration chore/1800-core-cleanup pushed (PLAN). T6/T7 dropped: already on main. Push identity: noreply via scratchpad id.sh (env gmail is refused by GitHub).
- 2026-11-11T21:24:41Z W1 started as local worktree subagents: #1801 (Opus), #1803 (Fable), #1804 (Fable), #1805 (Opus). Next: #1802 after #1803 (core barrel), #1806 after #1803, #1807 after #1792.
- 2026-11-11T21:25:32Z #1804 STUCK: closed union of Game Mode ids conflicts with ADR 0006 (Game Mode is an Extension Point, Edition modes). Default taken: no code change, keep mode: string; PR «Questions for the owner»: option branded GameModeId parsed in progress/records.ts:44,100 or ADR change. Do not relaunch #1804.
- 2026-11-11T21:30:43Z #1803 merged (8a11d49c, author reset to noreply on merge). Worktree agents start from origin/main: brief them to branch from chore/1800-core-cleanup. Launching #1802, #1806.
- 2026-11-11T21:32:44Z #1805 merged (new packages/config/switch-lint.js + exports line in packages/config/package.json). Question: feed-notices.ts:180 two-switch dependency via helper → DEPENDS_ON?
- 2026-11-11T21:32:58Z STATE at ~140k: merged #1803 #1805 into chore/1800-core-cleanup (pushed). #1804 no-op (ADR 0006). Running local agents: #1801, #1802, #1806 (their commits live only in this container; if lost, relaunch from the ticket). Remaining for a successor: #1807 after #1792 merges (gh api repos/ToxaNn1/slovo/pulls/1792 -q .merged); code review of origin/main..chore/1800-core-cleanup; merge origin/main; PR to main (no auto-merge) with Questions: #1804 options (branded GameModeId parsed in core/src/progress/records.ts:44,100 / ADR change / keep string), feed-notices.ts:180 two-switch dependency via helper → DEPENDS_ON?, packages/config/package.json gained a ./switch-lint exports line, T6/T7 already on main (#1292, replaceOpenEntry); handbook: none. Push identity: author = noreply from origin/main log (env gmail is refused); worktree agents commit with env, coordinator resets author on merge.
- 2026-11-11T21:35:00Z #1801 merged (searchBudget option on newCrosswordDays, tests ~0.8 s + ~0.9 s module load).
- 2026-11-11T21:40:50Z #1802 merged (contracts: MixKindSchema from EntrySchema, WeightedKindSchema removed, origin-language.ts split; typecheck of all contracts dependents green). Waiting for #1806.
- 2026-11-11T21:48:31Z #1806 merged; all W1+W2 code tickets in chore/1800-core-cleanup (pushed, mobile/core/contracts/config/language-pack green, pnpm deps clean). Code review agent running locally (branch chore/1800-review). #1792 still open → #1807 and PR wait.
- 2026-11-11T21:55:24Z Review fix merged (14 commits, all noreply). HANDOFF for the successor: (1) wait until gh api repos/ToxaNn1/slovo/pulls/1792 -q .merged is true; (2) #1807 on chore/1800-core-cleanup: remove the old address from .github/workflows/commitlint.yml line ~95 (the second -e) and commitlint config, never type it; (3) git merge origin/main (no rebase), checks; (4) open PR to main with title/body from PR.md on this branch, no auto-merge; (5) wait CI green, fix; (6) STATUS: FINISHED, WAVES.md status finished, Ukrainian final message. Commit author: export GIT_AUTHOR_EMAIL/GIT_COMMITTER_EMAIL from `git log -1 --format=%ae origin/main` (noreply) in the same command, else GitHub refuses the push.
- 2026-11-11T21:55:36Z WAITING until 22:20Z for #1792 merge
- 2026-11-11T22:21:53Z STOP at 153k context: #1792 still open after 25 min wait. Successor continues from step (1) of the HANDOFF above.
- 2026-11-11T22:48:04Z safety net takeover (last commit 2026-11-11T22:21:53Z)
- 2026-11-11T22:48:55Z #1792 still open (auto-merge on, mergeable, blocked): its CI and Commit messages runs from 20:26Z and 20:48Z are queued with no jobs; no Actions run anywhere in the repo since then (githubstatus: operational). Likely an Actions billing/minutes or account limit; owner notified. #1807 and the PR stay blocked; re-running CI is not a fix.
- WAITING until 2026-11-11T23:45:00Z: GitHub Actions to pick up queued runs, then #1792 merge
- 2026-11-11T23:59:28Z safety net takeover (last commit 2026-11-11T22:48:55Z)
- 2026-11-12T00:00:25Z #1792 still open/blocked; repo Actions runs from 20:26Z and 20:48Z still queued, none newer. Wave stays blocked on GitHub Actions; no work possible.
- WAITING until 2026-11-12T01:00:00Z: GitHub Actions to run queued #1792 checks, then #1792 merge; successor resumes from HANDOFF step (1)
- 2026-11-12T01:04:53Z safety net takeover (last commit 2026-11-12T00:00:25Z)
- 2026-11-12T01:04:53Z #1792 still open/blocked; CI/Commit messages runs from 20:26Z and 20:48Z still queued, no newer Actions runs. No work possible.
- WAITING until 2026-11-12T02:00:00Z: GitHub Actions to run queued #1792 checks, then #1792 merge; successor resumes from HANDOFF step (1)
- 2026-11-12T02:04:52Z safety net takeover (last commit 2026-11-12T01:05:27Z)
- 2026-11-12T02:04:52Z #1792 still open/blocked; CI/Commit messages runs from 20:26Z and 20:48Z still queued, no newer Actions runs. No work possible.
- WAITING until 2026-11-12T02:59:00Z: GitHub Actions to run queued #1792 checks, then #1792 merge; successor resumes from HANDOFF step (1)
- 2026-11-12T03:14:26Z safety net takeover (last commit 2026-11-12T02:05:34Z)
- 2026-11-12T03:14:52Z #1792 still open/blocked; CI/Commit messages runs from 20:26Z and 20:48Z still queued, no newer Actions runs. No work possible.
- WAITING until 2026-11-12T04:00:00Z: GitHub Actions to run queued #1792 checks, then #1792 merge; successor resumes from HANDOFF step (1)
- 2026-11-12T04:04:33Z safety net takeover (last commit 2026-11-12T03:14:52Z)
- 2026-11-12T04:05:15Z #1792 still open/blocked; CI/Commit messages runs from 20:26Z and 20:48Z still queued, no newer Actions runs. No work possible. Note: env author email is the private one (push rejected GH007); commit with the noreply address via GIT_AUTHOR_EMAIL/GIT_COMMITTER_EMAIL.
- WAITING until 2026-11-12T05:00:00Z: GitHub Actions to run queued #1792 checks, then #1792 merge; successor resumes from HANDOFF step (1)
- 2026-11-12T05:05:07Z safety net takeover (last commit 2026-11-12T04:05:15Z)
- 2026-11-12T05:05:29Z #1792 still open/blocked; CI/Commit messages runs from 20:26Z and 20:48Z still queued, no newer Actions runs. No work possible.
- WAITING until 2026-11-12T06:00:00Z: GitHub Actions to run queued #1792 checks, then #1792 merge; successor resumes from HANDOFF step (1)
- 2026-11-12T06:04:51Z safety net takeover (last commit 2026-11-12T05:05:29Z)
- 2026-11-12T06:05:19Z #1792 still open/blocked; CI/Commit messages runs from 20:26Z and 20:48Z still queued, no newer Actions runs. No work possible.
- WAITING until 2026-11-12T07:00:00Z: GitHub Actions to run queued #1792 checks, then #1792 merge; successor resumes from HANDOFF step (1)
- 2026-11-12T07:04:51Z safety net takeover (last commit 2026-11-12T06:05:19Z)
- 2026-11-12T07:05:33Z #1792 still open/blocked; CI/Commit messages runs from 20:26Z and 20:48Z still queued, no newer Actions runs. No work possible.
- WAITING until 2026-11-12T08:00:00Z: GitHub Actions to run queued #1792 checks, then #1792 merge; successor resumes from HANDOFF step (1)
