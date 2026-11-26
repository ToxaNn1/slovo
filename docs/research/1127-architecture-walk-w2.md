# Architecture-friction walk, wave 2 (2026-11-26)

Read-only walk for #1127 over `packages/language-pack`, `packages/content-rules`, `tools`, `apps/admin/src`, `apps/widget`, and one leftover in the Core: modules that copy a Feature Switch at open while screens read it live. No code changed. Line numbers are of `origin/main` on the day of the walk.

Two actions were followed end to end:

- **A content save.** `pnpm content check` / the admin's record form → `content-writes.ts` (`write`) → `parseRecord`, `saveRecord`, `checkRecord` → a Patch → `applyPatch` → the pack's rows → `mediaOf` → the Core's media.
- **A remote switch change.** `RemoteSwitches.ask` → new verdicts → `reopenComposition` → the Core modules open again, while the screens draw again from `useEditionInEffect`.

Each candidate names a friction and the evidence. None proposes a name, a style or an interface.

## 1. A Feature Switch has two timelines: copied at open in the Core, live on the screens

**Files.** Copies at open, 20 lines in 9 Core modules: `game/game.ts:323`, `game/crossing-crossword-progress.ts:100,127`, `mood/mood.ts:92,94`, `progress/xp-log.ts:338-341`, `progress/active-days.ts:68`, `progress/badges.ts:110,112`, `dashboard/dashboard.ts:182-187`, `dashboard/correction-types.ts:61`, `dashboard/curated-collections.ts:131`. Live reads in the Core, inside methods or thunks: `knowledge/knowledge.ts:393-500` (10 reads), `feed/weekly-recap.ts:77-108`, `entries/mix.ts:261,395,665,667`, `progress/streak-break.ts:76`, `entries/rarity-range.ts:70`, `mix/rarity-test.ts:78`, `mistake-reports/mistake-reports.ts:115`, `notifications/notification-plan.ts:349`. The screens: about 100 live reads in `apps/mobile/src` and `packages/ui/src`, the screens through `useEditionInEffect` (`edition/remote-switches.ts:11`). What joins them: `apps/mobile/src/shell/app-shell.ts:127-135` (`editionInEffect`), `shell/lifecycle.tsx:75-90`, `sync/background-sync.ts:76-96`, `opening.ts:129-140`.

**The friction.** Every module gets the same `editionInEffect`, whose `isFeatureEnabled` answers by the last verdicts each time it is asked. Some modules ask once and keep a `const`; others ask on every call; every screen asks on every draw. Nothing in a module's type says which it does. The two are brought together by reopening the whole composition after a changed answer, and three windows are left where they differ:

- While a Game is on screen the reopen waits until it is left (`background-sync.ts:89-94`), with no bound. The Game screens read `gameReview`, `gameRoundMascot` and `gameModeToast` live (`app/game/index.tsx:78,95,126`) while `game.ts:323-324` holds the modes and `xp-log.ts:338-341` the XP switches as they opened.
- A reopen that fails keeps the old composition and only reports it (`opening.ts:134-139`). The copies then stay until some later change, while the screens show the new answer.
- Inside the Core the same switch is read both ways: `xp-log.ts:338` copies `xpLog` and reads no records when it opened off (`:342`), while `weekly-recap.ts:94` asks `xpLog` live for the same week.

One followed case: `crossing-crossword-progress.ts:100` copies `crosswordSolveTime` as `timed` and writes `solveSeconds` only while it is true (`:150`, `:163`); the solved screen takes `withTime` live (`app/game/crossword.tsx:134`). In the same module `crosswordHint` is copied too (`:127`) but handed to the screen as `crossword.hint`, so that pair cannot differ. The two switches of one module are wired two ways.

