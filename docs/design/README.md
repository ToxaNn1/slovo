# Design: «Клин 2.0: Рупор»

The app's design (ADR 0070). `export/` is the owner's Claude Design export «SLOVO interactive design system» of 2026-11-02, kept byte for byte; Prettier, oxlint and knip skip it. It is static HTML that doubles as data: **never open it in a browser or run it**, read it with `grep` and `sed -n`. Where a board and `CONTEXT.md` or an ADR disagree, the glossary and the ADRs win.

## The boards

| File                                                                                           | What it holds                                                                                                                                                                      |
| ---------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `export/SLOVO.dc.html`                                                                         | The canvas: tokens, fonts, components, the 19 screens, the Rupor states and Decor, widgets, Share Cards, system states.                                                            |
| `export/SlovoApp.dc.html`                                                                      | The prototype of the 19 screens (props: theme, start, reduceMotion, sound, decor, season). Holds the keyframes and the shape lists.                                                |
| `export/Rupor.dc.html`                                                                         | The Mascot as one SVG component (viewBox 150×112), its states and Decor accessories.                                                                                               |
| `export/SLOVO New Screens.dc.html`                                                             | The board of 85 more screens in both Themes, assembled from the `X*` files below.                                                                                                  |
| `export/XFeed`, `XGame`, `XSaved`, `XSettings`, `XCats`, `XShare`, `XOut`, `XDecor` `.dc.html` | The screens of one series each: Feed and Word card, Games and crossword, Saved and Profile, Settings and sheets, categories and Rupor scenes, Share Cards, outside the app, Decor. |
| `export/support.js`                                                                            | The Claude Design runtime the boards load. Not repo code.                                                                                                                          |

## Colour variables → token roles

The design sets its colours as CSS variables on `[data-slovo]`; `data-th` picks the Theme. Edition tokens carry the values (`editions/<edition>/tokens.json`); the Core names the roles (`packages/contracts/src/edition-tokens.ts`).

| CSS variable | Role (new, or kept)      | Light                   | Dark                    | Used for                                         |
| ------------ | ------------------------ | ----------------------- | ----------------------- | ------------------------------------------------ |
| `--bg`       | `background`             | `#FFF4E6`               | `#140C0A`               | The screen.                                      |
| `--ink`      | `ink`                    | `#140C0A`               | `#FFF4E6`               | Text.                                            |
| `--sf`       | `surface`                | `#FFFBF5`               | `#221714`               | Settings cards, sheets.                          |
| `--sf2`      | `surfaceSunken`          | `#F5E4CF`               | `#2E201B`               | Icon buttons, search, stat cards, chips.         |
| `--tile`     | `tile` (new)             | `#FFFBF5`               | `#33241F`               | The face of a tile or button.                    |
| `--edge`     | `tileEdge` (new)         | `#DCC2A6`               | `#050302`               | The 3D edge of a tile.                           |
| `--r`        | `accent`                 | `#FF3B2F`               | `#FF3B2F`               | Wedges, the main button, success.                |
| `--re`       | `accentEdge` (new)       | `#C4271D`               | `#C4271D`               | The red's edge and pressed shadow.               |
| `--c`        | `onAccent` (new)         | `#FFF4E6`               | `#FFF4E6`               | Cream on red.                                    |
| `--hl`       | `highlight` (new)        | `#F2D3AE`               | `#5A3C33`               | The crossword word, the selected letter.         |
| `--mute`     | `muted`                  | `#6B5D55`               | `#BDAE9F`               | Secondary text.                                  |
| `--line`     | `line`                   | `rgba(20,12,10,.13)`    | `rgba(255,244,230,.13)` | Hairlines.                                       |
| `--sil`      | `silhouette` (new)       | `rgba(20,12,10,.14)`    | `rgba(255,244,230,.10)` | The off track, the locked Badge, the empty tile. |
| `--bar`      | `tabBar` (new)           | `rgba(255,244,230,.94)` | `rgba(20,12,10,.94)`    | The tab bar (blur 14).                           |
| `--k`        | (the ink in both Themes) | `#140C0A`               | `#140C0A`               | Black on red, the stamp and record borders.      |

