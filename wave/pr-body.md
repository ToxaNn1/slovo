Closes #1949, closes #1950, closes #1951, closes #1952, closes #1953, closes #1954, closes #1955, closes #1956, closes #1957, closes #1958, closes #1959

## What changed

The «Сервіси» wave (spec #1949), built on the integration branch `feat/1949-services` and merged with `main` (including #1948). One summary line per ticket:

- Closes #1950: the eighth Owner admin section «Сервіси», Власник only, with the eleven Services seeded on a dark dotted canvas; solid lines are constant links, dashed lines scheduled runs; a block opens a side panel, and the canvas becomes a card list at phone width (ADR 0164, which amends 0088).
- Closes #1951: `services.add` and `services.editMoney` (Власник, confirmation and reason, Action log `service.add` / `service.money.edit` with changed fields only); monthly total and next charge on the Kyiv day.
- Closes #1952: the Vault: Service entries sealed with AES-256-GCM under `VAULT_KEY` (32 bytes, parsed once, refused if equal to `AUTH_SECRET`); `VAULT_OFF` (503) without the key; Action log rows without values.
- Closes #1953: the TOTP unlock: reveal and copy ask a fresh code (the sign-in code is not reused), open the Vault for 15 minutes per admin session in backend memory; the value hides after 30 s; copy never renders it.
- Closes #1954: `admin.services.usdRate` from the NBU open API, one row per Kyiv day in the existing `sourcing_cache`; USD/UAH switch kept on the device.
- Closes #1955: the Railway adapter: one GraphQL read serves the ports Railway, alerts, quote-check, recordings (Online/Offline, spend against $5, last and next Cron run), through `RAILWAY_READ_TOKEN`.
- Closes #1956: the one usage port `service-usage.ts` (metered / railway / cron readings), `cachedRead` with refresh and stale, `admin.services.usage` and `refreshUsage`, and the Sentry and PostHog adapters.
- Closes #1957: Neon, GitHub Actions and Cloudflare (R2 and Worker) adapters in `usage-sources.ts`.
- Closes #1958: Alert kind `service-limit` at 90 % of any limit (deduped by the unique `alerts.key`, once per Service, limit and UTC month), a yellow «Ліміт майже вичерпано» mark on block, card, panel and bar.
- Closes #1959: the owner checklist and the final handbook page (both below).

## Migrations

One migration only: a single generated `0031_services` with the seed of the eleven Services. The wave's migrations were regenerated after `main` took `0030` and then folded into this one (no `0031_service_entries`, no other file). The seed INSERT is appended by hand to the generated `.sql`; `meta/` is untouched by hand. The only decision record is ADR 0164 (amends 0088), extended in place by #1952, #1953, #1955 and #1958; no other ADR is added or changed.

## Cost-first

Every read passes a 1-hour in-memory `cachedRead` (shared by all four Railway ports), plus the «Оновити» button and one read after a restart.

| API | Requests | Bytes | Frequency | Limit |
|---|---|---|---|---|
| Railway (GraphQL) | 1 POST for 4 ports | ~0.7 KB out, 2-4 KB in, <0.2 MB/day | at most 24-50/day | Hobby 1,000 req/h; API calls not billed |
| Neon (management API) | 1 GET | ~3 KB, ~72 KB/day | at most 24/day | ~700 req/min; no Postgres connection, so no wake-up and no egress |
| GitHub Actions (billing report) | 1 GET | 20-100 KB, at most 2.4 MB/day | at most 24/day | 5,000 req/h per token, shared with «Розробка» |
| Cloudflare (GraphQL: R2 and Worker) | 1 POST | 2-5 KB | at most 24/day | 300 queries / 5 min; free plan |
| NBU (open API) | 1 GET | ~150 B, <30 KB/month | at most 1 per Kyiv day (31/month); a failure is not retried until the next day | no key, no published quota; $0 |
| Sentry (stats_v2) | 1 GET | 1-3 KB | ~750/month, ~2 MB | ~40 req/s org limit; stats calls not billed |
| PostHog (HogQL count) | 1 POST | under 1 KB | ~750/month | 120 queries/h per team; query calls are free |

The alerts Cron reads the limits only in the first run of each UTC hour (runs at :15, :30, :45 make 0 calls): 6 requests per hour, 144/day, ~2.6 MB/day worst case, $0. This stays far below every limit above. #1950-#1953 call no outside API.

## Code review

Review of the tip before the fixes found one confirmed issue, fixed in c22cd4c: `edit()` in `packages/server-core/src/services/service-entries.ts` opened a sealed value to compare it with the new one. A sealed value is opened only inside the reveal procedure, and an entry with a damaged or changed `VAULT_KEY` could not be overwritten (500). Now a new value for a sealed entry counts as changed without opening the old one; open entries still compare. Test: "change a sealed value without opening the old one".

Checked, no finding:
- Authorization: every `services.*` procedure goes through `admit(..., { security: true })` or `ownSession`; Адмін and Агент get FORBIDDEN, tested.
- Vault leaks: list, add and edit drop sealed values; Action log rows hold ids, types and field names only; reveal and copy log without the value; config errors and `.env.example` hold no values; `leak.test.ts` covers `services.list`.
- Unlock window: per admin session, in memory, injected clock, expired windows pruned; the TOTP is spent (no reuse) with its own 3-try limit.
- Service-limit Alert dedupe on the unique `alerts.key` with `onConflictDoNothing`.
- Parsing at the edge: provider answers through `readJson` and zod; stored rows parsed; inputs are `strictObject` with `ReasonSchema`.
- Project rules: `server-core` has no React imports; no non-null assertions or ts-expect-error in the diff.


## Testing

- [x] `pnpm lint`, `pnpm typecheck` and `pnpm test` green for backend, admin, contracts and server-core; `pnpm deps` and `pnpm format` clean.
- [x] Commits are Conventional Commits, with no co-author trailers and no AI attribution.
- [x] CI green on c22cd4c.

Known flake under parallel load: backend Postgres «permission denied to terminate process»; two admin tests failed once under load and pass alone.

## Питання власнику

Кожне питання має безпечне значення за замовчуванням, уже застосоване.
1. Лінії на полотні (#1950). У специфікації лінії ведуть до app, backend, site, Pages і Crons, яких серед одинадцяти Сервісів немає. За замовчуванням: Railway означає backend; Cloudflare покриває site і Pages; Expo/EAS веде до обох магазинів, магазини до Railway, від Railway до Telegram-бота йде пунктир (alerts Cron). Лінії «Crons → backend» немає.
2. Назва в сіді «Telegram bot» лишилась англійською; за потреби замінимо на «Telegram-бот».
3. Ліміти плану вручну не редагуються (#1951). Новий Сервіс починається без лімітів і ліній.
4. Сховище закривається після перезапуску backend: так. Сам успішний unlock у Журнал дій не пишеться: ні. Ліміт хибних кодів unlock окремий від входу (3 спроби, потім 15 хв): так (#1953).
5. Невдале читання НБУ не повторюється до наступної київської доби: так. Гривня показується цілою (#1954).
6. Блоків Cron у сіді немає (ADR 0164 не робить Cron Сервісом). За замовчуванням власник додає `alerts`, `quote-check`, `recordings` (вид Cron) через «Додати сервіс». Інакше пізніший тікет засіє їх міграцією й змінить ADR 0164 (#1955).
7. У Railway немає токена лише для читання: на backend стоїть токен робочого простору. Ліміт $5 (Hobby) зашито; Pro дає $20. Поля GraphQL перевірено лише на підробці: хибна форма відповіді дає «не вдалося прочитати», а не хибні числа.
8. Ліміти Sentry (5 000 помилок) і PostHog (1 млн подій) — безкоштовні плани в коді; вручну введений ліміт їх не перекриває. Період — календарний місяць UTC, а не день списання. PostHog рахує лише проєкт SLOVO (#1956).
9. GITHUB_TOKEN потребує права «Plan: read»; без нього смужка GitHub каже, що не може прочитати (#1957). Звіт рахує й хвилини публічних репозиторіїв, які GitHub не стягує, тому смужка може завищувати проти 2 000. За замовчуванням проста сума; інакше рахувати лише приватні.
10. Ключ Neon не лише для читання (найвужчий — ключ проєкту). На платних планах Neon поля проєкту порожні, смужка скаже «не вдалося прочитати». На платних планах ліміти треба переносити з констант у план Сервісу.
11. Cloudflare: сайт на GitHub Pages (ADR 0125), смужки Pages немає; показано запити Worker за сьогодні.
12. Період 90 %-го сповіщення — календарний місяць UTC для кожного ліміту; денний ліміт Worker сповістить щонайбільше раз на місяць. alerts Cron тепер тримає ключі читання як посилання на backend (ADR 0164 оновлено); альтернатива — Cron питає backend через внутрішню авторизацію. Ліміти беруться із зашитих констант, не з таблиці (#1958).

## Handbook

Сторінка «Сервіси» (нова, плюс рядок у README довідника). Що змінив кожен тікет:

- #1950: розділ лише для Власника; одинадцять Сервісів блоками на темному полотні з крапками; суцільна лінія — постійний зв'язок, пунктир — запуск за розкладом; клік відкриває бічну панель, на телефоні полотно стає списком карток.
- #1951: Власник вводить план, ціну й день списання, додає сервіс із причиною; вгорі сума на місяць і наступне списання.
- #1952: записи Сервісу зашифровані під VAULT_KEY; логіни й посилання видно, паролі, токени й коди приховані; без ключа не додати й не змінити; втрата ключа означає втрату секретів, копію тримати поза Railway.
- #1953: «Показати» і «Копіювати» просять свіжий код TOTP і відкривають сховище на 15 хвилин лише в цій сесії; показане значення ховається за 30 с; «Копіювати» кладе в буфер без показу; кожен показ і копіювання — у Журналі дій без значення.
- #1954: перемикач USD/UAH біля суми й у панелі, вибір пам'ятається на пристрої; курс НБУ раз на добу, при збої — останній відомий із датою.
- #1955: блок Railway — Online/Offline і витрати проти $5; блоки Cron — останній запуск і «Наступний через N хв»; щогодини через RAILWAY_READ_TOKEN.
- #1956: Sentry і PostHog показують смужку від ліміту; у панелі числа, час читання й «Оновити»; раз на годину; при збої — останні дані з «застаріло».
- #1957: Neon (обчислення, сховище, трафік), GitHub (хвилини Actions), Cloudflare (сховище й операції R2, запити Worker) показують смужки.
- #1958: на 90 % будь-якого ліміту блок і панель жовтіють, Cron alerts раз на годину шле в Telegram одне повідомлення на сервіс, ліміт і місяць.
- З рев'ю: зміна значення пароля чи токена завжди записується в Журнал дій як зміна, старе значення не відкривається.

Остаточний текст сторінки:

---

## Для чого
Одне місце для всіх зовнішніх сервісів проєкту: що ми в них платимо, скільки витратили від ліміту, як зайти. Бачить лише Власник.

## Що видно
- Полотно з 11 блоків: GitHub, Cloudflare, Expo/EAS, Apple Developer / App Store Connect, Google Play, Railway, Neon, Sentry, PostHog, Zoho Mail, Telegram bot. Лінії між ними показують, хто від кого залежить.
- Угорі сума на місяць і наступне списання. Перемикач USD/UAH біля суми й у панелі; вибір пам'ятається на пристрої, курс НБУ береться раз на добу, при збої показується останній відомий із датою.
- Блок Railway показує Online/Offline і витрати проти $5. Блоки Neon, GitHub, Cloudflare, Sentry і PostHog показують смужку від ліміту. Блоки Cron показують останній запуск і «Наступний через N хв».
- У панелі: числа, час читання й «Оновити». Дані читаються раз на годину; при збої лишаються останні, з позначкою «застаріло».
- На 90 % будь-якого ліміту блок і панель жовтіють («Ліміт майже вичерпано»), а Cron alerts шле в Telegram одне повідомлення на сервіс, ліміт і місяць.

## Що робить Власник
- Вводить план, ціну й день списання; додає сервіс із причиною.
- Додає записи сервісу: логіни й посилання видно, паролі, токени й коди приховані. Вони зашифровані ключем VAULT_KEY.
- «Показати» і «Копіювати» просять свіжий код TOTP і відкривають сховище на 15 хвилин лише в цій сесії. Показане значення ховається за 30 с, «Копіювати» кладе в буфер без показу. Кожен показ і копіювання потрапляє в Журнал дій без значення.
- Після перезапуску backend сховище знову закрите.

## Важливо
Без VAULT_KEY записи не додати й не змінити. **Втрата ключа означає втрату всіх секретів: тримайте його копію поза Railway.**

## Налаштування
Ключі читання (RAILWAY_READ_TOKEN, NEON_API_KEY, GITHUB_TOKEN, CLOUDFLARE_API_TOKEN та інші) задаються в Railway; повний список у чекліcті.

---

## Чекліст власника

**УВАГА: збережіть копію VAULT_KEY ПОЗА Railway (менеджер паролів, офлайн).** Якщо ключ втратиться, усі паролі, токени й коди в «Сервісах» зникнуть назавжди.

## Змінні Deployment (Railway)

Створіть ключ: `openssl rand -base64 32`. Він має відрізнятися від AUTH_SECRET.

Усе ставите на сервісі **backend**. Cron **alerts** бере RAILWAY_READ_TOKEN, NEON_API_KEY, GITHUB_TOKEN і CLOUDFLARE_API_TOKEN як посилання на backend: окремо їх вводити не треба (VAULT_KEY йому не потрібен).

- VAULT_KEY: backend.
- RAILWAY_READ_TOKEN: токен робочого простору Railway (backend, alerts за посиланням).
- NEON_API_KEY і NEON_PROJECT_ID: ключ і id проєкту Neon.
- GITHUB_TOKEN: потрібне право «Plan: read» для хвилин Actions.
- CLOUDFLARE_API_TOKEN: Account Analytics: Read на ваш акаунт R2.
- SENTRY_AUTH_TOKEN і SENTRY_ORG: уже є для «Якості».
- PostHog: POSTHOG_PERSONAL_API_KEY і POSTHOG_PROJECT_ID, уже є для «Аналітики».

## Записи по кожному з 11 сервісів

Спершу задайте VAULT_KEY, інакше записи не додати. Для кожного сервісу введіть план, ціну й день списання.

1. **GitHub**: логін, посилання на репозиторій, токен (змінна GITHUB_TOKEN дає смужку хвилин Actions).
2. **Cloudflare**: логін, посилання на панель, токен API (CLOUDFLARE_API_TOKEN дає R2 і запити Worker).
3. **Expo/EAS**: логін, посилання на проєкт, токен доступу. Читання з API немає: сума й день списання вручну.
4. **Apple Developer / App Store Connect**: логін, посилання, коди відновлення. Плата річна: вручну.
5. **Google Play**: логін, посилання, коди відновлення. Вручну.
6. **Railway**: логін, посилання, токен (RAILWAY_READ_TOKEN: Online/Offline і витрати проти $5).
7. **Neon**: логін, посилання, ключ API (NEON_API_KEY, NEON_PROJECT_ID: обчислення, сховище, трафік).
8. **Sentry**: логін, посилання, токен (SENTRY_AUTH_TOKEN, SENTRY_ORG: смужка помилок від 5 000).
9. **PostHog**: логін, посилання, ключ (смужка подій від 1 млн).
10. **Zoho Mail**: логін, посилання, пароль. Лише вручну.
11. **Telegram bot**: посилання на бота, токен від BotFather. Лише вручну.

Cron-сервіси alerts, quote-check, recordings додайте через «Додати сервіс» (вид Cron), з причиною: вони покажуть останній запуск і наступний.

## Перевірки вручну

1. Відкрийте «Сервіси»: видно 11 блоків, угорі сума на місяць і наступне списання.
2. Додайте запис: логін і посилання видно, пароль прихований.
3. «Показати» просить свіжий код TOTP (не той, що щойно був на вході) і відкриває сховище на 15 хв. Значення ховається за 30 с.
4. «Копіювати» кладе в буфер без показу.
5. У Журналі дій є показ і копіювання, без самого значення.
6. Блоки з ключами показують смужку, час читання й «Оновити».
7. Перемикач USD/UAH працює й запам'ятовується.
8. На 90 % ліміту блок жовтіє («Ліміт майже вичерпано»), у Telegram приходить одне повідомлення.
9. Після перезапуску backend сховище знову закрите.
