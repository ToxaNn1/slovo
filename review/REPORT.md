# Глобальне рев'ю SLOVO, 06.11: зведений звіт для власника

База: `main` bf792f89. Рев'ю лише читало код, нічого не збирали й не запускали. Джерела: `core-a.md`, `core-b.md`, `mobile.md`, `ui.md`, `backend.md`, `content.md`, `docs.md` (з підзвітами `core-a-entries.md`, `core-a-feed.md`, `content-sourcing.md`, `content-editions.md`, `parts/`, `mobile-parts/`).
Ідентифікатори: `<область>-<рівень><номер>`. Знахідки з підзвітів мають назву підзвіту в id, наприклад `core-a-feed-H1` або `content-sourcing-M4`. Нумерація mobile іде за його ранжованим індексом: H1, далі M1–M7, далі L1–L12.
Позначки: «підтв.» означає, що знахідку видно в коді або даних. «правд.» означає, що наслідок виведено, але не відтворено.

Що навмисно поза цим звітом: усе, що вже планує спека #1586 (PR #1640); `composition.ts`; робота над Narrator Voice (#1633, PR #1639).

---

## 1. Кількість знахідок за областями й рівнями (після дедуплікації)

| Область | Critical | High | Medium | Low |
|---|---|---|---|---|
| core-a (`packages/core`, перша половина: account, backend, counters, dashboard, edition, entries, feed) | 0 | 1 | 8 | 32 |
| core-b (`packages/core`, друга половина: mood … widget, sync, user-state, progress, notifications) | 0 | 2 | 10 | 19 |
| mobile (`apps/mobile`) | 0 | 1 | 7 | 12 |
| ui (`packages/ui`) | 0 | 0 | 4 | 9 |
| backend (`apps/backend`, `server-core`, `contracts/api`, Docker/Railway) | 0 | 0 | 3 | 9 |
| content (`language-pack`, `contracts` Entry, `tools/content`, `tools/sourcing`, `editions/uk`) | 1 | 7 | 12 | 17 |
| docs (ADR, `CONTEXT.md`, `docs/agents`, CI) | 0 | 1 | 3 | 5 |
| **Разом** | **1** | **12** | **47** | **103** |

