# Global review tails (coordination branch, never merged)
review/REPORT.md + per-area files = global review of 06.11; review/OWNER-DECISIONS-1106.md = owner decisions (items 4-7 already in main via #1749).
Progress log: append below (finding id -> branch/commit, or skipped + why).

## 09.11 wave (integration branch fix/1109-global-review-tails)
Triage files (per finding id: FIXED/SKIP-*/FIX + tickets): scratchpad triage core-a, core-b, mobile-ui, content-docs (copied to review/triage-1109/).
- T-ui-1, T-ui-2, T-ui-3, T-ui-5 -> merged ce89c7fac. T-ui-4 -> pending (implementer ran out of context).
- running: T-mobile-1..5; core-a T-account-1, T-core-1, T-dashboard-1, T-entries-1..3; core-b T-userstate-1, T-sync-1, T-mood-1, T-progress-1, T-widget-1; content T-sourcing-1..5.
- queued: core-a T-feed-1..4; core-b T-dates-1, T-notifications-1/2, T-settings-1, T-onboarding-1; content T-lp-1, T-contracts-1, T-docs-1/2, T-edition-1, T-core-1(content); T-mobile-6.

## 09.11 PR
- Draft PR #1753 (https://github.com/ToxaNn1/slovo/pull/1753), branch fix/1109-global-review-tails, head affb82d11. Not merged, not ready.
- Merged ids: T-ui-1/2/3/5; T-mobile-1/2/3/5; T-account-1, T-core-1 (core-a); T-entries-1/2/3 (E-L5 not done); T-feed-1..4; T-userstate-1, T-sync-1, T-mood-1, T-progress-1, T-widget-1; T-dates-1, T-notifications-1/2; T-sourcing-1/2/3/4 (sourcing-M2 partial, L5 skipped); T-docs-1/2.
- Finisher fixes: 29ede0df6 fix(contracts) empty standardEquivalents names the field (language-pack test); affb82d11 refactor(ui) CorrectionTypeRow guard.
- Not done, next wave: T-ui-4, T-mobile-4, T-mobile-6, T-settings-1, T-onboarding-1, T-dashboard-1, T-sourcing-5, T-lp-1, T-contracts-1, T-edition-1, content T-core-1, T-content-1 (ADR 0090); also E-L5, sourcing-L5, mobile-T6.
- Open: branch conflicts with main (#1743, #1746) -> merge main first. Local red only from env: backend tests (no Postgres), content import.test chmod-as-root.

- 09.11 main merged into fix/1109-global-review-tails (8f8187d91, tip e1b0474f8); lint/typecheck 25/25, tests core/mobile/language-pack/content green locally. Draft PR #1753 left draft for the owner. Next wave: the not-done list above.
- 2026-11-09T14:21:17Z safety net takeover (last commit 2026-11-09T13:21:58Z)
- 2026-11-09T14:22:22Z batch 1 running (local worktrees): T-ui-4, T-mobile-4, T-settings-1+T-dashboard-1, T-lp-1+T-edition-1, T-contracts-1. Batch 2 next: T-onboarding-1, T-sourcing-5, content T-core-1, T-mobile-6. T-content-1 skipped (tools/content retired under ADR 0090).
- 2026-11-09T14:22:29Z WAITING until 2026-11-09T15:45:00Z: batch 1 implementers
- 2026-11-09T14:40:10Z T-settings-1, T-dashboard-1 merged (d41525c94). Owner Q: settings writes every choice (sync stamp), only tracking is filtered. Started T-onboarding-1.
- 2026-11-09T14:42:52Z T-mobile-4 merged. Started T-sourcing-5.
- 2026-11-09T14:48:27Z merged T-contracts-1 (53a380436), T-ui-4 (2fc4ead62); fixed red breaking-changes test (tuple lost minItems in /v1 description) in api-description.ts. Running: T-lp-1+T-edition-1, T-onboarding-1, T-sourcing-5. Next: content T-core-1, T-mobile-6 (Fable).
- 2026-11-09T14:49:08Z merged T-sourcing-5 (94cb54241), T-edition-1 (d16a82704). T-lp-1 SKIPPED: the checks now live in packages/content-rules (out of scope); its branch fix/1109-lp-unique-names (71aac0c39) is local only. Started content T-core-1, T-mobile-6 (Fable).
- 2026-11-09T14:51:24Z merged T-onboarding-1. Running: content T-core-1, T-mobile-6.
- 2026-11-09T14:56:00Z merged content T-core-1. Running: T-mobile-6.
- 2026-11-09T15:09:08Z merged T-mobile-6 (aafa43c27). Running: leftovers E-L5, sourcing-L5, mobile-T6 (fix/1109-review-leftovers). Then root lint/typecheck, PR body, FINISHED.
- 2026-11-09T15:11:25Z root lint + typecheck green on aafa43c27; waiting leftovers agent
