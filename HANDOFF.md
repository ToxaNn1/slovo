# Admin wave handoff (specs #1708, #1709; PRs #1743, #1746)

State (2026-11-09):
- feat/1708-content-postgres: every ticket incl. #1734 merged. Code review done; fixes running on the branch (findings were in the coordinator scratchpad, rerun `code-review medium` if lost).
- feat/1709-admin f550a3e5: #1710-#1733 (minus 1731), #1737 merged, plus 1708 at 83a1816c.
- Running: #1736 on feat/1736-telegram-alerts; Crossword days editor on feat/1733-crossword-days-editor (decisions: flags enum unchanged in /v1; edit/retire only days after today UTC).
Next:
1. Merge #1736 and the crossword branch into feat/1709-admin, then 1708 again (after its review fixes).
2. #1738 visual pass last (texts listed in the PR, do not block on «текст ок»).
3. #1735 stays open: needs the owner's first app build.
4. code-review medium on feat/1709-admin vs main, one fix implementer, green CI on #1743 and #1746; merge #1743 first, then update #1746 from main, auto-merge.
Owner questions for PR bodies («Питання власнику»):
- Keep CI job «Contract and Language Pack» (default: keep, it checks the /v1 contract).
- CLAUDE.md Edition line after #1734: owner edits it.
- Огляд: «Активні люди» = last day of the period, «Відвідини» = sum (default as built).
- Crossword days: published days never change (edit only future days, UTC).
Flaky under load: backend content-cli «adds the drafts in one batch», content-writes «refuses a save that breaks a rule».
