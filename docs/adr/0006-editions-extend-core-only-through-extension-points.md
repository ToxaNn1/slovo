# Editions extend the Core only through switches, extension points and decor

An Edition can change what it gets from the Core in three ways only:

- turn Core features on or off with Feature Switches;
- plug its own behaviour or UI into Extension Points the Core defines (Game modes, Word card sections, language services);
- supply Decor, design tokens and the assets its config names.

It can never replace Core files or whole screens. The rule for anything an Edition needs: if it is useful to every Edition, it goes into the Core behind a Feature Switch; otherwise it goes in through an Extension Point, and if no Extension Point fits, we add one to the Core first.

Among the assets and values the Edition config names, each required of every Edition:

- **`wordOfTheDayFont`**, one of the Edition's fonts, embedded like the others: the app sets only the Lemma on the Word of the Day card in the Feed in it, behind the `calligraphy` Feature Switch, and every other text keeps the Edition's usual fonts. The Edition chooses it because only the Edition knows which fonts draw its letters; the Edition check refuses a font that lacks a glyph for a letter of the Edition's alphabet in either case, for the punctuation a Lemma may hold or for the Stress mark (ADR 0035).
- **`widgetPalette`**, the widget palette: the background and text colours of the widget's Пергамент (`parchment`) and Синій (`blue`) backgrounds, required of every Edition; the Edition config refuses text below 4.5:1 contrast with its background (WCAG AA). Світлий and Темний come from the Edition's colour tokens, and the app config writes all of them into the widget (ADR 0026).
- **`linkDomain`**, the domain of its Collection Links (ADR 0058).

## Considered Options

- **Free override of any Core file or screen per Edition**: rejected. With many Editions it turns the factory into N silent forks, where every Core change risks breaking some Edition unnoticed.
- **One calligraphic font in the Core for every Edition**: rejected. No one font draws every language's letters, and a missing glyph would fall back to another font in the middle of a Lemma.
