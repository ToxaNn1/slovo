# Fonts of the Ukrainian Edition

The app embeds every font file in this folder at build time (see `apps/mobile/app.config.ts`), so text never waits for the network. Changing a font needs a new development build.

| Family   | Weights                   | Used for                                            |
| -------- | ------------------------- | --------------------------------------------------- |
| Literata | 400, 400 italic, 500, 600 | The Word: Lemma, Definitions, Examples, headings    |
| Manrope  | 400, 500, 600, 700        | The UI: labels, chips, buttons, tabs and other text |
| Kurale   | 400                       | The Lemma on the Word of the Day card               |

On iOS a font is selected by its PostScript name, which is also its file name here without `.ttf`: `Kurale-Regular`, `Literata-Regular`, `Literata-Italic`, `Literata-Medium`, `Literata-SemiBold`, `Manrope-Regular`, `Manrope-Medium`, `Manrope-SemiBold` and `Manrope-Bold`. Literata covers Cyrillic and the combining acute (U+0301) that marks Stress; Manrope has no combining acute, so a Lemma is always set in Literata, or in Kurale on the Word of the Day card.

`wordOfTheDayFont` in `edition.json` names the font file that sets the Lemma on the Word of the Day card: `Kurale-Regular.ttf`, a calligraphic face with ґ, є, і, ї, the apostrophe and a combining acute that sits over every vowel, `ї` included. The Edition check (`pnpm content check`, `pnpm build:pack`) refuses a font without a glyph for a letter of the alphabet, in either case, for the apostrophe or hyphen a Lemma may hold, or for the Stress mark.

The files are the static Google Fonts builds, taken unmodified from `@expo-google-fonts/literata` 0.4.3 and `@expo-google-fonts/manrope` 0.4.2 and renamed after their PostScript names. `Kurale-Regular.ttf` and `OFL-Kurale.txt` are taken unmodified from `ofl/kurale` in the Google Fonts repository (github.com/google/fonts). All three families are under the SIL Open Font License 1.1, which allows bundling them with the app: see `OFL-Kurale.txt`, `OFL-Literata.txt` and `OFL-Manrope.txt`.
