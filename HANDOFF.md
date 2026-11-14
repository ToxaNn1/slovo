# Games board wave #1880 — coordinator handoff
STATUS: ACTIVE
Coordinator: CLOUD session_01VefVQUUP6Lq9nRKxM2WCHR (moved from the laptop 15.11 ~00:35 on the owner's «можеш усю роботу в хмару перекинути і працювати там без мене»). Laptop coordinator mcp:launch:cb3440f7 retired.
Grant (GRANT.md): commits, pushes, PRs, PR merges to main (batch PRs, squash auto-merge on green), no owner questions (coordinator defaults in the PR body), NO idle. NOT: force-push, branch deletion, EAS builds. #1894 waits for the owner's «текст ок» (default; build everything else).
Scheme: skill mattpocock-skills:implement-spec + docs/agents/waves.md. Implementers = background subagents in your session, each in its own worktree on its ticket branch, brief = BRIEF-TEMPLATE.txt (fill NUM/BRANCH), model opus; merges via a merger subagent; push the integration branch after each merge. At most 5 implementers at once; never two on the same hot file (strings.json, edition.json, CONTEXT.md, ADR index).
All tickets in the cloud now, #1889 and #1895 too: no simulator/screenshots; #1895 = code-level pass against the spec + the phone check list in the PR body «Owner checks».
Integration branch: feat/1880-games-board (from #1879 head 29b6653c2). If #1879 merges to main (or anything lands on main), merge origin/main into it the same turn.
Reserved: ADR 0137–0139 (#1881); no migrations.
Lane: packages/core/src/game*, packages/ui/src/game, apps/mobile/src/game, editions/uk/strings.json game keys; #1881 alone touches contracts/edition.json/CONTEXT.md/docs/adr.
Inputs: gh issue view 1880 (spec) and 1881–1895; TESTING.md; OWNER-DECISIONS.md; HANDBOOK-igry.md = owner's handbook page «Ігри» (cloud has no handbook folder: name the page changes in the PR body, keep this copy updated).
Graph: 1881,1882 → 1883(1881) 1884(1881,1882) 1885(1881,1882) 1886(1881) 1892(1881,1882) 1893(1881) → 1887(1884,1885) 1888(1885) 1889(1885) 1890(1885,1886) 1891(1885) → 1894(owner+1893) → 1895(all but 1894).
Batches to main: after 3–5 merged tickets run Skill code-review on the batch, one implementer fixes, PR ready, gh pr merge --auto --squash; then merge origin/main back. Draft PR opens after the first merge.
Never end your turn while work remains; wait with one blocking command; push a `WAITING until <UTC>` line here before any wait >10 min. At the very end: `STATUS: FINISHED` first line.
## State
- #1882: cloud session_01VefVQUULN8q6pRKMn53P9H working on chore/1882-split-game-round; it ends with a `chore: DONE #1882` (or FAILED/STUCK) commit on that branch — wait for it (git ls-remote/fetch loop), then merge.
- #1881: NOT started in the cloud yet. Partial uncommitted laptop work saved as WIP commit 8a61a6885 on origin/chore/1881-rules-first (switches declared in contracts, fixtures, edition.json, openapi, shown.ts — unverified). Launch an implementer on that branch to finish the ticket (ADRs 0137–0139, ADR 0052, CONTEXT.md, strings, tests). START IT FIRST.
## Log
- 15.11 00:20 owner night grant; 00:35 moved to the cloud.
