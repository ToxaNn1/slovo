# App-pass copy picks (owner-chosen texts). Temporary input for branch 4: delete this file in the last commit.

## Items to fix along (report §2)
5. VoiceOver читає цитату із зайвими знаками: «…амбразур., — М. Коцюбинський». Знімок: `01-feed/word-detail.png`.
14. VoiceOver читає «Як сказати краще?. Швидке питання»: зайва крапка після знака питання. Знімки: `01-feed/swipe-3..10.png`.
43. Коли пошук нічого не знайшов, застосунок пропонує слово «у пункті «Про застосунок і відгук»». Такого пункту немає (є «Про SLOVO»), а «Запропонувати слово» там позначене «СКОРО», тож читач заходить у глухий кут. Знімки: `03-saved/search-empty.png`, `05-settings/about.png`. Файл: `editions/uk/strings.json` (`search.nothingFound`).
61. «Легкий початок для найзайнятіших» у «Ціль дня» звучить незграбно. Знімок: `05-settings/goal.png`.
63. Опис «Фразеологізмів» у «Мій Мікс» згадує «топоніми». Знімок: `05-settings/mix.png`. Файл: `strings.json` (`mix.idioms.subtitle`, див. розділ 3).
64. «…питання з Гри» — «Гри» з великої посеред речення. Знімок: `05-settings/mix-bottom.png`.
70. Одне й те саме має дві назви: рядок «Пройти опитування ще раз», а екран «АНКЕТА». Знімок: `05-settings/questionnaire.png`.
75. Назви не збігаються: рядок «Приховані записи», екран «ПРИХОВАНЕ». Знімок: `05-settings/hidden.png`.
77. Під «Анонімна статистика» не пояснено, що саме збирається. Текст для цього вже вибрано, див. `settings.anonymousStats.explanation` у розділі 3. Знімок: `05-settings/privacy.png`.
80. VoiceOver читає «Запропонувати слово, скоро буде доступно. або Виправлення» — підпис «або Виправлення» звучить зламано. Знімок: `05-settings/about.png`.
83. На екрані результату тесту рідкості кома переноситься на початок рядка: «незнайоме / , рідші почекають». Знімок: `07-part3/rarity-test-result.png`.
89. Вікно скидання каже «Серія, XP і відзнаки зникнуть», а насправді зникають ще рекорди ігор, перерва (разом з її 30-денним очікуванням) і підказки жестів. Що саме скидається, вирішено в ADR 0133, тому треба або дописати текст вікна, або змінити обсяг скидання. **ТВОЄ РІШЕННЯ.** Знімок: `05-settings/reset-confirm.png`.
5. **`fix/…-feed-details`: дрібниці Стрічки.** Один формат підпису слова дня (п. 1), «з» у рядку рідкості (п. 2), VoiceOver для розкритої картки (п. 3), одна форма частини мови (п. 4), обрізаний приклад (п. 6), кнопки закриття у вікнах «Повідомити про помилку», «Статистика» і «Додати час» (п. 8, 21, 56), чип настрою під меню (п. 12), правильна відповідь у швидкому питанні і перехід далі (п. 16, 17), пояснення «ціль ще не виконана» біля серії 0 (п. 19, 47).

Item 89 (owner decision Р2): the reset dialog lists everything it wipes: серія, XP, відзнаки, рекорди ігор, перерва, підказки.

## 3. Тексти, що відрізняються від вибраних тобою

Звірено 231 вибраний текст (`copy-picks/picks/`) з `main` на 18.11: 38 уже такі самі, **188 досі старі**, **5 рядків у застосунку вже немає**. Ці 5 рядків — кросворд «веди пальцем» і значок «Кросворд дня N днів поспіль». Їх видалено в #1982 разом із функцією, тож вони більше не потрібні.
Застереження: кілька ключів можуть не показуватися на тому екрані, де їх видно в проході. Наприклад, `wordOfTheDay.reveal` у файлі — «Розкрити», а на обкладинці видно «РОЗКРИЙ СЛОВО». Отже, кнопку обкладинки, мабуть, бере інший ключ, і це варто перевірити під час правки.


### Стрічка (обкладинка, картка, повідомлення, маскот) (75)

