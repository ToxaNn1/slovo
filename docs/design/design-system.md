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
| `color.wrong`         | `#A3271F` | Wrong answer fill, "Не цього разу"                                            |
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

**Radii** are tokens, never layout. The Ukrainian Edition is square-cornered "like canvas and stitch":

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

From artboard 3e and the canvas keyframes. Every animation has a Reduce Motion variant.

| Moment           | Motion                                                                     | Haptic                           | Sound                    | Reduce Motion                 |
| ---------------- | -------------------------------------------------------------------------- | -------------------------------- | ------------------------ | ----------------------------- |
| Feed swipe       | 420 ms, `cubic-bezier(.2,.8,.2,1)`, snaps one card per screen              | selection, on every card         | none                     | 200 ms cross-fade             |
| Heart (Favorite) | 450 ms spring: scale 1 → 1.35 → 0.92 → 1, `cubic-bezier(.3,1.6,.5,1)`      | impact light                     | a soft "tuk"             | fill only                     |
| Correct answer   | 250 ms fill to `color.correct` and scale 1.03                              | notification success             | a plucked string, rising | n/a                           |
| Wrong answer     | 200 ms fill to `color.wrong`, then a ±4 pt shake twice (400 ms)            | notification warning (not error) | a muted string           | n/a                           |
| Life lost        | 500 ms: scale 1.4 and rotate −12°, then the heart turns to an outline      | impact medium                    | none                     | no animation                  |
| Win              | rosettes "stitch" in one after another, 120 ms apart, spring 500 ms        | success ×2                       | a bandura chord          | n/a                           |
| Sheet            | slides up 320 ms, `cubic-bezier(.2,.8,.2,1)`                               | none                             | none                     | n/a                           |
| Loading          | skeleton pulse 1.4 s; the divider is stitched in square by square (140 ms) | none                             | none                     | static skeleton, full divider |

The notification has its own sound: a quiet bandura pluck of 0.6 s.

## Components

Each component is shown in the screens listed; light and dark refer to the Ukrainian Edition unless marked Core.

**Word card** (`feed-word-card-*`). A surface card with `radius.card`, a 1 pt line border and four corner ornaments (Decor slot 3). Top row: the Lemma with Stress, and under it the part of speech (abbreviated, e.g. "ім., ж. р.") with an optional register chip (an outlined accent chip, e.g. "розм.", "заст."); the pronunciation button (44 pt outlined circle, speaker icon, accent) on the right. Then the ornament divider (Decor slot 2), the primary Definition, the Example in italics with its author, the synonym line ("Синонім:" or "Антонім:") and the Category chip (`surfaceSunken`, `radius.chip`). Variants:

- **Word of the Day**: a filled accent badge "СЛОВО ДНЯ · 11 ЖОВТНЯ" above the Lemma.
- **Linked to a Correction**: a footer row under a hairline, with a lightbulb icon and «Часто кажуть: _на протязі_».

**Correction card** (`feed-correction-card-*`). The same card without corner ornaments. Overline "ВИПРАВЛЕННЯ" with an outlined Correction Type chip on the right (росіянізм / калька / суржик / канцелярит). "Так часто кажуть" over the non-standard form in muted ink, struck through in a soft accent. A divider whose centre is a downward arrow instead of the rosette. "Українською краще" in accent over the standard form at Lemma size. A neutral explanation. An example pair on `surfaceSunken`: "—" before the non-standard sentence, a ✓ in `color.correct` before the standard one. No red "error" styling anywhere.

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

**Round progress.** Left of the Lives: "7 / 15" (Manrope 700, 13) over a 4 pt bar (`track` background, accent fill, width animates 400 ms). The ✕ exit button (44 pt) sits on the far left.

