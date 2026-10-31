# SLOVO design system

Extracted from the owner's Claude Design export of 2026-10-11 ([`claude-design/`](claude-design/)). The canvas is the visual source; this document turns it into tokens, components and a screen index for implementers. Where the canvas and `CONTEXT.md` or an ADR disagree, the glossary and the ADRs win (see [Gaps and contradictions](#gaps-and-contradictions)).

The design idea, in the designer's words: "an old good book you turn with your thumb". Literata for the Word, Manrope for the UI. The palette is black thread, red thread, gold and linen canvas. Red is only Decor and accent, never "error". Every Decor element is built from 2×2 pt cross-stitches. The Core knows nothing about embroidery: same layouts, and its slots hold a thin line and a dot.

All sizes are in pt (CSS px on the canvas). Screens are drawn at 393×852 (iPhone 15/16), with one check at 375×667 (SE).

## Colour tokens

The canvas defines six semantic roles per Edition and Theme (artboard 1h). The names below are the canvas's roles translated to English; the Core owns the names, and an Edition supplies the values (ADR 0006).

| Token              | Core light | Core dark | UA light  | UA dark   |
| ------------------ | ---------- | --------- | --------- | --------- |
| `color.background` | `#F4F4F2`  | `#111111` | `#F5EEE2` | `#15110E` |
| `color.surface`    | `#FFFFFF`  | `#1C1C1C` | `#FBF7F0` | `#1F1915` |
| `color.ink`        | `#161616`  | `#F2F2F0` | `#1E1813` | `#F3EADB` |
| `color.muted`      | `#6A6A6A`  | `#9C9C9C` | `#6B5E4E` | `#B5A893` |
| `color.accent`     | `#161616`  | `#F2F2F0` | `#A3221B` | `#D4AE5C` |
| `color.decor`      | `#D6D6D2`  | `#3A3A3A` | `#9C7A2E` | `#C8372D` |

The roles in plain words: background is the screen; surface is cards, grouped lists and sheets; ink is primary text; muted is secondary labels (part of speech, timestamps, captions); accent is the active tab, links, the pronunciation button and toggles; decor is ornament only.

The screens also use these values, which the token table does not name. The proposed names are ours.

| Proposed token               | Core light            | UA light                   | UA dark                            | Used for                                                         |
| ---------------------------- | --------------------- | -------------------------- | ---------------------------------- | ---------------------------------------------------------------- |
| `color.inkSecondary`         | `#3D3D3D`             | `#3E342A`                  | `#D9CDB9`                          | Example sentence, synonym value, row subtitles                   |
| `color.surfaceSunken`        | `#EFEFEC`             | `#F0E5D3`                  | `#2A221C`                          | Category chip, example-pair box, skeleton blocks, mini cards     |
| `color.track`                | n/a                   | `#EADFCB`                  | `#2A221C`                          | Segmented-control track, Round progress track                    |
| `color.switchOff`            | n/a                   | `#D8CCB8`                  | n/a                                | Switch track when off (switch on uses `color.accent` `#A3221B`)  |
| `color.line`                 | `rgba(0,0,0,.08–.14)` | `rgba(156,122,46,.18–.32)` | `rgba(212,174,92,.14–.35)`         | Card borders (≈30%), list separators (≈14–22%), tab bar top line |
| `color.scrim`                | n/a                   | `rgba(30,24,19,.45)`       | `rgba(0,0,0,.45–.6)`               | Behind sheets and dialogs                                        |
| `color.primaryButton` / `On` | n/a                   | `#1E1813` / `#F5EEE2`      | `#D4AE5C` or `#F3EADB` / `#15110E` | Primary button fill / label                                      |
| `color.inactiveTab`          | `#6A6A6A` (see below) | `#6B5E4E`                  | `#B5A893`                          | Tabs that are not selected                                       |

Semantic colours that every Edition must keep apart from the Decor red (artboard 1h: "Game answers are separate semantic tokens, so that the embroidery red never reads as an error"):

| Proposed token        | Value     | Used for                                                                      |
| --------------------- | --------- | ----------------------------------------------------------------------------- |
| `color.correct`       | `#2F6B45` | Correct answer fill, the ✓ in a Correction's example pair (light)             |
| `color.correctOnDark` | `#8FC79F` | "Правильно!" on a dark sheet, the ✓ in the example pair (dark)                |
| `color.wrong`         | `#A3271F` | Wrong answer fill, "Не цього разу" (from 0.5 `#E8877D` in dark, for text)     |
| `color.destructive`   | `#A3271F` | Delete and Clear actions (swipe action, confirmation buttons)                 |
| `color.heart`         | `#C8372D` | Filled Favorites heart and filled Lives in dark; Lives use `#A3221B` in light |

From 0.3 `heart` and `destructive` are colour roles of the Edition tokens like the six above, with the values of this table in both Themes.

The canvas draws the Core's inactive tabs in `#8A8A8A`, which is only 3.1:1 on `#F4F4F2`; the Core uses `#6A6A6A` (its `color.muted`, 4.9:1) instead. A test in `apps/mobile` holds every text colour of the 0.2 screens at 4.5:1 or more on what it is drawn on, in both Themes, for the Core and for every Edition.

All text and background pairs above pass WCAG AA (4.5:1): we checked, for example, `#6B5E4E` on `#F5EEE2` at 5.5:1, `#B5A893` on `#1F1915` at 7.4:1, white on `#2F6B45` at 6.3:1 and white on `#A3271F` at 7.3:1. The decor colours (`#9C7A2E` at 3.5:1, `#C8372D` at 3.6:1) are only for graphics and never carry text.

### Decor pattern colours

The Ukrainian Decor is drawn as SVG patterns (defined once at the top of the canvas):

| Pattern                   | Colour                                   | Theme |
| ------------------------- | ---------------------------------------- | ----- |
| `zzGold` zig-zag (16×10)  | `#D4AE5C`                                | dark  |
| `zzRed` zig-zag (16×10)   | `#A3221B`                                | light |
| `bgDark` cross tile (44)  | `#D4AE5C` at 6%                          | dark  |
| `bgLight` cross tile (44) | `#A3221B` at 5%                          | light |
| `rosGold` rosette (18)    | `#D4AE5C` outline, `#C8372D` cross       | dark  |
| `rosLight` rosette (18)   | `#A3221B` outline, `#1E1813` cross       | light |
| `cornGold` corner (16)    | `#D4AE5C` L-stitch, `#C8372D` inner mark | dark  |
| `cornLight` corner (16)   | `#9C7A2E` L-stitch, `#A3221B` inner mark | light |

## Typography

| Role | Family                                               | Weights used              |
| ---- | ---------------------------------------------------- | ------------------------- |
| Word | **Literata** (book serif with optical sizes 7–72 pt) | 400, 400 italic, 500, 600 |
| UI   | **Manrope** (calm grotesque)                         | 400, 500, 600, 700        |

Literata is chosen because its Cyrillic and the combining acute U+0301 render cleanly at every size (artboard 1h tests 13 pt, italic, 600 and two stresses in one Lemma). Literata covers the Lemma, Definitions, Examples, headings, big numbers and Game answers; Manrope covers everything else. `type.family.*` is an Edition token, so another Edition may swap both families.

### Scale

| Style                         | Font                         | Size / line height                        | Notes                                             |
| ----------------------------- | ---------------------------- | ----------------------------------------- | ------------------------------------------------- |
| Lemma, Feed                   | Literata 500, −0.01em        | 48 / 1.05 (M)                             | Follows the font-size step; static mockups use 52 |
| Lemma, hero                   | Literata 500, −0.02em        | 76 / 1                                    | Onboarding welcome                                |
| Lemma, Share Card             | Literata 500                 | 54 (story), 34 (square)                   |                                                   |
| Lemma, widget                 | Literata 500                 | 28–30 small, 34 medium                    |                                                   |
| Lemma, list row               | Literata 400–500             | 20–22                                     | Favorites, History, Hidden                        |
| Definition                    | Literata 400                 | 19 / 1.5 (M)                              |                                                   |
| Example                       | Literata 400 italic          | 17 / 1.5 (M)                              | `color.inkSecondary`                              |
| Example author                | Manrope 500                  | 13                                        | "— з народного мовлення", `color.muted`           |
| Part of speech                | Manrope 500                  | 14                                        | `color.muted`                                     |
| Synonym line                  | Manrope 400                  | 15                                        | Label in `color.muted`, value in `inkSecondary`   |
| Correction, non-standard form | Literata 400, struck through | 26 / 1.2                                  | Strike in accent at 50–60%                        |
| Correction, standard form     | Literata 500                 | 46 (light mockup), Lemma size in the Feed |                                                   |
| Correction explanation        | Manrope 400                  | 16 / 1.55                                 |                                                   |
| Screen title                  | Literata 500                 | 32–36                                     | "Налаштування", "Збережене", "Гра"                |
| Sheet / dialog title          | Literata 500                 | 24–26                                     |                                                   |
| Empty-state title             | Literata 500                 | 26–30 / 1.2                               |                                                   |
| Game definition               | Literata 400                 | 25 / 1.35                                 |                                                   |
| Answer option                 | Literata 500                 | 21                                        |                                                   |
| Big number                    | Literata 500                 | 64 (Streak), 26–30 (stats, counts)        |                                                   |
| Block heading                 | Manrope 700                  | 17                                        |                                                   |
| UI body                       | Manrope 500                  | 15                                        | iOS Dynamic Type `body`                           |
| Button                        | Manrope 700                  | 15–16                                     |                                                   |
| Chip                          | Manrope 600                  | 12.5                                      |                                                   |
| Overline label                | Manrope 700, +0.14em, caps   | 11                                        | "ВИЗНАЧЕННЯ", "ТЕМА", "СЛОВО ДНЯ · 11 ЖОВТНЯ"     |
| Tab label                     | Manrope 600 (700 selected)   | 10.5                                      |                                                   |

