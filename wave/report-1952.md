# #1952 handoff (branch feat/1952-services-vault, tip 66efb171, clean)

Done (all committed, checks green before merge: lint/typecheck/test of admin, backend, contracts, server-core; pnpm deps; pnpm format):
- contracts: api/reason.ts (ReasonSchema moved out of admin.ts), services.ts block serviceEntriesContract (entries/addEntry/editEntry/deleteEntry, VAULT_OFF 503), spread into servicesContract; v1.openapi.json regenerated.
- server-core: services/service-entries.ts (ServiceVault on|off, ServiceEntryStore, createServiceEntries; log rows {service, entry, type, fields}).
- backend: config VAULT_KEY (44-char base64 = 32 bytes, refused if = AUTH_SECRET); services/vault.ts (AES-256-GCM, injected IV); migration 0031_service_entries; service-entry-store.ts; service-entries-procedures.ts; servicesProcedures(store, admitOwner, entryAccess); testApp `vault` option (fake key per test); tests vault.test.ts, service-entries.test.ts, operations.test.ts VAULT_KEY case.
- admin: components/services/service-entries.tsx in ServicePanel; mock fixtures/handlers; service-entries.test.tsx.
- docs: ADR 0164 paragraph, docs/deploy.md row, apps/backend/.env.example.

Open: `git merge feat/1949-services` conflicts (#1951 merged): server-core/index.ts, contracts services.ts + reason.ts (AA: both added — keep one), admin-procedures.ts, api.ts, app.ts, services-procedures.ts, admin panel/mock files, ADR 0164. Resolve keeping both blocks, regenerate v1.openapi.json with `pnpm --filter contracts describe-api`, check migration number vs #1951's (rename via drizzle if #1951 added 0031), rerun the four packages' checks, commit.

Outside my touch list: .railway/railway.ts backend env needs `VAULT_KEY: preserve()`.
