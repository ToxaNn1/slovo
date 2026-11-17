Closes #1962, closes #1963, closes #1964, closes #1965, closes #1966

## What changed

The release channels and staging wave (spec #1961), built on the integration branch `feat/1961-release-channels`. #1967 (App Store Connect) waits for the Apple Developer purchase and is not part of this PR.

- #1962: two Update channels, `production` and `beta`. The `testflight` profile is replaced by `beta` and `production` store profiles in `eas.json`, each naming its channel. The channel stays out of the fingerprinted app config, so both profiles give one runtime version (ADR 0062), and a release build with a missing or unknown channel throws. The app reads the channel as `deviceFacts.updateChannel`, and About shows it beside the version, build and update id. ADR 0167 amends 0007 and 0062.
- #1964: `ota-update.yml` takes an action (`publish`, `widen` or `promote`), the channel (`beta` or `production`), the Rollout share, an update group and the Deployment address. Inputs are checked in `apps/mobile/ota-plan.ts`, and its tests show that an unknown channel is refused, as is a `production` run or a promotion with an address other than production's. An update built against staging carries no PostHog key, and promotion refuses it. Nothing publishes on push or on a schedule. ADR 0167 gains a section on promotion.
- #1963: the Staging Deployment. `.railway/railway.ts` gets a `staging` environment: backend only, Railway sleep on, no Cron services, its own domain and `preserve()` variables, and `DEPLOYMENT=staging`. On staging the backend refuses to start with PostHog or R2 keys, sends no Analytics, writes nothing to the Media Store (it reads public URLs only) and tags Sentry reports `staging`. ADR 0168 and the glossary term **Staging Deployment**.
- #1965: a Rule can target the Update channel. `RuleTargets` gets an optional `channel` (`beta` | `production`), and an unknown value is refused. The Core switch evaluator matches it against `deviceFacts.updateChannel`, so a build with no channel matches no channel Rule. The backend stores it in jsonb, so no migration. «Свічі» offers «Канал: усі / бета / основний», and the Rule list shows «канал бета». ADR 0170 amends 0089 and 0122: the breaking-change check lets a `/v1/admin/` strict output gain a field, and `v1.openapi.json` is regenerated.
- #1966: `scripts/staging.ts` (check-ref, check-definition, reset, wizard) and two `workflow_dispatch` workflows. `staging-deploy.yml` deploys a chosen ref, refusing any ref whose `.railway/railway.ts` staging is not backend-only with sleep on, no Cron and `DEPLOYMENT=staging`; migrations run in its release step. `staging-reset.yml` restores the staging Neon branch from its parent, copies no data over the network and refuses default, protected or parentless branches. The wizard (`--dry-run`) walks the owner through seven steps. ADR 0168 gains a section «Deploy, reset and set-up».
- Code review fixes: `ota-update.yml` runs `pnpm install` first and validates inputs before any EAS call; promote refuses a group not on `beta`; `ota-plan.ts` reuses `UpdateChannelSchema` and refuses control characters in values written to `GITHUB_OUTPUT`; `profileChannel` follows `extends`; the Media Store `head()` gives no size without Content-Length; the ADR index lines 0007 and 0062 name 0167.

## Checks

- [x] lint, typecheck and test pass for the affected packages
- [ ] CI green
- [x] New behaviour has tests through the spec's seams
- [x] Commits are Conventional Commits, with no co-author trailers and no AI attribution

## Cost

#1965 makes no new requests; a Rule with a channel adds about 20 bytes.

No Cron service, no scheduled workflow and no health check that runs outside a deploy, so nothing wakes the staging database on its own.

- Neon (Launch): 0.25 CU × about 2 h a day ≈ 15 CU-hours ≈ $1.6 a month; ≈ 180 CU-hours ≈ $19 if it stays awake all month. Storage is only the branch's changes. Transfer is tens of MB a month against 500 GB.
- Railway with sleep on: about $1–5 a month.
- Staging deploy, per manual run: two checkouts (~30 MB), the Railway CLI (~20 MB), `railway up` (~30 MB) and one image build; Neon wakes once (≈ 0.02 CU-hours).
- Staging reset: two Neon API requests (~4 KB); no data over the network. The wizard makes no requests.
- Railway's `/health` check: 1 request, under 1 KB, on each deploy only, right after the migrations that wake Neon anyway.

## Питання власнику

- Staging і ZeptoMail (залишено як є, вирішувати власнику). Нотатка рецензента: - ZeptoMail on staging (review #8, behaviour unchanged): the Staging Deployment keeps production's ZEPTOMAIL_TOKEN/MAIL_FROM and the reset copies real Accounts, so a staging sign-in mails a real address from the production sender. - Owner question: refuse mail variables under DEPLOYMENT=staging (or a log-only mailer there)? Safe default until answered: leave as is, sign in on staging only with the owner's own address.
- ADR 0122 забороняв міняти відповіді admin, а `RuleSchema` стоїть у них як строгий об'єкт, тому нове поле `targets.channel` перевірка вважала ламаючою зміною. Я обрав безпечний варіант: ADR 0170 доповнює 0122 і дозволяє відповіді `/v1/admin/` нове поле. Admin виходить разом із бекендом, тож старих клієнтів немає. Для відповідей застосунку правило лишається суворим, і це перевіряє тест. Якщо не згодні, напишіть.
- Для staging у EAS я взяв середовище development: `EXPO_PUBLIC_SLOVO_API_URL=https://staging.slovoapp.org` і без `EXPO_PUBLIC_POSTHOG_KEY`.
- Скидання бази staging не залишає резервної гілки.
- Після скидання TOTP в адмінці staging доведеться налаштувати заново, бо секрети запечатано `AUTH_SECRET` production.
- `RAILWAY_STAGING_TOKEN` має бути токеном саме середовища staging.
- Promote створює в production нову групу оновлень з тим самим кодом, бо EAS не зберігає номер групи. Частку потім розширюють уже за новим номером, і workflow його показує.
- Без `eas` я не перевірив, чи eas-cli 24.13 приймає `update:republish --destination-channel --rollout-percentage`, чи повертає `update:view --json` поле `.[0].message` і чи `eas update` бере змінні всередині `env:exec`. Якщо щось із цього не так, workflow зупиниться з помилкою й нічого не опублікує. Перевіримо після покупки Apple (#1967).
- Railway перевіряє `/health` на staging лише під час розгортання (одразу після міграцій). Перевірка звертається до бази, але базу вже розбудили міграції. За замовчуванням я її залишив; якщо треба прибрати, це один рядок у `stagingProject()`.
- Завантаження ілюстрації в адмінці staging свідомо падає з помилкою 500, бо запис у Media Store там заборонено.

## Handbook

- Сторінка «Свічі» (#1965): нове поле правила «Канал» (усі, бета або основний). «Бета» означає лише тих, хто встановив бета-збірку, тобто тестувальників.
- Сторінка «Тестовий сервер (staging)» (#1966). Що це: https://staging.slovoapp.org, сервер спить і коштує ≈ $1.6 за Neon плюс $1–5 за Railway на місяць. Як викласти гілку: Actions → Staging deploy; стару гілку, що не знає про staging, деплой відхилить. Як повернути базу до production: Staging reset зі словом `staging`, після чого TOTP налаштовують заново. Застосунок проти staging: `EXPO_PUBLIC_SLOVO_API_URL=https://staging.slovoapp.org pnpm --filter @slovo/mobile start` без ключа PostHog; перший запит після сну чекає кілька секунд. Чого не робити: запланованих задач (тоді ≈ $19 замість $1.6). Ілюстрації на staging не завантажуються. Налаштування з нуля: `node scripts/staging.ts wizard`.
- Сторінка «Канали оновлень», новий розділ «Як випустити оновлення» (#1964): як випустити оновлення в beta, як перевести його до читачів (promote) і як розширити частку. Перевести можна лише групу з каналу beta, а widen і promote не приймають адресу Deployment.
- Нова сторінка «Канали оновлень: beta і production» і рядок у README довідника. #1962: що отримує кожен канал, як бета-оновлення доходить до читачів і де в «Про застосунок» видно канал.
- Нова сторінка «Тестовий сервер (staging)» і рядок у README довідника. #1963: це окрема копія бекенду для перевірок власника. Вона засинає, коли нею не користуються, не збирає аналітику і нічого не змінює в медіафайлах.

## Чекліст власника

Майстер `node scripts/staging.ts wizard` проводить через ці кроки:

1. Neon: у проєкті (план Launch) створи гілку `staging` від `main`. Обчислення — фіксовано 0.25 CU, Scale to zero — через 5 хв. Запиши pooled connection string, ID гілки (br-…) і ID проєкту.
2. Railway: Environments → New Environment → Empty, назва `staging`. Не копія production: у копії будуть Cron-сервіси. Змінні backend:
   - `DATABASE_URL` — рядок гілки staging;
   - `AUTH_SECRET` — новий (його згенерує майстер);
   - `ZEPTOMAIL_API_URL`, `ZEPTOMAIL_TOKEN`, `MAIL_FROM`, `GOOGLE_CLIENT_IDS`, `SENTRY_DSN`, `MEDIA_BASE`, `TRUSTED_PROXY_HOPS` — як у production;
   - жодних `POSTHOG_*`, `R2_*`, `TELEGRAM_*`, `GITHUB_TOKEN`, `EXPO_TOKEN`.

   Project token створи саме для середовища staging.
3. GitHub → Secrets: `RAILWAY_STAGING_TOKEN`, `NEON_API_KEY`, `NEON_PROJECT_ID`, `NEON_STAGING_BRANCH_ID`.
4. Перший деплой: Actions → Staging deploy → ref `main`.
5. Cloudflare: CNAME `staging` на ціль, яку Railway показує для `staging.slovoapp.org`, Proxied (помаранчева хмара). Якщо Railway попросить, додай TXT-запис для перевірки.
6. EAS, середовище development: `EXPO_PUBLIC_SLOVO_API_URL=https://staging.slovoapp.org` і без `EXPO_PUBLIC_POSTHOG_KEY`.

### Перевірки власника

- [ ] Staging deploy гілки: у лозі видно міграції в release step, `/health` відповідає.
- [ ] Staging reset зі словом `staging`: після нього дані staging збігаються з production.
- [ ] Сон: через 5 хв без запитів Neon показує Idle, а Railway — Sleeping; за ніч CU-години гілки не ростуть.
- [ ] `node scripts/staging.ts wizard --dry-run` друкує 7 кроків.
- [ ] Після покупки Apple (#1967): збірки beta і production мають один fingerprint; publish у beta, promote у production і widen працюють.
