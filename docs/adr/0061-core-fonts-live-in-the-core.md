# Core fonts live in the Core

The Core's tokens (`packages/ui/src/tokens.ts`) set the word family in Literata and the UI family in Manrope, and every Edition gets them unless its `tokens.json` names other families. Until 0.9 their files lay in the Ukrainian Edition's `assets/fonts/`, beside `Kurale-Regular.ttf`, the one font the Edition names itself. A second Edition would have had to copy the Core's fonts into its own folder, so an Edition carried Core assets rather than being configuration plus content and assets (ADR 0006).

**Where fonts live.** The files of the families the Core's tokens name, with their licences and a README on their origin, live in `packages/ui/assets/fonts/`, next to the tokens. `packages/ui/src/fonts.ts` is the one place that names that folder (`coreFonts()`); only build tooling imports it. An Edition's `assets/fonts/` holds only the fonts the Edition names itself: its Word of the Day font, and the files of any family its `tokens.json` sets.

**What the app embeds.** `app.config.ts` embeds the Core's fonts, then the Edition's own. The widget extension takes from both sets the files of the word and UI families of the Edition's tokens, so the Word of the Day font stays out of it. Font files keep their PostScript names, which iOS selects them by.

**The Word of the Day font is the Edition's.** `wordOfTheDayFont` names one of the Edition's own fonts, never a Core one; the app config and the Edition check refuse any other. `edition-folder.ts` stays the only code that knows the Edition folder's layout (ADR 0035).

## Considered Options

- **Core fonts stay in each Edition**: rejected. Every Edition would carry a copy of the Core's files, and an Edition without them would draw the Core's families in the system font.
- **A Core font package of its own**: rejected. The tokens that name the families live in `@slovo/ui`; the files beside them need no new package.