**Sheets.** Bottom sheet with `radius.sheet` top corners, a 38×5 grabber, slide-up motion and a scrim. Uses: Stats, Add to Collection, the Game answer sheet (inverted colours: cream on dark, dark on light), feedback form. The built sheet (Add to Collection) slides in 320 ms and leaves in 220 ms; with Reduce Motion it fades in place. The scrim is the light Theme's ink at 45% and black at 60% in the dark one; the sheet closes on a tap on the scrim, a drag down on the grabber, VoiceOver's escape gesture, and «Готово». The design draws neither the sheet with no Collection (the name field is open at once, without the keyboard) nor a refused name (a line of ink text under the field in the Edition's words, and a heart-coloured border).

**Popups.** Centred alert dialog (radius 6, surface, title in Literata 24, body, primary then secondary full-width buttons) for "Вийти з гри?" and "Очистити Історію?". The system action sheet (the iOS look, title and message over «Видалити» and «Скасувати») for deleting a Collection. A toast with an undo button at the bottom (radius 6, inverted colours, `elev.toast`, 4 s) after restoring a Hidden Entry.

**List rows.** Grouped lists on a surface card with hairline separators, 52–56 pt rows: label left, value and chevron right, or a switch. Word rows: Lemma in Literata 20–22 with a timestamp or kind on the right and an optional Definition below. Swipe left reveals 84–96 pt actions ("Видалити" in `destructive`, "Назва" in muted). History groups rows under day overlines ("СЬОГОДНІ", "УЧОРА").

**Empty states** (`favorites-empty-light`, `history-empty-dark`, `feed-end-of-cycle-dark`). Decor slot 4 (a 90–120 pt rosette) centred, a Literata title, one line of muted body text and an optional primary button.

**Tab bar.** 84 pt, four equal tabs in the brief's order: Головна · Налаштування · Гра · Збережене, 24 pt line icons (house, sliders, a diamond in a rounded square, bookmark). Selected tab in accent with a 700-weight label (and the Saved icon filled); others in `inactiveTab`. A 1 pt top line in `color.line`.

**Other pieces.** The Stats pill (Feed top left: flame icon and the Streak number, 40 pt tall, surface fill with an accent border); the Feed position counter "1 / 6" top right; the first-launch swipe hint (an inverted pill "Гортайте вгору — наступне слово" above the tab bar); the skeleton card for loading; widgets (small 170×170: overline mode name, Lemma and zig-zag; medium 364×170: plus a short Definition); the notification (app icon, "SLOVO", time, Lemma with Stress in Literata 600, short Definition).

## Decor slots

The brief defines seven slots; the Core provides a neutral default for each, and the Ukrainian Edition fills them with cross-stitch Decor. Decor never carries text or behaviour.

| #   | Slot                      | Ukrainian Decor (dark / light)                                                                                                                                                                                    | Core default shown                        | Screens                                                                 |
| --- | ------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------- | ----------------------------------------------------------------------- |
| 1   | Screen background         | A 44 pt tile with one cross-stitch "+": gold at 6% on `#15110E` / red at 5% on `#F5EEE2`. Used on the Feed, onboarding, splash and Share Cards.                                                                   | Plain background colour (implied)         | `feed-*`, `splash-dark`, `tokens-and-decor-kit`                         |
| 2   | Ornament divider          | A zig-zag band (10 pt) with an 18 pt eight-point rosette in the middle; gold and red / red and black. The Correction card swaps the rosette for a down arrow. Also used alone as a band (sheets, widgets, About). | A 1 pt line with a 5 pt dot in the middle | `feed-word-card-*`, `feed-word-card-core-vs-ukrainian-light`            |
| 3   | Word card frame / corners | 16 pt L-shaped stitched corners with an inner mark: gold and red / ochre and red. Four on the Word card, two on other cards.                                                                                      | None (the card is just rounded 22)        | `feed-word-card-*`, `game-round-dark`                                   |
| 4   | Empty-state illustration  | A large rosette (90–120 pt), gold / red.                                                                                                                                                                          | Not shown                                 | `favorites-empty-light`, `history-empty-dark`, `feed-end-of-cycle-dark` |
| 5   | Share Card frame          | Story: zig-zag bands at the top and bottom on the pattern background. Square: four corners and a zig-zag divider.                                                                                                 | Not shown                                 | `share-card-*`                                                          |
| 6   | Game victory illustration | Three rosettes stitched in one after another (marked "TBD" on the canvas); the result screen shows one 120 pt rosette.                                                                                            | Not shown                                 | `game-result-win-dark`, `motion-sound-haptics-dark`                     |
| 7   | Splash / launch           | A 72 pt rosette, the letter-spaced "SLOVO" wordmark, the tagline "рідкісні слова рідної мови" and a zig-zag band near the bottom, on the dark pattern.                                                            | Not shown                                 | `splash-dark`                                                           |

**The Core's neutral Decor stays minimal** (the owner's decision in 0.2, closing gap 22). It fills slot 2 only, with the 1 pt line and the 5 pt dot; slots 1, 3, 4 and 7 stay empty, so an Edition without Decor shows a plain background, cards with just their rounded corners, empty states and the error state without an illustration, and the native splash alone. Both Themes draw it from the Core's token table.

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
| `feed-word-card-light.png`                     | Feed, Word card, Ukrainian Edition, light                                                     | 1a       |
| `feed-word-card-core-light.png`                | Feed, Word card, Core tokens, light                                                           | 1a       |
| `feed-word-card-core-vs-ukrainian-light.png`   | The same Word card with the Core tokens and the Ukrainian Edition side by side, light         | 1a       |
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

