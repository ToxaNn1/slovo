# Admin wave handoff (specs #1708, #1709; PRs #1743, #1746)

State (2026-11-09):
- PR #1743 (spec 1708): ready, all CI green, auto-merge (squash) on. Body has «Питання власнику». #1735 stays open (owner's first app build).
- feat/1709-admin 1d1eaaf1: every 1709 ticket merged incl. #1736 (backend + admin), #1737, Crossword days editor. Admin lint/typecheck/test green.
- #1738 merged (no v4 board on this machine: checked for consistency only; owner compares screenshots). Texts list: TEXTS-1709.md on this branch.
Next:
1. Done: #1738 merged.
2. Done (950bd738, db:generate clean, ADR 0096): After #1743 lands: merge origin/main into feat/1709-admin. ADR clash: main now has 0095 = quote check (1708); #1728's Якість ADR 0095 on 1709 must move to the next free number (fix the index and links). Migrations: renumber 1709's after main's, `pnpm --filter @slovo/backend db:generate` reports no changes.
3. Done (fixture already fixed, test green): Fix packages/content-rules/fixtures/edition.json (outdated vs Edition config schema: switches true vs "on"), its test is red.
4. code-review medium on feat/1709-admin vs main; one implementer fixes; green CI on #1746.
5. PR #1746 body: Checks, «Питання власнику» (below), Owner checks, new texts (do not block on «текст ок»); ready; auto-merge squash.
Owner questions for #1746:
- Огляд: «Активні люди» = last day, «Відвідини» = sum; shows 5 latest alerts (backend returns 20).
- Crossword days: add/edit/retire only days after today (UTC); batch rollback can still change a passed day.
- Alerts: activity drop 50 %; kill switch sends at once, others via Cron every 15 min; «Останні сповіщення» Owner only; thresholds block sits in Безпека between Агент tokens and the Action log.
Flaky under load: some backend and language-pack tests; pass alone.
- Texts: «пачка» in the admin vs «пакет» in Telegram; «Variants, 2 або 3 через кому» mixes languages.
