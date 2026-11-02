# Fonts of the UA Edition

The Edition's own fonts (ADR 0006, 0070). The app embeds every font file in this folder at build time (see `apps/mobile/app.config.ts`); the Core brings no font of its own, so text never waits for the network. Changing a font needs a new development build.

| Family    | Weights            | Used for                                                                                  |
| --------- | ------------------ | ----------------------------------------------------------------------------------------- |
| Unbounded | 400, 600, 800, 900 | The word family of `tokens.json`: the Word, shout, headings, buttons; the Word of the Day |
| Onest     | 400, 500, 600, 700 | The UI family of `tokens.json`: reading text and meta                                     |

On iOS a font is selected by its PostScript name, which is also its file name here without `.ttf`: `Unbounded-Regular`, `Unbounded-SemiBold`, `Unbounded-ExtraBold`, `Unbounded-Black`, `Onest-Regular`, `Onest-Medium`, `Onest-SemiBold` and `Onest-Bold`, so keep the names: the Edition check also finds a family's files by them.

`wordOfTheDayFont` in `edition.json` names the font file that sets the Lemma on the Word of the Day card, one of this folder's: `Unbounded-Black.ttf`. The Edition check (`pnpm content check`, `pnpm build:pack`) refuses a Word of the Day font that is not in this folder, and refuses a family `tokens.json` names when this folder has no file of it. It refuses any of those files that has no glyph for a letter of the alphabet, in either case, or for the apostrophe or hyphen a Lemma may hold, and a Word of the Day font or word family file without the Stress mark. Unbounded and Onest both have ґ, є, і, ї and the combining acute.

The Unbounded and Onest files are the static Google Fonts builds, taken unmodified from `@expo-google-fonts/unbounded` 0.4.1 and `@expo-google-fonts/onest` 0.4.2 and renamed after their PostScript names. Both families are under the SIL Open Font License 1.1, which allows bundling them with the app: see `OFL-Unbounded.txt` and `OFL-Onest.txt`.
