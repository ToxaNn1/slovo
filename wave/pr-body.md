Closes #1962, closes #1963, closes #1964, closes #1965, closes #1966

## What changed

The release channels and staging wave (spec #1961), built on the integration branch `feat/1961-release-channels`. #1967 (App Store Connect) waits for the Apple Developer purchase and is not part of this PR.

- #1962: two Update channels, `production` and `beta`. The `testflight` profile is replaced by `beta` and `production` store profiles in `eas.json`, each naming its channel. The channel stays out of the fingerprinted app config, so both profiles give one runtime version (ADR 0062), and a release build with a missing or unknown channel throws. The app reads the channel as `deviceFacts.updateChannel`, and About shows it beside the version, build and update id. ADR 0167 amends 0007 and 0062.
- #1963: the Staging Deployment. `.railway/railway.ts` gets a `staging` environment: backend only, Railway sleep on, no Cron services, its own domain and `preserve()` variables, and `DEPLOYMENT=staging`. On staging the backend refuses to start with PostHog or R2 keys, sends no Analytics, writes nothing to the Media Store (it reads public URLs only) and tags Sentry reports `staging`. ADR 0168 and the glossary term **Staging Deployment**.

## Checks

- [x] lint, typecheck and test pass for the affected packages
- [ ] CI green
- [x] New behaviour has tests through the spec's seams
- [x] Commits are Conventional Commits, with no co-author trailers and no AI attribution

## Cost

No Cron service, no scheduled workflow and no health check that runs outside a deploy, so nothing wakes the staging database on its own.

- Neon (Launch): 0.25 CU × about 2 h a day ≈ 15 CU-hours ≈ $1.6 a month; ≈ 180 CU-hours ≈ $19 if it stays awake all month. Storage is only the branch's changes. Transfer is tens of MB a month against 500 GB.
- Railway with sleep on: about $1–5 a month.
- Railway's `/health` check: 1 request, under 1 KB, on each deploy only, right after the migrations that wake Neon anyway.

## Питання власнику

- Railway перевіряє `/health` на staging лише під час розгортання (одразу після міграцій). Перевірка звертається до бази, але базу вже розбудили міграції. За замовчуванням я її залишив; якщо треба прибрати, це один рядок у `stagingProject()`.
- Завантаження ілюстрації в адмінці staging свідомо падає з помилкою 500, бо запис у Media Store там заборонено.

## Handbook

- Нова сторінка «Канали оновлень: beta і production» і рядок у README довідника. #1962: що отримує кожен канал, як бета-оновлення доходить до читачів і де в «Про застосунок» видно канал.
- Нова сторінка «Тестовий сервер (staging)» і рядок у README довідника. #1963: це окрема копія бекенду для перевірок власника. Вона засинає, коли нею не користуються, не збирає аналітику і нічого не змінює в медіафайлах.

## Чекліст власника

- Створити в Railway середовище `staging` порожнім, а не копією production, бо в копії будуть Cron-сервіси. Задати його змінні `preserve()`, зокрема новий `AUTH_SECRET` і `DATABASE_URL` гілки Neon.
- Додати в Cloudflare проксійований запис `staging.slovoapp.org`.
