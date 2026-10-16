# UI components are tested in Jest with jest-expo

Until 0.6 nothing in CI rendered a component of `packages/ui`. Vitest tests the Core, the hook modules of the app and the pure functions of the UI, and the Maestro flows, which drive the screens, run only on the owner's machine (ADR 0028). A regression in the pager, a Round of the Game or a toast passed CI.

The components of `packages/ui` are tested with React Native Testing Library on a second runner, Jest with the `jest-expo/ios` preset, and Vitest keeps every other test:

- **A component test is a `*.test.tsx` file in `packages/ui/src`, and Jest runs it.** A `*.test.ts` file is Vitest's, in every package. `pnpm test` runs both (`vitest run && jest` in `@slovo/ui`), so CI runs both.
- **It renders through the public seam**, `@slovo/ui`, with the providers a screen gives it (`EditionProvider`, a `GestureHandlerRootView` where the component needs one), and finds what it checks the way VoiceOver and the Maestro flows do: by role and label, by text, by `testID`. It never reaches into a component's state or styles.
- **Time is injected through Jest's fake timers** (`jest.useFakeTimers()`), which React Native Testing Library knows; a test of a 4 s toast takes milliseconds.
- **The native libraries run on the doubles they ship for Jest:** Gesture Handler's `jestSetup` and Reanimated's `setUpTests()` (`jest.setup.js`), and Worklets' web build through its Jest resolver, chained with React Native's (`jest.resolver.cjs`). Babel runs `babel-preset-expo`, as Metro does, from the Jest config, so the package has no Babel config for Metro to pick up.
- A component test checks behaviour: what a tap, a swipe action or a VoiceOver action does, what shows and what leaves. It does not take snapshots, and it does not replace a Maestro flow: the flows remain the check of screens and navigation on the real app, and ADR 0028 still holds for every change to a screen, a component or a hook.
- The first tests are those of the spike: `UndoToast` (undo, its 4 s, one toast at a time, staying with VoiceOver on) and `EntryRow` (open, a swipe action, the same action from VoiceOver), the latter through Gesture Handler's `ReanimatedSwipeable`.

Versions move with Expo, not on their own. `jest-expo` 57 is built on Jest 29, so `jest` and `@jest/globals` stay on 29 until the preset moves. `test-renderer`, the renderer of React Native Testing Library 14, follows the React minor: 1.2 for React 19.2 (1.3 needs React 19.3).

## Considered Options

The spike rendered `UndoToast` and an `EntryRow` with a swipe action under each runner, on React Native 0.86, Reanimated 4.5 and Gesture Handler 2.32.

- **Vitest with React Native Testing Library and our own setup**: rejected. It works, but only by rebuilding what a Jest preset does. React Native ships Flow source, and its modules load one another with `require`, which Vite's transforms and `vi.mock` never see. The spike needed about a hundred lines on Node's private loader APIs (`Module._load`, `Module._resolveFilename`) with `@babel/register` for Flow and `.ios.js` files, a stand-in `jest` global that finds its caller's file from the stack so the mocks of `@react-native/jest-preset` and Gesture Handler can run, a CommonJS shim per native library, and Worklets' resolver trick done by hand. The package's tests then took 40 to 52 s instead of about one, since the setup transforms React Native again in every test file. Each upgrade of React Native, Reanimated or Worklets can break it (0.86 alone moved the Jest preset out of `react-native`), with no one upstream to follow: the one library for this, `vitest-react-native`, has had no release since January 2024, and React Native Testing Library's timer helpers support Jest only.
- **No component tests, Maestro only**: rejected. It adds no tool, but the flows never run in CI (ADR 0028), so nothing on a PR would show a broken component. The flows also cannot reach some states quickly or at all, such as a toast with VoiceOver on.
- **Jest for every test, Vitest dropped**: rejected. It would leave one runner, but the Core, the hook modules and the pure functions run in Vitest in about a second, need no React Native, and would move to a slower runner for no gain.

## Consequences

Expo, React Native Testing Library, Reanimated and Gesture Handler each document Jest as the way to test, so the setup is under thirty lines of config and comments, and an upgrade follows their notes. The cost is a second runner beside Vitest: two test APIs (`@jest/globals` and `vitest`), Jest 29 with Babel and its dependencies in the lockfile, and about 40 s for the first run on the laptop, while Jest fills its transform cache (about 6 s after). CI keeps no Jest cache, so each CI run pays the first-run time.

`packages/ui` has two runners and two kinds of test file, told apart by the extension. A test of a pure function stays a Vitest `*.test.ts`; only a test that renders goes to Jest. If Vitest ever runs React Native without a home-made loader, or `jest-expo` stops being the documented way, the component tests move and this ADR is superseded. Gesture Handler logs that `ReanimatedSwipeable`'s callbacks mix worklets and plain functions when it runs on its Jest doubles; the tests pass with it, and it is left as the library prints it.