| PNG                                           | Screen and state                                                                                       | Artboard |
| --------------------------------------------- | ------------------------------------------------------------------------------------------------------ | -------- |
| `saved-overview-light.png`                    | Saved tab: Favorites, Collections and History cards with counts, light                                 | 1e       |
| `favorites-list-light.png`                    | Favorites list, newest first, light                                                                    | 3b       |
| `favorites-row-swipe-delete-light.png`        | Favorites list with a row swiped to "Видалити", light                                                  | 3b       |
| `favorites-empty-light.png`                   | Favorites empty state (Decor slot 4), light                                                            | 3b       |
| `history-list-dark.png`                       | History grouped by day, dark                                                                           | 3c       |
| `history-clear-confirm-dark.png`              | History, "Очистити Історію?" confirmation, dark                                                        | 3c       |
| `history-empty-dark.png`                      | History empty state, dark                                                                              | 3c       |
| `collections-manage-delete-confirm-light.png` | Collections: a row being renamed, a row swiped to Назва / Видалити, and the delete action sheet, light | 3d       |
| `add-to-collection-sheet-dark.png`            | Add to Collection sheet with checkboxes, dark                                                          | 2c       |
| `add-to-collection-new-collection-dark.png`   | Add to Collection sheet with the inline "new Collection" field filled, dark                            | 2c       |
| `hidden-entries-dark.png`                     | Hidden Entries and Hidden Categories with "Повернути" / "Увімкнути", dark                              | 4c       |
| `hidden-entries-undo-toast-dark.png`          | Hidden, after restoring one Entry: the undo toast, dark                                                | 4c       |
| `settings-scrolled-light.png`                 | Settings, bottom: Notifications, My Mix, Hidden, Sounds, Widgets, About, light                         | 2b       |
| `about-light.png`                             | About and feedback, light                                                                              | 5a       |
| `about-feedback-word-light.png`               | Feedback sheet "Нове слово", filled in (the typed `'` becomes the stress mark), light                  | 5a       |
| `about-feedback-error-light.png`              | Feedback sheet "Помилка", empty, light                                                                 | 5a       |
| `about-feedback-sent-light.png`               | Feedback sheet, thank-you state, light                                                                 | 5a       |

### 0.4 Habit and onboarding

| PNG                                    | Screen and state                                                                 | Artboard |
| -------------------------------------- | -------------------------------------------------------------------------------- | -------- |
| `stats-sheet-dark.png`                 | Stats sheet from the Streak pill, dark                                           | 1b       |
| `onboarding-1-welcome-dark.png`        | Onboarding 1, welcome with a hero Word, dark                                     | 2a       |
| `onboarding-2-mix-light.png`           | Onboarding 2, choose the Mix: Category chips, "Усі", Corrections switch, light   | 2a       |
| `onboarding-3-notifications-light.png` | Onboarding 3, notifications with a sample and three default times, light         | 2a       |
| `onboarding-4-slovo-id-dark.png`       | Onboarding 4, SLOVO ID, marked "later version" (the Account itself is 0.7), dark | 2a       |
| `widgets-and-notification.png`         | The notification (0.4), plus the widgets (0.6)                                   | 2d       |

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

