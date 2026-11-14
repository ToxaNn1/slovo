# Wave #1861 (board 11 Settings) — coordinator handoff (rewrite whole, never append)
Owner ran /mattpocock-skills:implement-spec on #1861. Follow that SKILL.md + docs/agents/waves.md «Steps» + docs/agents/ticket-brief.md. Grant: ~/.slovo-coord/grant-settings-1861.md (no main merge, no force-push, no branch deletion, no EAS). Folder: ~/.slovo-coord/settings-1861/wave/ (briefs/, reports/, cloud-<n>.log, wait.sh).

## State (14.11 ~23:15Z)
- main = 44e4f260f. Integration feat/1861-settings-board, checked out in the main folder. Pushed tip 6cf817d16: #1862 (A+B), #1866, #1867, #1864, #1868 merged. #1863 handbook DONE (outside repo).
- Merge of #1865 (origin/feat/1865-text-size-steps) was IN PROGRESS in the main folder with conflicts (apps/mobile/src/app/settings/index.tsx + settings-screen.test.tsx); a merger subagent of coordinator #1 was at `pnpm format` just before its commit (23:52). FIRST: `git status`; if still conflicted and no one is on it, resolve (keep #1864's list structure, add #1865's text size) and commit; run `pnpm turbo run typecheck test --filter=@slovo/mobile --filter=@slovo/ui --filter=@slovo/core --output-logs=errors-only | tail`; push.
- DONE, not merged yet: #1870 feat/1870-questionnaire-retake, #1869 feat/1869-hidden-list, #1874 feat/1874-daily-goal-screen (then #1877 can start). Merge each (`git fetch origin <b>; git merge --no-ff -m 'chore: merge #n: <title>' origin/<b>`), checks, push; save `git log -1 --format=%b origin/<b>` to reports/<n>.md.
- Running in cloud (each needs a waiter: `wait.sh <n> <branch>` as a background Bash):
  #1871 feat/1871-rarity-test-result · #1872 feat/1872-profile-name · #1873 feat/1873-account-screen · #1875 feat/1875-privacy-export
- Draft PR #1879 (Closes #1862–#1877), link it to your thread.
- origin/chore/1862-board11-switches (ecb28d0d1, STUCK) = safety-net duplicate of #1862B: ignore.
- Metro running on 8082 from the main folder (owner tests on phone; reuse, never restart).
- Owner asked status every 5 min: create a session cron `*/5 * * * *` with a short Ukrainian status (tips via `git ls-remote origin 'refs/heads/feat/18[67]*'`, what is merged, what runs next; never merge to main).
- PR body «Questions for the owner»: from «Питання» in reports/ (1862B, 1864–1870 …).

## Next
Remaining to launch: #1876 (Core then sheet; #1864 merged), #1877 (after #1865 + #1874 merged). #1878 waits for owner «заграва» Recordings. Brief template briefs/1873.txt (sed branch, number, last seams line). ≤5 cloud at once.
End: all merged → code-review on the integration branch → one fixer → handbook check (reports name pages) → PR body (Questions, Owner checks, new texts) → mark ready; main merge only on the owner's word. Then WAVES.md (origin/coord/safety-net) status finished.
