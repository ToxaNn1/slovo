# Review of feat/1949-services (spec #1949), tip 1e31fa5

## Confirmed

1. **An edit opens a sealed value outside a reveal** — `packages/server-core/src/services/service-entries.ts` `edit()`
   called `vault.open(entry.value.sealed)` to compare the old value with the new one. The spec says a sealed
   value is opened only inside the reveal procedure. It also meant an entry whose sealed value can't be opened
   (a changed or damaged `VAULT_KEY`) could not be overwritten: the edit failed with a 500. Verdict: confirmed, fixed.
   Now a new value given for a sealed entry counts as changed without opening the old one; open entries still compare.
   Test: `apps/backend/src/services/service-entries.test.ts` "change a sealed value without opening the old one".

## Checked, no finding

- Authorization: every `services.*` procedure goes through `admit(..., { security: true })` / `ownSession`; an
  Адмін gets FORBIDDEN and an Агент bearer gets FORBIDDEN (`writesContent` false). Tests cover both roles.
- Vault leaks: list/add/edit answers drop sealed values (`shownOf`); Action log rows hold service, entry id,
  type, field names only; reveal/copy log the entry without the value; config errors print no values;
  `.env.example` holds no values; `leak.test.ts` covers `services.list`. Errors thrown name only ids/types.
- Unlock window: per admin session token, in memory, injected clock, expired windows pruned; reveal/copy check
  vault-off then the window; `confirmTotp` spends the TOTP (no reuse of the sign-in code) with its own 3-try limit.
- Service-limit Alert dedupe: key `service-limit:<Service>:<limit>:<YYYY-MM>` on the unique `alerts.key`
  with `onConflictDoNothing`; read only in the first run of a UTC hour; cron readings skipped.
- Parsing at the edge: provider answers via `readJson` + zod; NBU via zod; stored rows parsed with
  `ServiceEntryTypeSchema` / `ServiceKindSchema` / `KeptRateSchema`; inputs are `strictObject` with `ReasonSchema`.
- CLAUDE.md: Core (`server-core`) has no React imports; no `!` / `@ts-expect-error` in the diff. The `as` casts on
  `request.json()` in test fakes (`fake-railway.ts`, two tests) follow the existing test pattern on an `any`
  body: dropped as not silencing a compiler error.

## Dropped (speculative)

- `alertText` with a 0 limit: limits are hard-coded positive constants.
- Clipboard write failing after a copy was logged: the value did reach the client; UI says it failed.
