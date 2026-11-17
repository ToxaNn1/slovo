# #1953 report (branch feat/1953-vault-unlock, tip 2e58c36, merged feat/1949-services c329ac1)

No migration. The unlock window lives in backend memory, keyed by the admin session token (Map in createServiceEntries, clock injected); a restart or sign-out locks again.

- contracts services.ts: unlockVault (POST /admin/services/vault/unlock {code} -> {openUntil}; WRONG_CODE 400 {attemptsLeft}, TOO_MANY_REQUESTS {retryAfterSeconds}, VAULT_OFF), revealEntry / copyEntry (POST /admin/services/entries/{id}/reveal|copy -> {value}; LOCKED 423, VAULT_OFF, NOT_FOUND). v1.openapi.json regenerated.
- server-core: AdminSignIn.confirmTotp(email, totp) reuses spendTotp (step newer than last spent, so the sign-in code is refused) with its own attempt key adminTotpConfirm:<email> (3 then 15 min). ServiceEntries.unlock(session) / read(id, 'reveal'|'copy', session, who); VAULT_OPEN_MS = 15 min; log rows service.entry.reveal|copy {service, entry, type}, reason null.
- backend: EntryAccess.ownerOf now returns {who, session}; signIn passed in; app.ts passes clock. Test vault-unlock.test.ts (6 cases, vi.setSystemTime): locked/open/locked at 16 min, per session + sign-out, wrong/used code + block, log without value, NOT_FOUND + VAULT_OFF, Адмін FORBIDDEN.
- admin: SealedValue in service-entries.tsx (Показати/Сховати, Копіювати, status «Скопійовано»), vault-unlock-dialog.tsx (native dialog «Відкрити сховище», «Код із застосунку»). A read answering LOCKED opens the prompt, then retries. Hide timer starts with the value (30 s). Mock fixtures/handlers. 3 tests in service-entries.test.tsx (fake timers, clipboard).
- docs: ADR 0164 paragraph «The TOTP unlock» (no new ADR).

Checks: lint, typecheck, test of admin, backend, contracts, server-core green; flakes seen only under parallel turbo load: backend «permission denied to terminate process» (rerun green), admin services-money.test.tsx once (green alone).
Foreign issues on the integration tip (not mine, untouched): oxlint no-unsafe-optional-chaining in apps/backend/src/services/usage-sources.test.ts:188; prettier warns apps/admin/src/services-currency.test.tsx.

Owner questions (safe defaults taken):
1. Unlock window in memory: a backend restart/redeploy locks the Vault (default: yes, acceptable).
2. Successful unlock itself is not written to the Action log, only reveal/copy (default: no row).
3. Wrong unlock codes have their own limit apart from sign-in (default: separate, 3 then 15 min).
Handbook «Сервіси»: «Показати» і «Копіювати» просять свіжий код TOTP і відкривають сховище на 15 хвилин лише в цій сесії; показане значення ховається за 30 с, «Копіювати» кладе його в буфер без показу, а кожен показ і копіювання йде в Журнал дій без значення.
Cost: no outside API.
