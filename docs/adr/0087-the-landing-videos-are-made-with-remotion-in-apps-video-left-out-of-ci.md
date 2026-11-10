# The landing's videos are made with Remotion in `apps/video`, left out of CI

The landing (ADR 0071) gets two 2D videos in the Рупор style: the 30 s promo «Спочатку було слово» and the 15 s series «Тобі бракувало слова», one rare word a week. They are made by agents in code, not drawn by hand, so a new episode of the series is a new word, not a new animation.

**The videos are a Remotion project in `apps/video` (`@slovo/video`), and CI leaves it out.**

- **Remotion, in the monorepo.** The videos are React components rendered frame by frame. They read the UA Edition's tokens, the Mascot's vector (`editions/uk/decor/decor.json`), its fonts (`editions/uk/assets`, the public folder of `remotion.config.ts`) and its Entries straight from the repository, so a video never drifts from the app's look or quotes a word wrong. The sounds are the videos' own, not the app's: synthesised by `apps/video/sounds/make.py`, their source and licence in `apps/video/SOUNDS.md`.
- **Left out of every check.** The package has no `lint`, `typecheck` or `test` script, so Turborepo runs none; oxlint, Prettier, dependency-cruiser and Knip ignore `apps/video`; the `changes` job of `ci.yml` drops `apps/video/` from the changed files, so a pull request that touches only the videos runs neither the app's nor the site's tests. A video is checked by watching it in Remotion Studio (`pnpm --filter @slovo/video dev`), not by tests.
- **Renders stay out of git.** `pnpm --filter @slovo/video render <composition> <file>` writes the video; finished files go to the site or to `~/Downloads/WORD/video/`.

## Considered Options

- **A folder outside the repository.** Faster to start, but it would copy the tokens, the Mascot and the words and drift from the app.
- **Hand animation (After Effects, Rive).** Better for a one-off, but every weekly episode would cost an animator's time.
- **Lint and typecheck the videos like the site.** Rejected by the owner: the folder holds only videos, and its checks would slow every pull request for nothing a reader sees.
