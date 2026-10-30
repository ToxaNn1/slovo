# Fonts of the Core

The families the Core's tokens (`src/tokens.ts`) name, which every Edition gets unless its `tokens.json` names others (ADR 0061). The app embeds every font file in this folder at build time, with the Edition's own fonts (see `apps/mobile/app.config.ts`), so text never waits for the network. Changing a font needs a new development build.

| Family   | Weights                   | Used for                                            |
| -------- | ------------------------- | --------------------------------------------------- |
| Literata | 400, 400 italic, 500, 600 | The Word: Lemma, Definitions, Examples, headings    |
| Manrope  | 400, 500, 600, 700        | The UI: labels, chips, buttons, tabs and other text |

On iOS a font is selected by its PostScript name, which is also its file name here without `.ttf`: `Literata-Regular`, `Literata-Italic`, `Literata-Medium`, `Literata-SemiBold`, `Manrope-Regular`, `Manrope-Medium`, `Manrope-SemiBold` and `Manrope-Bold`, so keep the names. Literata covers Cyrillic and the combining acute (U+0301) that marks Stress; Manrope has no combining acute, so a Lemma is always set in Literata, or in the Edition's Word of the Day font on the Word of the Day card.

The files are the static Google Fonts builds, taken unmodified from `@expo-google-fonts/literata` 0.4.3 and `@expo-google-fonts/manrope` 0.4.2 and renamed after their PostScript names. Both families are under the SIL Open Font License 1.1, which allows bundling them with the app: see `OFL-Literata.txt` and `OFL-Manrope.txt`.