| Ключ | Вибраний текст | Зараз у застосунку | Файл |
|---|---|---|---|
| `dashboard.category.toasts.added` | «{name}» тепер у твоєму Міксі. | „{name}“ тепер у твоєму Міксі. | `editions/uk/strings.json` |
| `dashboard.category.toasts.removed` | «{name}» прибрано з Міксу. | „{name}“ прибрано з Міксу. | `editions/uk/strings.json` |
| `dashboard.correctionTypes.descriptions.surzhyk` | Коли в одному реченні перемішалися дві мови. | Слова, що прослизають у мову непомітно. | `editions/uk/strings.json` |
| `dashboard.correctionTypes.examples.few` | {count} виправлення | {count} приклади | `editions/uk/strings.json` |
| `dashboard.correctionTypes.examples.many` | {count} виправлень | {count} прикладів | `editions/uk/strings.json` |
| `dashboard.correctionTypes.examples.one` | {count} виправлення | {count} приклад | `editions/uk/strings.json` |
| `dashboard.correctionTypes.examples.other` | {count} виправлення | {count} приклади | `editions/uk/strings.json` |
| `dashboard.curatedCollection.add` | + Додати собі | + Додати | `editions/uk/strings.json` |
| `dashboard.curatedCollection.addButton` | ДОДАТИ СОБІ | ДОДАТИ | `editions/uk/strings.json` |
| `dashboard.curatedCollection.added` | У Міксі ✓ | Додано ✓ | `editions/uk/strings.json` |
| `dashboard.curatedCollection.addedButton` | У МІКСІ | ДОДАНО | `editions/uk/strings.json` |
| `dashboard.previousWords.months.0` | січ. | січ | `editions/uk/strings.json` |
| `dashboard.previousWords.months.1` | лют. | лют | `editions/uk/strings.json` |
| `dashboard.previousWords.months.10` | листоп. | лис | `editions/uk/strings.json` |
| `dashboard.previousWords.months.11` | груд. | гру | `editions/uk/strings.json` |
| `dashboard.previousWords.months.2` | берез. | бер | `editions/uk/strings.json` |
| `dashboard.previousWords.months.3` | квіт. | кві | `editions/uk/strings.json` |
| `dashboard.previousWords.months.4` | трав. | тра | `editions/uk/strings.json` |
| `dashboard.previousWords.months.5` | черв. | чер | `editions/uk/strings.json` |
| `dashboard.previousWords.months.6` | лип. | лип | `editions/uk/strings.json` |
| `dashboard.previousWords.months.7` | серп. | сер | `editions/uk/strings.json` |
| `dashboard.previousWords.months.8` | верес. | вер | `editions/uk/strings.json` |
| `dashboard.previousWords.months.9` | жовт. | жов | `editions/uk/strings.json` |
| `feedNotices.communityWord.added.few` | до Улюбленого додали {count} читачі | додали {count} читачі | `editions/uk/strings.json` |
| `feedNotices.communityWord.added.many` | до Улюбленого додали {count} читачів | додали {count} читачів | `editions/uk/strings.json` |
| `feedNotices.communityWord.added.one` | до Улюбленого додав {count} читач | додав {count} читач | `editions/uk/strings.json` |
| `feedNotices.communityWord.added.other` | до Улюбленого додали {count} читача | додали {count} читача | `editions/uk/strings.json` |
| `feedNotices.enoughForToday.keepGoing` | Ще одне слово | Гортати далі | `editions/uk/strings.json` |
| `feedNotices.firstWeek.days.1.text` | На вкладці «Ігри» слова з твого Міксу стають грою, а «Кросворд дня» щодня новий. | На вкладці «Гра» на тебе чекають ігри зі словами твого Міксу і щоденний «Кросворд дня». | `editions/uk/strings.json` |
| `feedNotices.firstWeek.days.1.title` | Час пограти | Час для Гри | `editions/uk/strings.json` |
| `feedNotices.firstWeek.days.3.text` | Обери, що бачити у Стрічці: категорії слів, Виправлення, Фразеологізми, Синонімічні ряди, Поради. Це — у Налаштуваннях, розділ «Мій Мікс». | Обери, що бачити у Стрічці: категорії слів, Виправлення, Фразеологізми, Поради. Це — у Налаштуваннях, розділ «Мій Мікс». | `editions/uk/strings.json` |
| `feedNotices.firstWeek.lastDayText.few` | Сім днів із SLOVO — і нових слів у запасі вже чимало! Твоя серія — {count} дні поспіль. Завтра чекають нове слово дня і свіжий «Кросворд дня» — повертайся. | Дякуємо, що ти з нами! Твоя серія — {count} дні поспіль. Повертайся по нові слова. | `editions/uk/strings.json` |
| `feedNotices.firstWeek.lastDayText.many` | Сім днів із SLOVO — і нових слів у запасі вже чимало! Твоя серія — {count} днів поспіль. Завтра чекають нове слово дня і свіжий «Кросворд дня» — повертайся. | Дякуємо, що ти з нами! Твоя серія — {count} днів поспіль. Повертайся по нові слова. | `editions/uk/strings.json` |
| `feedNotices.firstWeek.lastDayText.one` | Сім днів із SLOVO — і нових слів у запасі вже чимало! Твоя серія — {count} день поспіль. Завтра чекають нове слово дня і свіжий «Кросворд дня» — повертайся. | Дякуємо, що ти з нами! Твоя серія — {count} день поспіль. Повертайся по нові слова. | `editions/uk/strings.json` |
| `feedNotices.firstWeek.lastDayText.other` | Сім днів із SLOVO — і нових слів у запасі вже чимало! Твоя серія — {count} дня поспіль. Завтра чекають нове слово дня і свіжий «Кросворд дня» — повертайся. | Дякуємо, що ти з нами! Твоя серія — {count} дня поспіль. Повертайся по нові слова. | `editions/uk/strings.json` |
| `feedNotices.firstWeek.lastDayTextNoStreak` | Сім днів із SLOVO — і нових слів у запасі вже чимало! Завтра чекають нове слово дня і свіжий «Кросворд дня» — повертайся. | Дякуємо, що ти з нами! Повертайся по нові слова. | `editions/uk/strings.json` |
| `feedNotices.laterQuestions.interests.text` | Познач категорії слів для Стрічки. Решту сховаємо — повернути їх можна в Міксі. | Познач категорії слів для Стрічки. Решта стануть прихованими — повернути їх можна в Міксі. | `editions/uk/strings.json` |
| `feedNotices.laterQuestions.mixReview.text` | Налаштуй, що показувати у Стрічці: категорії слів, Виправлення, Фразеологізми, Синонімічні ряди, Поради. | Можна змінити, що показувати у Стрічці: категорії, Виправлення, Фразеологізми, Поради. | `editions/uk/strings.json` |
| `feedNotices.laterQuestions.open` | Зараз | Відкрити | `editions/uk/strings.json` |
| `feedNotices.laterQuestions.rarityTest.text` | 10 слів, хвилина, лише «Знаю» чи «Не знаю» — і Стрічка підбере рідкість саме для тебе. | Короткий тест підбере, наскільки рідкісні слова тобі показувати. | `editions/uk/strings.json` |
| `feedNotices.laterQuestions.wordGoalChoice.text` | Ціль тримає серію: виконаєш її — день зараховано. Обери свою. | Скільки слів бачити щодня. Поки не обереш, цілі немає. | `editions/uk/strings.json` |
| `feedNotices.levelMilestone.message` | Ще одна сходинка вгору! Спробуй рідкісніші слова або нову категорію в Міксі — тобі це вже під силу. | Можна спробувати рідкісніші слова або нову категорію в Міксі — якщо захочеться. | `editions/uk/strings.json` |
| `feedNotices.notificationReask.title` | Слово дня само прийде | Ще раз про сповіщення | `editions/uk/strings.json` |
| `feedNotices.weeklyRecap.spoken.goalDays.few` | ціль виконано: {count} дні із семи | ціль виконано {count} дні | `editions/uk/strings.json` |
| `feedNotices.weeklyRecap.spoken.goalDays.many` | ціль виконано: {count} днів із семи | ціль виконано {count} днів | `editions/uk/strings.json` |
| `feedNotices.weeklyRecap.spoken.goalDays.one` | ціль виконано: {count} день із семи | ціль виконано {count} день | `editions/uk/strings.json` |
| `feedNotices.weeklyRecap.spoken.goalDays.other` | ціль виконано: {count} дня із семи | ціль виконано {count} дня | `editions/uk/strings.json` |
| `feedNotices.weeklyRecap.spoken.known.few` | позначено «Знаю»: {count} картки | позначено «Знаю»: {count} записи | `editions/uk/strings.json` |
| `feedNotices.weeklyRecap.spoken.known.many` | позначено «Знаю»: {count} карток | позначено «Знаю»: {count} записів | `editions/uk/strings.json` |
| `feedNotices.weeklyRecap.spoken.known.one` | позначено «Знаю»: {count} картка | позначено «Знаю»: {count} запис | `editions/uk/strings.json` |
| `feedNotices.weeklyRecap.spoken.known.other` | позначено «Знаю»: {count} картки | позначено «Знаю»: {count} запису | `editions/uk/strings.json` |
| `feedNotices.weeklyRecap.spoken.saved.few` | збережено {count} картки | збережено {count} записи | `editions/uk/strings.json` |
| `feedNotices.weeklyRecap.spoken.saved.many` | збережено {count} карток | збережено {count} записів | `editions/uk/strings.json` |
| `feedNotices.weeklyRecap.spoken.saved.one` | збережено {count} картку | збережено {count} запис | `editions/uk/strings.json` |
| `feedNotices.weeklyRecap.spoken.saved.other` | збережено {count} картки | збережено {count} запису | `editions/uk/strings.json` |
| `feedNotices.weeklyRecap.spoken.seen.few` | переглянуто {count} картки | переглянуто {count} записи | `editions/uk/strings.json` |
| `feedNotices.weeklyRecap.spoken.seen.many` | переглянуто {count} карток | переглянуто {count} записів | `editions/uk/strings.json` |
| `feedNotices.weeklyRecap.spoken.seen.one` | переглянуто {count} картку | переглянуто {count} запис | `editions/uk/strings.json` |
| `feedNotices.weeklyRecap.spoken.seen.other` | переглянуто {count} картки | переглянуто {count} запису | `editions/uk/strings.json` |
| `knowledge.communityCounters.known.few` | «Знаю» — {known} з {count} читачів | Знають {known} з {count} читачів | `editions/uk/strings.json` |
| `knowledge.communityCounters.known.many` | «Знаю» — {known} з {count} читачів | Знають {known} з {count} читачів | `editions/uk/strings.json` |
| `knowledge.communityCounters.known.one` | «Знаю» — {known} з {count} читача | Знають {known} з {count} читача | `editions/uk/strings.json` |
| `knowledge.communityCounters.known.other` | «Знаю» — {known} з {count} читача | Знають {known} з {count} читача | `editions/uk/strings.json` |
| `knowledge.swipe.hint.rows.known.body` | Позначу слово як відоме. | Слово піде в підтверджені. | `editions/uk/strings.json` |
| `knowledge.swipe.hint.rows.unknown.body` | Додам у «Вчу» — повторимо завтра. | Додам у «Вчу» з днем повторення. | `editions/uk/strings.json` |
| `knowledge.swipe.menu.hide` | Не показувати | Сховати | `editions/uk/strings.json` |
| `knowledge.swipe.menu.toasts.unknown` | Позначено: не знаю. Повторимо завтра | Позначено: не знаю | `editions/uk/strings.json` |
| `mascot.dailyGoal` | Ціль дня виконано! Завтра нова — і серія росте. | Денну ціль виконано! | `editions/uk/edition.json` |
| `mascot.gameEnd` | Гарна розминка! Ще один раунд? | Гру завершено. Гарна розминка! | `editions/uk/edition.json` |
| `mascot.streakMilestone` | Оце серія! Завтра продовжимо? | Серія росте — ще один день поспіль! | `editions/uk/edition.json` |
| `noWords` | Слів поки немає. Зазирни в Мій Мікс або до прихованих записів у Параметрах. | У словнику ще немає слів. | `editions/uk/strings.json` |
| `share.standard` | Так правильно | Українською краще | `editions/uk/strings.json` |
| `wordCard.etymology` | Походження | Етимологія | `editions/uk/strings.json` |
| `wordCard.reveal` | Розкрити значення | Показати значення | `editions/uk/strings.json` |
| `wordOfTheDay.reveal` | Розкрий слово | Розкрити | `editions/uk/strings.json` |

