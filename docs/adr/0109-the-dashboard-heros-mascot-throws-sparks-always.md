# The Dashboard hero's Mascot throws sparks, always

Owner recording of 2026-11-12 against the «Рупор» Dashboard board. The board's hero draws five small diamonds (`v.leaves`, `@keyframes slLeaf`) flying from the Mascot's megaphone; the board gates them on its seasonal Decor (`s.decor`), the owner wants them always.

**Not Decor.** The sparks do not change with the date or the season: always the autumn diamond (`wedges.spark`), in the key ink and the cream by turns, in both hero states, unrevealed and revealed, under the Mascot.

**The board's values.** Five sparks start at the megaphone (the board's 150, 350 minus the Mascot's 14, 318: 136, 32 from the figure). Spark i flies `90 + 40i` points right and `40 + 14i` down, turning 320°, in `3 + 0.4i` s, linearly, without end; it fades in over the first 15 % and out over the rest, and its first flight waits `0.7i` s, as the board's `animation-delay`. The values are the tokens `dashboard.hero.sparks`.

**Own switch.** The sparks sit behind the new Feature Switch `heroSparks`, which needs `dashboard`; the UA Edition has it on.

**When there are none.** Under Reduce Motion (the system's or «Менше руху»), and until the system has answered, there are none, not a still frame. Without the Decor's Mascot figure there is no megaphone, so there are none either: the sparks follow the figure, as its own motion does. VoiceOver skips them.

**Motion.** Reanimated on the UI thread: `withDelay` then `withRepeat(withTiming(…), -1)`, no JS timers; the module is listed under ADR 0059.

## Considered Options

- **Gate them on the seasonal Decor, as the board does**: rejected. The owner wants them always.
- **Sparks without the Mascot figure**: rejected. They come from its megaphone; with no figure they would fly out of nothing.
- **A still frame under Reduce Motion**: rejected. Still diamonds over the hero read as noise.
- **Behind `dashboard` alone**: rejected. Every feature gets its own Feature Switch.
