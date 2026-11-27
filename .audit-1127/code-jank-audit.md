# Code jank audit — SLOVO mobile (2026-11-27)

Scope: `apps/mobile/src`, `packages/ui/src`, read-only, against `main` at d1fb6ed49. Every finding below was checked by reading the code. Severity: **high** = likely visible stutter on a normal phone, **medium** = visible in some cases or adds real UI-thread/JS work during motion, **low** = small or rare.

Counts: **2 high, 9 medium, 8 low**.

## Ruled out (checked, clean)

- No React Native `Animated` and no `LayoutAnimation` anywhere: all motion is Reanimated on the UI thread.
- Lists are `FlatList`/`SectionList` with stable `keyExtractor` (history, favorites, learning, collections, category boards, search, hidden, WOTD archive). `useListScroll` (`ScrollToTop.tsx:42-54`) only writes a shared value on scroll, and `ScrollToTopButton` calls `scheduleOnRN` only when the visibility flips (`:90`).
- Tabs that lose focus are put in a hidden `<Activity>` (`edition-tabs.tsx:175-206`). That runs effect cleanups, so the Game timer interval and the `useSharedValue` cleanup (Reanimated 4.7.1 `useSharedValue.ts` cancels on unmount) stop endless loops (Mascot, HeroSparks, loaders) while a tab is hidden.
- Haptics run fire-and-forget (`game/haptics.ts`). Nothing awaits them on a press.
- No `JSON.parse` of content and no sync SQLite on navigation: storage calls are async.
- `FeedPage` is `memo` and `renderPage` is a `useCallback` (`app/feed.tsx:104-127`), so a swipe does not re-render the pages it keeps.

---

## High

### H1. Crossword: the trace lags behind the finger. Each letter takes a JS round trip and re-renders the whole grid
- **Where:** `packages/ui/src/game/useTraceDrag.ts:58-63` → `apps/mobile/src/game/crossing-crossword.ts:225` (`extend` → `play`) → `:173-187` (`setOpened`) → `:197` (`cells: crossingCells(...)` rebuilt) → `packages/ui/src/game/CrossingGrid.tsx:104-130` (`'use no memo'`, every cell re-rendered, new inline `onPress` per cell) and `LetterWheel.tsx:139-200` (polyline and chips drawn from the JS `trace` prop).
- **On screen:** Daily Crossword. When you trace letters on the wheel quickly, the red path line and the letter chips land a few frames after the finger has passed a tile. On a fast trace they visibly catch up in jumps.
- **Why:** the hit test runs on the UI thread, but the visible result (line, chips) only appears after `scheduleOnRN` → Core `play` (an `inTurn` promise, queued behind the 1 s ticks) → `setOpened` → a full screen render. That render includes every `Cell` + `PressedTile` (both opt-out modules, so no compiler memo) and a rebuilt `cells` matrix, because `state` changes on every extend.
- **Fix:** keep the live trace on the UI thread. Hold the traced tile indices in a shared value (`useTraceDrag` already knows `at.index`) and draw the polyline with `useAnimatedProps` on an `AnimatedPolyline`, plus the chip highlight with `useAnimatedStyle`. Send only `release` (and VoiceOver steps) to JS/Core. Also wrap `Cell` in `memo` with a stable `onSelect(row, column)` instead of an inline closure, and memoize `crossingCells` on `(puzzle, state.current, state.words, state.cells)` rather than the whole `state`, so `trace`-only changes don't rebuild the grid.

