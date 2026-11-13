# Text on red is ink

ADR 0070 named the `onAccent` colour role «cream on red». The 2026-11-12 boards draw text on a red fill in ink, `#140C0A`, in both Themes: 79 red fills carry `color:#140C0A` against one with cream (an icon tile in XEntry2). Every red button, chip, crossword letter and badge of the boards has an ink label.

**`onAccent` is ink.** The UA Edition sets `onAccent` to `#140C0A` in the light and the dark Theme (`editions/uk/tokens.json`), and `packages/ui/src/tokens.test.ts` pins it in both. It colours text, letters and marks that sit on a red fill: a red Chip's label, the traced and solved letters of the Games, the crossword clue number, a selected daily goal, a Choice Mark, the Pick round's wrong mark. Its contrast on `accent` is about 5.7:1.

**Cream stays cream where it is not on red.** The code had used `onAccent` for cream in general. Those places keep cream, taken as the light Theme's `background` (`#FFF4E6`, the same in both Themes): the label of the `onAccent` Button variant on its ink tile, the play icon and the stressed syllable of the narrator voice picker, the Switch knob, the frozen day of the Active Days calendar, the Mascot's body on red (app and widget), the splash S, the About panel's giant letter, the light Share Card's giant, chips and footer label, and every `apps/video` composition, whose frames do not change.

**`accentText` is unchanged.** Small red text stays `#C4271D` for contrast on the cream grounds (ADR 0070, owner, 13.11.2026).

## Considered Options

- **Keep cream on red** (ADR 0070): replaced; the boards draw ink.
- **A new `cream` colour role**: rejected for now. The light Theme's `background` is the cream in both Themes, so no role is needed to keep the old look.

Amends ADR 0070 (the `onAccent` role only).