**Deletion test.** Deleting the copies (every read live) would remove the need to reopen for a switch at all, but a module such as `xp-log` decides at open what to read from the user state, so a live read there needs more than a changed line. Deleting the live reads on screens (each screen takes the module's answer, as with `hint`) would concentrate the answer in the module that acts on it. Either direction concentrates; today's mix only moves the question to each call site.

**What tests cannot reach.** Core tests open a module over a fixed Edition from `loadEdition`, so a switch never changes under an open module. Screen tests draw over `editionAtLaunch` or a fixed Edition. No test holds a composition open, changes a verdict and reads both a module and a screen; the Game-held wait is tested for the reopen, not for what the screens show meanwhile.

**Related ADRs.** 0089 (Rules evaluated on the device, a changed answer reopens), 0203 (in effect versus shipped, decided; a remote off does not close what is open), 0199 (the catalogue). None decides whether a Core module copies or asks.

**Confidence.** High that the two timelines exist and that the three windows are real; medium that a reader sees a wrong screen often, since the windows are short outside a Game.

**Size.** Large if every copy moves (9 modules, their tests); small per module. A first step of one family (the crossword, or XP) is a day.

## 2. Whether a save passes is assembled by each caller, and three rules sit on the backend's side of the seam

**Files.** `packages/content-rules/src/check.ts:50-142`, `parse-record.ts`, `crossword-days.ts:112-168`, `refusal.ts:1-30`; `apps/backend/src/content/content-writes.ts:132-173,431-493`, `content-records.ts:163-185`; `tools/content/src/writes.ts:197-255`, `tools/content/src/cli.ts:198-199`; `packages/language-pack/src/read-edition.ts:94`, `edition-folder.ts:352,369`.

**The friction.** `content-rules` is described as the rules «shared by build, CLI and backend», but what it exports is parts: `parseRecord`, `contentSetOf`, `checkRecord`, `checkContentSet`. Each of the three callers builds the set, picks the dates and orders the steps itself, and they do it differently:

- The backend runs `datedRefusal` (`content-writes.ts:132-157`), then `withPublishDate`, `parseRecord`, the kind's own rule inside `saveRecord` (`content-records.ts:163-185`, `curated-collection-appeared`), then `checkRecord` with `editionDate` in the Edition's time zone (`:487-490`).
- `pnpm content check` runs `parseRecord` and `checkRecord` only (`writes.ts:242-245`), with no `editionDate` (UTC day), an empty `crosswordDay` list (`:227-228`), and each draft against the snapshot alone, never against the drafts before it in the same file (the `set` of `:220` is not updated in the loop of `:238-252`). Two drafts of one Word in one file both pass locally and the second is refused by the backend.
- `RuleName` (`refusal.ts`) names `curated-collection-appeared`, which only the backend implements, and `crossword-days-immutable`, which both sides implement with different meanings: «a day on or before today never changes» in `crossword-days.ts:118-127` and «an edit keeps its date» in `content-writes.ts:140-147`. The `duplicate-id` of a day is the backend's too (`:148-155`).

**Deletion test.** Deleting `checkRecord` would spread the before/after comparison of `check.ts:117-142` into two callers: it earns its place. What does not is the wiring around it: the order and the inputs are a rule of their own with no module. Folding that wiring behind `content-rules` would concentrate it; today it is copied.

**What tests cannot reach.** `content-rules.test.ts` tests the parts; `content-writes.test.ts` tests the backend's wiring; `writes.test.ts` tests the CLI's with a fake API. No test states that a draft that passes `content check` is saved, or the reverse, so the three differences above are invisible.

**Related ADRs.** 0090 (every save through the shared content rules, one transaction), 0146 (the Edition's own text), 0031 (the contract only grows). None decides where a kind's own rule lives.

**Confidence.** High for the three differences (read in code); medium on how often a wave meets them, since a wave's drafts are usually distinct.

**Size.** Medium: one entry for «check this write against this set» with the dates as inputs, two callers moved, the CLI's loop fixed; no schema change.

## 3. The «needs a new Recording» mark is written one way by a build and another by a Patch

**Files.** `apps/backend/src/content/content-records.ts:98-144`, `content-store.ts:176-188`, `media-rows.ts:137-148`; `packages/contracts/src/api/content.ts:55-57`; `packages/language-pack/src/write-pack.ts:75-76`, `record-rows.ts:33-37,236-253`, `apply-patch.ts:89,95-103`, `media-rows.ts:83-98`, `pack-layout.ts:328-329`, `starter-media.ts:68-71`; `packages/core/src/media/media.ts:142,195`, `ports.ts:310`.

**The friction.** One rule («a Word whose Lemma or Stress changed plays nothing until it is recorded again») is kept in four places. The backend sets the mark and retires the Word's live Recordings in one transaction (`content-records.ts:129-143`) and clears it when new files are saved (`media-rows.ts:145-148`). The snapshot carries the marked ids, so a built pack writes the column (`write-pack.ts:75-76`). A Patch carries no mark: `applyPatch` writes each Word with `false`, the upsert leaves the column as the pack has it (`record-rows.ts:33-34`), and a second statement clears it for every Word a live Recording arrives for (`apply-patch.ts:95-103`), a copy of the backend's clearing rule. So a pack patched to content version N and a pack built at N hold different marks for the same Word edited at N: 0 and 1. The Core then guards on the mark (`media.ts:142,195`).

On the save path the mark and «no live Recording rows» always travel together, so the two packs play the same; the mark matters on the device only if a Word is marked while it still has live rows, which the import of a snapshot can produce (`content-store.ts:177-188` adds `waiting` without retiring). The comment in `pack-layout.ts:328-329` still says no app reads the column.

**Deletion test.** Deleting the device's side of the mark (column, snapshot list, port field, two guards, the clearing statement) would leave the rule where it is decided, in the backend and its retired rows, if the import retired too. Keeping it means every way a pack is written must repeat the lifecycle. It concentrates.

**What tests cannot reach.** `apply-patch.test.ts:197-221` starts from a pack built from a hand-made snapshot that has both marks and live Recordings, a state the save path never makes. No test compares a patched pack with a built pack of the same content version; `media.test.ts` gets the mark from the memory store's own list.

**Related ADRs.** 0099 (media rows, a live Recording clears the mark), 0195 (the default voice records every live Word), 0090 (Patches).

**Confidence.** High that build and Patch write the column differently; medium that the device's mark is redundant, because of the import path.

**Size.** Small to medium: a pack format step if the column goes, or one statement in `applyPatch` plus the missing built-versus-patched test if it stays.

## 4. The widget reads the Widget Snapshot through a hand-kept Swift copy that no check ties to the contract

**Files.** `apps/widget/WidgetSnapshot.swift:5-31,75-129`, `EntryTimeline.swift:22-28,63-86`, `ModeContent.swift`; `packages/contracts/src/widget-snapshot.ts:12,69-110`; `packages/core/src/widget/widget.ts:187-217`; `apps/mobile/plugins/widget-extension.test.ts:241`; `apps/mobile/src/widget/widget-snapshot.ts:18`.

**The friction.** `WidgetSnapshotSchema` is «the source of truth» (the Swift file says so), and the Swift structs repeat it by hand: the format number (`readableFormat = 1` and `WIDGET_SNAPSHOT_FORMAT = 1`), the two file names, every field and which of them is optional. The decoder is all-or-nothing (`try?` at `WidgetSnapshot.swift:121-126`): one required field renamed or made optional in the schema and every widget shows «no snapshot yet», with no error anywhere. The schema already grows by optional fields that keep the format (`widget-snapshot.ts:94,103,106`), so the format number does not guard this.

A day rule is split too. The Core writes the ring for its day and for the next (`after`); the widget decides which applies by its own local date in its own Gregorian calendar (`EntryTimeline.swift:22-28,70-80`) and owns a third state the Core never sees: two days on, an empty ring without the Streak. The ✓ of the Word of the Day is the same comparison (`:68`).

**Deletion test.** The Swift structs cannot be deleted, the widget must decode. But the copy can stop being hand-kept: the example snapshot is already parsed by the schema in a test (`widget-extension.test.ts:241`); nothing decodes it, or a snapshot the Core wrote, with the Swift types. Moving the day choice wholly to the Core (a ring per date) would delete the Swift rule and concentrate it.

**What tests cannot reach.** There is no Swift test in the repo; the 740 lines of `apps/widget` run only in an EAS build (ADR 0004). CI can tell that the app writes a valid snapshot, never that the widget can read it or which ring it draws at midnight.

**Related ADRs.** 0001 (SwiftUI widget over an App Group), 0004 (native builds in EAS only), 0006 (the widget palette from the Edition config), 0066 (the Streak the next day keeps).

**Confidence.** High on the missing tie; medium on the day rule, read on the Swift side only in part of `widget.ts`.

**Size.** Small for a check that the Swift field list matches the schema's keys (a script over the two files, no native build); medium to move the day rule into the snapshot.

## 5. The Action log's vocabulary is a contract kept on both sides by string

**Files.** `apps/admin/src/action-texts.ts:33-74,76-93,96-125,253-357`; `packages/contracts/src/api/admin.ts:1172-1174`; the writers in 9 backend files, among them `apps/backend/src/content/content-writes.ts:495-502,545-554`.

**The friction.** A row's `what` is `z.string()` and its `before`/`after` are `z.json()` in the contract. The backend writes the keys as literals and templates in 9 files (`content.${kind}.${op}`, `content.flag.${decision}`, `service.entry.${how}`, `switches.minimum.set` …). The admin holds its own table of 19 keys, 7 kinds and 6 operations, and 13 Zod shapes for the two sides of a row (`action-texts.ts:96-125`), each a guess at what a writer far away puts in. The two lists already differ: the backend writes `service.entry.*`, which the admin's table has no line for, so the Власник reads «Інша дія: service.entry.…».

The tolerance is on purpose (rows are kept for years, an unknown key still reads, ADR 0088). The friction is not the fallback but that a new writer cannot know it owes the admin a line, and a changed `after` shape silently turns a row's Було / Стало into nothing (`safeParse` failing returns `undefined`).

**Deletion test.** Deleting `action-texts.ts` would spread the parsing into every screen that shows a row: it is deep and earns its place. What is missing is on the seam: one list of keys with the shape each writes, as ADR 0199 gave the Feature Switches. That would concentrate; the file alone cannot.

**What tests cannot reach.** `action-log.test.tsx` feeds rows from `mock/fixtures.ts`, written by the same hand as the table. Backend tests assert the row they write. No test fails when the backend adds a key or changes a shape.

**Related ADRs.** 0088 (the admin imports only the contracts; unknown rows still read), 0204 (what the deletion row keeps), 0198 (admission declared once, the nearest precedent), 0199.

**Confidence.** High; the `service.entry` gap is in the code today.

**Size.** Medium: a catalogue of keys and shapes in the contracts, the 9 writers typed over it, the admin's table typed over the same keys. Old rows keep the fallback.

## 6. «One Entry authored twice» is decided by a shared one-line key that each caller normalises its own way

**Files.** `packages/content-rules/src/entries.ts:12-19,108`, `:193` (Idioms), `synonym-rows.ts:48`, `tips.ts:29`; `tools/sourcing/src/pipeline.ts:325-341`, `text.ts:4,76-79`, `corrections.ts:295-300`.

**The friction.** `wordKey(lemma, primaryDefinition)` is one line (`JSON.stringify` of the Lemma and the trimmed Definition) and its comment says the build and the sourcing run both compare Words by it. They do not compare the same thing, because what makes two spellings one is left to the caller. The content rules pass `lemma.toLocaleLowerCase(config.locale)` (`entries.ts:108`). Sourcing passes `matchKey(text)` (`pipeline.ts:340`): squeezed spaces, Stress marks removed, lowercase in a hard-coded `uk`, and three apostrophe forms folded to one (`text.ts:4,78`). A third `wordKey` of another meaning lives in `corrections.ts:296`. So a draft that sourcing drops as already written and a record the save refuses as a duplicate are decided by two keys; which pairs differ depends on what the schema lets into a Lemma, and the shared function hides that the question exists.

**Deletion test.** Deleting `wordKey` moves one `JSON.stringify` into two callers and loses nothing: it is shallow, its interface is its implementation. The concept worth a module is the normalised identity of an Entry's text, which today is written four times (`entries.ts:108,193`, `synonym-rows.ts:48`, `tips.ts:29`) and once more, differently, in sourcing.

**What tests cannot reach.** Each side tests its own key with its own fixtures. No test gives one pair of spellings to both and asks for the same answer.

**Related ADRs.** 0146 (every Entry's text is the Edition's own; candidate lists before any write), 0065 (the language-agnostic Core, which the hard-coded `uk` in sourcing sits outside of).

**Confidence.** Medium: the two normalisations differ in code; whether a real pair of spellings passes one and not the other was not shown, since the alphabet rule (`entries.ts:66,94`) may already refuse the other apostrophes.

**Size.** Small: one function for the compared form of a text, used by the four rules and by sourcing.

## Walked, no candidate

- `packages/language-pack/src/record-rows.ts`: the row statements shared by the build (`write-pack.ts`) and the Patch (`apply-patch.ts`). Deleting it would copy every `INSERT` twice. Deep; leave.
- `apps/admin/src/components/content-editor/kinds.ts`: a field list beside the contracts' schemas, with no rule in it (the backend refuses). `record-form.tsx:103-108` keeps the top-level fields the editor does not know; nested ones inside a `list` or `object` control are rebuilt from the editor's own sub-fields (`kinds.ts:381-387`), so a sub-field the schema gains would be dropped on the next edit. All sub-fields match today.
- `checkRecord`'s comparison key (`check.ts:139-141`) leaves the message out, so a save that adds a second refusal of the same rule, file and field to another record is not reported. Narrow; noted only.

## Not walked

`packages/language-pack/src/pack-reader.ts`, `edition-folder.ts` and `crossword.ts`, `tools/sourcing` beyond the duplicate key, and the admin's `account-records.ts`, services and switches screens were not read in this walk.
