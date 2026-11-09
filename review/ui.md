# Global review 06.11 — packages/ui (Рупор design system)

Scope: `packages/ui/src` at `main` bf792f89, read-only. Skipped what spec #1586 already plans
(GameRound literal block and split, ActionRow/CornerActions/EntryMenuSheet duplication, Saved list screens).
Method: `docs/react-native.md`, ADR index, token lint rule (`packages/config/token-lint.js`), greps over
casts, a11y props, timers, keys, exports; contrast computed from `editions/uk/tokens.json` (WCAG relative luminance).

Hygiene that checked out: no `as`/`!`/`@ts-expect-error` casts outside tests; every `Pressable` carries a role and
label (BottomSheet scrim is `accessible={false}` by design, TabBarButton uses `role="tab"`); no `Alert`/`ActionSheetIOS`;
no `Date.now`/`Math.random`; every `setTimeout` is cleared; `Pressable disabled` flows into `accessibilityState`;
no test that passes on an empty render (all use `getBy*`, call counts or values); no app deep-imports into `@slovo/ui/src`;
GameTimer takes time as a prop; Game haptics come from `createGameHaptics` (ADR 0025).

Counts: High 0 · Medium 4 · Low 9.

---

## Medium

### M1. Accent red as small text falls below WCAG AA contrast — confirmed (computed)
UA light theme: `accent`/`destructive`/`heart` = `#FF3B2F` on `background #FFF4E6` = **3.27:1**, on `surface/tile` 3.44:1,
on `surfaceSunken` 2.85:1, on `highlight` 2.48:1. Dark theme: on `tile` 4.19:1, `surfaceSunken` 4.42:1. AA for text under
18.66 pt bold needs 4.5:1. The roles drawn in accent are all small: `eyebrow` 11, `reviewTag` 11, `heroKicker` 11,
`formLabel` 12, `fieldProblem` 13, `textLink`/`recentClear`/`linkWord` 15 (`tokens/base.ts:125,246,256,258,382,384,398`).
Also `onAccent` cream on accent = 3.27:1, so the primary Button label on a red ground fails too unless the role is ≥ 18.66 pt bold.
Sites (14): `entries/ReviewLabel.tsx:25`, `entries/CorrectionCard.tsx:85,270`, `entries/WordCard.tsx:407,475`,
`primitives/TextField.tsx:125`, `saved/CollectionNameField.tsx:68,106`, `saved/CollectionSheet.tsx:114,223`,
`search/RecentQueries.tsx:41`, `feed/FeedNoticeCard.tsx:72`, `knowledge/EntryMenuSheet.tsx:64`, `game/GameRound.tsx:538`.
Failure: a low-vision reader in light theme cannot read a field's problem text («Така назва вже є») or the «Повторення» tag.
Fix: an Edition token for accent *text* (`accentText`, UA: `accentEdge #C4271D` gives 5.29:1 on background, 5.57:1 on surface)
and point every text role above at it; keep `accent` for fills, borders and ≥ 19 pt bold text. Palette is an Edition token
(ADR 0070), so the change is one line in `editions/uk/tokens.json` plus the 14 sites; add a Vitest contrast check in
`tokens.test.ts` over every text-colour pair so it stays.

### M2. Every `useReduceMotion()` call site asks the system itself — confirmed
`providers/useReduceMotion.ts:12-28`: each call runs `AccessibilityInfo.isReduceMotionEnabled()` and adds a
`reduceMotionChanged` listener. 30 call sites, 0 of them shared; a Dashboard rail screen with N `RailScreenCard`s does N native
round-trips, N listeners and N extra renders when the promises resolve. Worse, `useReduceMotion()` is `false` until the
promise resolves, so an animation started in a mount effect (`useCascade`, `ScreenEnter`, `PressedTile`, `TabBarButton`,
`BottomSheet` slide) begins in full form for a reader with system Reduce Motion on; only `UndoToast` and `SplashOverlay`
guard with `useReduceMotionKnown`. ADR 0055: "one short fade under Reduce Motion".
Fix: `ReduceMotionProvider` reads the system once (value + listener) and publishes `system || setting` with a `known` flag;
`useReduceMotion` becomes a context read. One subscription, no first-frame full-motion flash.

