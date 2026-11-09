# Admin wave handoff (specs #1708, #1709; PRs #1743, #1746)

State (2026-11-09, later):
- #1743 merged to main (96fcc066). #1735 stays open (owner's first app build).
- feat/1709-admin 950bd738: main merged in. ADR: 1709's duplicate quote-check 0094 dropped, CI-history ADR is now 0096. Migrations 0017-0021 are 1709's (switch_rules, admin_sign_in, owner_checks, ci_runs, alerts); db:generate no changes. content-rules fixture fixed. lint/typecheck/test green.
- Review findings: scratchpad review-1709.md (part 1: invite not atomic, email format, addOwnerCheck lacks reason per ADR 0088, retire reason blank, Needs flags, tickOwnerCheck re-read). Copy kept below if the scratchpad is gone.
Next:
1. One implementer fixes the review findings on feat/1709-admin.
2. Green CI on #1746; body: Checks, «Питання власнику» (below), Owner checks, new texts (TEXTS-1709.md; do not block on «текст ок»); ready; auto-merge squash.
Owner questions for #1746:
- Огляд: «Активні люди» = last day, «Відвідини» = sum; shows 5 latest alerts (backend returns 20).
- Crossword days: add/edit/retire only days after today (UTC); batch rollback can still change a passed day.
- Alerts: activity drop 50 %; kill switch sends at once, others via Cron every 15 min; «Останні сповіщення» Owner only; thresholds block sits in Безпека between Агент tokens and the Action log.
Flaky under load: some backend and language-pack tests; pass alone.
- Texts: «пачка» in the admin vs «пакет» in Telegram; «Variants, 2 або 3 через кому» mixes languages.