1. **Categories and register labels are mixed up.** The Mix chips include "Застарілі" and "Діалектні", and the Hidden screen lists "Застарілі" under Categories. These are register labels (`archaic`, `dialectal`), not Categories. The other chip names ("Розум і характер", "Побут і гомін", "Час", "Простір і рух", "Почуття", "Природа") are not the Ukrainian Edition's Categories (`editions/uk/edition.json`: "Людина і тіло", "Емоції та характер", "Природа і погода", "Побут і ремесла", "Техніка", "Військова справа", "Мистецтво і культура", "Історія та старовина", "Наука", "Мова і мовлення").
2. **Lives and Favorites share one glyph.** Both are the same heart in the same red (`#C8372D`). The glossary keeps them apart (Life: _Avoid_ "Heart"), and the brief itself says "5 lives (hearts)". A different Life glyph, or at least a different colour, would avoid confusion.
3. **The Word card shows less than a Word holds.** The contract has `extraDefinitions`, several `examples`, both `synonyms` and `antonyms`, `etymology` and several `registers`. The design shows one Definition, one Example, one synonym _or_ one antonym, one register chip, and no Etymology at all. The brief asked for optional extra Definitions and Etymology. **Closed in 0.2:** the card shows the primary Definition, the first Example, up to three Synonyms, antonyms, every register chip and the Category chip, and «Детальніше» opens the etymology, extra Definitions and further Examples.
4. **Example author is hard-coded.** Every Example reads "— з народного мовлення"; the contract's `author` is optional, and the design has no state without an author. **Closed in 0.2:** the author line shows only when the Example names one.
5. **Part of speech is abbreviated** ("ім., ж. р.", "прикм.", "присл.") while `editions/uk/strings.json` has full labels ("іменник"…) and no gender labels yet. Decide on one form; the gender abbreviation needs new strings. **Closed in 0.2:** the card shows the dictionary short forms, VoiceOver reads the full words, and the Edition strings hold both, gender included.
6. **Stress inside a Correction.** The light Correction card shows «протягом ро́ку» with a stress mark, but a Correction's `standardEquivalents` are plain text with no Stress field. **Closed in 0.2:** Corrections carry no Stress.
7. **A Correction with several standard equivalents** (e.g. «наступний / такий» in the brief) is not designed. **Closed in 0.2:** the main equivalent at the Lemma's size, the others as «також: …».
8. **The Feed network error contradicts offline-first.** "Нитка урвалася — Немає з'єднання з інтернетом" assumes the Feed needs the network, but the Language Pack ships with the app (ADR 0005). A local failure state is more likely; the current Core string is "Не вдалося відкрити словник.". **Closed in 0.2:** a local error state, «Нитка урвалася» over «Не вдалося відкрити словник.» with «Спробувати ще» and the broken-thread illustration (slot 4); no network copy and no «Відкрити Збережене».
9. **The Feed position counter "1 / 6"** suggests a finite, counted Feed. The Feed is an endless stream until the end of a Cycle; the counter looks like a canvas demo aid. Confirm whether it ships. **Closed in 0.2:** no counter ships.
10. **Hidden copy is narrower than the concept.** "Ці записи й категорії не з'являються у Стрічці" says Feed only; a Hidden Entry is also excluded from notifications, widgets and the Game. The restore buttons differ too: "Повернути" for Entries, "Увімкнути" for Categories.
11. **Deleting a Collection** says "15 слів залишаться в Історії та Улюбленому". That is only true for Entries already in History or Favorites; deleting a Collection adds nothing to Favorites. **Closed in 0.3:** the system action sheet reads «Видалити колекцію «‹name›»?» / «Самі записи нікуди не зникнуть.», with «Видалити» and «Скасувати»; deleting a Collection removes it and its Entry records and leaves its Entries in Favorites, History and other Collections.
12. **"слів" for Entries.** Collection counts, the Stats sheet and Favorites say "слів"/"слово", but Collections and Favorites hold Entries, which include Corrections (the demo Collections contain «брати участь»). **Closed in 0.3:** counts say «записів» in every plural form of the Edition's language («1 запис», «2 записи», «17 записів»), chosen with `Intl.PluralRules`; Hermes lacks it, so the app adds a pure-JavaScript polyfill with the Edition's plural rules only (ADR 0020). The Favorites card and the Favorites list show the bare number, as drawn, and VoiceOver reads the count in full. The Add to Collection sheet and the Collections card's Collections say «1 запис», «2 записи», «17 записів»; the Collections card's own count is the bare number of Collections, and VoiceOver reads it in full («3 колекції»).
13. **The brief uses "round" for the Cycle** ("The next swipe starts a new round"), against the glossary (Cycle; Round is a Game term). The design avoids it ("почнемо нове коло"), so only the brief needs fixing.

### Inconsistencies inside the design