Як рахували:
- core-a: `core-a-entries-M3` і `core-a-feed-M1` описують один дефект, тож Medium 8, а не 9, як у `core-a.md`. `core-a-L11` автор сам назвав «not a defect». `core-a-L9` увійшов у `mobile-H1`.
- content: `content.md` називає 9 Medium, але не враховує `content-sourcing-M4`…`M6`, а `content-M7` об'єднує дві знахідки. Тож тут 12. `content-L3` не є знахідкою. `content-sourcing-L1` увійшов у `content-M3`.
- docs: `docs-M2` («індекс пропускає 0083») — **не дрейф**. Номер 0083 зарезервовано для Narrator Voice (PR #1639), тому знахідку знято. `docs-L11` увійшов у `content-H1`.
- `core-a-L3` і `core-b-L3` (компаратор `newestFirst` у `in-turn.ts`) рахуються один раз, у core-a. У `core-b-L3` лишилося тільки місце в `xp-log.ts:322`.

---

## 2. Critical і High, за пріоритетом для всіх областей

| # | id | Що не так | Де | Впевн. | Виправлення одним рядком | Рішення |
|---|---|---|---|---|---|---|
| 1 | **content-C1** (+ content-editions-C1) | Чотири тестові Curated Collections («ТЕСТ N», «Не для релізу») потраплять у продакшн-Edition. Дати публікації вже минули, `curatedCollections` і `contentUpdates` увімкнені | `editions/uk/content/curated-collections/cc_test1..4.json`, `editions/uk/edition.json` | підтв. | Поки немає ADR з content-H2: поставити далекі дати публікації або вимкнути Feature Switch | потрібне рішення власника (разом із H2) |
| 2 | **docs-H1** | Перевірка авторства й відсутності AI-атрибуції («Commit messages») не входить у required checks. Auto-merge зливає PR, навіть коли вона червона, тож `CLAUDE.md` обіцяє більше, ніж є | `.github/workflows/commitlint.yml:17-47`, ruleset `main`, `ci.yml:152-158` | підтв. | Додати «Commit messages» у required checks ruleset або перенести job у `ci.yml` → `checks.needs` | потрібне рішення власника (налаштування GitHub) |
| 3 | **content-H3** (+ content-editions-H1) | У юридичних сторінках лишився буквальний `{CONTACT}`, і ніщо його не підставляє. Це ризик відмови на App Review | `editions/uk/legal/terms.md:46`, `editions/uk/legal/privacy.md:151` | підтв. | Вписати контакт або підставляти його під час збірки з `edition.json` | потрібне рішення власника (яку адресу показати; домен пошти ще не обрано) |
| 4 | **core-b-H2** | Ліміт у 64 Notification вмикається до того, як план 1.0 лишає 2 слоти на день. При ≥5 Notification times план покриває менше 14 днів. Коли `politePause` увімкнено, тиждень тиші закінчується farewell на 14-й день | `packages/core/src/notifications/notification-plan.ts:109,144,367-375` | підтв. (арифметика) | Спершу відфільтрувати слоти за схемою 1.0, потім застосувати ліміт; тест «evening + >3 times» | — |
| 5 | **core-a-feed-H1** | Новий день починає новий Cycle, хоча Synonym Rows або Tips ще не Seen: перевірка рахує лише Corrections та Idioms. Це суперечить ADR 0016, 0051 і глосарію | `packages/core/src/feed/word-of-the-day.ts:138` | підтв. | Один `cycle.hasUnseen()` для всіх видів, спільний для Feed і Word of the Day; спершу тест | — |
| 6 | **mobile-H1** (+ core-a-L9) | Word of the Day поза Cycle (Hidden або поза Mix) ламає дві речі. Dashboard знову й знову відкриває Feed, бо ask не очищається, і Dashboard стає непридатним до перезапуску. Hero ніколи не стає «revealed» | `apps/mobile/src/dashboard/dashboard.ts:48-51`, `apps/mobile/src/feed/feed.ts:123-139`, `packages/core/src/feed/feed.ts:451-453`, `packages/core/src/dashboard/dashboard.ts:171-173` | правд. (шлях у коді підтв.) | Очищати ask, коли Feed не може приземлитися. «Revealed» брати із Seen-today, а не з `cycle.covers` | — |
| 7 | **content-H1** (+ docs-L11) | Перевірку цитати можна обійти: `verify` дивиться лише `sources[0].url`, а `unverified` падає тільки з `--book`. `SourceSchema` — вільний текст, і жодне правило не вимагає СУМ-20 або СУМ-11 (ADR 0012, 0084) | `tools/content/src/verify.ts:67-69,80-82,99`, `packages/contracts/src/shared.ts:28-33`, `.github/workflows/ci.yml:142` | підтв. (шлях); обхід правд. | `--strict` у CI (`unverified` = помилка), правило check-content «джерело goroh/СУМ має url», перевіряти кожен url | потрібне рішення власника (чи посилювати ADR 0012/0084) |
| 8 | **content-H6** (= content-sourcing-H3 = content-editions-M3) | Ніде не записано, на якій підставі ми дослівно цитуємо СУМ-20, ЕСУМ, Караванського, Пономарева, Антоненка-Давидовича та сучасних авторів Examples. У `legal/terms.md` такого пункту немає | `packages/contracts/src/shared.ts:28-33`, ADR 0012/0084/0045, `editions/uk/legal/terms.md` | правд. | ADR: що можна цитувати, скільки, з якою атрибуцією на картці й у `legal/` | **потрібне рішення власника (ADR)** |
| 9 | **content-H2** (+ content-editions-H2) | Curated Collection неможливо прибрати. Реєстр id не дає видаляти записи (ADR 0010), а стану Retired у колекції немає | `editions/uk/content/ids.json`, `packages/language-pack/src/record.ts:60-64`, `packages/contracts/src/curated-collection.ts` | підтв. | ADR про стан Retired для Curated Collection, потім ретайр `cc_test1..4` | **потрібне рішення власника (ADR)** |
| 10 | **core-b-H1** | Синхронізований ключ `wordOfTheDayArchive.<date>` ніхто не парсить. Один кривий ключ дає `RangeError` в `Intl.format(NaN)`: архів більше не відкривається, Spotlight падає щоразу | `packages/core/src/saved/word-of-the-day-archive.ts:107-121`, `local-date.ts:59`, `spotlight.ts:64` | правд. (код підтв.) | Парсити ключ схемою LocalDate на вході й пропускати ключі, які не читаються | — |
| 11 | **content-H4** (= content-sourcing-H1) | Відповіді goroh 403/5xx читаються як «такої сторінки немає»: слово отримує `no-entry`, синоніми й етимологія тихо зникають | `tools/sourcing/src/polite-client.ts:137`, `tools/sourcing/src/goroh.ts:32` | підтв. | Будь-який статус, крім 200 і 404, вважати `fetch-failed` з повтором; фікстури 403/500 | — |
| 12 | **content-H5** (= content-sourcing-H2) | Сторінка bot-check або помилки зі статусом 200 назавжди лягає в кеш як «тут нічого». CI відновлює цей кеш, і fallback на Wayback для sum.in.ua не спрацьовує | `tools/sourcing/src/polite-client.ts:64,131-134`, `sum.ts:41-46`, `ci.yml:120-127` | правд. | Кожен виклик передає `accept`, який вимагає розмітку статті; 200 без неї не кешувати | — |
| 13 | **content-H7** (= content-sourcing-M1, підвищено) | Sourcing перевіряє повтори лише за Lemma, тож другий омонім вважається дублікатом назавжди. Це суперечить глосарію: омоніми — окремі Words | `tools/sourcing/src/source-words.ts` (рядки в `content-sourcing.md` M1) | підтв. | Ключ Lemma + primary Definition, як у `check-content.ts:101` | — |

---

## 3. Medium за темами

**Помилки ковтаються або губляться**
- core-a-M2: `answerOf` вважає будь-яку помилку не-`ORPCError` станом `offline`, і баги ховаються за повторами — `packages/core/src/backend.ts:35` (потрібне рішення власника: дописати компроміс в ADR 0064)
- core-b-M2: `openSync` може відхилитися, коли сховище кидає помилку при старті без входу — `packages/core/src/sync/sync.ts:107`
- core-b-M6: `levelReached` — єдиний виклик `analytics.track` без `.catch` — `packages/core/src/progress/xp-log.ts:434`
- core-b-M7: якщо падає analytics, `choose`/`skip` у Mood відхиляються вже після успішного запису — `packages/core/src/mood/mood.ts`
- core-b-M8: `askPermission().catch(() => undefined)` ковтає й помилки самого плану — `packages/core/src/notifications/notifications.ts:255`
- core-b-M10: повторне планування вечора йде через `void`, тож отримуємо unhandled rejection — `packages/core/src/notifications/notifications.ts:288-289`
- ui-M3: помилка дії над Collection іде лише в `console.error`, а поле виглядає бездіяльним — `packages/ui/src/saved/CollectionSheet.tsx:100-103`, `CollectionNameField.tsx:48-51`
- mobile-M2: екран Collection Link порожній під час завантаження й лишається порожнім після помилки — `apps/mobile/src/saved/collection-link.ts:17`, `app/c/[linkId].tsx:59-67`
- mobile-M3: board-екрани (Collection, Category, Curated Collection, Correction Type) не мають ні порожнього стану, ні стану помилки — `apps/mobile/src/saved/collection-board.tsx:76-80`, `categories/category-screen.ts:64-82`, `dashboard/correction-type.ts:38-46`
- content-sourcing-M4: CLI sourcing повертає exit 0, навіть коли жоден Lemma не завантажився — `tools/sourcing/src/cli-common.ts:67-92`

**Застарілий стан, порядок і гонки**
- core-a-entries-M2: Rarity Ceiling сповіщає підписників раніше, ніж `eligibility.publish()`, тобто в зворотному до Mix порядку — `packages/core/src/entries/rarity-ceiling.ts:79-82`
- core-a-feed-M2: одного id Cycle, якого немає в Language Pack, досить, щоб Feed зупинився назавжди — `packages/core/src/feed/feed.ts:532-535`
- core-b-M3: Mood читає Feature Switch один раз, при відкритті (ADR 0040) — `packages/core/src/mood/mood.ts:57`
- core-b-M4: «сьогодні» в Mood не оновлюється, коли check-in приходить синхронізацією — `packages/core/src/mood/mood.ts:63-104`
- mobile-M1: подвійний тап на «Додати» створює дві копії Curated Collection (виправляти в Core) — `packages/core/src/dashboard/curated-collections.ts:197-205`, `apps/mobile/app/curated-collection/[collectionId].tsx:80`
- mobile-M4: заголовки «Сьогодні»/«Учора» в History застарівають після півночі — `apps/mobile/src/saved/history.ts:37-61`

**Правила домену й неможливі стани**
- core-a-entries-M3 = core-a-feed-M1: Hidden Correction лишається у зв'язках картки Word, і її можна відкрити у Feed, де вона стане Seen. Глосарій каже, що Hidden Entry ніколи не з'являється у Feed — `packages/core/src/entries/entries.ts:441-460`, `packages/core/src/feed/feed.ts:614-616` (потрібне рішення власника: чи підкоряються зв'язки правилам Hidden і Mix)
- core-a-entries-M1: тип допускає порожній `standardEquivalents`, і два модулі обробляють це по-різному — `packages/contracts/src/correction.ts:72`, `core/entries/correction-card.ts:50`, `entry-row.ts:125`
- core-b-M9: `OnboardingState` складено з двох незалежних optional-полів замість discriminated union — `packages/core/src/onboarding/onboarding.ts:70-75`
- core-b-M1: у `userStateRecords` немає `moodRecords` і `dashboardRecords`, тож фабрики тестових станів тихо їх пропускають — `packages/core/src/user-state-schema.ts:120-139`

**Дані ззовні без парсингу**
- core-a-feed-M3: Community Word приходить з мережі й записується в сховище без парсингу; клієнт oRPC не валідує відповіді — `packages/core/src/feed/community-word.ts:48-51`, `packages/contracts/src/api.ts:103-116`
- content-M5: `TextSchema` пропускає рядки з одних пробілів і з пробілами по краях — `packages/contracts/src/shared.ts:4`

**Account і backend**
- core-a-M1: токени не повідомлених серверу sign-out живуть лише в пам'яті, тож Session на сервері лишається дійсною — `packages/core/src/account/account.ts:343-357,458-463`
- backend-M1: `/admin/*` POST не має ліміту тіла запиту, і `parseBody` буферизує все ще до перевірки власника (ризик OOM) — `apps/backend/src/app.ts:203-209`, `admin/admin-routes.ts:102-119`
- backend-M2: вхід через Apple ігнорує `email_verified`, на відміну від Google — `apps/backend/src/account/apple-verifier.ts:38-45`, `packages/server-core/src/account/accounts.ts:191-205`
- backend-M3: строк дії коду перевіряється через `Date.now()` замість injected `Clock` — `apps/backend/src/account/authenticator.ts:170`

**Продуктивність**
- core-a-M3: немає negative caching для Community Counters, тож невідоме Entry дає запит на кожну зміну Feed — `packages/core/src/community-counters/counter-reads.ts:73-91`
- core-b-M5: `derive()` у XP log має складність O(records × days) і запускається на кожну Seen-картку — `packages/core/src/progress/xp-log.ts:258-272,397-401,629-632`
- ui-M2: кожен `useReduceMotion()` сам питає систему (30 місць). Поки відповідь не прийшла, перший кадр іде з повною анімацією всупереч ADR 0055 — `packages/ui/src/providers/useReduceMotion.ts:12-28`

**Доступність і дизайн-система**
- ui-M1: червоний accent у дрібному тексті має контраст 3.27:1 (потрібно 4.5:1), 14 місць — `packages/ui/src/tokens/base.ts:125,246…`, `editions/uk/tokens.json` (потрібне рішення власника: токен `accentText` змінює палітру з дошок)
- ui-M4: розмірні константи на рівні модуля обходять token lint — `packages/config/token-lint.js`, `packages/ui/src/game/OrderedChips.tsx:21-29`, `PairsGrid.tsx:23-34` та ін.

**Брами контенту й sourcing**
- content-M1: check-content не шукає дублікатів серед Corrections, Synonym Rows і Tips; реальний дубль: `t_6cfl3m` і `c_tdlwgq` — `packages/language-pack/src/check-content.ts:188-266`
- content-M2: `check` і `import` по-різному визначають дублікат Word — `check-content.ts:98-110`, `tools/content/src/import.ts:104-112`
- content-M3 (+ content-sourcing-L1): закешований 404 робить «перезапусти крок» марним у CI — `tools/sourcing/src/polite-client.ts:64`, `ci.yml:120-127`
- content-M4: перевірка цитати порівнює лише 40 символів (ADR 0084 це дозволяє, тож це прийнятий ризик) — `tools/content/src/verify.ts:249-251` (потрібне рішення власника: змінити ADR 0084)
- content-M6 (= content-editions-M1): sourcing не ставить `shortName`, тож 100 Words показують повну назву словника — `tools/sourcing`
- content-M7 (= content-sourcing-M2, M3): Idiom Type береться з рядка списку; запуск спершу стирає старі чернетки, а звіт пише наостанок — `tools/sourcing/src/` (рядки в підзвіті)
- content-M8 (= content-editions-M2): три Tips за глосарієм є Corrections — `editions/uk/content/tips/`
- content-sourcing-M5: цитати редагуються більше, ніж дозволяє ADR 0012 (крапки, обрізання shade notes) — `tools/sourcing/src/source-words.ts:792-794,573`, `synonyms.ts:184-198`, `sum.ts:268` (потрібне рішення власника: записати ці нормалізації в ADR або прибрати)
- content-sourcing-M6: `compact()` через `as T` ховає відсутнє обов'язкове поле — `tools/sourcing/src/source-words.ts:629-635`

**Тести, що нічого не доводять, і мертвий код**
- mobile-M5: `useEntries()` експортується, але ніде не використовується — `apps/mobile/src/content-update/language-pack.tsx:99`
- mobile-M6: тест стану «fresh» перевіряє лише `toBeDefined()` — `apps/mobile/src/user-state/test-states.test.ts:103`
- mobile-M7: тести undo після reopen проходять, навіть якщо hide загубився — `apps/mobile/src/mix/hiding-undo.test.ts:74,85`

**Документація**
- docs-M3: ADR 0074 змінює 0066 (Active Day), але ні 0066, ні індекс про це не кажуть — `docs/adr/README.md` (рядок 0066), `docs/adr/0066-*.md`
- docs-M4: позначки «amends» стоять лише з одного боку (0081 → 0033/0076, 0072 → …) — `docs/adr/README.md`
- docs-M5: слово «SLOVO ID» є в _Avoid_, але вживається ~45 разів у коді й документації — `CONTEXT.md:229`, `apps/mobile/src/settings/account-screen.tsx:57,65,328` та ін. (потрібне рішення власника: прибрати слово з коду чи повернути назву)
- ~~docs-M2~~: індекс ADR пропускає 0083. **Не дрейф**: номер зарезервовано для Narrator Voice (PR #1639), і PR додасть цей рядок.

---

## 4. Low: кількість і теми

| Область | Low | Теми |
|---|---|---|
| core-a | 32 | `as`-cast і неможливі стани (`AccountState`, необов'язковий `schedule`); непослідовний компаратор `newestFirst`; гонка `refresh()` у Curated Collections; зайві читання сховища та unhandled listener; часовий пояс «назад» і dwell за стінним годинником; рядкові дати без схеми; мертві експорти та застарілі doc-коментарі; літерал рідкості `5`; `#fragment` у `parseLink`; 7+ слабких тестів |
| core-b | 19 | дати XP і нотифікацій як `z.string()`; `Number()` для версії схеми; неможливі стани (xp record, laterQuestions, Collection `source?`); poison pending change блокує push; дубль дати в Mood, немає `inTurn`; годинник читається двічі; кільце віджета близько півночі; Reserved Words зберігаються до scheduler; зайві `settingChanged`; _Avoid_ «reminder»; слабкі тести (`toBeDefined`, «порожній план») |
| mobile | 12 | шість `void` promises без обробника; ланцюжок remote-switch без `.catch`; перечитування, що приходять не в тому порядку; Search не скидає результати при помилці; правило Level/Badge живе в app, а не в Core; ключ на identity `LocalDate`; завантаження виглядає як справжні дані; подвійна підписка Progress; 5 `it.skip` і закоментований код (DESIGN-05, чекає рішення власника); тавтологічний тест PostHog; 5 зайвих експортів |
| ui | 9 | немає `voice` у `DailyCrosswordCard`; застарілий `onDone` під eslint-disable; одна роль `fieldProblem` має два кольори; SVG-рядки замість `wedges`; контраст краю плитки 1.65:1 (рішення дошки); `CategoryGrid` без memo; 15 експортованих типів, які ніхто не імпортує; чотири схожі label-компоненти; ширина-заглушка 360 |
| backend | 9 | `as Session`; мертві `??`; гонка першого входу через Google/Apple; read-then-act на спробах коду; завантаження старих паків без ліміту; немає дедлайну graceful stop; `MAIL_FROM` за замовчуванням на чужому `slovo.app`; немає security headers; рекурсія в `take` без обмеження |
| content | 17 | `retire` правиться regex-ом; `.parse` рядків паку всередині app; кеш CDX і `2^n` slug-ів; `idMaker` без ліміту спроб; регістр у `parseDefinitions`; casts у тестах; немає robots.txt і контакту в UA; дані: омонім «купина» без розрізнення, 23 однослівні Definitions, Idioms без етимології, 81 джерело без url і 15 `http://`, зв'язок на Retired Word, малий пул кросворда, 2 Words без Examples, зайві `.gitkeep` |
| docs | 5 | _Avoid_ «Ukrainian Edition», «toggle»; `rarityFloor` збігається з назвою видаленого Rarity Floor; `waves.md` залежить від скіла, якого немає в репо; назви тек `mascot/` і `categories/` проти ADR 0027 |

---

## 5. Спільні теми для кількох областей

1. **Час зі стінного годинника, межа доби.** backend-M3 (`Date.now`), core-b-L (годинник читається двічі в `notification-plan.ts:107,134,321`), core-a-feed-L1 (день «назад» після зміни поясу), core-a-feed-L2 (dwell без монотонного годинника), mobile-M4 (History після півночі), core-b-L7 (віджет близько півночі), mobile-H1/core-a-L9 (Word of the Day на межі Cycle). Корінь: немає єдиного «момент зараз → LocalDate» на одну операцію і немає монотонного годинника в порті `Clock`.
2. **Дані ззовні без парсингу або з м'якою схемою.** core-b-H1, core-b-L1, core-b-notifications-L1, core-a-feed-L9, core-b-L5 (у `contracts` немає `LocalDateKeySchema`); core-a-feed-M3 (oRPC-клієнт не валідує відповіді); content-M5 (`TextSchema`); content-H1/docs-L11 (`SourceSchema` як вільний текст); content-L2 (`.parse` у pack-reader); `declareRecord.decode` тихо робить зі зламаного запису «відсутній».
3. **Помилки ковтаються, unhandled rejection.** core-a-M2, core-b-M2/M6/M7/M8/M10, ui-M3, mobile-M2/M3, mobile-L (шість `void`, lifecycle), core-a-L7, content-H4/H5 (помилку прочитано як «немає сторінки»), content-sourcing-M4 (exit 0). Корінь: немає однієї ідіоми «Core-виклик ніколи не відхиляється / помилку видно». Частково перетинається з keep-ідіомою зі спеки #1586.
4. **Неможливі стани можна виразити в типах.** core-a-L2, core-a-L4, core-a-entries-M1, core-b-M9, core-b-L2, core-b-L10, core-b-notifications-L6, core-b-L8.
5. **Гонки й застарілий стан.** core-a-L8, mobile-M1, mobile-L (перечитування не в тому порядку), core-b-L9 (Mood без `inTurn`), core-a-entries-M2, core-b-M3/M4, backend-L3/L4, core-a-L3 = core-b-L3 (компаратор).
6. **Тести, що пройдуть і на порожньому результаті.** core-a-L12, core-a-entries-L10…L12, core-a-feed-L10, core-b-L11, core-b-notifications-L8, mobile-M6/M7, mobile-L (PostHog), content-sourcing-L6.
7. **Слова з _Avoid_ глосарія.** docs-M5 (SLOVO ID), docs-L (Ukrainian Edition, toggle, `rarityFloor`), core-b-notifications-L7 (reminder), «headword» у sourcing.
8. **ADR не підкріплені кодом.** docs-H1 (перевірка авторства), content-H1/M4/sourcing-M5 (ADR 0012/0084), content-H2 (ADR 0010 без Retired для колекцій), core-b-M3 (ADR 0040).

### Як згрупувати в майбутні спеки (5)

1. **Брами релізу контенту й чесність цитат.** content-C1, H1–H7, M1–M8, content-sourcing-M4…M6, content-L*, docs-L11. Потрібні ADR: Retired для Curated Collection, підстава для ліцензій, нормалізації ADR 0012 і строгий режим ADR 0084. Блокує реліз.
2. **Межа Core: дати, парсинг, неможливі стани.** `LocalDateKeySchema` у `contracts`, валідація відповідей oRPC, core-b-H1, core-b-M1, core-a-entries-M1, core-b-M9, тема 4, content-M5, content-L2.
3. **Помилки видно: без тихих збоїв.** Тема 3: класифікація в `answerOf` (зміна ADR 0064), стани loading/failed/empty в app і ui (mobile-M2/M3, ui-M3), sync-M2, exit-коди sourcing. Звірити з keep-ідіомою зі спеки #1586.
4. **Правильність Feed, Cycle, Notifications і часу.** core-a-feed-H1, core-b-H2, mobile-H1 + core-a-L9, core-a-entries-M3/feed-M1 (рішення власника про Hidden-зв'язки), feed-M2, entries-M2, Mood M3/M4, тема 1 (одна точка «зараз», монотонний dwell), тема 5, продуктивність (core-a-M3, core-b-M5).
5. **Account, backend і гігієна UI/документації.** backend-M1…M3, core-a-M1, backend-L*. Далі ui-M1 (рішення власника про палітру), ui-M2/M4, тема 6, мертві експорти, docs-M3…M5, тема 7.

**Поза спеками, зробити негайно руками власника:** docs-H1 (required check у GitHub ruleset); content-C1 як тимчасовий захід (дати публікації або Feature Switch); content-H3 (контакт у `legal/`).
