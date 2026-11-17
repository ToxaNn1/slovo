# Report #1950

Branch feat/1950-services-canvas, last commit cdd5feea (merged feat/1949-services: already up to date).

## Done
- Migration 0030_services (drizzle-generated) creates the whole `services` table: id uuid, name unique, kind (check railway|cron|metered), plan, monthly_price_usd_cents, billing_day (1..31), limits jsonb, x, y, links jsonb ({to: name, kind: constant|scheduled}). Seed INSERT of the eleven Services is appended to the generated .sql (meta untouched by hand).
- Contracts: packages/contracts/src/api/services.ts (ServiceSchema, servicesContract.list GET /admin/services) wired once as `admin.services`; ADMIN_ERRORS moved to api/admin-errors.ts so both modules share it; v1.openapi.json regenerated.
- server-core: ServiceStore port (packages/server-core/src/services/services.ts).
- Backend: apps/backend/src/services/{service-store.ts, services-procedures.ts, services.test.ts}; adminProcedures passes `admit` with security:true (writes flag ready for later tickets). leak.test.ts covers the new procedure.
- Admin: section «Сервіси» (8th, ownerOnly), routes/services.tsx, components/services/{canvas.tsx, service-panel.tsx}, mock/services-fixtures.ts, services.test.tsx. Canvas wrapper sets data-theme="dark" + bg-black with radial-gradient dots. Phone: PHONE_TITLES gets /services, Ще gets «До Сервісів» for a Власник.
- ADR 0164 + README line; 0088 and its README line amended (eight sections); CONTEXT.md: Service, Service entry, Vault; Owner admin and Власник/Адмін/Агент terms updated.

## Questions for the owner (safe defaults taken)
1. Story 4 lines name app, backend, site, Pages and the Crons, which are not among the eleven Services. Default: links mapped onto the eleven (Railway = backend; Cloudflare covers site/Pages; Expo/EAS → both stores for "EAS → app"; both stores → Railway for "app → backend"; Railway → Telegram bot dashed for the alerts Cron). "Crons → backend" has no line (same block). Kind `cron` exists for a later Cron block if wanted.
2. Seed name "Telegram bot" kept in English (language rule); could be «Telegram-бот».
3. New UI strings: «Цей розділ відкриває тільки Власник.», «До Сервісів», «Закрити» (panel), aria labels «Полотно Сервісів», «Зв’язки між Сервісами»; subtitle «Тільки Власник».

## Owner checks
- Look of the canvas against the Railway screenshot (desk width), and the right-side panel; cards on a phone. No screenshot taken (cloud session).

## Checks
lint/typecheck/test green for @slovo/backend, @slovo/contracts, @slovo/server-core, @slovo/admin; pnpm deps clean; pnpm format clean.

## Cost
No outside API called; the list is one Postgres read per page open.
