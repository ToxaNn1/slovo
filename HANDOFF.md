STATUS: RUNNING
WAITING until 13:34Z for the fixer (fix-report.md in scratchpad)
# Coordinator handoff — Feed f5 wave, spec #1842

## Grant
Commits and pushes on coord/weekly-1842, feat/1842-weekly-board, feat/1843-*, feat/1844-*, feat/1845-* only. NO PR to main, NO merge to main. Plain `git commit`; no command with the owner's email; no AI attribution; no & or nohup.
Lane: packages/core/src/feed/, packages/ui/src/feed/, apps/mobile/src/app/feed.tsx, apps/mobile/src/feed/, feed state in apps/mobile/src/, editions/uk/strings.json, packages/contracts/src/edition-strings/, CONTEXT.md, docs/adr/. ADR 0130–0131 only. No new Feature Switch, no edition.json, no package.json. Board: docs/design/export/XFeed.dc.html f5.

## Order
#1843 (Core + ADR + glossary) → #1844 (week card + shared page) → #1845 (Yesterday quiz). Then code-review, one fixer, final DONE commit on feat/1842-weekly-board.
Implementers: Opus subagents (Agent tool, worktree), each pushes its ticket branch; coordinator merges into feat/1842-weekly-board.

## State
- #1843: DONE, merged into feat/1842-weekly-board, core checks green. Report: commit body of origin/feat/1843-feed-f5-core tip. Owner identity: .github/owner-email via scratchpad og.sh (gmail push is refused by GitHub email privacy).
- #1844: DONE, merged. Report: tip body of origin/feat/1844-feed-f5-week. Known red: mobile swipe-marks-on-screen «leave Yesterday» test, handed to #1845.
- #1845: DONE, merged; all lane checks green (core, ui, mobile, contracts, deps, prettier).
- Code review: done, 10 findings (scratchpad review.md). Fixer running, pushes onto feat/1842-weekly-board.

## Next
On each DONE: fetch, merge --no-ff into feat/1842-weekly-board, run package checks, push, launch next.
Note: cloud-setup Postgres failed (not needed for this lane); pnpm install done by hand.