### M3. A thrown Collection action is swallowed into `console.error` — confirmed
`saved/CollectionSheet.tsx:100-103` and `saved/CollectionNameField.tsx:48-51`: when `onCreate`/`onSubmit` throws, the catch
logs and returns; `refusal` keeps its previous value, nothing is announced, the field looks idle. Failure: storage refuses the
write (disk full, closed Language Pack after a reopen per ADR 0036) and the reader taps «Створити» repeatedly with no answer.
Fix: the prop contract is `Promise<string | undefined>` (a reason or success), so a throw is a programming error: either let it
propagate to the app's error boundary, or set a generic refusal from the Edition's strings and `announceForAccessibility` it,
as the refusal path already does. No `console.*` elsewhere in the package.

### M4. Module-level size constants bypass the token lint — plausible (lint gap confirmed, each value is a design size)
`token-lint.js` bans literal `fontSize|padding|margin|gap|borderRadius` *properties* and hex colours; a `const X = 14` used
in a style passes. Outside spec #1586's GameRound: `game/OrderedChips.tsx:21-29` (SLOT_HEIGHT 64, SLOT_BORDER 3, CHIP 60×54,
CHIP_RADIUS 14, CHIP_GAP 8, LINE_GAP 22), `game/PairsGrid.tsx:23-34` (CELL_HEIGHT 70, CELL_RADIUS 16, CELL_GAP 12),
`game/VowelButtons.tsx:22-31` (38×62, LETTER_GAP 2), `game/GameTimer.tsx:9-11`, `game/TypedAnswer.tsx:9-10`,
`progress/XpBar.tsx:9` (BAR_HEIGHT 40), `search/SearchButton.tsx:9` (40), `entries/WordCard.tsx:548` (ILLUSTRATION_HEIGHT 160),
`entries/PronunciationButton.tsx:42-43` (260/64), `feed/FeedStates.tsx:128` (`minHeight: 54`), `primitives/BottomSheet.tsx:51-78`
(SLIDE_OUT 220 ms, OVERSHOOT 10, CLOSE_DISTANCE 96, CLOSE_VELOCITY 800; `motion.sheet` tokens exist beside them).
The same `maxFontSizeMultiplier` caps are redeclared in 17 files (`NUMBER_MAX_FONT_SCALE = 1.3`, `TEXT_MAX_FONT_SCALE = 1.5`, …).
Failure: a board change to the Game chip size touches 4 files instead of `tokens/game.ts`; the guide's "a size missing from the
tokens goes into `packages/ui/src/tokens/`" has no teeth. Fix: move them to `tokens/game.ts`, `tokens/entry.ts`, `tokens/chrome.ts`
(one `fontScaleCap = { number: 1.3, text: 1.5 }` in `base.ts`); extend the lint with a selector for
`VariableDeclarator[id.name=/^[A-Z_]*(WIDTH|HEIGHT|RADIUS|GAP|SIZE|PADDING|MARGIN|BORDER)$/] > Literal` outside `tokens/`.

## Low

### L1. `DailyCrosswordCard` reads its Ukrainian label with the system voice — confirmed
`game/DailyCrosswordCard.tsx:63-67`: the `PressedTile` gets `accessibilityLabel={sentences([title, day, state])}` but no
`{...voice}` (the file never imports it). The guide requires `voice` on every Edition-language text. Same for the badge symbol
Text in `progress/BadgeMark.tsx:101` if the symbol is a letter. Fix: `const { voice } = useEdition()` and spread it on the tile.

### L2. Stale `onDone` in the splash timer — plausible
`onboarding/SplashOverlay.tsx:128-134`: `setTimeout(onDone, …)` inside an effect with `// eslint-disable-next-line
react-hooks/exhaustive-deps`, deps `[reduceMotion]`. If the shell renders a new `onDone` (closure over a later opening) before
the cut ends, the first one fires. Fix: `const done = useEffectEvent(onDone)` as `UndoToast.tsx:171` already does; drop the disable.

### L3. Same `fieldProblem` role, two colour tokens — confirmed
`primitives/TextField.tsx:125` draws the problem text in `colors.accent`; `saved/CollectionNameField.tsx:106` in
`colors.destructive`. In the Core neutral palette (`tokens/base.ts:36-79`) accent is ink and destructive is grey, so the same
message looks different in two fields. Pick one (destructive, see M1 for its contrast) and fold `CollectionNameField`'s field into `TextField`.

