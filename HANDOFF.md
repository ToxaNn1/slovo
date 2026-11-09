# HANDOFF: wave infra-1109

Coordinator: cloud. Grants (owner 09.11): commits, pushes, PRs. NO merge to main, except PR #1752 whose auto-merge is already on. Never touch feat/1108-video or apps/video.

## Tasks (one small PR to main each)

1. PR #1752 (docs/1109-conflict-free-waves): merge origin/main in, resolve, push, wait green; auto-merge does the rest. Add nothing else.
2. Test UI shards: ci.yml `UI` job -> `UI 1/3..3/3` via `vitest --shard` and `jest --shard`, coverage merged as for the app. No ADR.
3. Dependabot: fix open alerts (minimatch, glob, deepmerge, stream-json, uuid, esbuild) with pnpm.overrides or parent bumps; one PR `chore(deps): ...`.
4. Stryker over packages/core: devDeps, stryker.config.mjs (incremental), .github/workflows/mutation.yml (weekly + dispatch, HTML artifact, score in summary, no threshold), ADR «Mutation testing runs weekly over the Core, not on every PR» + index line; STAR ticket text in PR body, no issue.

PRs 2-4: ready for review, NO auto-merge. Colliding PRs: base the later on the earlier, say so in its body. Owner questions: safe default under «Питання власнику».

Done = every PR green -> `STATUS: FINISHED` first line, WAVES.md block finished.

## Log
- 2026-11-09T13:09:28Z step 0: branch created
- 2026-11-09T13:10:14Z task1: merged origin/main into #1752 (waves.md conflict), pushed cf500803f; CI running. Next: tasks 2+3 implementers in parallel, task 4 on top of task 3 (pnpm-lock); ADR number 0097
- 2026-11-09T13:20:01Z task1: #1752 CI green on cf500803f; task2 pushed 1a2dfa3d9 on chore/1109-ui-test-shards
- 2026-11-09T13:20:26Z task2: PR #1754 opened (chore/1109-ui-test-shards); waiting its CI and task3 implementer
- 2026-11-09T13:25:20Z task3: PR #1755 (chore/1109-dependabot, bf668aa45). #1752 merged. #1754/#1755 Commit messages red only from proxy-appended PR-body footer (owner must delete). task4 implementer on top of chore/1109-dependabot
- 2026-11-09T13:32:23Z task3: #1755 CI green except footer-caused Commit messages; waiting task4 implementer
- 2026-11-09T13:32:32Z WAITING until 2026-11-09T14:02:32Z: task4 Stryker implementer (chore/1109-stryker)
- 2026-11-09T14:02:05Z task4: implementer still running after 60 min, nothing pushed yet
- 2026-11-09T14:31:26Z task4: stryker run still in progress locally (~90 min)