### H2. Feed: every swipe mounts a new full card in the middle of the drag
- **Where:** `packages/ui/src/primitives/VerticalPager.tsx:221-227` (`setNearest` when the position crosses .5) and `:419-421` (`visible = items.slice(first, Math.max(index, nearest) + 2)`).
- **On screen:** Feed (the main screen). At rest the pager draws pages i-1, i, i+1. When the drag crosses halfway, `nearest` becomes i+1 and the window grows to include i+2, so a whole Word card mounts while your finger is still moving or the spring is settling. That card has SVG, a `SwipeMarks` pan detector, up to 4 `Text` copies of the Lemma in `WholeWordsText`/`FlyingText`, and illustration and tabs. Its fit passes (M2, M3) then commit again during the settle. This is the most likely cause of the small per-swipe hitch.
- **Why:** Fabric applies the mount on the UI thread in one transaction, and that is the same thread that moves `translateY` for the drag. The JS work doesn't block the UI thread, but the commit it produces does.
- **Fix:** mount the look-ahead page before the gesture, not during it. Render a fixed window `[index-1, index+2]` from `index` only and drop `nearest` from the window computation (keep it only for anything that truly needs it), so i+2 is already mounted at rest. Or defer the growth to `rested` (`setRested`, `:236`), so the mount lands after the spring stops.

---

## Medium

### M1. Entry screen: the card loads after the push starts and mounts mid-transition
- **Where:** `apps/mobile/src/entries/entry-screen.tsx:55-60` (`useCompositionRead(read)`), `apps/mobile/src/composition.ts:113-139` (read starts in `useEffect`, `setRead` on resolve), render gated at `entry-screen.tsx:87`.
- **On screen:** opening a Word from Saved, History, Search, Categories or the Dashboard. The native stack slides in an empty background, then the whole card pops in a few frames later, during the slide, and starts its reveal at the same moment.
- **Why:** the read is async and starts only after the first commit, so the biggest view tree in the app mounts on the UI thread during the native push animation. `openedFromSearch`/`openedFromNotification`/`widget.opened` also write state in that read.
- **Fix:** start the read before navigating. `useOpenScreen` could prefetch `composition.entryCard(id)` into a small cache keyed by id, and the screen reads it synchronously on first render. Or hand the row's already-known card model in. At minimum, gate the mount until `transitionEnd` (`screen-stack.tsx` already listens) and show a static placeholder of the card frame, so the mount happens after the slide.

### M2. `WholeWordsText` fits titles by trial: up to 10 render-and-layout passes, text hidden until done
- **Where:** `packages/ui/src/primitives/WholeWordsText.tsx:104-127` (`setFit({ step: step + 1 })` per failed step, `titleScale` has 10 steps, `tokens/base.ts:893`), `:197-200` (`onLayout` → `setLineWidth`), `:239-266` (`onTextLayout` → `setWidestWord` / `setLineCount`), `:170` (`!settled && styles.hidden`).
- **On screen:** every card title and tile that uses it: Word/Correction/Idiom/Tip cards (Feed, Entry), `CategoryTile` (the Categories grid, every tile at once), `DashboardHero`, game `RoundCard`/`PairsGrid`/`AnswerTiles`/`PickRound`, onboarding. A long Lemma stays invisible for several frames and then appears. On the Categories grid many tiles do this loop together while `ScreenEnter` slides the screen in.
- **Why:** each step is a state change → render → native text layout → event back → next step. That costs at least one frame per step, and each step commits again on the UI thread.
- **Fix:** measure once at the start size and compute the step directly: a single word's width scales linearly with font size (letter spacing is already a share of the size, `sized()`), so `step = first titleScale entry with size ≤ start * lineWidth / widest`. Only phrases with `lines` need one confirming pass. That gives 1–2 passes instead of up to 10.

### M3. Card tabs shrink their text by trial and remount the content each step
- **Where:** `packages/ui/src/entries/CardTabs.tsx:186-208` (`setFit` to `smallerTextSize` when `drawn.height > room`), `:239-246` (`<WholeLinesView key={drawnAt}>` remounts on every step), `:78` (`<FitPanel key={selected.key}>` remounts on every tab change).
- **On screen:** a Word card with long tab content at the «larger»/«largest» text size. On first draw and on every tab tap, the text draws big for a frame, then redraws smaller (up to 2 steps), visibly re-flowing. Each step also restarts the nested `WholeWordsText` fits (M2).
- **Why:** the key change throws away and re-creates the content subtree per step instead of updating its font size.
- **Fix:** keep the `WholeLinesView` key stable (drop `drawnAt` from the key) and change only the `FontSizeProvider` size. Measure all ladder sizes at once in an invisible absolute copy, or hide the content (`opacity: 0`) until `fit` settles, as `WholeWordsText` does.

