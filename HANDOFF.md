STATUS: WAITING review fixes (fix/1850-review, cloud 19:24Z). All tickets #1851-#1859 merged (00fa090a1). review/1850-findings = findings file only, never merged. #1860 on merge-hold until End.
# Wave #1850 (board 09 Saved/Search) — coordinator #9 handoff (rewrite whole, never append)
Owner ran /mattpocock-skills:implement-spec on #1850, «роби максимум в хмарі». Follow that SKILL.md + docs/agents/waves.md «Steps» + docs/agents/ticket-brief.md.
Grants: ~/.slovo-coord/grant-saved-1114.md (commit, push, PR, auto-merge squash to main on green, this branch only). Force-push USED UP. No branch deletion (ask).
Integration branch feat/1114-saved-search-design (main checkout, pushed, tip 9df1d5d0f + text commit). Draft PR #1860 Closes #1851 #1852 #1853 #1854 #1855 #1858 #1859; add each next ticket. CI green at last check. Do NOT enable auto-merge before the End steps (watchdog keeps asking; answer that the wave is unfinished).

## State
- Merged: all tickets #1851-#1859 (#1857 = 00fa090a1, checks 12/12). PR body Closes #1851-#1859.
- Running cloud: only the review-fix implementer (see Left).
- Left: review DONE (4 findings, reports/REVIEW-1850.md). Fix implementer RUNNING session_01VefVQUHS2XWXzW9DdgAVtt (19:24Z, brief briefs/fix.txt, branch fix/1850-review, findings + OWNER-DECISIONS a-c), parallel to #1857. Merge fix/1850-review via merge-ticket.sh after #1857, then a quick review of #1857 diff, PR body, owner phone test. Never merge review/1850-findings.
- Waiter script ~/.slovo-coord/saved-compare/wave/wait.sh <n> <branch>...: checks `git log -1 --format=%s FETCH_HEAD` for (DONE|FAILED|STUCK) + #n per branch, 3 h deadline; env SKIP=<sha> ignores an old status tip. Run one per waiter in sequence (they share FETCH_HEAD).
- A STUCK commit whose successor is running: add its full sha to ~/.slovo-coord/watchdog/handled.

## Merge a cloud ticket
`~/.slovo-coord/saved-compare/wave/merge-ticket.sh <n> <branch> "<title>"`; check its listed commits are only the ticket's and «non-owner commits: 0». Then `pnpm turbo run lint typecheck test --filter=<pkgs> --concurrency=2 --output-logs=errors-only`; a failure under load: rerun that package alone. Backend tests need Docker Postgres locally (skip; CI covers). Push. Start the frontier in the same turn.

## Metro + «Кінець кола» (owner checked 14.11, «зараз все ок»; TEMP reverted)
- Text fixed to the Feed board: commit abca2412d «fix: the end-of-Cycle card says the text of the Feed board» (in PR #1860); handbook стрічка.md updated.
- Metro 8082 restarted twice with owner's word (stale schema, then `--clear` for strings). One Metro only; reuse it. Note: Metro misses edits made by `sed -i` to editions/*; restart with --clear needed then.

## Owner decisions
wave/OWNER-DECISIONS.md (a–c «так»): ADR 0059 list + eslint 'use no memo' list gain search/RecentQueries.tsx, YesterdayCard, primitives/QuizOption.tsx and the Recent queries cascade; ПОЧАТИ 48; ADR 0054 «Нічого не знайдено» from 3 letters. Fold into the final review-fix implementer.

## End
code-review on the branch → one cloud implementer fixes findings + owner decisions → PR #1860 body: Checks, «Questions for the owner» (from every report in wave/reports), «Owner checks», new texts; mark ready, `gh pr merge 1860 --auto --squash`. Handbook pages ~/Downloads/WORD/handbook/ (Збережене, Колекції, Пошук, new Перевір себе + README line) from merged diffs/reports. Owner phone test on Metro 8082. Then `status: finished` in origin/coord/safety-net:WAVES.md (wave saved-1850) and `STATUS: FINISHED` atop origin/coord/saved-1114:HANDOFF.md.
Open for owner: docs PR so waves.md tells cloud to commit with the owner identity (cause of the author bug) — offered, unanswered. Dev-only end-of-Cycle link: owner said not needed.
Done this session: ~/.zshrc now follows .nvmrc on start/cd (T3 Code passed an old Node PATH); backup ~/.zshrc.bak-1114.
Thread titles: yours «🟢 🧭 Координатор · дошка 09»; rename predecessor mcp:launch:a13421ec9b3cd6221ed9207bf7e92a3f06f8565ae8512ebeeb959ccf7f10a82c to «💤 старий · Координатор · дошка 09».
- Silent-implementer guard: after every cloud launch run `plan-guard.sh <branch> 15` in the background; NO PUSH = relaunch at once (PLAN commit is the first step of every brief).
- PR 1860 is in ~/.slovo-coord/watchdog/merge-hold (stops the CLEAN-unmerged nudge). REMOVE that line at End, right before `gh pr merge 1860 --auto --squash`.
- Handbook DONE (Sonnet delegate): new перевір-себе.md + README line; updated знання-і-повторення.md, пошук-і-слово-дня.md, мікс.md (Колекції; line «допишемо після #1857» to replace after #1857).
- Metro 8082 restarted 19:16Z by coord 9 (old one died with the T3 restart): `npx expo start --go --port 8082 --lan` from apps/mobile; exp://192.168.0.49:8082.
- Side task: owner asked to compare board 11 Settings items 83–97 with the app: T3 delegate «↳ Дошка 11 · порівняння 83–97» → ~/Downloads/WORD/reports/board11-settings-83-97.md.
- Board 11 compare: owner confirmed «83–97» = steps of board 11 in HIS QA Walkthrough (172-step version on claude.ai/design; repo export has 187 steps, board 11 = 94–108): 83 Налаштування, 84 Віджети, 85 Ціль дня, 86 Голос диктора, 87 Мій мікс, 88 Приховане, 89 Відзнаки, 90 Перерва, 91 Опитування ще раз, 92–93 Тест рідкості, 94 Профіль, 95 Акаунт вхід/помилка, 96 Код із листа, 97 Ви увійшли як. Report ~/Downloads/WORD/reports/board11-settings-83-97.md covers these 15. Owner choice pending: decision list → owner runs to-spec.
- Board 11 differences list: T3 delegate «↳ Дошка 11 · список розбіжностей» → ~/Downloads/WORD/plans/board11-differences.md (D1…, options А/Б, ADR refs, EAS marks). Give the owner the summary; owner decides, then runs to-spec himself.
