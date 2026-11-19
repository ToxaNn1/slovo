---
summary: One catalogue in `@slovo/contracts` (`feature-switch-catalogue.ts`) holds every Feature Switch as one record (its meaning as JSDoc, its admin name and line in Ukrainian, its admin group, its dependencies); the Edition schema's keys, `DEPENDS_ON` and the admin's tables derive from it; test and fixture Editions state only the switches they set `off` or `unavailable` and take the rest `on` from it, while the real Edition still declares every switch (ADR 0089).
---

# One catalogue holds every Feature Switch

Decision of 2026-11-19, ticket #2050 (spec #2049).

**Why.** What a Feature Switch is lived in four tables keyed by the same names (the schema with its JSDoc, the admin's names and lines, the admin's groups, `DEPENDS_ON`), and the full list was restated in four fixture Editions and the Core's Edition tests. Adding, retiring or renaming one switch edited 10–13 files, and most of the edits proved nothing new.

## Decision

- **Where.** `packages/contracts/src/feature-switch-catalogue.ts`, `FEATURE_SWITCHES`: one record per switch, in the order the Edition declares them. A record holds `name` and `line` (what the owner reads in the admin), `group` (the part of the app the admin shows it under) and `dependsOn` (ADR 0040); the JSDoc above it is the switch's meaning. The compiler refuses a record without a name, a line or a group, and a dependency that is not a switch of the catalogue.
- **The admin's texts live in the contracts.** They are the owner's words for a switch, not an Edition's UI strings: the admin is one Ukrainian tool for every Edition, and no Edition translates them. Keeping them beside the key is what lets one file say everything about a switch. The group labels, which change only with the admin's layout, stay in the admin.
- **Derived.** `FeatureSwitchesSchema` is a strict object over the catalogue's keys (the generated API description is unchanged), `DEPENDS_ON` is the catalogue's `dependsOn`, and the admin's `SWITCH_TEXTS` and groups read the catalogue. `switchedOn` stays the one rule over `DEPENDS_ON`.
- **Test and fixture Editions.** `featureSwitchStates(stated)` gives every switch `on` but the ones stated; a fixture `edition.json` states only the switches it sets `off` or `unavailable`, and the test that reads it completes it with that function. The real Edition (`editions/uk/edition.json`) still declares every switch, and the schema still refuses one left out (ADR 0089).
- **Tests.** The Core's Edition tests check each generic fact once over the whole catalogue: a switch off or unavailable is not in effect, a switch left out is refused by name, and a switch off turns off exactly the switches that stand on it. No test lists switches by name to restate the mechanism.

## Consequences

- Adding a switch no code reads yet changes the catalogue, `editions/uk/edition.json` and the generated `v1.openapi.json`. Retiring one changes the same three files plus the code that reads it.
- The admin's names of the switches change in `@slovo/contracts`, not in `apps/admin`.