### Font-size steps (S / M / L / XL)

The user's font size scales the Word card only; the UI follows iOS Dynamic Type (`type.ui` 15 → `body`). From the developer token table (artboard 4d):

| Token          | S   | M     | L   | XL  |
| -------------- | --- | ----- | --- | --- |
| `type.lemma`   | 40  | 48–52 | 56  | 64  |
| `type.def`     | 17  | 19    | 21  | 23  |
| `type.example` | 15  | 17    | 19  | 21  |

The live Feed uses Lemma 40 / 48 / 56 / 64, but the Settings preview uses other values (see gaps). On the SE the Lemma drops to 44 at M, card padding shrinks by 25% and the Category chip moves into the synonym row; at XL the Definition is cut to 3 lines with "Ще".

## Spacing, radii, shadows

**Spacing** is a 4-pt grid: `space.1` 4, `space.2` 8, `space.3` 12, `space.4` 16, `space.5` 20, `space.6` 24, `space.8` 32. In practice:

- Screen side padding 24 (Feed, Game), 20 (Settings, Saved, Collections), 28–32 (onboarding).
- Word card padding 32 top, 26 sides, 26 bottom; 18–20 between blocks. Correction card 28 / 26 / 24, 16 between blocks.
- Status bar 54, navigation row 44, Feed top row 44–50, tab bar 84 (50 on SE).
- Touch targets ≥ 44: action-row buttons 52, list rows 52–60, primary buttons 50–56, answer buttons ≥ 58.

**Radii** are tokens, never layout. The UA Edition is square-cornered "like canvas and stitch":

| Token           | Core | UA                  |
| --------------- | ---- | ------------------- |
| `radius.card`   | 22   | 4                   |
| `radius.chip`   | 14   | 2 (3 in one mockup) |
| `radius.button` | 14   | 4                   |
| `radius.sheet`  | 22   | 22 (system)         |

Other radii on the screens: dialog 6, toast 6, segmented control 4 (segment 3), iOS-style action sheet 14, Stats pill 20, pronunciation button a full circle (44), widgets 22–24, app icon 40 at 180 pt.

**Shadows and lines:**

| Token        | Value                                                  |
| ------------ | ------------------------------------------------------ |
| `elev.card`  | none; a 1 pt border in `color.line` at about 30%       |
| `elev.sheet` | a top hairline in `color.line`, plus a scrim at 45–60% |
| `elev.toast` | `0 10 30 rgba(0,0,0,.4)`                               |
| `line.hair`  | 1 pt in the decor colour at 14–22%                     |

Small extras: switch thumb `0 1 3 rgba(0,0,0,.25)`; selected segment `0 1 3 rgba(0,0,0,.12)`.

## Motion, sound and haptics

From artboard 3e and the canvas keyframes. Every animation has a Reduce Motion variant. The [animation audit](animation-audit.md) of 0.8.14 lists every animation of the app against the motion rules of ADR 0055 and the change each needs.

| Moment           | Motion                                                                     | Haptic                           | Sound                    | Reduce Motion                 |
| ---------------- | -------------------------------------------------------------------------- | -------------------------------- | ------------------------ | ----------------------------- |
| Feed swipe       | 300 ms spring at the swipe's speed, one card per screen; no swipe: eased   | selection, on every card         | none                     | 200 ms cross-fade             |
| Heart (Favorite) | 300 ms: springs to 1.2, then back to 1 with a small bounce                 | impact light                     | a soft "tuk"             | fill only                     |
| Correct answer   | 250 ms fill to `color.correct` and scale 1.03; the fill stays until «Далі» | notification success             | a plucked string, rising | fill only                     |
| Wrong answer     | 200 ms fill to `color.wrong`, then a ±4 pt shake twice (300 ms)            | notification warning (not error) | a muted string           | fill only                     |
| Life lost        | 300 ms: scale 1.4 and rotate −12°, then the heart turns to an outline      | impact medium                    | none                     | the fill fades to the outline |
| Win              | rosettes "stitch" in one after another, 120 ms apart, spring 300 ms        | success ×2                       | a bandura chord          | 250 ms fade, all together     |
| Sheet            | slides up 320 ms, `cubic-bezier(.2,.8,.2,1)`                               | none                             | none                     | n/a                           |
| Loading          | skeleton pulse 1.4 s; the divider is stitched in square by square (140 ms) | none                             | none                     | static skeleton, full divider |

The notification has its own sound: a quiet bandura pluck of 0.6 s.

**Built in 0.5:** the shake and the fill start together, as on the canvas, and the other options fade in 200 ms. The right option fills in 250 ms on a wrong answer too, but grows only on a right one. A lost Life pops 200 ms after the answer, once the wrong choice has filled, so its medium haptic follows the warning instead of blurring into it; its fill fades to the outline as the pop comes back. The win's second success comes 300 ms after the first. Each motion runs whatever the system setting, and with Reduce Motion the Game leaves out the scale, the shake and the pop itself.

## Components

Each component is shown in the screens listed; light and dark refer to the UA Edition unless marked Core.

**Word card** (`feed-word-card-*`). A surface card with `radius.card`, a 1 pt line border and four corner ornaments (Decor slot 3). Top row: the Lemma with Stress, and under it the part of speech (abbreviated, e.g. "ім., ж. р.") with an optional register chip (an outlined accent chip, e.g. "розм.", "заст."); the pronunciation button (44 pt outlined circle, speaker icon, accent) on the right. Then the ornament divider (Decor slot 2), the primary Definition, the Example in italics with its author, the synonym line ("Синонім:" or "Антонім:") and the Category chip (`surfaceSunken`, `radius.chip`). Variants:

- **Word of the Day**: a filled accent badge "СЛОВО ДНЯ · 11 ЖОВТНЯ" above the Lemma.
- **Review** (0.8.6): an outlined accent label "ПОВТОРЕННЯ" at the top of a card the Feed brought back for Review, on Word and Correction cards alike, drawn like the badge (overline type, badge padding, `radius.chip`) with a 1 pt accent border on the surface.
- **Linked to a Correction**: a footer row under a hairline, with a lightbulb icon and «Часто кажуть: _на протязі_». The row is left out while Corrections are out of the Mix (Settings › Мій Мікс), on the Feed and on the Entry screen, and comes back with them.

**Correction card** (`feed-correction-card-*`). The same card with the same four corner ornaments (Decor slot 3, drawn since 0.8.5). Overline "ВИПРАВЛЕННЯ" with an outlined Correction Type chip on the right (росіянізм / калька / суржик / канцелярит / англіцизм). "Так часто кажуть" over the non-standard form in muted ink, struck through in a soft accent. A divider whose centre is a downward arrow instead of the rosette. "Українською краще" in accent over the standard form at Lemma size. A neutral explanation. An example pair on `surfaceSunken`: "—" before the non-standard sentence, a ✓ in `color.correct` before the standard one. Under it, when the Correction has sources, a muted line naming them (Manrope 13, «Джерело: ‹title›»; several titles are joined with «; »), built in 0.8.5 and left out without sources. No red "error" styling anywhere.

**Action row** (`feed-word-card-dark`, `feed-word-card-favorited-dark`). Four 52 pt icon buttons spread evenly under the card: Favorite (heart), Share, Add to Collection (bookmark with a plus), Hide (thumb down). Labels exist only for VoiceOver: "Додати в Улюблене" / "Прибрати з Улюбленого", "Поділитися", "Додати до колекції", "Не показувати". A favorited heart fills with `color.heart` and pops.

**Chips.** Category chip (filled `surfaceSunken`); register and Correction Type chips (outlined accent, 11–11.5 pt); Mix chips in onboarding (44 pt tall, `radius.chip`; on = filled ink, off = surface with a line border; the "Усі" chip is filled accent when everything is on).

**Buttons.** Primary: 50–56 tall, full width, `radius.button`, filled `primaryButton`. Secondary: same size, transparent with a 1 pt light border. Text button: accent or muted label, ≥ 44 tall ("Пізніше", "+ Додати час", "+ Нова колекція"). Destructive: filled `color.destructive` with white label. Toggle: iOS switch 51×31, on = accent. Segmented control: `track` background, selected segment on surface with a small shadow (Theme, Font size, feedback type).

**Answer buttons** (`game-round-*`). 58 pt tall, `radius.button`, the word in Literata 21. States:

| State                      | Fill            | Border                  | Text      | Tag on the right |
| -------------------------- | --------------- | ----------------------- | --------- | ---------------- |
| Default (dark)             | `#1F1915`       | `rgba(243,234,219,.16)` | ink       | none             |
| Default (light)            | `#FBF7F0`       | `rgba(156,122,46,.35)`  | ink       | none             |
| Correct                    | `color.correct` | same                    | white     | "Правильно"      |
| Wrong (the user's choice)  | `color.wrong`   | same                    | white     | "Ваш вибір"      |
| Disabled (after answering) | unchanged       | unchanged               | unchanged | opacity 0.45     |

**Lives** (`game-round-*`). Five 20 pt hearts top right, 3 pt apart. Full = filled `color.heart` (`#A3221B` in light); lost = an outline in ink at 30–35%. VoiceOver: "Життів: 4 з 5".

**Round progress.** Left of the Lives: "7 / 15" (Manrope 700, 13) over a 4 pt bar (`track` background, accent fill, width animates 300 ms; with Reduce Motion it is set at once). The ✕ exit button (44 pt) sits on the far left.

**Correction mode** (`game-mode-select-dark`, `game-round-correction-answered-light`). **Built in 0.5:** its mode card «ВИПРАВЛЕННЯ / Обери правильне» is drawn on the ink fill in the other scheme's tokens, like the Favorites card, without the corner Decor; its sample «слідуючий → наступний» is upright Literata with the non-standard form struck through in the accent at 55%. While Corrections are out of the Mix the card fades and says «Виправлень немає у вашому Міксі. Увімкніть їх у Налаштуваннях.» in place of the sample; an Edition without Corrections has no such card. **Built after 0.5:** just after launch, until the Game has planned its offers (well under a second), every mode card fades as a refused one does and takes no tap, but keeps its sample and gives no reason. Should the planning fail, the Game tries again after 1, 2 and 4 s and on the next return to the foreground; the cards stay faded without a reason meanwhile, since the reader can do nothing about it. A Round reads «ЯК СКАЗАТИ КРАЩЕ?» over the sentence; the non-standard form, where the sentence holds it as written, sits on `surfaceSunken` underlined in the accent, and VoiceOver reads «Виділено: ‹form›» after the sentence. The answer sheet shows the standard form at the answer's size and the Correction's explanation (Manrope 16 / 1.55) under it.

**Sheets.** Bottom sheet with `radius.sheet` top corners, a 38×5 grabber, slide-up motion and a scrim. Uses: Stats, Add to Collection, the Game answer sheet (inverted colours: cream on dark, dark on light), feedback form. The built sheet (Add to Collection) slides in 320 ms and leaves in 220 ms; with Reduce Motion it fades in place. The scrim is the light Theme's ink at 45% and black at 60% in the dark one; the sheet closes on a tap on the scrim, a drag down on the grabber, VoiceOver's escape gesture, and «Готово». The design draws neither the sheet with no Collection (the name field is open at once, without the keyboard) nor a refused name (a line of ink text under the field in the Edition's words, and a heart-coloured border).

**Popups.** Centred alert dialog (radius 6, surface, title in Literata 24, body, primary then secondary full-width buttons) for "Вийти з гри?" and "Очистити Історію?" (both built as system alerts instead, see below). Deleting a Collection asks the same way, with the SLOVO confirmation dialog (title and message over the destructive «Видалити» and «Скасувати»); the design canvas drew an iOS action sheet for it, it became a system alert in #302 because it offers one action (`docs/react-native.md`), and the SLOVO dialog replaced that alert in 0.8.5. A toast with an undo button at the bottom (radius 6, inverted colours, `elev.toast`, 4 s) after restoring a Hidden Entry. **Built in 0.3:** one undo toast for every such moment, first «‹Lemma› приховано» after hiding an Entry from its card (in «» quotes, what the Entry's row leads with: the Lemma with its Stress, or a Correction's main standard equivalent), on the Feed and on the Entry screen. It sits 16 pt above the tab bar and from the sides, on the ink fill with the message in the background colour (Manrope 500, 15) and a «Скасувати» button on the background fill (Manrope 700, 15, `radius.button`, 44 pt tall); it fades in over 200 ms (at once with VoiceOver on), and a new toast takes the place of the one before. With VoiceOver on, VoiceOver moves to the toast and reads it, and the toast stays until the reader takes the undo or uses the escape gesture, so «Скасувати» is always in reach. The hide button opens a SLOVO bottom sheet with a row «Не показувати цей запис», then «Не показувати категорію «‹Category›»» on a Word card or «Не показувати Виправлення» on a Correction card, and «Скасувати» last. The Category option is left out for the last Category in the Mix, and either option when what it names is out of the Mix already (on the Entry screen a list opens). Their toasts read «Категорію «‹Category›» приховано» and «Виправлення приховано», and the undo puts the Category or Corrections back in the Mix. **Built in 0.8.14 for Mistake Reports:** the same toast without a button, once the report is sent or queued offline, reads «Дякуємо! Ми перевіримо.», and over the daily limit «Забагато повідомлень сьогодні. Спробуйте завтра.»; with nothing to undo it leaves after 4 s, VoiceOver on too. In the Feed the next card takes the hidden one's place at once, from its top, also when every card after it left with it, and the undo puts the hidden card back on screen. **Built in 0.5 for leaving a Game:** «Вийти з гри?» is the system alert, as «Очистити Історію?» is, not the drawn dialog: «Вийти з гри?» / «Прогрес буде втрачено.» with «Грати далі» (cancel) and «Вийти» (destructive). The ✕ (44 pt touch target, a 20 pt ink glyph) sits at the start of the Round header and is read «Вийти з гри»; «Грати далі» returns to the same Round and state, and «Вийти» drops the Game and shows the mode screen.

**List rows.** Grouped lists on a surface card with hairline separators, 52–56 pt rows: label left, value and chevron right, or a switch. Word rows: Lemma in Literata 20–22 with a timestamp or kind on the right and an optional Definition below. Swipe left reveals 84–96 pt actions ("Видалити" in `destructive`, "Назва" in muted). History groups rows under day overlines ("СЬОГОДНІ", "УЧОРА").

**Empty states** (`favorites-empty-light`, `history-empty-dark`, `feed-end-of-cycle-dark`). Decor slot 4 (a 90–120 pt rosette) centred, a Literata title, one line of muted body text and an optional primary button.

**Tab bar.** 84 pt, four equal tabs in the brief's order: Головна · Налаштування · Гра · Збережене, 24 pt line icons (house, sliders, a diamond in a rounded square, bookmark). Selected tab in accent with a 700-weight label (and the Saved icon filled); others in `inactiveTab`. A 1 pt top line in `color.line`.

**Other pieces.** The Stats pill (Feed top left: flame icon and the Streak number, 40 pt tall, surface fill with an accent border; while the reader hides the Streak, the flame alone in a 40 pt circle, which still opens the stats sheet); the Feed position counter "1 / 6" top right; the first-launch swipe hint (an inverted pill "Гортайте вгору — наступне слово" above the tab bar); the skeleton card for loading; widgets (small 170×170: overline mode name, Lemma and zig-zag; medium 364×170: plus a short Definition); the notification (app icon, "SLOVO", time, Lemma with Stress in Literata 600, short Definition).

## Decor slots

The brief defines seven slots; the Core provides a neutral default for each, and the UA Edition fills them with cross-stitch Decor. Decor never carries text or behaviour.

| #   | Slot                      | Ukrainian Decor (dark / light)                                                                                                                                                                                            | Core default shown                        | Screens                                                                      |
| --- | ------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------- | ---------------------------------------------------------------------------- |
| 1   | Screen background         | A 44 pt tile with one cross-stitch "+": gold at 6% on `#15110E` / red at 5% on `#F5EEE2`. Used on the Feed, onboarding, splash and Share Cards.                                                                           | Plain background colour (implied)         | `feed-*`, `splash-dark`, `tokens-and-decor-kit`                              |
| 2   | Ornament divider          | A zig-zag band (10 pt) with an 18 pt eight-point rosette in the middle; gold and red / red and black. The Correction card swaps the rosette for a down arrow. Also used alone as a band (sheets, widgets, About).         | A 1 pt line with a 5 pt dot in the middle | `feed-word-card-*`, `feed-word-card-core-vs-ukrainian-light`                 |
| 3   | Word card frame / corners | 16 pt L-shaped stitched corners with an inner mark: gold and red / ochre and red. Four on the Word card, two on other cards.                                                                                              | None (the card is just rounded 22)        | `feed-word-card-*`, `game-round-dark`                                        |
| 4   | Empty-state illustration  | A large rosette (90–120 pt), gold / red.                                                                                                                                                                                  | Not shown                                 | `favorites-empty-light`, `history-empty-dark`, `feed-end-of-cycle-dark`      |
| 5   | Share Card frame          | Story: zig-zag bands at the top and bottom on the pattern background. Square: four corners, and slot 2 as the divider.                                                                                                    | Not shown                                 | `share-card-*`                                                               |
| 6   | Game victory illustration | The rosette of slot 4, in dark and light; the result screen shows it at 120 pt on a win, stitched in layer by layer 120 ms apart, and at 64 pt on a loss, still. (The canvas's board draws three rosettes, marked "TBD".) | Not shown                                 | `game-result-win-dark`, `game-result-loss-dark`, `motion-sound-haptics-dark` |
| 7   | Splash / launch           | A 72 pt rosette, the letter-spaced "SLOVO" wordmark, the tagline "рідкісні слова рідної мови" and a zig-zag band near the bottom, on the dark pattern.                                                                    | Not shown                                 | `splash-dark`                                                                |

**The Core's neutral Decor stays minimal** (the owner's decision in 0.2, closing gap 22). It fills slot 2 only, with the 1 pt line and the 5 pt dot; slots 1, 3, 4, 5, 6 and 7 stay empty, so an Edition without Decor shows a plain background, cards with just their rounded corners, empty states and the error state without an illustration, plain Share Cards, and the native splash alone. Both Themes draw it from the Core's token table.

What changes between Editions (artboard 4d): tokens (`color.*`, `type.family.*`, `radius.*`, `motion.sound.*`) and Decor (7 slots × light/dark, SVG patterns without text). What never changes: layouts, block order, touch-target sizes and the tab bar.

## Screen index

All PNGs are in [`screens/`](screens/), rendered at 2× from the canvas, including the main interactive states. Phone screens have transparent corners; boards keep the canvas background. "Artboard" is the id on the canvas.

### 0.2 Feed

| PNG                                            | Screen and state                                                                              | Artboard |
| ---------------------------------------------- | --------------------------------------------------------------------------------------------- | -------- |
| `feed-word-of-the-day-swipe-hint-dark.png`     | Feed, Word of the Day card with register chip, first-launch swipe hint, dark                  | 1b       |
| `feed-word-card-dark.png`                      | Feed, Word card, dark                                                                         | 1b       |
| `feed-word-card-favorited-dark.png`            | Feed, Word card with the heart filled (Favorites itself is 0.3), dark                         | 1b       |
| `feed-word-card-register-label-dark.png`       | Feed, Word card with a register chip and an antonym, dark                                     | 1b       |
| `feed-word-card-often-said-dark.png`           | Feed, Word card linked to a Correction («Часто кажуть»), dark                                 | 1b       |
| `feed-correction-card-dark.png`                | Feed, Correction card (калька), dark                                                          | 1b       |
| `feed-end-of-cycle-dark.png`                   | Feed, end-of-Cycle card, dark                                                                 | 1b       |
| `feed-word-card-light.png`                     | Feed, Word card, UA Edition, light                                                            | 1a       |
| `feed-word-card-core-light.png`                | Feed, Word card, Core tokens, light                                                           | 1a       |
| `feed-word-card-core-vs-ukrainian-light.png`   | The same Word card with the Core tokens and the UA Edition side by side, light                | 1a       |
| `feed-correction-card-light.png`               | Feed, Correction card (росіянізм), light, without the action row                              | 1d       |
| `feed-word-card-iphone-se-light.png`           | Feed, Word card on iPhone SE 375×667, font size M, light                                      | 2e       |
| `feed-loading-dark.png`                        | Feed, loading skeleton with the divider being stitched, dark                                  | 4a       |
| `feed-error-light.png`                         | Feed, error state, light; 0.2 ships it as a local error, without the network copy (gap 8)     | 4a       |
| `splash-dark.png`                              | Splash (Decor slot 7), dark                                                                   | 1g       |
| `app-icon-light-dark.png`                      | App icon at 180 pt, and at 60 pt in dark and light                                            | 1g       |
| `tokens-and-decor-kit.png`                     | Colour tokens, Lemma specimens S–XL with the U+0301 test, UI type, the 7 Decor slots          | 1h       |
| `tokens-for-developers.png`                    | Spacing, radii (Core → UA), shadows, font-size steps, what Editions may change                | 4d       |
| `settings-light.png`                           | Settings, top: Theme and Font size with the live preview (Theme and font size are 0.2), light | 2b       |
| `settings-font-size-s-light.png`               | Settings, font size S, light                                                                  | 2b       |
| `settings-font-size-l-light.png`               | Settings, font size L, light                                                                  | 2b       |
| `settings-font-size-xl-dark-preview-light.png` | Settings, font size XL with the Theme set to dark, so the preview card turns dark             | 2b       |
| `motion-sound-haptics-dark.png`                | Motion, sound and haptics notes for the Feed swipe, heart and Game (Game parts are 0.5)       | 3e       |

### 0.3 My words

| PNG                                           | Screen and state                                                                                                                                           | Artboard |
| --------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- | -------- |
| `saved-overview-light.png`                    | Saved tab: Favorites, Collections and History cards with counts, light                                                                                     | 1e       |
| `favorites-list-light.png`                    | Favorites list, newest first, light                                                                                                                        | 3b       |
| `favorites-row-swipe-delete-light.png`        | Favorites list with a row swiped to "Видалити", light                                                                                                      | 3b       |
| `favorites-empty-light.png`                   | Favorites empty state (Decor slot 4), light                                                                                                                | 3b       |
| `history-list-dark.png`                       | History grouped by day, dark                                                                                                                               | 3c       |
| `history-clear-confirm-dark.png`              | History, "Очистити Історію?" confirmation, dark                                                                                                            | 3c       |
| `history-empty-dark.png`                      | History empty state, dark                                                                                                                                  | 3c       |
| `collections-manage-delete-confirm-light.png` | Collections: a row being renamed, a row swiped to Назва / Видалити, and the delete action sheet of the canvas (the build shows an alert since #302), light | 3d       |
| `add-to-collection-sheet-dark.png`            | Add to Collection sheet with checkboxes, dark                                                                                                              | 2c       |
| `add-to-collection-new-collection-dark.png`   | Add to Collection sheet with the inline "new Collection" field filled, dark                                                                                | 2c       |
| `hidden-entries-dark.png`                     | Hidden Entries and Hidden Categories with "Повернути" / "Увімкнути", dark                                                                                  | 4c       |
| `hidden-entries-undo-toast-dark.png`          | Hidden, after restoring one Entry: the undo toast, dark                                                                                                    | 4c       |
| `settings-scrolled-light.png`                 | Settings, bottom: Notifications, My Mix, Hidden, Sounds, Widgets, About, light                                                                             | 2b       |
| `about-light.png`                             | About and feedback, light                                                                                                                                  | 5a       |
| `about-feedback-word-light.png`               | Feedback sheet "Нове слово", filled in (the typed `'` becomes the stress mark), light                                                                      | 5a       |
| `about-feedback-error-light.png`              | Feedback sheet "Помилка", empty, light                                                                                                                     | 5a       |
| `about-feedback-sent-light.png`               | Feedback sheet, thank-you state, light                                                                                                                     | 5a       |

### 0.4 Habit and onboarding

| PNG                                    | Screen and state                                                                                                                                                                                                            | Artboard |
| -------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------- |
| `stats-sheet-dark.png`                 | Stats sheet from the Streak pill, dark                                                                                                                                                                                      | 1b       |
| `onboarding-1-welcome-dark.png`        | Onboarding 1, welcome with a hero Word, dark                                                                                                                                                                                | 2a       |
| `onboarding-2-mix-light.png`           | Onboarding 2, choose the Mix: Category chips, "Усі", Corrections switch, light                                                                                                                                              | 2a       |
| `onboarding-3-notifications-light.png` | Onboarding 3, notifications with a sample and three default times, light                                                                                                                                                    | 2a       |
| `onboarding-4-slovo-id-dark.png`       | Onboarding 4, SLOVO ID, marked "later version" (the Account itself is 0.7), dark. Built in 0.8 without «ПІЗНІША ВЕРСІЯ»: the SLOVO ID screen opens over the step, and its back link «Збережіть свої слова» comes back to it | 2a       |
| `widgets-and-notification.png`         | The notification (0.4), plus the widgets (0.6)                                                                                                                                                                              | 2d       |

### 0.5 Game

| PNG                                        | Screen and state                                                                     | Artboard |
| ------------------------------------------ | ------------------------------------------------------------------------------------ | -------- |
| `game-mode-select-dark.png`                | Game Mode select: "Вгадай слово" and "Обери правильне", dark                         | 3a       |
| `game-round-dark.png`                      | Round in the Definition → Word mode, before answering (Round 7 of 15, 5 Lives), dark | 1c       |
| `game-round-correct-dark.png`              | Round after a correct answer, with the answer sheet, dark                            | 1c       |
| `game-round-wrong-dark.png`                | Round after a wrong answer: a Life lost, "Не цього разу" sheet, dark                 | 1c       |
| `game-round-correction-answered-light.png` | Round in the Correction mode after a correct answer, with the haptics marker, light  | 3a       |
| `game-exit-confirm-dark.png`               | "Вийти з гри?" confirmation, dark                                                    | 1c       |
| `game-result-win-dark.png`                 | Result, win (Decor slot 6), dark                                                     | 1c       |
| `game-result-loss-dark.png`                | Result, loss (no Lives left), dark                                                   | 1c       |

### 0.6 Share and widget

| PNG                                      | Screen and state                                                  | Artboard |
| ---------------------------------------- | ----------------------------------------------------------------- | -------- |
| `share-card-word-story-dark.png`         | Share Card for a Word, story format, dark                         | 1f       |
| `share-card-correction-square-light.png` | Share Card for a Correction, square, light                        | 1f       |
| `widgets-and-notification.png`           | Widgets: small dark and light, medium dark (Collection) and light | 2d       |
| `widget-guide-step-1-light.png`          | "Віджети: як додати", step 1 (icons jiggle), light                | 4b       |
| `widget-guide-step-2-light.png`          | Widget guide, step 2 (widget gallery), light                      | 4b       |
| `widget-guide-step-3-light.png`          | Widget guide, step 3 (the widget on the home screen), light       | 4b       |

## Gaps and contradictions

Listed for the owner to decide; the design itself is left unchanged. Gaps marked **Closed in 0.2** were settled by the 0.2 Feed spec (#51) and built in 0.2.

### Against `CONTEXT.md` and the data model

1. **Categories and register labels are mixed up.** The Mix chips include "Застарілі" and "Діалектні", and the Hidden screen lists "Застарілі" under Categories. These are register labels (`archaic`, `dialectal`), not Categories. The other chip names ("Розум і характер", "Побут і гомін", "Час", "Простір і рух", "Почуття", "Природа") are not the UA Edition's Categories (`editions/uk/edition.json`: "Людина і тіло", "Емоції та характер", "Природа і погода", "Побут і ремесла", "Техніка", "Військова справа", "Мистецтво і культура", "Історія та старовина", "Наука", "Мова і мовлення"). **Closed in 0.3 for the Mix:** the Мій Мікс screen offers the Edition's Categories only, in the Edition's order, plus «Усі»; no register labels. **Closed in 0.3 for the Hidden screen:** its Categories section lists the Hidden Categories by their Edition names (a Category out of the Mix, ADR 0019), never register labels.
2. **Lives and Favorites share one glyph.** Both are the same heart in the same red (`#C8372D`). The glossary keeps them apart (Life: _Avoid_ "Heart"), and the brief itself says "5 lives (hearts)". A different Life glyph, or at least a different colour, would avoid confusion. **Kept in 0.5:** the Lives sit in the Game header, where no heart action exists, so they keep the heart glyph and `color.heart`.
3. **The Word card shows less than a Word holds.** The contract has `extraDefinitions`, several `examples`, both `synonyms` and `antonyms`, `etymology` and several `registers`. The design shows one Definition, one Example, one synonym _or_ one antonym, one register chip, and no Etymology at all. The brief asked for optional extra Definitions and Etymology. **Closed in 0.2:** the card shows the primary Definition, the first Example, up to three Synonyms, antonyms, every register chip and the Category chip, and «Детальніше» opens the etymology, extra Definitions and further Examples.
4. **Example author is hard-coded.** Every Example reads "— з народного мовлення"; the contract's `author` is optional, and the design has no state without an author. **Closed in 0.2:** the author line shows only when the Example names one.
5. **Part of speech is abbreviated** ("ім., ж. р.", "прикм.", "присл.") while `editions/uk/strings.json` has full labels ("іменник"…) and no gender labels yet. Decide on one form; the gender abbreviation needs new strings. **Closed in 0.2:** the card shows the dictionary short forms, VoiceOver reads the full words, and the Edition strings hold both, gender included.
6. **Stress inside a Correction.** The light Correction card shows «протягом ро́ку» with a stress mark, but a Correction's `standardEquivalents` are plain text with no Stress field. **Closed in 0.2:** Corrections carry no Stress.
7. **A Correction with several standard equivalents** (e.g. «наступний / такий» in the brief) is not designed. **Closed in 0.2:** the main equivalent at the Lemma's size, the others as «також: …».
8. **The Feed network error contradicts offline-first.** "Нитка урвалася — Немає з'єднання з інтернетом" assumes the Feed needs the network, but the Language Pack ships with the app (ADR 0041). A local failure state is more likely; the current Core string is "Не вдалося відкрити словник.". **Closed in 0.2:** a local error state, «Нитка урвалася» over «Не вдалося відкрити словник.» with «Спробувати ще» and the broken-thread illustration (slot 4); no network copy and no «Відкрити Збережене».
9. **The Feed position counter "1 / 6"** suggests a finite, counted Feed. The Feed is an endless stream until the end of a Cycle; the counter looks like a canvas demo aid. Confirm whether it ships. **Closed in 0.2:** no counter ships.
10. **Hidden copy is narrower than the concept.** "Ці записи й категорії не з'являються у Стрічці" says Feed only; a Hidden Entry is also excluded from notifications, widgets and the Game. The restore buttons differ too: "Повернути" for Entries, "Увімкнути" for Categories. **Closed in 0.3:** the subtitle reads «Вони більше не трапляться вам ніде, доки ви їх не повернете.» The screen is Settings › Приховане (the row «Приховані записи» shows the count, «0 записів» too): «ЗАПИСИ» newest first, each row the Lemma (a Correction its main standard equivalent) over «слово · ім., ж. р.» or «виправлення · росіянізм» (kind, then the part of speech with gender and the registers, or the Correction Type) and an outlined «Повернути» (accent outline at 45%, radius 6, 44 pt tall) that takes the Entry out of the list under the undo toast «‹Lemma› знову у Стрічці» (undo hides it again with the time it was hidden before, so it returns to its old place in the list); «КАТЕГОРІЇ» rows with the Category's name and «Увімкнути», which puts it back in the Mix (Corrections taken out of the Mix show as a row «Виправлення» with the same button, so the screen is never empty while something is out); with nothing hidden, a muted line «Прихованих записів немає.» A row is read as its Lemma, kind and labels in whole words, with the restore button apart. At the largest text sizes of iOS (scale above 1.3) the button drops under the text and a Lemma or a name stops growing at 1.3×, so no word breaks. Checked in both Themes on iPhone 16 and SE.
11. **Deleting a Collection** says "15 слів залишаться в Історії та Улюбленому". That is only true for Entries already in History or Favorites; deleting a Collection adds nothing to Favorites. **Closed in 0.3:** the system action sheet (a system alert since #302) reads «Видалити колекцію «‹name›»?» / «Самі записи нікуди не зникнуть.», with «Видалити» and «Скасувати»; deleting a Collection removes it and its Entry records and leaves its Entries in Favorites, History and other Collections.
12. **"слів" for Entries.** Collection counts, the Stats sheet and Favorites say "слів"/"слово", but Collections and Favorites hold Entries, which include Corrections (the demo Collections contain «брати участь»). **Closed in 0.3:** counts say «записів» in every plural form of the Edition's language («1 запис», «2 записи», «17 записів»), chosen with `Intl.PluralRules`; Hermes lacks it, so the app adds a pure-JavaScript polyfill with the Edition's plural rules only (ADR 0020). The Favorites card and the Favorites list show the bare number, as drawn, and VoiceOver reads the count in full. The Add to Collection sheet and the Collections card's Collections say «1 запис», «2 записи», «17 записів»; the Collections card's own count is the bare number of Collections, and VoiceOver reads it in full («3 колекції»).
13. **The brief uses "round" for the Cycle** ("The next swipe starts a new round"), against the glossary (Cycle; Round is a Game term). The design avoids it ("почнемо нове коло"), so only the brief needs fixing.

### Inconsistencies inside the design

14. **Font-size steps disagree.** The Feed uses Lemma 40 / 48 / 56 / 64; the token table says 40 / 48–52 / 56 / 64; the Settings preview uses 38 / 46 / 54 / 62 for the Lemma and 15 / 17 / 19 / 21 for the Definition, where the token table says 17 / 19 / 21 / 23. Static mockups use a Lemma of 52 at M. One table must be chosen. **Closed in 0.2:** one table, Lemma 40 / 48 / 56 / 64 and Definition 17 / 19 / 21 / 23, for the Feed and the Settings preview alike. On a screen narrower than 390 pt (the SE) the Lemma drops by 44/48 at every step, in the Feed and in the preview alike (44 at M).
15. **The UA chip radius** is 2 in the token table and the Feed, but 3 on the light Word card. **Closed in 0.2:** 2.
16. **The light Correction card has no action row**, while Corrections in the dark Feed have one. **Closed in 0.3:** the Word and the Correction card share one action row: three 52 pt buttons spread evenly (the heart, Add to Collection, Hide); Share joins in 0.6.
17. **The story Share Card is not 9:16.** It is 324 wide plus 34 padding on each side (content-box), so it renders at 392×576, not 324×576. **Closed in 0.6:** the Story Share Card is 324×576 with the 34 pt padding inside it, a true 9:16, and its image is captured at 1080×1920.
18. **The wrong-answer sheet hides the correct option.** The brief wants the chosen button red and the correct one green; the sheet covers the lower buttons, so the green one is often out of sight (the sheet does name the right Word).
19. **The win screen still shows "рекорд 13"** after a 15 / 15 result; the best result does not update. **Closed in 0.5:** «рекорд» is the best result with the Game just over included, so a 15 / 15 win shows «15». It shows on the result screen after every finished Game; each mode card on the mode screen shows its own Best result (the line under its title, with its Rounds, Lives and «Найкраще — 13 / 15.», went in 0.8.12), and the stats sheet the fourth cell «13 / 15» over «найкраще у Грі», both left out before the first finished Game and when the Edition turns the Game off. The best result is one per Edition across both Game Modes.
20. **Lives use `#A3221B` in light but `#C8372D` in dark**, and the light Favorites heart is never shown filled. **Closed in 0.3 for the heart:** the filled Favorites heart is `color.heart` `#C8372D` in both Themes (3:1 or more against the background and the surface); Lives stay open for 0.5. **Closed in 0.5 for the Lives:** they are `color.heart` in both Themes, full when filled and an outline in ink at 32% when lost.

### Missing screens and states (the brief asked for light and dark of every screen)

21. **Most screens exist in one theme only.** No light Feed with Word of the Day, end of Cycle or loading; no dark Correction card outside the Feed; no dark Settings, Saved, Favorites, Collections, About or widget guide; no light Game, Stats, History, Hidden or Add to Collection; no light splash; dark error state missing. **Closed in 0.2 for the 0.2 screens:** each is built from the tokens and checked in both Themes; the other screens stay open for their versions. **Closed in 0.3 for Favorites:** the Saved overview, the Favorites list, its empty state and the Entry screen are built from the tokens and checked in both Themes; the Favorites card is drawn on the ink fill with its content in the other scheme's tokens and Decor, so it is cream with a red band in dark. **Closed in 0.3 for Add to Collection:** the sheet and the Collections card of the Saved overview are built from the tokens and checked in both Themes, on iPhone 16 and SE. **Closed in 0.3 for History:** the History list, its empty state and the History card of the Saved overview are built from the tokens and checked in both Themes on iPhone 16 and SE, with the largest text size of iOS; the confirmation is the system alert «Очистити Історію?» rather than the drawn dialog, and a screen title stops growing at 1.3× so it never breaks a word. **Closed in 0.3 for the undo toast:** drawn in dark only, it is built from the tokens and checked in both Themes on iPhone 16 and SE: cream on dark, and dark ink with a cream button on light. **Closed in 0.3 for the Collections screen:** the list, the field that names a Collection and the swipe actions are built from the tokens and checked in both Themes on iPhone 16 and SE, with the largest text size of iOS. A row is a surface card with the name (Manrope 700, 17) and the count («17 записів», muted) on one line and the newest Lemmas under it (Literata 22, joined by « · »); at the largest text sizes the count drops under the name instead of squeezing it. «+» at the top right opens the field for a new Collection, drawn like the rename field of the design (an accent border, the overline «НОВА КОЛЕКЦІЯ», the name on the sunken fill; the keyboard's return key keeps the name, leaving the field drops it, and a refused name stays with its reason in the destructive colour under it). A row swiped to «Назва» becomes that field in place under «ПЕРЕЙМЕНУВАННЯ». **Closed in 0.8.5 for the «…» button (#423):** each row carries a «…» button at its right edge (three muted dots, a 44 pt tap area) that opens a bottom sheet with «Перейменувати» (the same in-place field), «Видалити» (destructive; the SLOVO dialog follows once the sheet has slid away) and «Скасувати»; the swipe stays. The copy waits for the owner's confirmation. The empty list reuses the empty state (Decor slot 4) with «Колекцій ще немає» and a «Нова колекція» button. The swipe action labels and the empty state's title stop growing at 1.3× so they never break a word. **Closed in 0.5 for the Game:** the mode screen, a Round, its answered states with the answer sheet and the result screens are built from the tokens and checked in both Themes on iPhone 16 and SE, with the largest text size of iOS. The answer fills are the light scheme's `correct` and `wrong` in both Themes, under white text; the answer sheet is drawn in the other scheme, so its «Правильно!» and «Не цього разу» take that scheme's `correct` and `wrong` (`wrong` is `#E8877D` in dark, to read on the dark surface). The Round shows the Rounds passed («0 / 15» in the first Round), moving up on «Далі». The tab bar stays under the Game screens. **Closed in 0.6 for the widget guide:** the guide (Settings › «Віджети: як додати») is built from the tokens and checked in both Themes on iPhone 16 and SE, with the largest text size of iOS. It draws one picture, the small and the medium widget on a home screen with the caption «Малий · Середній», over the three numbered steps, not one picture per step as the design's three screens do. The widgets are drawn in the other scheme than the screen, like the design's dark widget on the light Theme. The title and the steps' texts stop growing at 1.3× so no word breaks and a hint never outgrows its step's title. **Closed in 0.6 for the screen titles (#276):** a screen title stops growing at 1.3× and, where a word is still wider than the line (on the SE, «Налаштування» at 34 pt × 1.3), shrinks until its widest word fits, so no title breaks a word at any text size, in both Themes.
22. **The Core tokens are shown only as a light Word card.** There is no Core dark screen and no Core default for Decor slots 1 and 3–7 (only slot 2's line and dot), though the token table lists Core dark values. **Closed in 0.2:** the Core dark tokens come from the token table, and the Core's neutral Decor stays minimal (see [Decor slots](#decor-slots)).
23. **Decor slot 6 is marked "TBD"**, and the slots are shown in dark only on the Decor board. **Closed in 0.5:** slot 6 joins the Decor contract as an optional motif with the Core default of nothing. The UA Edition supplies the rosette of slot 4, drawn at 120 pt on a win and 64 pt on a loss, as the result screens show. On a win its layers stitch in one after another, 120 ms apart, each on the spring, 300 ms since 0.8.14 (the outline first, then the cross); with Reduce Motion they fade in together. The canvas's board of three rosettes gives way to the result screens, which show one.
24. **Settings sub-screens are missing:** the notification times list (add / edit / remove, up to 10), the My Mix screen, and the SLOVO ID / Account section (sign in, sign out everywhere, delete Account). **Closed in part in 0.3 for My Mix:** Settings › Мій Мікс is built from the tokens and checked in both Themes on iPhone 16 and SE, with the largest text size of iOS. It is the chip layout of `onboarding-2-mix-light` without the step, the «Оберіть свій Мікс» title, «Далі» and the count: a back link to «Налаштування», the title «Мій Мікс» with one line of muted text, then 44 pt chips that wrap (`radius.chip`; on is filled ink, off is the surface with a line border, and «Усі» is filled accent while every Category is on and an outline otherwise). The chips are the Edition's Categories in its order; the Corrections switch sits below them in a surface card with «Виправлення» and ««Так часто кажуть → Українською краще»», and is left out when the Edition doesn't turn Corrections on. A change applies at once. The chip of the last Category in the Mix is dimmed and disabled, with a line under the chips («Хоча б одна категорія лишається завжди, щоб було слово дня.») that VoiceOver reads once, as the disabled chip's hint. The «Мій Мікс» row of Settings is a live row with «Усі» or «N категорій» (the plural form of the Edition's language). The back link, on every screen that has one, stops growing at 1.3×, so a long screen name never breaks a word. **Closed in part in 0.4 for the notification times:** Settings › Сповіщення is built from the tokens and checked in both Themes on iPhone 16 and SE, with the largest text size of iOS. Under a back link to «Налаштування» and the title «Сповіщення», the Notification times sit in a surface card in time order, one row each: the time in the word family (Literata 500, 22) and a chevron. A swipe offers «Видалити» (the destructive colour), the same action VoiceOver offers on the row, which it reads «Сповіщення о 09:00». Under the card, «+ Додати час» in the accent colour (Manrope 700); at 10 times it is muted and disabled, with the line «Не більше 10 разів на день.» under it that VoiceOver reads once, as the button's hint. With no times left the card is left out. The switch «Звук сповіщень» sits in its own card below. A change applies at once. The «Сповіщення» row of Settings is a live row with «N на день», or «Вимкнено» with no times or while iOS denies notifications. Above a text scale of 1.3 a Settings row puts its value, or its switch, under its label instead of squeezing it, so no word breaks; the time stays on its line. A tap on a time, or on «+ Додати час», opens the system time picker in a bottom sheet (the same sheet as «До колекції»): the title «Час сповіщення», the iOS time wheels (24-hour in the UA Edition, starting from the time being changed, or from the current time for a new one) and a «Готово» button that keeps the time. A tap on the scrim, a drag down or VoiceOver's escape closes the sheet without a change. A time that is in the list already isn't kept: the one line «Такий час уже є.» shows under «+ Додати час», and VoiceOver announces it. A tappable time is read with the hint «Змінити час». On a dev client built before the native batch the picker is absent: «+ Додати час» is muted and disabled, a tap on a time does nothing, and removing still works; there is no fallback picker. **Closed in 0.7 for the Account section:** Settings › SLOVO ID is built from the tokens, rows, fields, buttons and system alerts, and checked in both Themes on iPhone 16 and SE, with the largest text size of iOS. «SLOVO ID» is the same name in every Edition. Its row heads Settings in a surface card of its own and reads «Увійти», or the email once signed in; it is left out when the Edition doesn't turn the Account on, and each time Settings opens the Account is checked. Under a back link to «Налаштування» and the title «SLOVO ID», signed out, the screen shows the field «Електронна пошта» (a muted caption over a surface field with a line border and `radius.button`, at least 44 pt tall) and the primary button «Надіслати код». Once the code is sent, the email stays in its field, sunken and read-only, over the field «Код із листа» (the number pad, the one-time-code content type, so iOS offers the code from Mail; it signs in as soon as it holds six digits), then the secondary buttons «Надіслати ще раз», dimmed and counting down «через N секунд» (the plural form of the Edition's language) until the minute is over, and «Змінити пошту», which goes back to the email field. Signed in, a muted «Ви увійшли як» over the email, then «Вийти», «Вийти на всіх пристроях» and «Видалити SLOVO ID», a secondary button filled with the destructive colour and a white label, as a destructive swipe action; it asks once in a system alert («Видалити SLOVO ID?», what goes and that the reader's words stay, «Скасувати» and the destructive «Видалити»). While a request is on the way, its button, or the code field, shows a spinner beside its label and takes no press, and the buttons that would start another are dimmed; «Вийти» always works, even offline. Each problem is one line under its field, or under the buttons when signed in (Manrope 600, caption, ink), and the field's border takes the destructive colour; VoiceOver announces the line each time it shows. Titles and button labels stop growing at 1.3×; the fields and buttons stand under one another at every text size, and an email too long for its line wraps under «Ви увійшли як» and in the row. The copy waits for the owner's confirmation.
25. **Other missing pieces:** a Collection's detail list; the full card opened from a list; the share flow (choosing story or square, the iOS share sheet); a Word Share Card in square and a Correction in story; the Pronunciation playing state; the Word of the Day in light; notification-permission-denied; loading, empty and error states for the Game, Saved and Settings. **Closed in part in 0.3:** a Collection's detail list is the Favorites list under the Collection's name: a link back to «Колекції», the name (wrapping, never cut) with the count in the accent colour on the right, then the shared Entry rows newest first with when each was added («сьогодні», «вчора», the date) and a footer. A swipe offers «Прибрати» (the destructive colour, also a VoiceOver action) and takes the Entry out of this Collection only; the empty Collection reuses the empty state (Decor slot 4) with «Колекція порожня» and a hint, without a button. A tap on a row of the Collections screen opens it. It is built from the tokens and checked in both Themes on iPhone 16 and SE, with the largest text size of iOS, where a row's date drops under its title instead of breaking it. The full card opened from a list is the Entry screen: one Entry card with its action row under a link back to the list (no pager), which stays open after its Entry leaves the list. The Favorites list's «Відновити демо» is a canvas aid and does not ship. The History list draws its rows with a kind on the right («слово», «виправлення», «слово дня») and no Definition, and its separators inset to the text; the Saved overview's History card shows the three latest rows with how long ago each was Seen («щойно», «5 хв тому», «сьогодні, 09:02», «вчора, 21:40», then «9 жовт., 08:05»; VoiceOver reads the minutes in full). «останні 500» is the cap, drawn from the Core's `HISTORY_CAP`. **Closed in part in 0.4 for notification-permission-denied:** while iOS denies the app notifications, Settings › Сповіщення shows, under the title and above the times, the line «Сповіщення вимкнені в налаштуваннях iOS» (Manrope, body size, ink) and under it a surface card with one row, «Відкрити налаштування» with a chevron, which opens the app's page in the iOS settings. The times, «+ Додати час» and the sound switch stay as they are below, and the times stay stored, so notifications start again at once when the reader allows them; coming back to the app reads the permission again. The «Сповіщення» row of Settings reads «Вимкнено» meanwhile. Before the reader is asked, as after «Пізніше» in the onboarding, the screen shows no such line but, in the same place, the primary button of the onboarding, «Увімкнути сповіщення», which asks iOS for permission; a grant plans the notifications, and the row reads «Вимкнено» until then. A dev client built before the native batch has no notifications at all, so it shows the button, which asks nothing. The copy waits for the owner's confirmation. It is built from the tokens; the line wraps and the row stacks at the largest text size of iOS like every Settings row. **Closed in 0.5 for the Game:** the Game is local, so it has no loading or error state; a mode that can't start for too few eligible Words fades on its card and says so in place of its sample («Замало слів у вашому Міксі. Поверніть кілька категорій у Налаштуваннях.»). **Closed in 0.6 for the share flow and the Share Card variants:** «Поділитися» sits in the action row between the heart and «Додати до колекції», on every Entry card, on the Feed and the Entry screen. It opens a bottom sheet (the same sheet as «До колекції»): the title «Поділитися карткою», a live preview of the Share Card scaled to fit (at most 58% of the screen's height, so the sheet fits the SE), under it the format control «Сторіс» / «Квадрат» (the segmented control of Settings), which switches the preview at once, and the primary «Поділитися». The sheet opens in the format chosen last in the session, Story at first. The control's labels and the toast stop growing at 1.3×, so they never break a word at the largest text size. A Word's Story Share Card is `share-card-word-story-dark` in the app's current Theme: the overline («СЛОВО ДНЯ» on today's Word of the Day, on the Feed and on the Entry screen, whose card of today's Word of the Day now carries its badge as the Feed's does; the Category otherwise; Manrope 700, 10, +0.22em, accent), the Lemma with Stress (Literata 500, 54), the part of speech with gender and then the registers, as the Entry card's chips show them, on one line («ім., ж. р. · розм.»; Manrope 500, 13, muted), the primary Definition (Literata 400, 19/1.45), centred over Decor slot 1, and the Edition's display name as the watermark 52 pt above the bottom (Manrope 600, 11, +0.32em, muted). Its type ignores the reader's text size. A Lemma too wide for its line shrinks to half its size and then wraps, and text too tall for the card shrinks until it fits; nothing is cut. The Square (`share-card-correction-square-light`, 300 pt on each side at the design's scale) starts at the top inside 30 pt of padding (28 at the sides) with 10 pt between its blocks, and ends in a footer: the overline on the left and the watermark on the right (Manrope 600, 10, +0.24em, muted). A Word in Square has the Lemma at 34, the part of speech line at 12 and the Definition at 15. A Correction's Share Card, in both formats, has the Correction Type as its overline («КАЛЬКА»; on top in the accent in Story, in the footer in Square), «Так часто кажуть» (Manrope 500, 13 in Story and 12 in Square, muted) over the non-standard form struck through in the accent at 50% (Literata 400, 32 and 20, muted), Decor slot 2 with the Correction's arrow, and «Українською краще» (accent) over the main standard equivalent at the Lemma's size, which shrinks and wraps like the Lemma. The Word in Square and the Correction in Story are not drawn; they follow these rules. The card is laid out off screen at the image's size (1080×1920 pixels for Story, 1080×1080 for Square, at the screen's scale), so nothing is stretched, and captured as a PNG into the cache directory, which the iOS share sheet gets by file URL. Once the iOS share sheet closes, shared or cancelled, the sheet closes too, and the reader is back on the card with no message; a failed capture shows the toast «Не вдалося створити зображення. Спробуйте ще раз.» over the bottom of the preview (drawn like the undo toast, without a button, for 4 s, announced by VoiceOver) and the sheet stays open. A tap on the scrim, a drag down or VoiceOver's escape closes the sheet without sharing; with Reduce Motion it fades instead of sliding. Sharing writes nothing. On a dev client without the capture module the share button stays out of the row, which keeps three buttons. The Share Card frame is Decor slot 5, one band and one corner in both Themes: the Story card draws the band across its whole width 28 pt inside its top edge and, mirrored, 28 pt inside its bottom edge; the Square card draws the corner 10 pt inside each of its four corners, mirrored like slot 3, and its divider is slot 2. Both scale with the card. The UA Edition supplies the zig-zag band of slot 2 (gold in dark, red in light) and the corner of slot 3, and the Core's plain card has none; the sheet's title, toast and format names wait for the owner's confirmation.
26. **About and feedback** ("Запропонувати слово", "Повідомити про помилку") are not in the roadmap. Suggesting words to the editors is not "user-added words" (2.x), but it needs a channel to send to, which needs the backend (0.7). **Closed in part in 0.3:** About shows the Edition's name and version, the description and the sources line; «Запропонувати слово» and «Повідомити про помилку» are dimmed «СКОРО» rows until feedback can be sent (0.7). The app icon, the leading icons of the feedback rows, the rating, "Поділитися SLOVO" and the legal links are left out until they have somewhere to point (0.9 / 1.0). Settings rows of later versions («Звуки», «Музика»; «Віджети: як додати» is live since 0.6, «Мій Мікс» and «Приховані записи» are live since 0.3, «Сповіщення» since 0.4) are dimmed «СКОРО» rows, not tappable and read by VoiceOver as unavailable; the «Звуки» row keeps its switch and «Музика» its slider as drawn only. The version reads «версія 0.8.6» (the app version, which follows the release, ADR 0044; the build number needs a native module).

## UI copy

Ukrainian copy from the canvas, quoted as is, for implementers to reuse. Sample content (Lemmas, Definitions, Examples) is left out. Put new strings in the Language Pack's UI strings, never in the Core.

### Tab bar

- Головна · Налаштування · Гра · Збережене

### Feed

- Stats pill (VoiceOver): «Статистика: серія 12 днів»
- Word of the Day badge: «СЛОВО ДНЯ · 11 ЖОВТНЯ»
- Review label: «ПОВТОРЕННЯ»
- Pronunciation (VoiceOver): «Вимова»
- Synonym and antonym labels: «Синонім:», «Антонім:»
- Linked Correction: «Часто кажуть: …»
- Correction card: «ВИПРАВЛЕННЯ», «Так часто кажуть», «Українською краще»
- Correction Types: «росіянізм», «калька», «суржик», «канцелярит», «англіцизм»
- Register labels: «розм.», «заст.» (the brief also lists застаріле, діалектне, книжне, розмовне)
- Action row (VoiceOver): «Додати в Улюблене» / «Прибрати з Улюбленого», «Поділитися», «Додати до колекції», «Не показувати»
- Swipe hint: «Гортайте вгору — наступне слово»
- End of Cycle: «Ви переглянули всі слова» / «Чекайте оновлення. Гортайте далі — почнемо нове коло.»
- Loading: «Вишиваємо слова…» (VoiceOver: «Завантаження слів»)
- Error: «Нитка урвалася» / «Немає з'єднання з інтернетом. Збережені слова доступні й без нього.» / «Спробувати ще» / «Відкрити Збережене». 0.2 ships «Нитка урвалася» / «Не вдалося відкрити словник.» / «Спробувати ще» (gap 8).
- VoiceOver actions that stand in for the swipe (0.2): «Наступний запис», «Попередній запис»; tabs read «Головна, вкладка 1 з 4»

### Stats sheet

- «днів поспіль», «найкраща серія — 31», «слів сьогодні», «в Улюбленому», «слово в Колекціях», «найкраще у Грі»

### Saved

- Title «Збережене»; cards «Улюблене», «Колекції», «Історія»; counts «17 слів»
- Favorites: «Улюблене», row action «Видалити» (VoiceOver «Видалити «…»»), footer «Найновіші — першими. Тап відкриває повну картку.»
- Favorites empty: «Тут поки порожньо» / «Торкніться ♥ під словом у Стрічці — і воно оселиться тут.» / «До Стрічки»
- History: «Історія», «останні 500», «СЬОГОДНІ», «УЧОРА», kinds «слово», «виправлення», «слово дня», times «щойно», «5 хв тому», «сьогодні, 09:02», action «Очистити»
- Clear History: «Очистити Історію?» / «Улюблене й Колекції залишаться.» / «Очистити» / «Скасувати»
- History empty: «Історія чиста» / «Нові слова з'являться тут, щойно ви їх погортаєте.»
- Collections: «Колекції», «Нова колекція» (VoiceOver), «ПЕРЕЙМЕНУВАННЯ», swipe actions «Назва», «Видалити», the «…» menu «Перейменувати», «Видалити», «Скасувати»
- Delete Collection: «Видалити колекцію «Робота»?» / «15 слів залишаться в Історії та Улюбленому.» / «Видалити» / «Скасувати»
  - Ships (gap 11): «Видалити колекцію «Робота»?» / «Самі записи нікуди не зникнуть.»
- Add to Collection sheet: «До колекції», «+ Нова колекція», placeholder «Назва колекції», «Створити», «Готово»

### Settings

- «Налаштування», «ТЕМА»: «Системна», «Світла», «Темна»
- «РОЗМІР ШРИФТУ»: S, M, L, XL
- Rows: «Сповіщення», «Мій Мікс» (value «Усі» or «5 категорій»), «Приховані записи»
- Мій Мікс: «Мій Мікс» / «Які слова показувати у Стрічці. Зміни діють одразу.» / «Усі» and the Category chips / «Виправлення» / ««Так часто кажуть → Українською краще»» / the last-Category line «Хоча б одна категорія лишається завжди, щоб було слово дня.» (the design's onboarding title, step, «Далі» and «Обрано 5 з 8 + Виправлення» do not ship)
- «ЗВУКИ»: «Звуки», «Вібрація», «Музика» with «СКОРО»
- «ВІДЖЕТИ»: «Як додати віджет»; «Про застосунок і відгук»
- Сповіщення: «Сповіщення» / the times, «09:00» (VoiceOver «Сповіщення о 09:00») / «Видалити» / «+ Додати час» / «Не більше 10 разів на день.» / «Звук сповіщень» / the picker: «Час сповіщення», «Готово», «Такий час уже є.», the hint «Змінити час»; «Увімкнути сповіщення»; the Settings row's value «3 на день» or «Вимкнено»
- Hidden: «Приховане» / «Ці записи й категорії не з'являються у Стрічці.» / «ЗАПИСИ», «КАТЕГОРІЇ» / «Повернути», «Увімкнути» / «Прихованих записів немає.» / undo toast «‹Lemma› знову у Стрічці» (the Lemma in «» quotes) with «Скасувати»
- Widget guide: «Слово на головному екрані»; steps «Утримуйте порожнє місце» / «Іконки почнуть хитатися.»; «Натисніть «Редагувати» → «Додати віджет»» / «Знайдіть SLOVO і оберіть розмір.» (iOS 18+); «Торкніться віджета, щоб обрати режим» / «Улюблене, Колекція чи Усі слова.»; gallery «Малий · Середній»; the widget hint's sheet closes with «Зрозуміло»
- About: «Українське видання»; «Версія 0.9 · збірка 42»; «Оновлення {id}» (the OTA update the app runs, absent without one); «Ми збираємо рідкісні, забуті й просто гарні слова, щоб говорити українською багатше — щодня потроху.»; «Джерела: тлумачні та діалектні словники, класична й сучасна література.»; «ВІДГУК»; «Запропонувати слово» / «або Виправлення»; «Повідомити про помилку» / «у слові, наголосі чи застосунку»; «Оцінити в App Store»; «Поділитися SLOVO»; «Політика конфіденційності»; «Умови використання»; «Зроблено з любов'ю до мови»
- Feedback sheet: «Скасувати», «Надіслати», titles «Нове слово» / «Помилка», segments «Слово / Виправлення» / «Помилка», fields «СЛОВО» / «ДЕ САМЕ» and «ЗНАЧЕННЯ, ПРИКЛАД, ДЖЕРЕЛО» / «ЩО НЕ ТАК», placeholders «напр. ке'бета», «Що означає, де ви його почули чи прочитали…», «Неправильний наголос, хибне визначення, збій…», hint «Наголос можна позначити так: ке'бета — ми перетворимо на ке́бета.»
- Feedback sent: «Дякуємо!» / «Редактори перевірять слово. Якщо воно потрапить до SLOVO — ви побачите його у Стрічці.» or «Ми виправимо це в найближчому оновленні.» / «Готово»

### Onboarding

- 1: «SLOVO», «Рідкісні слова рідної мови — щодня по одному.», «Гортайте, зберігайте, діліться й тренуйтеся.», «Почати»
- 2: «КРОК 2 З 4», «Оберіть свій Мікс», «Які слова показувати у Стрічці. Змінити можна будь-коли в Налаштуваннях.», chip «Усі», «Виправлення» / «"Так часто кажуть → Українською краще"», «Далі», «Обрано 5 з 8 + Виправлення»
- 3: «КРОК 3 З 4», «Слово саме прийде до вас», «Коротке сповіщення: слово з наголосом і визначення. Без реклами й нагадувань «повернись».», «Сповіщення о 09:00» (VoiceOver), «+ Додати час», «Дозволити сповіщення», «Пізніше»
- 4, with the Account on: «КРОК 4 З 4», «Збережіть свої слова», «SLOVO ID переносить Улюблене, Колекції та серію між пристроями.», «Увійти через SLOVO ID», «Продовжити без акаунта» (the design's «ПІЗНІША ВЕРСІЯ» does not ship; without the Account the onboarding has three steps, «КРОК 2 З 3»)

### Game

- Mode select: «Гра»; «ВИЗНАЧЕННЯ → СЛОВО», «Вгадай слово», «Читаєте визначення — обираєте одне слово з чотирьох.»; «ВИПРАВЛЕННЯ», «Обери правильне», «У реченні — поширена ненормативна форма. Знайдіть нормативну.»
- Round: «Вийти з гри» (VoiceOver), «7 / 15», «Життів: 4 з 5» (VoiceOver), «ВИЗНАЧЕННЯ», «ЯК СКАЗАТИ КРАЩЕ?»
- Answers: tags «Правильно», «Ваш вибір»; sheet «Правильно!» or «Не цього разу», «Далі»
- Exit: «Вийти з гри?» / «Прогрес буде втрачено.» / «Вийти» / «Грати далі»
- Result: «Перемога!» / «Усі 15 раундів пройдено.» or «Життя закінчилися» / «Нічого — слова нікуди не дінуться.»; «раундів», «життів», «рекорд»; «Ще раз», «На головну»

### Share Cards, widgets, notification, splash

- Share Card: «СЛОВО ДНЯ», «Так часто кажуть», «Українською краще», «КАЛЬКА», watermark «SLOVO»
- Widget modes: «УЛЮБЛЕНЕ», «УСІ СЛОВА», «КОЛЕКЦІЯ · ДЛЯ ЛИСТІВ»
- Notification: app name «SLOVO», time «зараз» / «09:00»
- Splash: «SLOVO», «рідкісні слова рідної мови»