### Ігри (56)

| Ключ | Вибраний текст | Зараз у застосунку | Файл |
|---|---|---|---|
| `game.dailyCrossword.solved` | Розгадано! | Розв’язано! | `editions/uk/strings.json` |
| `game.dailyCrossword.solvedMark` | ✓ Розгадано | ✓ Розв’язано | `editions/uk/strings.json` |
| `game.dailyCrossword.start` | Розгадати | Почати | `editions/uk/strings.json` |
| `game.dailyCrossword.traceHint` | Веди пальцем по сусідніх літерах, можна й навскіс, і склади слово з підказки. Кожна літера належить лише одному слову. | (рядка вже немає, видалено в #1982) | — |
| `game.modeBest.count` | Рекорд: {n} | Найкраще: {n} | `editions/uk/strings.json` |
| `game.modeBest.outOf` | Рекорд: {n} з {total} | Найкраще: {n} з {total} | `editions/uk/strings.json` |
| `game.modes.anagram.description` | Склади слово з перемішаних літер | Читаєш визначення — складаєш слово з перемішаних літер. | `editions/uk/strings.json` |
| `game.modes.anagram.refusals.too-few-entries` | Цьому режиму бракує слів на 4–9 літер. Поверни категорії в Налаштуваннях, розділ «Мій Мікс». | Замало слів на 4–9 літер у твоєму Міксі. Поверни кілька категорій у Налаштуваннях. | `editions/uk/strings.json` |
| `game.modes.anglicism.description` | Заміни англіцизм українським | У реченні — англіцизм, якому є український відповідник. Знайди його. | `editions/uk/strings.json` |
| `game.modes.anglicism.refusals.corrections-out-of-mix` | Виправлення вимкнено. Увімкни їх у Налаштуваннях, розділ «Мій Мікс». | Виправлень немає у твоєму Міксі. Увімкни їх у Налаштуваннях. | `editions/uk/strings.json` |
| `game.modes.anglicism.refusals.too-few-entries` | Цьому режиму бракує англіцизмів. Поверни категорії виправлень у Налаштуваннях, розділ «Мій Мікс». | Замало англіцизмів у твоєму Міксі. Поверни приховані в Налаштуваннях. | `editions/uk/strings.json` |
| `game.modes.build-idiom.description` | Читаєш значення — складаєш вислів слово за словом. | Читаєш значення — складаєш вислів, торкаючись його слів по порядку. | `editions/uk/strings.json` |
| `game.modes.build-idiom.refusals.idioms-out-of-mix` | Фразеологізми вимкнено. Увімкни їх у Налаштуваннях, розділ «Мій Мікс». | Фразеологізмів немає у твоєму Міксі. Увімкни їх у Налаштуваннях. | `editions/uk/strings.json` |
| `game.modes.build-idiom.refusals.too-few-entries` | Цьому режиму бракує фразеологізмів і прислів’їв. Поверни приховані вислови в Налаштуваннях, розділ «Приховані записи». | Замало фразеологізмів і прислів’їв у твоєму Міксі. Поверни приховані в Налаштуваннях. | `editions/uk/strings.json` |
| `game.modes.by-letters.description` | Збери слово літера за літерою | Читаєш визначення — вписуєш слово. Коли важко, відкриваєш літеру. | `editions/uk/strings.json` |
| `game.modes.by-letters.refusals.too-few-entries` | Цьому режиму бракує слів. Поверни категорії в Налаштуваннях, розділ «Мій Мікс». | Замало слів у твоєму Міксі. Поверни кілька категорій у Налаштуваннях. | `editions/uk/strings.json` |
| `game.modes.correction.description` | У реченні — помилка, яку часто чуєш. Обери, як сказати краще. | У реченні — поширена ненормативна форма. Знайди нормативну. | `editions/uk/strings.json` |
| `game.modes.correction.refusals.corrections-out-of-mix` | Виправлення вимкнено. Увімкни їх у Налаштуваннях, розділ «Мій Мікс». | Виправлень немає у твоєму Міксі. Увімкни їх у Налаштуваннях. | `editions/uk/strings.json` |
| `game.modes.correction.refusals.too-few-entries` | Цьому режиму бракує виправлень. Поверни категорії виправлень у Налаштуваннях, розділ «Мій Мікс». | Замало виправлень у твоєму Міксі. Поверни приховані в Налаштуваннях. | `editions/uk/strings.json` |
| `game.modes.guess-word.description` | Визначення є. Яке це слово? | Читаєш визначення — обираєш одне слово чи вислів з чотирьох. | `editions/uk/strings.json` |
| `game.modes.guess-word.refusals.too-few-entries` | Цьому режиму бракує слів і висловів. Поверни категорії в Налаштуваннях, розділ «Мій Мікс». | Замало слів і висловів у твоєму Міксі. Поверни кілька категорій у Налаштуваннях. | `editions/uk/strings.json` |
| `game.modes.idiom-meaning.description` | Вгадай, що означає вислів | Читаєш фразеологізм чи прислів’я — обираєш його значення з чотирьох. | `editions/uk/strings.json` |
| `game.modes.idiom-meaning.refusals.idioms-out-of-mix` | Фразеологізми вимкнено. Увімкни їх у Налаштуваннях, розділ «Мій Мікс». | Фразеологізмів немає у твоєму Міксі. Увімкни їх у Налаштуваннях. | `editions/uk/strings.json` |
| `game.modes.idiom-meaning.refusals.too-few-entries` | Цьому режиму бракує фразеологізмів і прислів’їв. Поверни приховані вислови в Налаштуваннях, розділ «Приховані записи». | Замало фразеологізмів і прислів’їв у твоєму Міксі. Поверни приховані в Налаштуваннях. | `editions/uk/strings.json` |
| `game.modes.origin.description` | З якої мови прийшло слово? | Бачиш слово і його визначення — обираєш мову, з якої воно походить. | `editions/uk/strings.json` |
| `game.modes.origin.refusals.too-few-entries` | Цьому режиму бракує слів із відомим походженням. Поверни категорії в Налаштуваннях, розділ «Мій Мікс». | Замало слів із відомим походженням у твоєму Міксі. Поверни кілька категорій у Налаштуваннях. | `editions/uk/strings.json` |
| `game.modes.pairs.description` | Чотири слова й чотири визначення — з’єднуєш їх у пари. | Чотири слова й чотири визначення — з’єднуєш кожне слово з його визначенням. | `editions/uk/strings.json` |
| `game.modes.pairs.refusals.too-few-entries` | Цьому режиму бракує слів. Поверни категорії в Налаштуваннях, розділ «Мій Мікс». | Замало слів у твоєму Міксі. Поверни кілька категорій у Налаштуваннях. | `editions/uk/strings.json` |
| `game.modes.stress.description` | Торкнись наголошеної голосної | Бачиш слово без наголосу — торкаєшся голосної, на яку він падає. | `editions/uk/strings.json` |
| `game.modes.stress.refusals.too-few-entries` | Цьому режиму бракує слів. Поверни категорії в Налаштуваннях, розділ «Мій Мікс». | Замало слів у твоєму Міксі. Поверни кілька категорій у Налаштуваннях. | `editions/uk/strings.json` |
| `game.modes.survival.description` | Три життя. Як далеко зайдеш? | Одне життя. Як далеко зайдеш? | `editions/uk/strings.json` |
| `game.modes.survival.glyph` | ⚑⚑⚑ | ♥ 1 | `editions/uk/strings.json` |
| `game.modes.survival.refusals.corrections-out-of-mix` | Виправлення вимкнено. Увімкни їх у Налаштуваннях, розділ «Мій Мікс». | Виправлень немає у твоєму Міксі. Увімкни їх у Налаштуваннях. | `editions/uk/strings.json` |
| `game.modes.survival.refusals.too-few-entries` | Цьому режиму бракує слів, висловів і виправлень. Поверни категорії в Налаштуваннях, розділ «Мій Мікс». | Замало слів, висловів і виправлень у твоєму Міксі. Поверни кілька категорій у Налаштуваннях. | `editions/uk/strings.json` |
| `game.modes.survival.roundLabel` | Твій хід | Виживання | `editions/uk/strings.json` |
| `game.modes.timed.description` | Хвилина. Скільки слів встигнеш? | Двадцять секунд. Скільки слів встигнеш? | `editions/uk/strings.json` |
| `game.modes.timed.glyph` | 60 с | 20 с | `editions/uk/strings.json` |
| `game.modes.timed.refusals.too-few-entries` | Цьому режиму бракує слів і висловів. Поверни категорії в Налаштуваннях, розділ «Мій Мікс». | Замало слів і висловів у твоєму Міксі. Поверни кілька категорій у Налаштуваннях. | `editions/uk/strings.json` |
| `game.modes.type-word.description` | У реченні — помилка, яку часто чуєш. Впиши, як сказати краще. | У реченні — поширена ненормативна форма. Впиши нормативну. | `editions/uk/strings.json` |
| `game.modes.type-word.refusals.corrections-out-of-mix` | Виправлення вимкнено. Увімкни їх у Налаштуваннях, розділ «Мій Мікс». | Виправлень немає у твоєму Міксі. Увімкни їх у Налаштуваннях. | `editions/uk/strings.json` |
| `game.modes.type-word.refusals.too-few-entries` | Цьому режиму бракує виправлень. Поверни категорії виправлень у Налаштуваннях, розділ «Мій Мікс». | Замало виправлень у твоєму Міксі. Поверни приховані в Налаштуваннях. | `editions/uk/strings.json` |
| `game.result.home` | До Стрічки | На головну | `editions/uk/strings.json` |
| `game.result.lost.line` | Нижче видно, де була помилка. А потім — ще раз? | Нічого — слова нікуди не дінуться. | `editions/uk/strings.json` |
| `game.result.lost.title` | Розминка! | Життя закінчилися | `editions/uk/strings.json` |
| `game.result.timeUp.line` | Ось скільки вдалося за хвилину. Побити? | Ось скільки вдалося за хвилину. | `editions/uk/strings.json` |
| `game.result.won.line.few` | {count} раунди — і всі твої. | Усі {count} раунди пройдено. | `editions/uk/strings.json` |
| `game.result.won.line.many` | {count} раундів — і всі твої. | Усі {count} раундів пройдено. | `editions/uk/strings.json` |
| `game.result.won.line.one` | {count} раунд — і той твій. | Усі {count} раунд пройдено. | `editions/uk/strings.json` |
| `game.result.won.line.other` | {count} раунду — і всі твої. | Усі {count} раунду пройдено. | `editions/uk/strings.json` |
| `game.round.synonymRow.prompt` | Яке слово — синонім до «{dominant}»? | Що є синонімом до „{dominant}“? | `editions/uk/strings.json` |
| `game.round.timer.few` | лишилися {count} секунди | лишилось {count} секунди | `editions/uk/strings.json` |
| `game.round.timer.many` | лишилося {count} секунд | лишилось {count} секунд | `editions/uk/strings.json` |
| `game.round.timer.one` | лишилася {count} секунда | лишилась {count} секунда | `editions/uk/strings.json` |
| `game.round.timer.other` | лишилося {count} секунди | лишилось {count} секунди | `editions/uk/strings.json` |
| `game.sheet.correct` | Влучно! | Правильно! | `editions/uk/strings.json` |
| `game.sheet.wrong` | Майже. Ось як правильно: | Не цього разу | `editions/uk/strings.json` |

### Збережене, пошук, історія, приховане (9)

| Ключ | Вибраний текст | Зараз у застосунку | Файл |
|---|---|---|---|
| `favorites.added.yesterday` | учора | вчора | `editions/uk/strings.json` |
| `favorites.remove` | Прибрати | Видалити | `editions/uk/strings.json` |
| `favorites.removeLabel` | Прибрати «{title}» з Улюбленого | Видалити «{title}» | `editions/uk/strings.json` |
| `hidden.entryRestored` | «{title}» знову в Стрічці | «{title}» знову у Стрічці | `editions/uk/strings.json` |
| `hiding.button` | Сховати | Не показувати | `editions/uk/strings.json` |
| `hiding.tile` | Не показувати | Сховати | `editions/uk/strings.json` |
| `history.relative.yesterday` | учора, {time} | вчора, {time} | `editions/uk/strings.json` |
| `search.nothingFound` | Нічого не знайдено. Спробуй інше написання. Пошук за значенням працює від трьох літер. Бракує слова? Запропонуй його в Налаштуваннях, у пункті «Про застосунок і відгук». | Нічого не знайдено | `editions/uk/strings.json` |
| `wordOfTheDayArchive.empty.message` | Сьогоднішнє вже чекає у Стрічці. Відкрий його — і тут з’явиться перший запис. | Слово дня з’явиться тут, щойно ти його побачиш. | `editions/uk/strings.json` |

### Профіль і відзнаки (8)

| Ключ | Вибраний текст | Зараз у застосунку | Файл |
|---|---|---|---|
| `settings.badges.conditions.dailyCrosswordRun.few` | Кросворд дня {count} дні поспіль | (рядка вже немає, видалено в #1982) | — |
| `settings.badges.conditions.dailyCrosswordRun.many` | Кросворд дня {count} днів поспіль | (рядка вже немає, видалено в #1982) | — |
| `settings.badges.conditions.dailyCrosswordRun.one` | Кросворд дня {count} день поспіль | (рядка вже немає, видалено в #1982) | — |
| `settings.badges.conditions.dailyCrosswordRun.other` | Кросворд дня {count} дні поспіль | (рядка вже немає, видалено в #1982) | — |
| `settings.profile.ladder.toNext` | {name}: ЩЕ {xp} XP | {name}: ще {xp} XP | `editions/uk/strings.json` |
| `settings.profile.noGameBest` | Ще жодної гри | Ще не грали | `editions/uk/strings.json` |
| `stats.calendar.days.frozen` | {day} {month}, заморозка врятувала день | {day} {month}, день врятовано заморозкою | `editions/uk/strings.json` |
| `stats.calendar.hint` | Проведи вгору або вниз, щоб змінити місяць | Проведи угору або вниз, щоб змінити місяць | `editions/uk/strings.json` |

### Налаштування (Мікс, сповіщення, віджет, анкета, тест) (20)

| Ключ | Вибраний текст | Зараз у застосунку | Файл |
|---|---|---|---|
| `mix.corrections.subtitle` | Росіянізми, кальки, суржик, наголос — і як краще сказати українською | «Так часто кажуть → Українською краще» | `editions/uk/strings.json` |
| `mix.idioms.subtitle` | Сталі вирази, прислів’я і топоніми з їхнім походженням | Сталі вирази й топоніми з їхнім походженням | `editions/uk/strings.json` |
| `mix.kindWeight.normal` | Помірно | Звичайно | `editions/uk/strings.json` |
| `mix.quickQuestion.normal` | Помірно | Звичайно | `editions/uk/strings.json` |
| `mix.quickQuestion.subtitle` | Як часто у Стрічці трапляється питання з Ігор. | Як часто у Стрічці трапляється питання з Гри. | `editions/uk/strings.json` |
| `notificationTemplates.farewell` | Нагадування на паузі. Слова нікуди не дінуться — повертайся, коли захочеш. | Ми зупиняємо нагадування | `editions/uk/strings.json` |
| `notificationTemplates.goalNotMet` | Ціль дня ще відкрита: кілька слів — і готово. | Ціль ще не виконана | `editions/uk/strings.json` |
| `notificationTemplates.titles.2` | Знаєш слово {word}? | Чи знаєш ти слово {word}? | `editions/uk/strings.json` |
| `notifications.denied.message` | Сповіщення вимкнено в налаштуваннях iOS, тому Слово дня вранці не приходить. Увімкни їх там — і воно повернеться. | Сповіщення вимкнені в налаштуваннях iOS | `editions/uk/strings.json` |
| `notifications.denied.openSettings` | Відкрити налаштування iOS | Відкрити налаштування | `editions/uk/strings.json` |
| `notifications.timeLabel` | Сповіщення, {time} | Сповіщення о {time} | `editions/uk/strings.json` |
| `questionnaire.level.0.label` | Поки небагато | Тільки починаю | `editions/uk/edition.json` |
| `questionnaire.level.4.label` | Перевір мене | Не знаю | `editions/uk/edition.json` |
| `rarityTest.result` | Твоя рідкість — до {n}. Стрічка бере незнайоме, рідші почекають. | Твоя рідкість: до {n} | `editions/uk/strings.json` |
| `rarityTest.retake` | Перевірити рівень ще раз | Пройти тест ще раз | `editions/uk/strings.json` |
| `rarityTest.subtitle` | 10 слів — і Стрічка підбере слова, нові саме для тебе | 10 слів — і ми підберемо рідкість саме для тебе | `editions/uk/strings.json` |
| `settings.anonymousStats.explanation` | Анонімні лічильники слів і відповідей опитування та анонімна статистика використання. Без акаунта, пошти й ідентифікатора пристрою. | Анонімні лічильники слів і відповідей анкети та анонімна статистика використання. Без акаунта, пошти й ідентифікатора пристрою. | `editions/uk/strings.json` |
| `settings.rows.questionnaire` | Анкета: підлаштувати Стрічку | Пройти опитування ще раз | `editions/uk/strings.json` |
| `widget.emptyCollection` | Додай слова в колекцію | Колекція порожня | `editions/uk/strings.json` |
| `widget.guide.steps.2.title` | Утримуй віджет і обери режим | Торкнися віджета, щоб обрати режим | `editions/uk/strings.json` |

### Вхід / акаунт (3)

| Ключ | Вибраний текст | Зараз у застосунку | Файл |
|---|---|---|---|
| `account.delete.button` | Видалити «{name}» | Видалити акаунт | `editions/uk/strings.json` |
| `account.delete.title` | Видалити «{name}»? | Видалити акаунт? | `editions/uk/strings.json` |
| `account.problems.refused` | Вхід не підтверджено. Спробуй ще раз або увійди кодом. | Google не підтвердив цей вхід. Спробуй ще раз або увійди кодом. | `editions/uk/strings.json` |

### Перший запуск (15)

| Ключ | Вибраний текст | Зараз у застосунку | Файл |
|---|---|---|---|
| `onboarding.dailyGoal.done` | Обираю | Готово | `editions/uk/strings.json` |
| `onboarding.dailyGoal.subtitle` | Це твоя денна ціль. Змінити можна в Налаштуваннях. | Скільки слів бачити щодня. Змінити можна в Налаштуваннях. | `editions/uk/strings.json` |
| `onboarding.firstWord.next` | Беру! | Далі | `editions/uk/strings.json` |
| `onboarding.firstWord.shout` | ТРИМАЙ! | ПЕРШЕ | `editions/uk/strings.json` |
| `onboarding.firstWord.title` | Твоє перше Слово дня. Завтра буде нове. | Твоє перше слово | `editions/uk/strings.json` |
| `onboarding.level.title` | Як у тебе з рідкісними словами? | Як добре ти знаєш мову? | `editions/uk/strings.json` |
| `onboarding.notificationTime.shout` | ДЗИНЬ! | НАГАДУВАННЯ | `editions/uk/strings.json` |
| `onboarding.notificationTime.title` | Коли нагадати про слово? | Коли нагадати? | `editions/uk/strings.json` |
| `onboarding.playStep.next` | Зіграю! | Далі | `editions/uk/strings.json` |
| `onboarding.playStep.subtitle` | Кросворд дня — щодня новий. А ще наголос, пари й анаграми. Тільки ти і слово. | Наголос, пари, анаграми й кросворд дня. Тільки ти і слово. | `editions/uk/strings.json` |
| `onboarding.welcome.start` | До першого слова | Почати | `editions/uk/strings.json` |
| `onboarding.welcome.subtitle` | Слова, якими захочеться здивувати друзів. | Гортай, зберігай, ділися й тренуйся. | `editions/uk/strings.json` |
| `onboarding.welcome.title` | Рідкісні слова рідної мови — нові щодня. | Рідкісні слова рідної мови — щодня по одному. | `editions/uk/strings.json` |
| `onboarding.why.title` | Чого ти хочеш від SLOVO? | Навіщо тобі рідкісні слова? | `editions/uk/strings.json` |
| `splash.tagline` | рідкісні слова щодня | Щодня одне рідкісне слово | `editions/uk/strings.json` |

### Категорії й Виправлення (7)

| Ключ | Вибраний текст | Зараз у застосунку | Файл |
|---|---|---|---|
| `categories.3.displayName` | Хата і побут | Побут і ремесла | `editions/uk/edition.json` |
| `categories.6.description` | Слова сцени, полотна й книжки — щоб в антракті було що сказати. | Слова сцени, полотна й книжки, які варто знати. | `editions/uk/edition.json` |
| `categories.8.description` | Зорі, кислоти й прилади теж мають українські імена. Згадаймо їх. | Українські наукові терміни, які варто повернути в ужиток. | `editions/uk/edition.json` |
| `correctionCard.reveal` | Відповідь | Показати | `editions/uk/strings.json` |
| `correctionCategories.3.description` | Каса, знижки й черга — і решта замість «здачі». | Каса, знижки й черга — як сказати правильно. | `editions/uk/edition.json` |
| `correctionCategories.4.displayName` | У дорозі | Транспорт | `editions/uk/edition.json` |
| `correctionCategories.6.description` | Кіно, спорт і соцмережі — обговорюй матч і серіал так, щоб не різало вухо. | Кіно, спорт і соцмережі — без кальок і суржику. | `editions/uk/edition.json` |

