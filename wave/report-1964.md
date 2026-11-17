# #1964 report

- Branch feat/1964-ota-channels, commit 8379650b (integration tip already merged, nothing new).
- Workflow `.github/workflows/ota-update.yml`: inputs action (publish|widen|promote), channel (beta|production, default beta), rollout, message, update-group, deployment-address (empty = production Deployment = EXPO_PUBLIC_SLOVO_API_URL read from EAS env `production`). Fixes the broken `.updateChannel` read. No push, no schedule.
- Check: `apps/mobile/ota-plan.ts` (dependency-free, run as `node apps/mobile/ota-plan.ts`, Node 22.23 strips types), Vitest `apps/mobile/ota-plan.test.ts` (16 tests: unknown channel/action refused, production or promote + other address refused, channels == UpdateChannelSchema). Dry run of the publish step with a fake npx: staging path gets the staging address and no POSTHOG key; production path unchanged (`--environment production`).
- Promote: `eas update:republish --group <beta group> --destination-channel production --platform ios --rollout-percentage N --private-key-path ... --json`; creates a NEW group id on production with the same bundle (EAS cannot keep the id); widen that new id later. Refuses a source group whose message carries `[built against <address>]` (mark added to every non-production publish), read via `eas update:view <group> --json` `.[0].message` (fails closed if unreadable).
- Unverified without eas (owner check after Apple, ticket 6): that `update:republish` takes `--destination-channel` and `--rollout-percentage` in eas-cli 24.13, that `update:view --json` has `.[0].message`, and that `eas update` without `--environment` inside `env:exec` takes the overridden variables. Each fails closed, never publishes wrong.
- Checks: lint, typecheck, test for @slovo/mobile green; prettier on changed files; knip shows no new finding (pre-existing ones only).
- ADR: amendment section in 0167 + README index line. Handbook page: release channels page of ticket 1.
- Cost: one extra `eas env:exec` call per run (reads one variable), runs only by hand; no requests to staging, nothing scheduled.

## Handbook text (page about beta, production and staging, section «Як випустити оновлення»)

**Випустити оновлення для тестувальників (beta).** GitHub → Actions → OTA update → Run workflow. Дія `publish`, канал `beta`, частка (наприклад `100`, бо тестувальників двоє), опис змін у «message». Поле адреси Deployment залиш порожнім: оновлення говоритиме з робочим сервером. Щоб перевірити на staging, впиши `https://staging.slovoapp.org`: таке оновлення не шле аналітики і ніколи не потрапить до читачів. Після запуску в підсумку буде «Update group» — збережи цей номер.

**Перевести перевірене оновлення до читачів (promote).** Знову Run workflow: дія `promote`, канал `production`, частка (почни з `10`), у «update-group» — номер групи з beta. Адресу не чіпай. Читачі отримають рівно той самий код, що бачили тестувальники. Оновлення, зібране для staging, workflow відмовиться переводити.

**Розширити частку.** Дія `widen`, у «update-group» — номер групи, який workflow показав після publish чи promote, і нова частка (наприклад `50`, потім `100`).

**Що workflow не дозволить.** Невідомий канал; канал `production` з будь-якою адресою, крім робочого сервера; promote без номера групи.
