# React Native guide

How to write screens and components in `apps/mobile` and `packages/ui`. `CONTEXT.md` and `docs/adr/` win over this guide; `docs/design/design-system.md` holds the visual rules.

## Where code lives

- **Route file** (`apps/mobile/src/app/**`): composition only. It reads hooks, branches on states (empty → content), assembles `@slovo/ui` components and wires navigation and confirmations. Aim for a screen you can read top to bottom in one pass.
- **Opening and readiness**: every screen draws over the open Language Pack and composition, behind their gates in `apps/mobile/src/app/_layout.tsx` (`Opened`, ADR 0036), so a route never checks for loading or a failure. The SLOVO ID screen alone puts its content under the gate of the Account, which opens apart (ADR 0036 amendment). A hook reads a module with `useSubscribed(useComposition().favorites, ({ list }) => list)`; a source that opens apart from the composition binds the same way. An opening can be reopened while the app runs (ADR 0036 amendment): read modules through `useComposition()` on each render, and keep no React state over a module that outlives the value it came from.
- **Hook module** (`apps/mobile/src/<domain>/<feature>.ts`): data shaping for a screen — grouping, sorting, building section keys, formatting through the Edition's strings. Expose one hook per screen need (a hook such as `useHistorySections()`, an illustration, not an existing name) and export the type of its output, so the route file imports the type instead of writing it inline.
- **Core** (`@slovo/core`): rules and pure functions, language-agnostic and free of React (ADR 0002, 0006). Time and randomness come in as arguments (`CLAUDE.md`: "Inject time and randomness").
- **UI** (`@slovo/ui`): every visual primitive — buttons, text roles, rows, headings. It takes data and callbacks through props and strings through `EditionProvider`. Its domain folders build on `primitives/`, which build on `providers/` and `decor/`; none of these three imports a domain folder (dependency-cruiser's `ui-layers-import-no-domain-folder`).
- **Folders** (ADR 0027): each package groups its modules into `<domain>/<feature>` folders named after the `CONTEXT.md` domains (`entries/`, `saved/`, `feed/`, `game/`, …), the same set in `packages/core`, `packages/ui` and `apps/mobile`. A domain with a single module keeps it at the root of `src/`; a test sits beside its module; a folder has no `index.ts` barrel. `apps/mobile/src/app/` holds routes only, and the app's config plugins sit in `apps/mobile/plugins/`.
- Extract a named subcomponent when a JSX block has its own meaning (a header bar, a day heading, an empty state) or grows past about 20 lines. Pass it data and callbacks; keep hooks that fetch data in the route file or hook module.

## Styling

- Static styles go in one `StyleSheet.create` at the bottom of the file; theme values join them through a style array: `style={[styles.title, { color: colors.ink }]}`.
- Take every size from `@slovo/ui` tokens: `space[n]` for spacing, `typeSize.*` and `overlineType` for type, `minTouchTarget` for tap areas, `useTokens()` for colours and font families. A size missing from the tokens goes into `tokens.ts` with a doc comment, then gets used. A literal size, spacing, radius or hex colour outside `tokens.ts` (tests aside) fails lint.
- A pressable piece of text, a label style or a row shape that two screens need becomes a component in `@slovo/ui`.

## Lists

- Render collections through `FlatList` / `SectionList` (virtualized) with `keyExtractor` returning a stable id such as `entryId`. `ScrollView` is for short, fixed content like a settings page.
- Memoize derived list data (`useMemo`) in the hook module; the React Compiler is not enabled, so memoize what feeds a list and props of heavy rows by hand, only where it is measurable.

## Gestures and animation

- One `GestureHandlerRootView` wraps the app in `apps/mobile/src/app/_layout.tsx`, and screens and components rely on it. A screen does not add its own wrapper. The exceptions are in `packages/ui`: `BottomSheet` keeps one inside its Modal, which is its own native root, and `VerticalPager` keeps its own.
- Animate with Reanimated shared values and `useAnimatedStyle` so motion runs on the UI thread. Respect `useReduceMotion()` for every animation.

## Safe area and platform

- Use `SafeAreaView` / `useSafeAreaInsets` from `react-native-safe-area-context` and name the `edges` a screen needs (tab screens: `['top']`).
- Small platform differences go through `Platform.select`; large ones go into `.ios.tsx` / `.android.tsx` siblings.

## Accessibility

- Every `Pressable` carries `accessibilityRole` and an `accessibilityLabel` from the Edition's strings, and a tap area of at least `minTouchTarget` (use `hitSlop` for small icons).
- Section and screen titles carry `accessibilityRole="header"` (the heading components in `@slovo/ui` already do).
- Text in the Edition's language spreads `voice` from `useEdition()` so VoiceOver reads it in that language.

## Confirmations and choices

- SLOVO draws its own confirmations and choices. `Alert.alert` and `ActionSheetIOS` are not used, because the system's look is foreign to the app.
- A single destructive confirmation uses `ConfirmationDialog` from `@slovo/ui`: a title, an optional message, a destructive action and a cancel action. The caller owns `visible` and turns it off in both callbacks (`onDestructive`, `onCancel`); a tap beside the dialog and the system back gesture ask `onCancel`. Examples: clearing History, deleting a Collection.
- A choice between different actions uses a `BottomSheet` with a row per action and the cancel last. It stays a sheet when the state leaves one option on offer. Example: hiding an Entry from its card, whose options are this Entry, its Category or Corrections.
- Do not open a sheet for a single action and its cancel; that is a confirmation, so it uses `ConfirmationDialog`.
- Build both from the Edition's strings, and give the flows in `apps/mobile/maestro/` the button texts to tap.

## Strings and conditionals

- UI text comes from `editionStrings` (`apps/mobile/src/edition/edition.ts`). `fill` from `@slovo/contracts` puts values into `{placeholders}`; a count picks its CLDR plural form (`Plural`, ADR 0020).
- Conditional JSX uses a boolean: `items.length > 0 && <X />`. A bare number before `&&` renders outside `<Text>` and crashes.

## Testing hooks

- Give each screen root, row and action a `testID` (`history`, `history-row-${entryId}`, `history-clear`) for Maestro flows in `apps/mobile/maestro/`.
- Test hook modules, Core functions and the pure functions of `@slovo/ui` (through its published subpaths such as `@slovo/ui/tokens`) with Vitest through their public seams, in `*.test.ts` files.
- Test a component of `@slovo/ui` in a `*.test.tsx` file beside it, which Jest runs with jest-expo and React Native Testing Library (ADR 0029). Render it from `@slovo/ui` inside the providers it needs, find what you check by role and label, text or `testID`, and pass time with `jest.useFakeTimers()`. Drive a gesture with Gesture Handler's `fireGestureHandler`, finding it by the test ID the component gives it with `withTestId` (`VerticalPager`'s swipe is `${testID}-swipe`). Check behaviour, not snapshots. Screens are covered by Maestro.
- Test how the app's routes open and close screens in a `*.test.tsx` file in `apps/mobile/src`, which Jest runs with Expo Router's test renderer (`renderRouter`, ADR 0029 amendment). Render a route map of the app's real layouts with stand-ins for screens that need the composition, pass device ports as props, and check the path and the screens on each stack. `apps/mobile/src/notifications/notification-taps.test.tsx` is the pattern.
- Maestro runs locally only, never in CI (ADR 0028). A PR that adds a screen or changes navigation or screen behaviour runs one flow of its own before the push and lists it in the PR's Checks; a PR that does not change screen behaviour runs none. The full smoke flow (`pnpm test:smoke`) runs once on `main` at the end of each spec (see the amendment in ADR 0028).
