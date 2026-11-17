# A Rule targets the Update channel

Owner decision of 2026-11-17 (spec #1961). A Rule targets Edition, app version, platform, the phone's region, a share of readers, signed-in state and a schedule (ADR 0089), but cannot target the owner's testers. ADR 0167 gives the app two Update channels, `beta` for testers and `production` for readers. This ADR amends ADR 0089: a Rule gets one more target, the channel.

**A tester is whoever runs the `beta` build.** `RuleTargets` gets an optional `channel`, `beta` or `production`, the contracts' `UpdateChannelSchema`; an unknown value is refused when parsed. There is no list of Accounts or Install ids: a named tester list stays out of scope (spec #1961).

**The device matches it against its own Update channel.** The Core switch evaluator reads the channel from the device facts (`deviceFacts.updateChannel`, ADR 0167) and combines it with the other targets as every target is combined: all the targets named must match. A development build or Metro has no channel, so no Rule with a channel target matches there. An app that does not know the target skips the Rule alone, as ADR 0089 skips every Rule it does not understand.

**The backend stores and serves it like any target.** The targets are one `jsonb` column, so no migration is needed; a Rule with a channel target never matches everyone, so the backend's «on for anyone» check is unchanged.

**The admin offers it in plain words.** The «Свічі» Rule editor has a «Канал» field (усі / бета / основний), and the Rule list shows «канал бета» or «канал основний».

**Testing.** Vitest: the evaluator applies a `beta` Rule on a `beta` device and not on a `production` one or one with no channel, combines it with platform and share, and skips a Rule with an unknown channel; the contracts parse the target and refuse an unknown channel; the backend saves and serves it; the admin's Rule editor offers it, shows it and saves it.

## Considered Options

- **A tester list of Accounts or Install ids**: rejected by the spec; the `beta` build already names the testers, with no personal id in a Rule.
- **A separate Feature Switch per channel**: rejected; a target keeps one Rule list per feature and combines with the other targets.
