# Fonts of the Ukrainian Edition

The Edition's own fonts (ADR 0006). The app embeds every font file in this folder at build time, with the Core's Literata and Manrope from `packages/ui/assets/fonts/` (see `apps/mobile/app.config.ts`), so text never waits for the network. Changing a font needs a new development build.

| Family | Weights | Used for                              |
| ------ | ------- | ------------------------------------- |
| Kurale | 400     | The Lemma on the Word of the Day card |

On iOS a font is selected by its PostScript name, which is also its file name here without `.ttf`: `Kurale-Regular`.

`wordOfTheDayFont` in `edition.json` names the font file that sets the Lemma on the Word of the Day card, one of this folder's: `Kurale-Regular.ttf`, a calligraphic face with ґ, є, і, ї, the apostrophe and a combining acute that sits over every vowel, `ї` included. The Edition check (`pnpm content check`, `pnpm build:pack`) refuses a font that is not in this folder or has no glyph for a letter of the alphabet, in either case, for the apostrophe or hyphen a Lemma may hold, or for the Stress mark.

`Kurale-Regular.ttf` and `OFL-Kurale.txt` are taken unmodified from `ofl/kurale` in the Google Fonts repository (github.com/google/fonts). Kurale is under the SIL Open Font License 1.1, which allows bundling it with the app: see `OFL-Kurale.txt`.
