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
WAITING until 2026-11-15T01:22Z: running in session_01VefVQUUP6Lq9nRKxM2WCHR: #1893 continuation (feat/1893-mode-groups), #1886 (feat/1886-option-stamp), #1888 (feat/1888-letters-modes), and a merger subagent merging origin/feat/1892-game-end and origin/feat/1884-answer-banner (both DONE) into feat/1880-games-board. Each implementer ends its branch with «chore: DONE #n»/FAILED/STUCK (report in body); a successor polls those branches (waves.md loop).
- Merged + pushed on feat/1880-games-board (45c8f640): #1882 #1881 #1885 #1883. Draft PR #1896 body says Closes #1881 #1882 only: add Closes for every merged ticket (PATCH body via gh api), merge the DONE reports' Owner checks, new texts, defaults into it.
- Batch rule: 6 tickets merged after the merger: run code-review on PR #1896, one implementer fixes, then ready (POST /repos/ToxaNn1/slovo/pulls/1896/ccr/ready_for_review) + auto-merge squash (PUT .../ccr/auto_merge), wait CI with one blocking loop, then merge origin/main back.
- Remaining after: #1887 (1884,1885), #1889 (1885), #1890 (1885,1886), #1891 (1885), then #1894 (owner «текст ок» + 1893), #1895 last.
- Known defaults for the PR body: #1892 «ВЛУЧНО!» from 60% right; #1893 new string «Рекорд: {n}» for modes with no Round limit, composition.ts order line; #1885 token roundMascotWidth 88; #1884/#1885 'use no memo' list in packages/ui/eslint.config.js (ADR 0059 does not list GameHeader/AnswerBanner: owner question); #1883 changed language-pack ukrainian-game.test.ts to 3 Lives; ConfirmationDialog heights not changed (shared primitive).
- Brief: BRIEF-CLOUD.txt (fill NUM/BRANCH) + «jest --maxWorkers=2, turbo --concurrency=2» (OOM kills seen). STUCK tickets continue on their branch from the plan in the STUCK commit body.
- Authorship: commit with E=$(cat /home/user/slovo/.github/owner-email); GIT_AUTHOR_EMAIL=$E GIT_COMMITTER_EMAIL=$E git commit (env GIT_AUTHOR_EMAIL is not the CI owner address).
- GraphQL blocked: gh api repos/ToxaNn1/slovo/... REST only. Remove .claude/worktrees/agent-* after a merge (prettier --check sees them).
- Cloud setup hook may fail: pg_createcluster 18 main --port 5432, rerun .claude/hooks/cloud-setup.sh.
## Log
- 15.11 00:20 owner night grant; 00:35 moved to the cloud.
- 14.11 22:40Z cloud coordinator up; #1881 implementer launched on the WIP branch.
- 14.11 23:10Z merged #1882, #1881; draft PR #1896; launched #1883 #1884 #1885 #1892 #1893.
- 14.11 23:24Z #1884 and #1893 STUCK at context limit (Core parts done, pushed); relaunched continuations on the same branches.
- 14.11 23:52Z merged #1885 #1883 (pushed 45c8f640); #1892 #1884 DONE → merger; launched #1886 #1888.