`correct`, `heart` and `destructive` are the red (`accent`); `wrong` is the ink with a slash. `decor` stays. `inkSecondary`, `track` and `inactiveTab` are removed. Radii: `tile` 12–14, `button` 16, `card` 18, `chip` 10, `sheet` 24. Fonts: **Unbounded** 400/600/800/900 (the word, shout, headings, buttons) and **Onest** 400/500/600/700 (reading and meta). The Core owns shapes, type roles, offset shadows (rest 5 px, pressed 1 px and 4 px down), the halftone raster, the wedge `clip-path` lists and the motion keyframes, which the boards define in `SlovoApp.dc.html` (`slScr`, `slCasc`, `slPop`, `slFly`, `slStamp`, `slToast`, `slSheet`, `slRm` and the rest). Under Reduce Motion every animation is `slRm`, one 0.3 s fade.

## Do not port

The boards draw looks, not features. These are the design's own names, possibly invented: check each against `CONTEXT.md` and the ADRs before a screen draws it. What the Core and the Edition have (some Game Modes, Badges, Levels) takes the design's look; what they lack is not built, and the screen takes the nearest component's style or leaves it out. The list is verbatim from the inventory of 2026-11-02.

- Game modes (13, 4 groups): ЗВУК: Наголос, Рими · ЗНАЧЕННЯ: Обери правильне, Пари, Синоніми, Фразеологізми · БУКВИ: Анаграми, Пропущена літера, Зайве слово · ШВИДКІСТЬ: На час (20 с), Бліц ("Три хвилини" in desc but 30 s in code), Марафон (до трьох помилок), Суржик-фікс. Plus Кросворд дня (5 слів, ~4 хв, №48). New Screens add: Вгадай слово, За буквами, Впиши слово, Звідки слово, Англіцизми, Склади вислів, Виживання.
- Categories (16): Погода, Почуття, Побут, Розстріляна лексика, Ремесла, Їжа, Природа, Звуки, Рухи, Кохання, Музика, Діалектизми, Архаїзми, Неологізми, Сленг, Наука. Fixes (7): Суржик, Наголоси, Кальки, Канцелярит, Пароніми, Відмінки, Правопис.
- Mood дня: Бадьоро, Сонно, Допитливо, Задумливо (with Rupor replies).
- Levels: «Словолов» (level 7, 640/1000 XP), next «Словотвор». XP: +15 know, +5 learn, +50 crossword.
- Badges: Серія — Три дні, Тиждень, Два тижні, Місяць, Сотня днів, Двісті днів, Рік без пропусків; Ігри — Влучний наголос, Без жодної помилки, Пароль-пара, Анаграміст, Блискавка, Десять перемог, П’ятдесят перемог; Слова — Перше слово, Їжак-словник, Десять слів, П’ятдесят слів, Сто слів, Колекціонер, Ходячий словник. Also «Сім кросвордів поспіль».
- Saved tabs: Вчу, Улюблене, Історія, Колекції, Слова дня. Sample collections: Осінні слова, Для листа колезі…, Карпатські діалекти, Смішні.
- Settings: groups ВИГЛЯД (Тема Світла/Темна/Системна, Менше руху, Decor, Шрифт і розмір), ЗВУК І СПОВІЩЕННЯ (Звуки, Сповіщення 08:00/12:30/20:30/Вимкнено, Віджети Малий/Середній/Великий/Екран блокування), НАВЧАННЯ (Ціль дня 1/3/5), АКАУНТ (Акаунт і синхронізація: Увійти через Apple / Увійти поштою; Конфіденційність: Анонімна статистика, Експортувати мої дані — "не показуємо рекламу"; Про SLOVO "Версія 2.0 (312)": Показати перший запуск, Оцінити застосунок), Скинути прогрес.
- Features in New Screens: Мій мікс, Приховане / «Не показувати», Перерва, Заморозка серії, Тест рідкості, Опитування, Слово тижня спільноти, Кінець кола, Повідомити про помилку, Слово від друга, Тихі години, Колекція за посиланням (веб), Spotlight/App Intents, Siri, «Лічильники», Походження.
- Copy: "ЛОВИ СЛОВО!", "Рідкісне. Свіже. Твоє на 24 години.", "ЩОДНЯ ОДНЕ СЛОВО", "Я знаю. А ти?", domain "slovo.app", "СЛОВО ДНЯ · №312".

Two disagreements inside the boards: the «Бліц»/«На час» text says three minutes while the prototype runs 30 s (the Core's value wins), and `slShake` in `XSettings` shakes a field while the canvas says nothing shakes (nothing shakes).