### M4. Goal-reached card animates `height` every frame
- **Where:** `packages/ui/src/feed/GoalReachedCard.tsx:187-189` (`cutStyle` → `height: … * height`), applied at `:390`.
- **On screen:** Feed, the Daily Goal card's entrance (with the Mascot and the band). The slanted cut is resized every frame of the entrance, which runs while the page turn is still settling.
- **Why:** in Reanimated 4, `height` is a layout prop. Each frame goes through a shadow-tree commit and a Yoga layout instead of the fast transform/opacity path.
- **Fix:** give the cut its full height once and animate `transform: [{ scaleY }]` with `transformOrigin: 'top'` (or `translateY` under a clip), which gives the same visual with no layout.

### M5. Weekly Recap fold animates `height` and `marginBottom` per frame, and ends on a JS timer
- **Where:** `packages/ui/src/feed/WeeklyRecapCard.tsx:261-266` (`height: height.value * (1 - closing)`, `marginBottom: …`), `:243-247` (`setTimeout(done, fold.duration)` beside the UI animation), `:280` (`setStarted(true)` re-render at the tap).
- **On screen:** Feed, «Готово» on the Weekly Recap. The card folds and the gap closes. Every frame relayouts the page. If JS is busy, `done` fires out of step with the animation, so the page jumps when the card is dropped.
- **Why:** layout props on the commit path each frame, plus two clocks (UI animation, JS timer) that are not tied together.
- **Fix:** finish with the animation's callback (`withTiming(1, …, (f) => { 'worklet'; if (f) scheduleOnRN(done) })`) instead of `setTimeout`. If the siblings really need to move, animate a `translateY` on the following content and drop the card at the end, or keep the height collapse but only over the last short `closing` share.

### M6. Timed Game: the timer re-renders the round 4 times a second and moves the bar by `width`
- **Where:** `apps/mobile/src/game/game.ts:48-66` (`TICK_MS = 250`, `setNow` every tick, even when the shown second does not change), `apps/mobile/src/app/game/index.tsx:58` (`Game` re-renders) → `GameRound.tsx:144-152` → `GameHeader.tsx:155-164` (`'use no memo'`, the whole header re-renders, with new `texts` closures) → `GameTimer.tsx:57-75` (`width: '${share*100}%'`).
- **On screen:** timed Game (60 s, `timed-mode.ts:5`). The red bar crawls in 4 fps steps instead of moving smoothly. Four layout commits a second compete with the option `FadeInUp` entrances (`PickRound.tsx:156`) and the answer banner slide. It also breaks the project rule «Animate with Reanimated shared values» (`docs/react-native.md`, Gestures and animation).
- **Why:** the bar is driven by React state, not the UI thread.
- **Fix:** drive the bar on the UI thread. Once per run/pause, set `progress.value = withTiming(0, { duration: left, easing: linear })` and animate `transform: [{ scaleX }]` with `transformOrigin: 'left'`. Re-render React only when the whole second changes: `setNow` only if `Math.ceil(left/1000)` changed, or tick on the second boundary.

### M7. Bottom sheet: the slide starts before the Modal is on screen
- **Where:** `packages/ui/src/primitives/BottomSheet.tsx:147-164` (in the same effect: `setMounted(true)` and `progress.value = withSequence(withTiming(…))`), `:271` (`if (!mounted) return null`).
- **On screen:** every sheet (stats pill, «⋯» Entry menu, Collections menu, share, gestures hint, voice picker). The first frames of the slide run while the Modal is still mounting and being presented natively, so the sheet appears partway up and the overshoot looks clipped. This is most visible on the first open after launch.
- **Why:** the animation clock starts before the content exists. Modal presentation plus first render of the panel takes one or more frames.
- **Fix:** start the slide when the panel first lays out (in `SheetPanel`'s `onHeight` on the first call, or `Modal`'s `onShow`), not in the effect that mounts it.

