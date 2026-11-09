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
