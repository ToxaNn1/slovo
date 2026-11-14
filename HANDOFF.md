STATUS: RUNNING
WAITING until 12:33Z for #1843 DONE commit
# Coordinator handoff — Feed f5 wave, spec #1842

## Grant
Commits and pushes on coord/weekly-1842, feat/1842-weekly-board, feat/1843-*, feat/1844-*, feat/1845-* only. NO PR to main, NO merge to main. Plain `git commit`; no command with the owner's email; no AI attribution; no & or nohup.
Lane: packages/core/src/feed/, packages/ui/src/feed/, apps/mobile/src/app/feed.tsx, apps/mobile/src/feed/, feed state in apps/mobile/src/, editions/uk/strings.json, packages/contracts/src/edition-strings/, CONTEXT.md, docs/adr/. ADR 0130–0131 only. No new Feature Switch, no edition.json, no package.json. Board: docs/design/export/XFeed.dc.html f5.

## Order
#1843 (Core + ADR + glossary) → #1844 (week card + shared page) → #1845 (Yesterday quiz). Then code-review, one fixer, final DONE commit on feat/1842-weekly-board.
Implementers: Opus subagents (Agent tool, worktree), each pushes its ticket branch; coordinator merges into feat/1842-weekly-board.

## State
- #1843: implementer running on feat/1843-feed-f5-core (launched 12:2x UTC).
- #1844: waiting on #1843.
- #1845: waiting on #1844.

## Next
On each DONE: fetch, merge --no-ff into feat/1842-weekly-board, run package checks, push, launch next.
Note: cloud-setup Postgres failed (not needed for this lane); pnpm install done by hand.
