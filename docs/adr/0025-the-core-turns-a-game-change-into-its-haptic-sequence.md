# Games give no haptics

Until 0.5 the views that animate a Game played its haptics; from 0.5 `createGameHaptics` in the Core turned each Game change into a haptic sequence over the app's `Haptics`, which asked Vibration at every haptic. The design «Клин 2.0: Рупор» and the owner (02.11) want no vibration and no shake on answers, so a mistake stings without being noisy.

Games give no haptics. `gameHaptics` in the Core still names the Game changes (a right answer, a wrong answer, a win) and returns the haptic sequence of each, which is empty; its return type says so, so no view can play one. The Core test of this module is the seam that keeps it that way. The haptics provider, its hook, the device's haptic engine and `expo-haptics` leave the app, and nothing else plays a haptic: the Feed swipe and the heart go silent too.

`LIFE_LOST_DELAY` stays in the Core, with the Game: a lost Life pops once the wrong choice has filled, and the Round's `lifeLostAfter` carries it to the Round screen (ADR 0017).

## Considered Options

- **Keep the sequences behind the Vibration setting, off by default**: rejected. The design has no haptics at all, and a sequence nobody plays is a second path to keep in step.
- **Delete the Game haptics module with its callers**: rejected. The version spec keeps it as the seam a test reads, so a later change that brings a haptic back fails a test.
