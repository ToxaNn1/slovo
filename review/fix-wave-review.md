# Fix-wave review: `git diff 5b6d94ce0...HEAD` (fix/global-review-1106)

Scope: owner decisions 4–7 (OWNER-DECISIONS-1106.md). Read-only review; no tests run.
Counts: High 1 · Medium 4 · Low 4.

Checked and fine:
- (a) No caller of the removed `linksCorrections` / `refreshLinkedCorrections` is left anywhere (git grep = 0). `linkedCorrections` filters out Hidden Corrections and those of a Category out of the Mix; `linkingSynonymRow` skips Hidden rows. `refreshLinks` now rebuilds the Word cards on every eligibility change, so hide and unhide update the links. `openLinkedCorrection` also guards with `cycle.covers`, which matches `eligible()` for Corrections (no Knowledge or rarity filter), so the guard can't block a legitimate tap.
- (b) `ColorTokensSchema` is a strictObject. Every literal it parses has `accentText`: `editions/uk/tokens.json`, `coreTokens`, and the contracts test, which builds its fixture from `keyof()`. Contrast as UA ships it: light #C4271D is 4.62–5.57, dark #FF5247 is 4.64–6.03, so it passes everywhere. Old `accent` on light background/surface/sunken was 3.27/3.44/2.85. Every moved text is under the large-text threshold (sheetLemma 20/600 is not bold, crosswordCardMark is 18/900). Fills, borders, wedges and large text (roundVerdict 30, streaks 48/60, exampleMark 54) stay on `accent`.
- (d) CONTEXT.md Account entry: «SLOVO ID» is out of _Avoid_, and the entry is consistent with ADR 0030/0036/0041 and with `account-texts.ts` / the edition-files tests, which use the name.

## High

H1. The ADR 0094 rules and the public «Джерела» text don't match the content that ships now.
- `editions/uk/legal/terms.md:41` says: «ми цитуємо їх лише коротко, не більше одного речення». `docs/adr/0094-…md:7` says: "at most one sentence of a Definition, an etymology, a Synonym article or a phraseological entry".
- A heuristic count of sentence ends over `editions/uk/content` finds many multi-sentence fields:
  - words `.etymology` 524/1223 (ЕСУМ-style articles);
  - tips `.explanation` 38/82 (Антоненко-Давидович quotes, e.g. «Люди, що не дбають за культуру власної мови… "Я вибачаюся". Так сказати не можна…»);
  - corrections `.explanation` 106/152;
  - idioms `.etymology` 18/23;
  - idioms `.primaryDefinition` 5/96.
- Failure: the first rights holder who reads the terms finds a public statement the app already breaks. That is worse than having no stated basis, which is exactly the risk the ADR was meant to remove.
- Conflict with ADR 0012: "Definitions and Examples are copied word for word", and 0012 rejects "Correct goroh's text by hand … That would be writing Definitions instead of quoting them". 0094 says "the Edition's own wording replaces the rest". That mix of quote and own wording is what 0012 rejected, yet 0094 and the README line call it "extends 0012, 0084", not "amends".
- Fix (needs an owner call, per the CLAUDE.md conflict rule):
  - (1) Mark 0094 as amending 0012 (and 0084's "quoted word for word"), and state that the current content does not comply yet and must be trimmed (a follow-up ticket).
  - (2) Until the trim lands, word terms.md as an aim or rule rather than a fact ("цитуємо коротко" without the current-state claim), or hold the terms change back until then.

## Medium

M1. Small red text was missed, and it still fails 4.5:1 in light. Each site below is still on `accent` (3.27–3.44):
- `apps/mobile/src/notifications/notification-times.tsx:115`: `textLink` (15/700) is on `colors.accent`. It is the same role CardTabs/WordCard moved.
- `apps/mobile/src/saved/saved-list-screen.tsx:105` and `apps/mobile/src/app/saved/collections/[collectionId]/index.tsx:111`: `collectionCount` is 22/500, under the 24 regular threshold, so it counts as small text.
- `packages/ui/src/entries/SynonymRowCard.tsx:196`: a linked member (`listWord`, 800, drawn at `sizes.definition`, under 18.66) is a link in red on surface.

Fix: switch these to `accentText`.

M2. The contrast gate covers only the UA Edition, not every Edition.
- `packages/ui/src/tokens.test.ts:113` checks `accentText` for the UA tokens only.
- The factory-wide table in `apps/mobile/src/edition/edition-files.test.ts:1721` (`textPairs`, run for the Core and every Edition) has no `accentText` pairs.
- Failure: a second Edition can ship an `accentText` at 3:1 and CI stays green.
- Fix: add `['accentText', 'background'|'surface'|'surfaceSunken'|'tile']` to `textPairs`. `leastContrast` then gives 4.5, because `accentText` is not in `signal`. The UA-only test can then go.

M3. The new colour role is not recorded in an ADR.
- ADR 0070:12 lists every colour role of a scheme exhaustively ("The Edition schema refuses a removed role").
- `accentText` adds one, plus a rule: small red text uses it, `accent` is for fills and large text. Only the contracts doc comment and `docs/design/README.md` record it.
- CLAUDE.md asks for a new decision to be recorded as an ADR in the same change. The UI rule also has no home that a later screen author would read.
- Fix: write a short ADR amending 0070 (role, threshold, the 4.5:1 rule), plus a README index line.

M4. `refreshLinks` now rebuilds every Word card of the session on every eligibility change (`packages/core/src/feed/feed.ts:713-724`).
- The old version skipped the rebuild unless Corrections toggled. The new one runs sequential `entries.get` plus `buildWordCard` calls (several content reads each) for all of `session.all`, then calls `session.renew` and `subscribers.tell()` even when no link changed.
- Failure: in a long session (hundreds of cards), each Hide or Mix change gets slower and re-renders every card, all inside `inTurnTellingSeen`, so the next swipe waits on it.
- Fix:
  - build the cards in parallel (`Promise.all`);
  - renew only the cards whose `linkedCorrections` or `synonymRow` link changed;
  - skip the `tell` when nothing changed.

## Low

L1. `packages/ui/src/saved/CollectionNameField.tsx:107`: the refusal colour moved from `destructive` to `accentText`. It is not an `accent` → `accentText` move, so it falls outside decision 5 ("only small red text moved"). It is defensible, since it now matches `ProblemLine`, but mention it in the PR.

L2. `editions/uk/legal/terms.md:40`: the named dictionaries leave out СУМ-11 (550 Words cite it), and the content cites no Караванський by name. goroh «Синонімія» (1111 citations) is presumably Караванський, but the terms then name him without the dictionary. Бурячок, Грінченко and Гринчишин/Сербенська are cited too. «зокрема» covers this, but list СУМ-11 and name the synonym dictionary precisely.

L3. ADR 0094:11 says "a death-year check on Example authors as ADR 0045 has for Literary Uses". Examples carry only `author` (e.g. «М. Малиновська»), with no death year, so a schema change is needed first. The ADR should say so, so the follow-up isn't read as a check-only task.

L4. `packages/core/src/entries/entries.ts:444-458`: `linkedCorrections` restates the Correction part of `eligible()`: kind shown, category in Mix, not Hidden, live. It is still inside Entries, as ADR 0015 requires, but the two can drift. Consider deriving both from one predicate. The feed test "opens no linked Correction the Cycle does not cover" (`feed.test.ts`) only exercises the belt-and-braces guard through a doctored `listIds`. It is fine, but `cycle.covers` is in effect redundant with `linkedCorrections`.
