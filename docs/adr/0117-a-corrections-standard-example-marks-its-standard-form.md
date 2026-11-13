# A Correction's standard example marks its standard form

Board e6 (2026-11-12 Feed board) draws a Correction's «Приклади» as plain lines: the non-standard sentence struck through, then the standard sentence with its standard form in bold, «Ми **беремо участь** у конкурсі.», the whole phrase and not only the changed word. The content had no way to say which part that is: a word diff finds «беремо», never «беремо участь», and an inflected standard equivalent («взяли участь» for «брати участь») cannot be found by matching text.

**Markup in the text.** The Edition's content marks the standard form in `examplePair.standard` with `**` on both sides. A standard form split by other words is marked in parts: «Просимо **взяти** наші рекомендації **до уваги**.». The marks stay in the text wherever it is kept, the content files, Postgres, the Language Pack and the Patches, so no store and no transport changes shape. `ExamplePairSchema` refuses a standard sentence with no mark, an unclosed mark, an empty mark or a stray `*`, naming the field, so the content check, the pack build and the admin's writes all stop on broken markup (owner, 13.11.2026).

**Parsed once into the card model.** `parseStandardExample` (`@slovo/contracts`) reads the marks into `ExampleSegment`s, a discriminated union of `{ kind: 'text' }` and `{ kind: 'standardForm' }`. The Core's Correction card model gives `examplePair.standardSegments` for the card to draw, the standard form bold, and `examplePair.standard` without the marks, for VoiceOver and sharing. The UI never reads the marks itself.

**Drafts.** The sourcing tool marks the words a drafted pair changes; the author widens the marks to the whole phrase.

## Considered Options

- **A range field beside the text** (`standardForm: { start, end }`): rejected. Offsets break with every edit of the sentence and cannot hold a split form.
- **A separate field for the standard form**, matched in the sentence at runtime: rejected. Matching inflected text is a guess; the author knows the span.
- **Segments as the stored shape** (an array in JSON and a new pack table): rejected. Every store, the Patch format and the admin editor would change shape for one bold span.
- **A word diff at runtime**: rejected. It bolds «беремо», not «беремо участь».
