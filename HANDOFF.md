# HANDOFF: wave ci-affected-1109

Coordinator: cloud. Grants (owner 09.11 «так»): commits, pushes, one PR. NO merge to main, NO auto-merge: the owner merges. Never touch feat/1108-video, apps/video or PR #1756.

## Task

Branch chore/1109-ci-affected-tests, one PR to main, implementer = Opus subagent. On pull requests, run the test parts of .github/workflows/ci.yml only for the workspace packages a change affects, at package level (Turbo affected mode against the PR base sha, dependents included). Unaffected parts pass without running (never skipped). Run all parts on push to main, workflow_dispatch, any change outside workspace packages other than docs/** and *.md, or when detection fails. Docs-only PR: no tests. ADR 0098 «Pull requests test the affected packages; main tests everything» + index line. PR body: STAR ticket text, parts table for (a) this PR, (b) docs-only, (c) one-package change (throwaway PRs closed after), «Питання власнику» with safe defaults.

Done = PR green, ready for review, no auto-merge -> `STATUS: FINISHED` first line, WAVES.md block finished.

## Log
- 2026-11-09T17:10:43Z step 0: branch created
- 2026-11-09T17:11:40Z step 0: WAVES.md block added on coord/safety-net; implementer launched on chore/1109-ci-affected-tests (Opus subagent, worktree)
- 2026-11-09T17:21:17Z PR #1758 opened (draft). Proxy appends AI footer to the body -> Commit messages check red until the owner deletes it. Next: probe PRs docs/admin/core on top of the branch
