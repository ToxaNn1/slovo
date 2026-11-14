# @slovo/video

The landing's 2D videos, made with Remotion (ADR 0102): `pnpm --filter @slovo/video dev` opens the studio, `render` renders. Sounds: `SOUNDS.md`.

`src/snapshot.json` is a slice of the UA Edition's content snapshot (ADR 0090): the backend's `GET /v1/editions/uk/content/snapshot` answer with only the Words the videos name by id kept and every other kind emptied. `src/words.ts` parses it once with `ContentSnapshotSchema`; to refresh a Word, save the snapshot again and cut it the same way.
