# Design: «Клин 2.0: Рупор»

The app's design (ADR 0070). `export/` is the owner's Claude Design export «SLOVO interactive design system» of 2026-11-12 (first imported 2026-11-02), kept byte for byte; Prettier, oxlint and knip skip it. It is static HTML that doubles as data: **never open it in a browser or run it**, read it with `grep` and `sed -n`. Where a board and `CONTEXT.md` or an ADR disagree, the glossary and the ADRs win.

## The boards

| File                                                                     | What it holds                                                                                                                                                                                                                                                                                                |
| ------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `export/SLOVO 00 Index.dc.html`                                          | The index of the numbered boards below.                                                                                                                                                                                                                                                                      |
| `export/SLOVO 01 First Launch.dc.html` … `export/SLOVO 17 Texts.dc.html` | One board per part of the app, both Themes: 01 First Launch, 02 Feed, 03 Word Card, 04 Swipe and Actions, 05 Categories, 06–07 Games, 08 Crossword, 09 Saved and Search, 10 Profile, 11 Settings, 11.1 Voice, 12 Modals and States, 13 Rupor Scenes, 14 Share Cards, 15 Outside the App, 16 Decor, 17 Texts. |
| `export/SLOVO QA Walkthrough.dc.html`                                    | «Покрокова перевірка»: the owner's step-by-step check of the app, screen by screen.                                                                                                                                                                                                                          |
| `export/SLOVO Feed Everything.dc.html`                                   | Every Feed card and state on one page.                                                                                                                                                                                                                                                                       |
| `export/SLOVO All Screens.dc.html`                                       | Every drawn screen on one page, each in both Themes.                                                                                                                                                                                                                                                         |
| `export/SlovoApp.dc.html`                                                | The prototype of the screens (props: theme, start, reduceMotion, sound, decor, season). Holds the keyframes and the shape lists.                                                                                                                                                                             |
| `export/Rupor.dc.html`                                                   | The Mascot as one SVG component (viewBox 150×112), its states and Decor accessories.                                                                                                                                                                                                                         |
| `export/X*.dc.html`                                                      | The screens of one series each, which the boards above assemble: `XFeed`, `XEntry2`, `XSwipeV`, `XGame`, `XSaved`, `XBadges`, `XSettings`, `XVoice`, `XCats`, `XShare`, `XOut`, `XDecor`, `XSplash`, `XTexts`.                                                                                               |
| `export/SLOVO Logo.dc.html`, `export/SlovoMark.dc.html`                  | The logo: versions 1a–1c compared; **1c «Клин-плакат» is chosen** and drawn on every board. `SlovoMark` is the mark as one SVG component.                                                                                                                                                                    |
| `export/exports/`                                                        | The logo files: `slovo-icon-1024.png` (the app icon), `mark.svg` (the mark), `favicon.svg` (the site's favicon).                                                                                                                                                                                             |
| `export/support.js`                                                      | The Claude Design runtime the boards load. Not repo code.                                                                                                                                                                                                                                                    |

The 2026-11-12 export replaced the older boards `SLOVO.dc.html`, `SLOVO New Screens`, `SLOVO Swipe`, `SLOVO Word Actions`, `XActions` and `XSwipe`; code comments that name `XActions` or `XSwipe` point at what board 04 Swipe and Actions now draws.

## Chosen on 2026-11-04

- **Logo 1c «Клин-плакат»**: the wordmark SLOVO in cream on a black wedge band (`clip-path: polygon(0 16%,100% 0,100% 100%,0 84%)`; on red, the band is the ink), the mark a red wedge with a cream S. It replaces the old red wedge beside the word everywhere: the Feed header, the splash, Share Cards, widgets, the app icon and the site's favicon.
- **Swipe «Знаю / Не знаю»**: right is Known, left is Unknown; the card tilts with the finger, a wedge stamp slides in from its edge, the threshold is 90 px with a light haptic, the card flies off and the next rises from under it, short of the threshold it springs back. The vertical Feed scroll stays. A tutorial shows once on the first card after onboarding; under Reduce Motion it is the sheet without the card's motion.
- **Card actions 3C**: heart and bookmark on the card, «⋯» opens «ДІЇ ЗІ СЛОВОМ» (Поділитися, Сховати…, Помилка). The card keeps a fixed height; the cream block scrolls inside it with a fade at the bottom. The five action tiles and the two mark buttons go.
- **Settings categories**: a two-column grid of tiles with Category pictograms, «9 з 16 обрано»; the Settings screen scrolls.

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
| none         | `accentText` (new)       | `#C4271D`               | `#FF5247`               | Small red text, at 4.5:1 on every ground.        |
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
- Features the boards add: Мій мікс, Приховане / «Не показувати», Перерва, Заморозка серії, Тест рідкості, Опитування, Слово тижня спільноти, Кінець кола, Повідомити про помилку, Слово від друга, Тихі години, Колекція за посиланням (веб), Spotlight/App Intents, Siri, «Лічильники», Походження.
- Copy: "ЛОВИ СЛОВО!", "Рідкісне. Свіже. Твоє на 24 години.", "ЩОДНЯ ОДНЕ СЛОВО", "Я знаю. А ти?", domain "slovo.app", "СЛОВО ДНЯ · №312".

Two disagreements inside the boards: the «Бліц»/«На час» text says three minutes while the prototype runs 30 s (the Core's value wins), and `slShake` in `XSettings` shakes a field while the canvas says nothing shakes (nothing shakes).
