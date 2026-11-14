# Wave #1850 (board 09 Saved/Search) — coordinator #8 handoff (rewrite whole, never append)
Owner ran /mattpocock-skills:implement-spec on #1850, «роби максимум в хмарі». Follow that SKILL.md + docs/agents/waves.md «Steps» + docs/agents/ticket-brief.md.
Grants: ~/.slovo-coord/grant-saved-1114.md (commit, push, PR, auto-merge squash to main on green, this branch only). Force-push grant ~/.slovo-coord/grant-force-push-saved-1114.md is USED UP: never force-push again. No branch deletion.
Integration branch feat/1114-saved-search-design (main checkout on it, pushed). Draft PR #1860 (Closes #1851 #1859 so far; add #1852 #1853 #1854 and each next ticket to its body).

## State
- Merged: #1859, #1851, #1852, #1853, #1854 (coord fixed #1854's STUCK: test reads groupByLocalDay from its module; barrel exports dropped). groupByLocalDay is now used only by its tests: raise in the final code-review.
- Running cloud (briefs in wave/briefs/<n>.txt):
  - #1855 feat/1855-due-quiz session_01VefVQSQztGPy3y3tUS8xL7
  - #1856 feat/1856-collections-screens session_01VefVQTrTs1Ao4x4jvTMFFq. Its brief wrongly said «push only feat/1852-sheet-toast»: look for the `#1856` status commit on BOTH branches.
  - #1858 feat/1858-search-screen session_01VefVQSUvXjpAJDBQAtZyc3
- Left: #1857 (after #1856; it writes the undo mechanism into ADR 0132). Build its brief from wave/briefs/1855.txt with sed using `|` as the delimiter (branch names hold `/`).

## How to merge a cloud ticket (author fix)
Cloud commits can carry the author noreply@anthropic.com, and CI «Commit messages» then fails. Never merge origin/<branch> directly. Use `~/.slovo-coord/saved-compare/wave/merge-ticket.sh <n> <branch> "<title>"`. It rewrites authors locally and prints «non-owner commits: 0». Then CHECK its listed commits: if it replays #1859 commits again (a branch that also holds the pre-force-push history 6e3a7a6a8), `git reset --hard HEAD~1` (not pushed yet), cherry-pick only the ticket's own commits (`--allow-empty`) in a scratch worktree, and merge that. Run the changed packages' checks with `--concurrency=2` (under load, tests fail at random; rerun one package alone before calling a failure real). Push. Start the new frontier in the same turn. Waiter per branch: the until-loop of waves.md (3 h deadline).

## End
code-review on the branch → one cloud implementer fixes → PR #1860 body: Checks, «Questions for the owner» (from every report), «Owner checks», new texts; mark ready, `gh pr merge 1860 --auto --squash`. Write the handbook pages ~/Downloads/WORD/handbook/ (Збережене, Колекції, Пошук, new Перевір себе + README line) from the merged diffs (the #1851 report lists the contents). Metro 8082: start ONE only for the owner's phone test. Then set `status: finished` in origin/coord/safety-net:WAVES.md (wave saved-1850) and `STATUS: FINISHED` at the top of origin/coord/saved-1114:HANDOFF.md.
Open for the owner: docs/agents/waves.md still tells cloud to use plain `git commit` (that caused the author bug); suggest a small docs PR.
Thread title: «🟢 🧭 Координатор · дошка 09»; rename the predecessor «💤 старий · Координатор · дошка 09».