### M8. Tab change: the hidden tab is revealed and re-subscribed in the same commit that starts its entrance
- **Where:** `apps/mobile/src/shell/edition-tabs.tsx:175-187` (`useHiddenOutOfFocus`: `setSettledOut(false)` during render on focus) and `:198-206` (`<Activity mode=…>` inside `ScreenEnter`), `packages/ui/src/primitives/ScreenEnter.tsx:44-68` (the entrance starts in a `useEffect` on `focused`).
- **On screen:** switching tabs (Feed ↔ Saved ↔ Profile ↔ Game). The returning screen draws everything that changed while it was hidden (History, XP, Badges after a Feed session) in the same render that starts the slide-and-wipe. Every `useSyncExternalStore` resubscription that finds a new snapshot forces a further sync render. The 300 ms entrance starts late and its first frames carry the reveal's commits.
- **Why:** the Activity un-hide, the effect re-mounts and the entrance trigger all land in one commit, and the motion's start waits for JS to finish that commit.
- **Fix:** start the entrance from the UI side as soon as focus flips. Kick `entered.value` from the tab `focus` listener before React re-renders, or keep the Activity hidden for one more frame after focus so the wipe cover is already moving over the old frame while the reveal commits underneath it.

### M9. Feed: the Seen/XP/History chain and media prefetch run during the settle spring
- **Where:** `packages/ui/src/primitives/VerticalPager.tsx:365-378` (`scheduleOnRN(swipeTo)` at release) → `:236-241` `turn` → `apps/mobile/src/app/feed.tsx:128-135` `onIndexChange` (`onCardChange` + `closeUndoToast`) → `apps/mobile/src/feed/feed.ts:76-79` → `feed/reader-place.ts:85-92` (`feed.show(position)` + `changed()`) → `packages/core/src/feed/feed.ts:815-837` (`keepScreenChange` → History record, XP log, `seen.publish`, `keepNextCardReady`) and `apps/mobile/src/feed/feed.ts:124-131` (`prefetchAhead` on every `place` change).
- **On screen:** Feed. Right after you let go, JS writes the Seen, updates XP/History/Badges subscribers (the streak pill in the header, `MascotCelebrations` at the root), appends the next card (a `cards` change re-renders the pager) and starts media downloads. All of that happens inside the ~300 ms spring. With H2 it adds commits on the UI thread while the page settles, and it delays the press feedback of anything you tap right after a swipe (see L7).
- **Why:** the index change is reported on release, not on rest.
- **Fix:** report the turn to the Core when the pager rests (`setRested`, `:236`), or defer `place.turn` and `prefetch` with `requestIdleCallback`/`InteractionManager.runAfterInteractions` behind the settle. Keep `setIndex` on release for the pager itself.

---

## Low

### L1. Answer banner draws its slab one frame after its text
- **Where:** `packages/ui/src/game/AnswerBanner.tsx:99-123` (`onLayout` → `setSize`, the `Wedge` renders only when `size` is known) while the rise starts at mount (`:91`).
- **On screen:** Game, after an answer. The banner text slides in with no red/ink slab behind it for a frame, then the slab appears.
- **Fix:** draw the slab with a `viewBox` and `preserveAspectRatio="none"` at `width/height="100%"` on an absolute fill, or start `rise` only after the first `onLayout`.

### L2. Interface sounds are created on first play
- **Where:** `apps/mobile/src/sounds/sound-engine.ts:36-44` (`createAudioPlayer` on the first `play`) and `:58-61`; first use from `packages/ui/src/game/GameRound.tsx:106`, `SplashOverlay.tsx:148-155`, `DashboardHero` `HeroButton sound="tap"`.
- **On screen:** the first right/wrong answer, the first tap sound, the splash «shout»: the sound comes late (the player is not loaded yet), and the sync native call runs on the JS thread at the moment of the press.
- **Fix:** create the players for the Edition's sounds once, when `InterfaceSoundsInEffect` mounts with sounds on (idle-time preload), and only `seekTo(0)` + `play()` on use.