14. **Font-size steps disagree.** The Feed uses Lemma 40 / 48 / 56 / 64; the token table says 40 / 48–52 / 56 / 64; the Settings preview uses 38 / 46 / 54 / 62 for the Lemma and 15 / 17 / 19 / 21 for the Definition, where the token table says 17 / 19 / 21 / 23. Static mockups use a Lemma of 52 at M. One table must be chosen. **Closed in 0.2:** one table, Lemma 40 / 48 / 56 / 64 and Definition 17 / 19 / 21 / 23, for the Feed and the Settings preview alike. On a screen narrower than 390 pt (the SE) the Lemma drops by 44/48 at every step, in the Feed and in the preview alike (44 at M).
15. **The UA chip radius** is 2 in the token table and the Feed, but 3 on the light Word card. **Closed in 0.2:** 2.
16. **The light Correction card has no action row**, while Corrections in the dark Feed have one. **Closed in 0.3:** the Word and the Correction card share one action row: three 52 pt buttons spread evenly (the heart, Add to Collection, Hide); Share joins in 0.6.
17. **The story Share Card is not 9:16.** It is 324 wide plus 34 padding on each side (content-box), so it renders at 392×576, not 324×576.
18. **The wrong-answer sheet hides the correct option.** The brief wants the chosen button red and the correct one green; the sheet covers the lower buttons, so the green one is often out of sight (the sheet does name the right Word).
19. **The win screen still shows "рекорд 13"** after a 15 / 15 result; the best result does not update.
20. **Lives use `#A3221B` in light but `#C8372D` in dark**, and the light Favorites heart is never shown filled. **Closed in 0.3 for the heart:** the filled Favorites heart is `color.heart` `#C8372D` in both Themes (3:1 or more against the background and the surface); Lives stay open for 0.5.

### Missing screens and states (the brief asked for light and dark of every screen)