### L4. Hand-drawn shapes as inline SVG strings — plausible
`settings/SettingsRows.tsx:117` (`points="0,0 4,0 10,8 4,16 0,16 6,8"` chevron), `entries/SwipeMarks.tsx:391` (check mark),
`settings/WidgetGuide.tsx` drawing. ADR 0070 makes shapes Core tokens (`wedges`), and the other wedges live in `tokens/base.ts`.
Fix: `wedges.chevron`, `wedges.check` with doc comments.

### L5. Tile edge below the non-text contrast floor — plausible
UA light: `tileEdge #DCC2A6` on `tile #FFFBF5` = 1.65:1, and `tile` on `background` ≈ 1.05:1, so the edge is the only boundary of
a Category tile (WCAG 1.4.11 asks 3:1 for component boundaries). Dark: 1.38:1. Design decision from the board; flag for the owner.

### L6. `CategoryGrid` re-renders every tile on each parent render — plausible
`categories/CategoryGrid.tsx:1,106-121`: a `'use no memo'` module (no compiler memoization) passes an inline `renderItem`,
and `onPress={() => onOpen(id)}` per row. The grid's `header` may hold a text field (comment at :34), so every keystroke in the
parent rebuilds all visible `Cascade` + `CategoryTile` elements. `RailBoard.tsx:55` has the same shape but is compiler-memoized.
Measure first (guide: "add new hand memoization only where it is measurable"); if real, hoist `renderItem` into a `useCallback`.

### L7. Fifteen exported types nobody imports — confirmed
`index.ts` exports `BadgeGridItem, CategoryShape, CrosswordWord, EntryMenuMarks, EntryRowAction, GesturesHintTexts,
GridColumns, HeroAction, HeroWord, MessageToastContent, MistakeReportSheetDraft, RowIcon, ToastContent, TracedLetter,
TypedAnswerBlank`; no file outside the defining module uses them (apps, site, ui, tests). 28 more exports are used only inside
`packages/ui` and its tests (`ConfirmationDialog`, `GameTimer`, `PairsGrid`, `OrderedChips`, `VowelButtons`, `TypedAnswer`,
`WedgeLoader`, `Icon`, `BadgeMark`, `BlockTitle`, `CategoryTile`, `coreTokens`, `roleSize`, …); the tests render from
`@slovo/ui` by the guide, so those stay. Drop the 15 types or mark them `@internal`.

### L8. Four small capital-label components with their own StyleSheets — plausible
`entries/ReviewLabel.tsx` (outlined accent), `entries/WordOfTheDayBadge.tsx` (filled accent / bare kicker on red),
`primitives/LabelChip.tsx` (sunken), `entries/CategoryChip.tsx` (filled). All: `alignSelf: flex-start`, `badgePadding`,
`radii.chip`, uppercase 11 pt role, `accessible` + `voice`. One `CardLabel` with `variant: 'outlined' | 'filled' | 'sunken'`
would remove ~80 lines and keep the four doc comments as variants. Check against the Рупор boards before merging the kicker form.

### L9. `UNMEASURED_WIDTH = 360` guess before layout — plausible
`entries/SwipeMarks.tsx:50,132`: the mark distance starts at `360 × MARK_SHARE` until `onLayout` reports the card width. A swipe
that starts before the first layout (fast re-mount in `VerticalPager`) uses the guess; on an iPad or landscape it is far off.
Low impact (one gesture); fix by reading `useWindowDimensions().width` as the initial value.

---

## Not findings (checked)
- `colors.background` as text on ink pills and the WOTD badge (10 sites) is the design's inversion, consistent in both schemes.
- `UndoToast` with VoiceOver and an undo never times out: documented at `UndoToast.tsx:148-149`, per ADR 0077 "undo always in reach".
- `BottomSheet` derives `openedOn` with setState during render: a legal derived-state pattern, bounded to one re-render.
- `key={index}` sites (`WordCard` examples, `OrderedChips`, `TracedCrosswordGrid`, `SettingsRows`, `Mascot`) index static
  per-render arrays with no reorder or item state; fine.
- `compiler-opt-out.test.ts` keeps the `'use no memo'` list and `eslint.config.js` in step (ADR 0059).