### L3. Rarity range drag calls JS on every frame
- **Where:** `packages/ui/src/settings/RarityRangePicker.tsx:157-162` (`scheduleOnRN(drag, start.value, at)` in every `onUpdate`).
- **On screen:** Settings › rarity range. ~60 JS calls a second while dragging; each bails early, but under load the bar highlight lags.
- **Fix:** keep the last `at` in a shared value and call JS only when it changes.

### L4. The Goal card's Mascot loops while its page waits off screen
- **Where:** `packages/ui/src/feed/GoalReachedCard.tsx:308-309` renders `mascot(...)` unconditionally; `packages/ui/src/primitives/Mascot.tsx:262-276, 300-309, 372-395` start endless `withRepeat` loops on mount, with no check of `useIsPageOnScreen()`.
- **On screen:** none visible. When the goal card is the pre-mounted next page, its celebrating Mascot (figure, rays) animates every frame off screen, which costs UI-thread work during the swipe into it.
- **Fix:** pass `useIsPageOnScreen()` down (or read it in `Mascot`) and start the loops only while on screen.

### L5. Search runs on every keystroke without deferral, with up to 300 row reads
- **Where:** `apps/mobile/src/search/search.ts:69-88` (for each of 6 groups, up to `GROUP_LIMIT = 50` `composition.entryRow` awaits), `useSearchScreen` `:96-110` re-reads on each `query` change. Core scan in `packages/core/src/search/search.ts:203-258` (the first query also builds the keys of all Entries).
- **On screen:** Search. Typing stays native, but results arrive late and JS is busy right as the list re-renders. The first query after open is the slowest.
- **Fix:** `useDeferredValue(query)` or a ~120 ms debounce; warm `readKeyedOnce` when the Search screen opens; build rows only for what the `SectionList` first shows.

### L6. Text colour and SVG props animated through the commit path
- **Where:** `packages/ui/src/settings/NarratorVoicePicker.tsx:236-243` (`interpolateColor` → `color` on `Animated.Text` per frame), `packages/ui/src/settings/RarityRangePicker.tsx:268-272`, `packages/ui/src/onboarding/OnboardingVoiceList.tsx:218`, `packages/ui/src/progress/LevelCard.tsx:75-77` (`strokeDashoffset` via `useAnimatedProps`).
- **On screen:** voice picker syllables, rarity bars, onboarding voice list, the Profile level ring. These are short, small views and smooth in practice, but each frame is a shadow-tree commit, not a direct native update.
- **Fix:** where it matters, overlay two copies of the text and cross-fade `opacity`. For the ring this is acceptable as is.

### L7. Press feedback starts from JS
- **Where:** `packages/ui/src/primitives/PressedTile.tsx:105-140` (`onPressIn` → `withTiming`; also builds `Easing.bezier(...)` per press), `packages/ui/src/primitives/Chip.tsx:74-79`.
- **On screen:** every tile and chip. When JS is busy (right after a Feed swipe, M9, or during a tab reveal, M8), the tile sinks late.
- **Fix:** hoist the easing to module scope. For the hottest tiles, use a Gesture Handler `Pressable`/tap gesture with `onBegin` as a worklet so the sink starts on the UI thread.

### L8. Splash ends and shouts on JS timers beside a UI animation
- **Where:** `packages/ui/src/onboarding/SplashOverlay.tsx:151-167` (`setTimeout(shout, …)`, `setTimeout(done, play(...))`).
- **On screen:** cold start and the daily splash. The app is opening the Language Pack at the same time, so JS timers fire late: the shout sound and the hand-off drift from the animation, and the overlay may hang on its last frame before it goes.
- **Fix:** end from the animation's completion callback (`scheduleOnRN(done)`), and trigger the shout with `useAnimatedReaction` crossing `shoutAt`.

---

## Top 5 to fix first
1. H2: fixed look-ahead window in `VerticalPager` (no mount mid-swipe).
2. H1: crossword trace drawn on the UI thread, grid memoized.
3. M9: report the turn to the Core on rest, not on release.
4. M1: prefetch the Entry card before the push.
5. M2: one-pass title fit in `WholeWordsText` (helps Feed, Entry, Categories and the Game at once).
