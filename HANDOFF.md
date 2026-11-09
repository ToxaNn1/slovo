# Admin wave handoff (specs #1708, #1709; PRs #1743, #1746)

State (2026-11-09):
- feat/1708-content-postgres: all tickets incl. #1734; review fixes #1-#7 pushed (#8 false). An agent is merging main into it (PR #1743 conflicted), fixing doc leftovers (publish:pack, switch:off/clear in map.md, content-wave.md, README, maestro remote-switches.yaml) and waiting for CI. Open: writerOf->admit cleanup (optional).
- feat/1709-admin 7738d66d: everything merged incl. #1737, Crossword days editor, #1736 part A (backend). @slovo/admin typecheck RED until #1736 part B (branch feat/1736-alerts-admin: mocks for alertThresholds/setAlertThreshold/latestAlerts, thresholds screen, Огляд «Останні сповіщення» on latestAlerts) is merged.
Next:
1. Merge feat/1736-alerts-admin into feat/1709-admin; then merge feat/1708-content-postgres again.
2. Fix: packages/content-rules/fixtures/edition.json outdated (switches true vs "on"); prettier on packages/core/src/edition/install-id.test.ts.
3. #1738 visual pass last (texts listed in the PR, do not block on «текст ок»; Telegram texts are in the #1736 part A DONE commit body).
4. #1735 stays open: needs the owner's first app build.
5. code-review medium on feat/1709-admin vs main, one fix implementer, green CI on #1743 and #1746; merge #1743 first, then update #1746 from main, auto-merge.
Owner questions («Питання власнику»):
- Keep CI job «Contract and Language Pack» (default keep). CLAUDE.md Edition line after #1734: owner edits.
- Огляд: «Активні люди» = last day, «Відвідини» = sum.
- Crossword days: edit/retire/add only days after today (UTC); batch rollback can still change a passed day.
- --override import retires missing Entries; Curated Collections/Crossword Days missing from the folder stay.
- Alerts: activity drop 50 %; kill switch sends at once, others via Cron every 15 min; «Останні сповіщення» Owner only.
Flaky under load: some backend and language-pack tests; pass alone.