21. **Most screens exist in one theme only.** No light Feed with Word of the Day, end of Cycle or loading; no dark Correction card outside the Feed; no dark Settings, Saved, Favorites, Collections, About or widget guide; no light Game, Stats, History, Hidden or Add to Collection; no light splash; dark error state missing. **Closed in 0.2 for the 0.2 screens:** each is built from the tokens and checked in both Themes; the other screens stay open for their versions. **Closed in 0.3 for Favorites:** the Saved overview, the Favorites list, its empty state and the Entry screen are built from the tokens and checked in both Themes; the Favorites card is drawn on the ink fill with its content in the other scheme's tokens and Decor, so it is cream with a red band in dark. **Closed in 0.3 for Add to Collection:** the sheet and the Collections card of the Saved overview are built from the tokens and checked in both Themes, on iPhone 16 and SE. **Closed in 0.3 for History:** the History list, its empty state and the History card of the Saved overview are built from the tokens and checked in both Themes on iPhone 16 and SE, with the largest text size of iOS; the confirmation is the system alert «Очистити Історію?» rather than the drawn dialog, and a screen title stops growing at 1.3× so it never breaks a word. **Closed in 0.3 for the Collections screen:** the list, the field that names a Collection and the swipe actions are built from the tokens and checked in both Themes on iPhone 16 and SE, with the largest text size of iOS. A row is a surface card with the name (Manrope 700, 17) and the count («17 записів», muted) on one line and the newest Lemmas under it (Literata 22, joined by « · »); at the largest text sizes the count drops under the name instead of squeezing it. «+» at the top right opens the field for a new Collection, drawn like the rename field of the design (an accent border, the overline «НОВА КОЛЕКЦІЯ», the name on the sunken fill; the keyboard's return key keeps the name, leaving the field drops it, and a refused name stays with its reason in the destructive colour under it). A row swiped to «Назва» becomes that field in place under «ПЕРЕЙМЕНУВАННЯ». The empty list reuses the empty state (Decor slot 4) with «Колекцій ще немає» and a «Нова колекція» button. The swipe action labels and the empty state's title stop growing at 1.3× so they never break a word.
22. **The Core tokens are shown only as a light Word card.** There is no Core dark screen and no Core default for Decor slots 1 and 3–7 (only slot 2's line and dot), though the token table lists Core dark values. **Closed in 0.2:** the Core dark tokens come from the token table, and the Core's neutral Decor stays minimal (see [Decor slots](#decor-slots)).
23. **Decor slot 6 is marked "TBD"**, and the slots are shown in dark only on the Decor board.
24. **Settings sub-screens are missing:** the notification times list (add / edit / remove, up to 10), the My Mix screen, and the SLOVO ID / Account section (sign in, sign out everywhere, delete Account).
25. **Other missing pieces:** a Collection's detail list; the full card opened from a list; the share flow (choosing story or square, the iOS share sheet); a Word Share Card in square and a Correction in story; the Pronunciation playing state; the Word of the Day in light; notification-permission-denied; loading, empty and error states for the Game, Saved and Settings. **Closed in part in 0.3:** the full card opened from a list is the Entry screen: one Entry card with its action row under a link back to the list (no pager), which stays open after its Entry leaves the list. The Favorites list's «Відновити демо» is a canvas aid and does not ship. The History list draws its rows with a kind on the right («слово», «виправлення», «слово дня») and no Definition, and its separators inset to the text; the Saved overview's History card shows the three latest rows with how long ago each was Seen («щойно», «5 хв тому», «сьогодні, 09:02», «вчора, 21:40», then «9 жовт., 08:05»; VoiceOver reads the minutes in full). «останні 500» is the cap, drawn from the Core's `HISTORY_CAP`.
26. **About and feedback** ("Запропонувати слово", "Повідомити про помилку") are not in the roadmap. Suggesting words to the editors is not "user-added words" (2.x), but it needs a channel to send to, which needs the backend (0.7). **Closed in part in 0.3:** About shows the Edition's name and version, the description and the sources line; «Запропонувати слово» and «Повідомити про помилку» are dimmed «СКОРО» rows until feedback can be sent (0.7). The app icon, the leading icons of the feedback rows, the rating, "Поділитися SLOVO" and the legal links are left out until they have somewhere to point (0.9 / 1.0). Settings rows of later versions («Сповіщення», «Звуки», «Музика», «Віджети: як додати», and «Мій Мікс» and «Приховані записи» until their screens) are dimmed «СКОРО» rows, not tappable and read by VoiceOver as unavailable; the «Звуки» row keeps its switch and «Музика» its slider as drawn only. The version reads «версія 0.1.0» (the app version; the build number needs a native module).

## UI copy

Ukrainian copy from the canvas, quoted as is, for implementers to reuse. Sample content (Lemmas, Definitions, Examples) is left out. Put new strings in the Language Pack's UI strings, never in the Core.

### Tab bar

- Головна · Налаштування · Гра · Збережене

### Feed

- Stats pill (VoiceOver): «Статистика: серія 12 днів»
- Word of the Day badge: «СЛОВО ДНЯ · 11 ЖОВТНЯ»
- Pronunciation (VoiceOver): «Вимова»
- Synonym and antonym labels: «Синонім:», «Антонім:»
- Linked Correction: «Часто кажуть: …»
- Correction card: «ВИПРАВЛЕННЯ», «Так часто кажуть», «Українською краще»
- Correction Types: «росіянізм», «калька», «суржик», «канцелярит»
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
- Collections: «Колекції», «Нова колекція» (VoiceOver), «ПЕРЕЙМЕНУВАННЯ», swipe actions «Назва», «Видалити»
- Delete Collection: «Видалити колекцію «Робота»?» / «15 слів залишаться в Історії та Улюбленому.» / «Видалити» / «Скасувати»
  - Ships (gap 11): «Видалити колекцію «Робота»?» / «Самі записи нікуди не зникнуть.»
- Add to Collection sheet: «До колекції», «+ Нова колекція», placeholder «Назва колекції», «Створити», «Готово»

### Settings

- «Налаштування», «ТЕМА»: «Системна», «Світла», «Темна»
- «РОЗМІР ШРИФТУ»: S, M, L, XL
- Rows: «Сповіщення», «Мій Мікс» (value «Усі» or «5 категорій»), «Приховані записи»
- «ЗВУКИ»: «Звуки», «Вібрація», «Музика» with «СКОРО»
- «Віджети: як додати», «Про застосунок і відгук»
- Hidden: «Приховане» / «Ці записи й категорії не з'являються у Стрічці.» / «ЗАПИСИ», «КАТЕГОРІЇ» / «Повернути», «Увімкнути» / «Прихованих записів немає.» / undo toast «‹Lemma› знову у Стрічці» (the Lemma in «» quotes) with «Скасувати»
- Widget guide: «Слово на головному екрані»; steps «Утримуйте порожнє місце» / «Іконки почнуть хитатися.»; «Натисніть «+» і знайдіть SLOVO» / «Оберіть малий або середній розмір.»; «Торкніться віджета, щоб обрати режим» / «Улюблене, Колекція чи Усі слова.»; gallery «Малий · Середній»
- About: «Українське видання · версія 1.0 (42)»; «Ми збираємо рідкісні, забуті й просто гарні слова, щоб говорити українською багатше — щодня потроху.»; «Джерела: тлумачні та діалектні словники, класична й сучасна література.»; «ВІДГУК»; «Запропонувати слово» / «або Виправлення»; «Повідомити про помилку» / «у слові, наголосі чи застосунку»; «Оцінити в App Store»; «Поділитися SLOVO»; «Політика конфіденційності»; «Умови використання»; «Зроблено з любов'ю до мови»
- Feedback sheet: «Скасувати», «Надіслати», titles «Нове слово» / «Помилка», segments «Слово / Виправлення» / «Помилка», fields «СЛОВО» / «ДЕ САМЕ» and «ЗНАЧЕННЯ, ПРИКЛАД, ДЖЕРЕЛО» / «ЩО НЕ ТАК», placeholders «напр. ке'бета», «Що означає, де ви його почули чи прочитали…», «Неправильний наголос, хибне визначення, збій…», hint «Наголос можна позначити так: ке'бета — ми перетворимо на ке́бета.»
- Feedback sent: «Дякуємо!» / «Редактори перевірять слово. Якщо воно потрапить до SLOVO — ви побачите його у Стрічці.» or «Ми виправимо це в найближчому оновленні.» / «Готово»

### Onboarding

- 1: «SLOVO», «Рідкісні слова рідної мови — щодня по одному.», «Гортайте, зберігайте, діліться й тренуйтеся.», «Почати»
- 2: «КРОК 2 З 4», «Оберіть свій Мікс», «Які слова показувати у Стрічці. Змінити можна будь-коли в Налаштуваннях.», chip «Усі», «Виправлення» / «"Так часто кажуть → Українською краще"», «Далі», «Обрано 5 з 8 + Виправлення»
- 3: «КРОК 3 З 4», «Слово саме прийде до вас», «Коротке сповіщення: слово з наголосом і визначення. Без реклами й нагадувань «повернись».», «Сповіщення о 09:00» (VoiceOver), «+ Додати час», «Дозволити сповіщення», «Пізніше»
- 4: «КРОК 4 З 4», «ПІЗНІША ВЕРСІЯ», «Збережіть свої слова», «SLOVO ID переносить Улюблене, Колекції та серію між пристроями.», «Увійти через SLOVO ID», «Продовжити без акаунта»

### Game

- Mode select: «Гра», «15 раундів, 5 життів. Найкраще — 13 / 15.»; «ВИЗНАЧЕННЯ → СЛОВО», «Вгадай слово», «Читаєте визначення — обираєте одне слово з чотирьох.»; «ВИПРАВЛЕННЯ», «Обери правильне», «У реченні — поширена ненормативна форма. Знайдіть нормативну.»
- Round: «Вийти з гри» (VoiceOver), «7 / 15», «Життів: 4 з 5» (VoiceOver), «ВИЗНАЧЕННЯ», «ЯК СКАЗАТИ КРАЩЕ?»
- Answers: tags «Правильно», «Ваш вибір»; sheet «Правильно!» or «Не цього разу», «Далі»
- Exit: «Вийти з гри?» / «Прогрес буде втрачено.» / «Вийти» / «Грати далі»
- Result: «Перемога!» / «Усі 15 раундів пройдено.» or «Життя закінчилися» / «Нічого — слова нікуди не дінуться.»; «раундів», «життів», «рекорд»; «Ще раз», «На головну»

### Share Cards, widgets, notification, splash

- Share Card: «СЛОВО ДНЯ», «Так часто кажуть», «Українською краще», «КАЛЬКА», watermark «SLOVO»
- Widget modes: «УЛЮБЛЕНЕ», «УСІ СЛОВА», «КОЛЕКЦІЯ · ДЛЯ ЛИСТІВ»
- Notification: app name «SLOVO», time «зараз» / «09:00»
- Splash: «SLOVO», «рідкісні слова рідної мови»
