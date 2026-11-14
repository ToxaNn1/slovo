# The React Compiler runs on code without animation

The app and `@slovo/ui` memoise by hand with `useMemo`, `useCallback` and `React.memo`. The React Compiler does this at build time, and Expo SDK 57 supports it. It assumes the rules of React: values used in render are not mutated after render, and refs are not read during render. Reanimated shared values and gesture callbacks bend those rules by design (a shared value is written outside render, a gesture handler closes over mutable state), so the animated modules are where the compiler can change behaviour.

**The compiler is on.** The app config sets `experiments.reactCompiler: true`, Expo's documented switch, and `babel-preset-expo` adds `babel-plugin-react-compiler` (its own dependency) for the app's code and the workspace packages Metro bundles, `@slovo/ui` included. Code in `node_modules` and Jest tests are not compiled. The compiler skips on its own any function it can't prove safe and leaves it as written.

**Animated modules opt out.** Every module with Reanimated, Worklets or gesture-handler code starts with the directive `'use no memo'`, which keeps the compiler off the whole file. These are, in `packages/ui/src`:

- `categories/CategoryGrid.tsx`
- `dashboard/CorrectionTypeRow.tsx`, `dashboard/HeroReveal.tsx`, `dashboard/HeroSparks.tsx`, `dashboard/MoodCheckIn.tsx`, `dashboard/PreviousWords.tsx`, `dashboard/QuietScreenRow.tsx`, `dashboard/RailScreenCard.tsx`, `dashboard/RailScreenHero.tsx`
- `entries/CardTabs.tsx`, `entries/SwipeMarks.tsx`, `entries/reveal.tsx`
- `feed/GesturesHintSheet.tsx`, `feed/GoalReachedCard.tsx`, `entries/swipe-demo.tsx`
- `game/ChipsRound.tsx`, `game/CrossingGrid.tsx`, `game/GameRound.tsx`, `game/LetterWheel.tsx`, `game/OrderedChips.tsx`, `game/PairsGrid.tsx`, `game/PairsRound.tsx`, `game/PickRound.tsx`, `game/RoundCard.tsx`, `game/TracedCrosswordGrid.tsx`, `game/TypedRound.tsx`, `game/VowelButtons.tsx`, `game/VowelRound.tsx`, `game/useAnswerMotion.ts`, `game/useTraceDrag.ts` (the Game Round's form modules, split from `GameRound.tsx`, keep its opt-out)
- `onboarding/OnboardingStep.tsx`, `onboarding/SplashOverlay.tsx`
- `progress/ActiveDaysCalendar.tsx`, `progress/BadgeStamp.tsx`, `progress/BadgeToast.tsx`, `progress/NewLevelScreen.tsx`, `progress/LevelCard.tsx`
- `primitives/BottomSheet.tsx`, `primitives/Chip.tsx`, `primitives/FallingMarks.tsx`, `primitives/FlyingText.tsx`, `primitives/Mascot.tsx`, `primitives/PressedTile.tsx`, `primitives/ScreenEnter.tsx`, `primitives/ScrollToTop.tsx`, `primitives/SwipeableRow.tsx`, `primitives/Switch.tsx`, `primitives/TabBarButton.tsx`, `primitives/UndoToast.tsx`, `primitives/useCascade.ts`, `primitives/VerticalPager.tsx`, `primitives/WedgeLoader.tsx`
- `saved/FavoriteButton.tsx`
- `settings/NarratorVoicePicker.tsx`
- `settings/WidgetGuide.tsx`
- `share/ShareSheet.tsx`

`game/round-motion.ts` holds Reanimated helpers but no component or hook, so the compiler leaves it alone anyway. In the app, only the root layout imports gesture-handler, for `GestureHandlerRootView`, with no animation of its own, so it is compiled. A test in `@slovo/ui` fails when a component module imports Reanimated, Worklets or gesture-handler, or a subpath of one, without the directive, so a new animated component opts out until it is checked.

**Lint follows the compiler.** Both `apps/mobile` and `packages/ui` lint with the compiler rules of `eslint-plugin-react-hooks` (`recommended-latest`) as errors, with effect dependencies kept as errors. The opted-out modules are exempt in `packages/ui/eslint.config.js`, which lists them again. The findings in compiled code that predated this decision carried an `eslint-disable-next-line` naming this ADR: three state resets in effects (`apps/mobile/src/feed/feed.ts`, `apps/mobile/src/notifications/notification-times.tsx`) and a counter mutated while rendering in `packages/ui/src/game/TypedAnswer.tsx`. All four were rewritten on 2026-10-30 (#1260, #1261, #1263): the Feed turns its pager and takes the reader's position while rendering, the duplicate hint derives from the list it was refused for, and `TypedAnswer` places its blanks before rendering. Compiled code carries no suppression of the compiler rules.

**Hand memoisation stays.** Existing `useMemo`, `useCallback` and `React.memo` stay for now; the compiler works with them.

**Next step.** Once the owner has checked the Feed swipes, the Game round, the sheets and Onboarding on an iPhone 16 and an SE with the compiler on, the opted-out modules are checked one at a time: one that passes the compiler's lint rules and keeps its gestures and motion on a device loses its directive and leaves the list above. After that, hand memoisation the compiler makes redundant is removed.
