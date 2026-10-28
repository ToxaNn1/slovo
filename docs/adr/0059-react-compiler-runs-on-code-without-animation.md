# The React Compiler runs on code without animation

The app and `@slovo/ui` memoise by hand with `useMemo`, `useCallback` and `React.memo`. The React Compiler does this at build time, and Expo SDK 57 supports it. It assumes the rules of React: values used in render are not mutated after render, and refs are not read during render. Reanimated shared values and gesture callbacks bend those rules by design (a shared value is written outside render, a gesture handler closes over mutable state), so the animated modules are where the compiler can change behaviour.

**The compiler is on.** The app config sets `experiments.reactCompiler: true`, Expo's documented switch, and `babel-preset-expo` adds `babel-plugin-react-compiler` (its own dependency) for the app's code and the workspace packages Metro bundles, `@slovo/ui` included. Code in `node_modules` and Jest tests are not compiled. The compiler skips on its own any function it can't prove safe and leaves it as written.

**Animated modules opt out.** Every module with Reanimated, Worklets or gesture-handler code starts with the directive `'use no memo'`, which keeps the compiler off the whole file. These are, in `packages/ui/src`:

- `decor/DecorSlots.tsx`
- `feed/FeedStates.tsx`
- `game/GameRound.tsx`, `game/OrderedChips.tsx`, `game/PairsGrid.tsx`, `game/VowelButtons.tsx`
- `onboarding/Onboarding.tsx`, `onboarding/SplashOverlay.tsx`
- `progress/ActiveDaysCalendar.tsx`
- `primitives/BottomSheet.tsx`, `primitives/SwipeableRow.tsx`, `primitives/UndoToast.tsx`, `primitives/VerticalPager.tsx`
- `saved/FavoriteButton.tsx`
- `settings/WidgetGuide.tsx`
- `share/ShareSheet.tsx`

`game/round-motion.ts` holds Reanimated helpers but no component or hook, so the compiler leaves it alone anyway. In the app, only the root layout imports gesture-handler, for `GestureHandlerRootView`, with no animation of its own, so it is compiled. A test in `@slovo/ui` fails when a component module imports Reanimated, Worklets or gesture-handler, or a subpath of one, without the directive, so a new animated component opts out until it is checked.

**Lint follows the compiler.** Both `apps/mobile` and `packages/ui` lint with the compiler rules of `eslint-plugin-react-hooks` (`recommended-latest`) as errors, with effect dependencies kept as errors. The opted-out modules are exempt in `packages/ui/eslint.config.js`, which lists them again. The findings in compiled code that predate this decision carry an `eslint-disable-next-line` naming this ADR: three state resets in effects (`apps/mobile/src/feed/feed.ts`, `apps/mobile/src/notifications/notification-times.tsx`), which the compiler compiles as they behave today, and a counter mutated while rendering in `packages/ui/src/game/TypedAnswer.tsx`, which the compiler skips.

**Hand memoisation stays.** Existing `useMemo`, `useCallback` and `React.memo` stay for now; the compiler works with them.

**Next step.** Once the owner has checked the Feed swipes, the Game round, the sheets and Onboarding on an iPhone 16 and an SE with the compiler on, the opted-out modules are checked one at a time: one that passes the compiler's lint rules and keeps its gestures and motion on a device loses its directive and leaves the list above. After that, hand memoisation the compiler makes redundant is removed, and the suppressed findings are rewritten.
