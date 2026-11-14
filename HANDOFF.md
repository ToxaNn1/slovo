# Wave #1850 (board 09 Saved/Search) — coordinator #9 handoff (rewrite whole, never append)
Owner ran /mattpocock-skills:implement-spec on #1850, «роби максимум в хмарі». Follow that SKILL.md + docs/agents/waves.md «Steps» + docs/agents/ticket-brief.md.
Grants: ~/.slovo-coord/grant-saved-1114.md (commit, push, PR, auto-merge squash to main on green, this branch only). Force-push USED UP. No branch deletion (ask).
Integration branch feat/1114-saved-search-design (main checkout, pushed, tip 9df1d5d0f + text commit). Draft PR #1860 Closes #1851 #1852 #1853 #1854 #1855 #1858 #1859; add each next ticket. CI green at last check. Do NOT enable auto-merge before the End steps (watchdog keeps asking; answer that the wave is unfinished).

## State
- Merged: #1859 #1851 #1852 #1853 #1854 #1858 #1855. Reports in wave/reports/.
- Running cloud: #1856 feat/1856-collections-screens session_01VefVQTrTs1Ao4x4jvTMFFq (launched ~17:26Z). NO push anywhere by 18:21Z; its brief wrongly said «push only feat/1852-sheet-toast» (tip 6b152cfff = #1852 DONE; watch for a #1856 commit there too). If still nothing: relaunch fresh from wave/briefs/1856.txt with the push line fixed to feat/1856-collections-screens.
- Left: #1857 after #1856: brief ready wave/briefs/1857.txt (1490 B). Launch: `script -q /tmp/cloud-1857.log claude --cloud "$(cat …/briefs/1857.txt)" </dev/null >/dev/null`.
- Waiter script ~/.slovo-coord/saved-compare/wave/wait.sh <n> <branch>...: checks `git log -1 --format=%s FETCH_HEAD` for (DONE|FAILED|STUCK) + #n per branch, 3 h deadline; env SKIP=<sha> ignores an old status tip. Run one per waiter in sequence (they share FETCH_HEAD).
- A STUCK commit whose successor is running: add its full sha to ~/.slovo-coord/watchdog/handled.

## Merge a cloud ticket
`~/.slovo-coord/saved-compare/wave/merge-ticket.sh <n> <branch> "<title>"`; check its listed commits are only the ticket's and «non-owner commits: 0». Then `pnpm turbo run lint typecheck test --filter=<pkgs> --concurrency=2 --output-logs=errors-only`; a failure under load: rerun that package alone. Backend tests need Docker Postgres locally (skip; CI covers). Push. Start the frontier in the same turn.

## Temp + Metro (owner look at «Кінець кола»)
- UNCOMMITTED TEMP in apps/mobile/src/app/feed.tsx (line `card = { kind: 'end-of-cycle' }; // TEMP-OWNER-LOOK`): every Feed card is the end-of-Cycle card. Revert with `git checkout apps/mobile/src/app/feed.tsx` when the owner says «бачив», and before any merge stash it (`git stash push apps/mobile/src/app/feed.tsx`). Never commit it.
- Text fixed to the Feed board: commit abca2412d «fix: the end-of-Cycle card says the text of the Feed board» (in PR #1860); handbook стрічка.md updated.
- Metro 8082 restarted twice with owner's word (stale schema, then `--clear` for strings). One Metro only; reuse it. Note: Metro misses edits made by `sed -i` to editions/*; restart with --clear needed then.

## Owner decisions
wave/OWNER-DECISIONS.md (a–c «так»): ADR 0059 list + eslint 'use no memo' list gain search/RecentQueries.tsx, YesterdayCard, primitives/QuizOption.tsx and the Recent queries cascade; ПОЧАТИ 48; ADR 0054 «Нічого не знайдено» from 3 letters. Fold into the final review-fix implementer.

## End
code-review on the branch → one cloud implementer fixes findings + owner decisions → PR #1860 body: Checks, «Questions for the owner» (from every report in wave/reports), «Owner checks», new texts; mark ready, `gh pr merge 1860 --auto --squash`. Handbook pages ~/Downloads/WORD/handbook/ (Збережене, Колекції, Пошук, new Перевір себе + README line) from merged diffs/reports. Owner phone test on Metro 8082. Then `status: finished` in origin/coord/safety-net:WAVES.md (wave saved-1850) and `STATUS: FINISHED` atop origin/coord/saved-1114:HANDOFF.md.
Open for owner: docs PR so waves.md tells cloud to commit with the owner identity (cause of the author bug) — offered, unanswered. Offered too: dev-only link to jump to the end-of-Cycle card — unanswered.
Done this session: ~/.zshrc now follows .nvmrc on start/cd (T3 Code passed an old Node PATH); backup ~/.zshrc.bak-1114.
Thread titles: yours «🟢 🧭 Координатор · дошка 09»; rename predecessor mcp:launch:a13421ec9b3cd6221ed9207bf7e92a3f06f8565ae8512ebeeb959ccf7f10a82c to «💤 старий · Координатор · дошка 09».
