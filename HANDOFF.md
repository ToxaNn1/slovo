# Word Meaning question wave (spec #1831) — cloud coordinator handoff

## Grant (owner, 14.11)
«окей, але будь ласка зроби це в хмарі, дозвіл на пуш коміт і PR і мердж даю» = commits, pushes, one PR to main, squash auto-merge on green after the code review. Nothing else merges to main.

## Work
- Spec #1831; tickets #1832 -> #1833 -> #1834 (linear chain, native blocked_by set). Decisions: ~ spec body; board look in #1834.
- Run it by the skill mattpocock-skills:implement-spec (read its SKILL.md in the plugin cache; follow every step) plus docs/agents/waves.md and docs/agents/ticket-brief.md.
- Integration branch: feat/1831-word-meaning from origin/main. Draft PR after the first merge, body closes #1831 #1832 #1833 #1834.
- Implementers: background Agent subagents, isolation worktree, Skill mattpocock-skills:tdd, merge the integration tip before DONE. #1832 and #1834 on Opus, #1833 on Fable (Core logic). Merges via a merger subagent. Then Skill code-review on the branch, fixes in one implementer, mark PR ready, `gh pr merge --auto --squash`.
- ADR 0127 is reserved for this wave (check docs/adr/README.md; take the next free if taken).
- #1834 screenshot (ADR 0126): no simulator in the cloud. Write it under «Questions for the owner» in the PR: the laptop takes it after the merge. Handbook page «Швидке питання»: name the page and what changed in the PR body (no handbook folder in the cloud).

## Rules (every brief, subagents included)
- Commit with plain `git commit`; never `git -c user.email=...`, never any command with the owner's email; no `&` / `nohup`.
- Conventional Commits, types feat/fix/docs/chore/test/refactor only (no `style:`), scopes from commitlint.config.js. Never the word «claude» or a `claude/...` branch name in a commit message; no Co-Authored-By, no AI attribution in commits/PR.
- Token rules of CLAUDE.md; test/lint output through tail; STUCK with what remains near the context limit.
- Never end your turn while work remains; wait with one blocking command. Before a wait over 10 min push `WAITING until <UTC ISO>: <what>` to the log below. At the end: `STATUS: FINISHED` in the log and `status: finished` for wave word-meaning-1831 in origin/coord/safety-net:WAVES.md.
- Open owner questions: take the default, record it in the PR «Questions for the owner». Never wait for the owner.

## Log
- 14.11 local coordinator: spec, tickets, grant, this handoff; cloud coordinator launched.
- 14.11 cloud coordinator: started; implement-spec plugin absent in cloud, ran by docs/agents/waves.md; integration feat/1831-word-meaning = main a1a3d6e6; ADR 0127 free; lane packages/core, apps/mobile, packages/ui, editions/uk, packages/contracts, CONTEXT.md, docs/adr; #1832 implementer (Opus, worktree) launched.
- WAITING until 2026-11-14T13:42:38Z: #1832 implementer (polling in 20 min blocks)
