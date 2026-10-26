# The Core turns a Game change into its haptic sequence

Until 0.5 the haptics of a Game were played by the views that animate it. An answer option played success or warning in an effect when its answer changed, a Life played the medium haptic in a timer that waited for the wrong choice to fill, and the result screen played success on a win and again 300 ms later. The sequence of a wrong answer (warning, then a lost Life) or of a win lived in three effects across two files, and `packages/ui` has no test runner, so nothing tested it.

`createGameHaptics` in the Core takes the app's `Haptics` (which asks Vibration at every haptic) and a `Schedule`, a function that runs something after a delay and returns how to cancel it. It has three changes and a stop: a right answer plays success; a wrong answer plays warning and, `LIFE_LOST_DELAY` later, the medium haptic of the Life it costs; a win plays success and, `WIN_SECOND_SUCCESS` later, success again. Stopping drops what is still to come, as when the screen goes away. The Core takes no React and no clock of its own, so the module is tested with the fake engine and a clock the test moves. The views keep only their animations and tell the module what happened: the Round screen when an answer is given now, the result screen when it opens on a win. A hook in `packages/ui` builds the module over the app's haptics and the real timers.

The delay that follows an animation is stated once, as `LIFE_LOST_DELAY` in the Core: the wrong choice fills for that long and the Life pops after it, so the Round screen takes both from the constant. The win's second success follows no animation and stays the module's own.

A wrong answer is the only way to lose a Life, so the Life's haptic belongs to the wrong answer and the Life view no longer plays one. Every Game Mode plays the same sequences, whatever its answer form (ADR 0052); in «На час», which has no Lives, a wrong answer plays warning alone.

## Considered Options

- **Leave the haptics in the views**: rejected. The sequences were the only part of the Game's behaviour without a test, and the Life's delay matched the fill only because the two constants shared a file.
- **Put the module in `packages/ui` and add a test runner there**: rejected. It would add a runner and React Native's test setup for logic that has no React in it; the Core already has the runner, the fake engine and the rule of injected time.
- **Pass the Life's delay to the module from the view**: rejected. The module would need a delay on every call site, including the result screen, which has no Life; the constant in the Core states it once and the view reads it.
