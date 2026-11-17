# #1951 notes

- API: `services.list` now answers `costs { monthlyTotalUsdCents, nextCharge { on, amountUsdCents, serviceIds } | null }`; new `services.add` (POST /admin/services) and `services.editMoney` (PUT /admin/services/{id}/money), Власник only (securityWrite), ReasonSchema reason, CONFLICT `unknown` / `name-taken`.
- `ReasonSchema` moved from admin.ts to `packages/contracts/src/api/reason.ts` (services.ts cannot import admin.ts: cycle). #1952 should import it from there.
- `SERVICE_BLOCK` (200x88) moved to contracts; canvas.tsx uses it; the backend places a new Service on a 300x140 grid, 20 px clear.
- server-core `services/money.ts`: `createServiceMoneyBook` + `ServiceMoneyStore` (separate from `ServiceStore` to keep merges with #1952/#1956 small). Backend wiring: `serviceMoney` key in app.ts/api.ts/admin-procedures.ts, 3rd arg of `servicesProcedures`.
- Action log: `service.add` (fields entered), `service.money.edit` (name + changed fields only, before/after; no row when nothing changed).
- Next charge: Kyiv day, today included, price > 0 and billing day set; day past month end -> last day.
- Limits are not editable by the Власник in this ticket (spec lists plan, price, billing day); added Services start with no limits and no links.
- Tests: apps/backend/src/services/services-money.test.ts, services-costs.test.ts; apps/admin/src/services-money.test.tsx.
