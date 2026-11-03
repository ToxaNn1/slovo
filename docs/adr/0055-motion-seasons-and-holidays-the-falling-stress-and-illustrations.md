# Motion, Seasons and Holidays, the falling Stress and Illustrations

One set of rules governs every animation of the app, Decor follows the Season and the Edition's Holidays, a Word's Stress falls into place and a Word may carry an Illustration; the decisions come from spec #886 and the owner's grilling of 2026-10-25.

**Feature Switches.** `seasonalDecor`, `stressAnimation` and `illustrations` are required of every Edition and all on in the UA Edition. A feature whose switch is off is absent: plain Edition Decor and no «Сезонний декор» row, a still Stress mark, no Illustration. A remote switch only turns a feature off (ADR 0040).

**Motion.** Every animation of the app follows four rules.

- **Timing.** An animation lasts 200–300 ms. The motion of «Клин 2.0: Рупор» (ADR 0070) is the one exception, and only where its boards draw it: the screen transition (a wedge wipe with a red sweep, about 500 ms), the reveal of the Word and its cascades, the pop, the stamp, the bottom sheet, the toast and the spring toggle may run longer. Everything else, and every animation the boards do not draw, keeps 200–300 ms.
- **Gestures.** What follows the reader's finger, such as a swipe, moves with a spring, not a timed curve.
- **The UI thread.** Animations run in Reanimated on the UI thread, so a busy JavaScript thread never makes them stutter on an older phone.
- **Reduce Motion.** Under Reduce Motion, from the system setting or from the in-app «Менше руху» switch, nothing moves across the screen: every animation becomes one short opacity fade (300 ms, once, no delay), or nothing where there is nothing to fade. The splash shortens as the design says.

The design boards (`docs/design/`) show each animation with its timing and its Reduce Motion variant. A right Game answer turns its tile red; nothing shakes; the Game's haptics stay (ADR 0025). The heart springs to 1.2 and back with a light haptic when the reader saves.

**Seasons and Holidays.** Paused in the UA Edition in 1.0 (spec #1358): the Feature Switch of the Decor is off, so Decor stays the Edition's own all year, the Settings row «Сезонний декор» is gone, and the code and the Edition's Holiday list stay so Decor can return after 1.0. The Word of the Day calligraphy (the `wordOfTheDayFont` of ADR 0006) is paused the same way.

- **The Season** of a local date is the meteorological one: December–February winter, March–May spring, June–August summer, September–November autumn. The Core computes it from the local date alone, so it is the same in every Edition and needs no hemisphere setting.
- **A Holiday** is a date the Edition lists, each by a rule: a fixed day and month, or the nth weekday of a month. The UA Edition lists 24 August, День вишиванки (the third Thursday of May), 25 December and 1 January. The Core decides whether a local date is a Holiday from the rules, so it knows no calendar of any language (ADR 0006).
- **A Holiday wins over the Season.** On a Holiday its motif shows instead of the Season's.
- **Local midnight.** The motif follows the local date, so it changes at local midnight with the day change (ADR 0022).

**Seasonal Decor** changes only the Mascot's accessory (ADR 0014); everything else keeps the Edition's Decor, so the app stays familiar. The Edition supplies in `decor/decor.json` an accessory for each Season and, with each Holiday rule, the Holiday's accessory. «Сезонний декор» is a synced setting (ADR 0041), on by default; off gives the plain Edition Decor.

**The falling Stress.** On a Word card in the Feed and on the Entry screen, the Stress mark of the Word Lemma falls onto its vowel in 300 ms each time the card appears. Lists, the widget and Share Cards show the mark still, and so does every other kind of Entry. Under Reduce Motion the mark is simply in place. The animation draws the mark only: VoiceOver reads the Lemma as before.

**Illustrations.**

- **The field.** A Word may carry an optional `illustration`, the name of a PNG file in the Edition's `assets/illustrations/`, which the Edition folder module names (ADR 0035). The content CLI sets, edits and checks it like the other Word fields.
- **Bundled, not in the pack.** Illustrations are Edition assets bundled in the app, so the Language Pack stays small and a Content update downloads no Illustration (ADR 0032). A Content update that names a file the app lacks shows no Illustration; the card never breaks.
- **The build's refusals.** The Language Pack build refuses a Word whose file is missing, is not a PNG (by its `.png` name and its content), is over 150 KB (150 000 bytes) or is not square, naming the Word and every reason, so a broken Illustration never ships.
- **The pack format.** The pack carries each Word's `illustration`, which an older app can't read, so it took a new pack format (ADR 0032).
- **On the card.** The Illustration sits above the Definition, at most 160 pt high, the same Illustration in light and dark mode; a tap on it does nothing. VoiceOver reads it as «Ілюстрація до слова {lemma}». A Word without an Illustration looks as before. Only Words carry Illustrations.
- **Placeholders.** The UA Edition gives 15 Words agent-drawn vector placeholders exported as PNG until final art.

## Considered Options

- **Timed curves for gestures**: rejected. A swipe that stops dead at the end of a curve feels drawn, not held.
- **Animations on the JavaScript thread**: rejected. They stutter whenever the Feed loads its next card.
- **Lift the 300 ms limit for every animation**: rejected. Only the peaks the design draws are loud; lists and controls stay quick.
- **Keep the movement under Reduce Motion, only slower**: rejected. Reduce Motion asks that nothing move across the screen.
- **Astronomical Seasons, or Seasons by hemisphere**: rejected. The meteorological months are what readers call the seasons, and an Edition's readers live in one hemisphere.
- **Holidays as a list of dates per year**: rejected. Someone would have to add next year's dates, and День вишиванки moves.
- **Seasons and Holidays in the Core**: rejected. Which days a language celebrates and how they look belong to the Edition.
- **Seasonal Decor beyond the Mascot**: rejected. The rest of the screen is the Edition's identity, which a reader should always recognise.
- **The Stress falls in lists, the widget and Share Cards**: rejected. A list of moving marks distracts, and the widget and a Share Card are still images.
- **Illustrations in the Language Pack**: rejected. Illustrations would make every Content update many times larger.
- **SVG Illustrations**: rejected. Metro would need an SVG transformer and the build could not check a file before the app runs (ADR 0014).
- **A separate dark-mode Illustration**: rejected. One Illustration drawn for both themes halves the art and the checks.
