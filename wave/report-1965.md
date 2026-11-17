# #1965 A Rule targets the Update channel — notes

Branch feat/1965-channel-rule-target, commits 12293994 (feature) + cf63f655 (merge of feat/1961-release-channels, README conflict resolved: integration's 0168 line + our 0170 line).

## Resolved (coordinator's safe default, owner question in the PR): ADR 0170 amends 0122
Commit 0d89beb5: breaking-changes.ts skips only "is new in a strict object" on `/v1/admin/` paths (isAdmin), test proves an app's strict output still flags it; v1.openapi.json regenerated with describe-api; 0122 index line "amended by 0170". Original analysis below.

## Former blocker: ADR 0031 / 0122 vs. a new target
`RuleSchema` (strict) is in admin outputs (`GET /v1/admin/editions/{id}/switches`, `PUT .../rules`, `PUT .../minimums/{platform}`). ADR 0122 holds admin outputs like every output (ADR 0031), and the breaking-change check reports
`200 body.rules[].targets.channel is new in a strict object` three times. So `pnpm --filter contracts describe-api` refuses to write `v1.openapi.json`, and two contracts tests stay red (breaking-changes.test.ts: "is broken by no change", "is the description"). CI's describe:api against the base will fail the same way. Not worked around.
Why the break is not real: the admin's `OpenAPILink` client validates no outputs (no ResponseValidationPlugin); the device reads Rules leniently (`RemoteRuleSchema` targets = record). Any future Rule target hits this same wall.
Proposed safe default (needs the owner's yes): amend ADR 0122 in ADR 0170 — "an admin output may gain an optional field in a strict object, since the admin validates no answer" — and in `packages/contracts/src/api/breaking-changes.ts` skip the "new in a strict object" line for `isAdmin(path)` (pass the path flag into responseChanges), with a test; then run describe-api. Alternative: make admin output Rule schemas plain objects per ADR 0122's text "output schemas stay plain objects" — still flagged once against the strict committed description, so it needs the same yes.

## Done
- contracts: `RuleTargetsSchema.channel = UpdateChannelSchema.optional()`; tests parse `beta`, refuse `alpha`.
- core: `SwitchFacts.updateChannel: UpdateChannel | undefined`; evaluator: `channel` must equal it (undefined matches no channel Rule). Tests: beta/production/no channel; combined with platform + share; unknown channel skipped.
- mobile: wired with no code change — `factsOf` spreads `deviceFacts`, whose `updateChannel` getter (#1962) now feeds the Rules; test reader has `updateChannel: undefined`.
- backend: jsonb targets, no migration; switch-rules test now saves and serves `channel: 'beta'`.
- admin: «Канал» select (усі / бета / основний), list shows «канал бета» / «канал основний»; test offered/shown/saved.
- ADR 0170 (amends 0089), README line + 0089 line note, glossary **Rule**.
- Checks: lint + typecheck green for contracts, core, admin, server-core, mobile, backend; tests green except the 2 contracts tests above; backend flakes (quality, patch) pass alone.
- Cost: no new requests; the Rule answer grows by ~20 bytes per Rule with a channel target.

## Handbook page «Свічі» (Ukrainian, for ~/Downloads/WORD/handbook/)
Додати в розділ про правила:

**Канал.** Правило можна дати лише тестувальникам: у полі «Канал» оберіть «бета» — правило діятиме тільки в застосунку з бета-збірки (TestFlight для вас і ще одного тестувальника). «основний» — лише для звичайних читачів з App Store, «усі» — для всіх. Канал поєднується з іншими умовами: наприклад, «бета · ios · 50% читачів» — половина тестувальників на iPhone. У списку правил це видно як «канал бета» або «канал основний». Застосунок, зібраний для розробки, не має каналу, тож правило з каналом там не діє. Старі версії застосунку, які ще не знають про канал, таке правило просто пропускають.
