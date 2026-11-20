# Audit 20.11, zones 6-10: adversarial verification

Checked against `main` at 0439b5deb, read-only. Input: `zones/zone-6.md` .. `zone-10.md` (52 findings).
Every HIGH and MEDIUM finding was opened in the code; LOW findings got a quick look (those marked "not opened" were judged on the report alone).

Verdicts: CONFIRMED 22, PLAUSIBLE 30, REJECTED 0. Two findings keep their defect but with a corrected mechanism or scenario (6.H1, 6.M2). Six severities lowered from medium to low (6.M2, 6.M3, 7.3, 9.M2, 9.M3, 10.M1), each with its reason below.

After verification: high 2, medium 9, low 41.

## High

### 6.H1 — CONFIRMED, high (mechanism corrected)
- Where: `apps/mobile/src/shell/edition-tabs.tsx:249-315`; routes `apps/mobile/src/app/curated-collections.tsx`, `apps/mobile/src/app/curated-collection-feed/[collectionId].tsx`; callers `apps/mobile/src/dashboard/dashboard.ts:90`, `apps/mobile/src/dashboard/curated-collection.ts:96`.
- Defect: the two routes have no `Tabs.Screen`. The audit's scenario (two extra visible tab buttons) is wrong: Expo Router 58.0.30 `standard-navigation/useVisibleTabsWithRedirect.js` shows only routes with `routeSource === 'layout'` and, when an undeclared route gets focus, does `router.replace` to the initial tab. This is exactly what the comment at lines 302-305 warns about.
- Consequence: «SLOVO пропонує» › all Curated Collections (`/curated-collections`) and a Word of a Curated Collection with `curatedCollectionFeed` on (`/curated-collection-feed/…`) bounce straight back to the Dashboard: the tile opens nothing. No extra tab buttons appear.
- Fix: add `<Tabs.Screen name="curated-collections" options={offTabs} />` and `<Tabs.Screen name="curated-collection-feed/[collectionId]" options={offTabs} />`; add both to the route map of `edition-tabs.test.tsx` (6.L6, first item, merges here).
- Note: not seen on a device; one tap on the phone settles it.

### 10.H1 — CONFIRMED, high
- Where: `packages/language-pack/src/record-rows.ts:33-42`, `packages/language-pack/src/apply-patch.ts:90-91`, read at `packages/language-pack/src/media-rows.ts:83-98`, used at `packages/core/src/media/media.ts:142,195`.
- Defect: `needs_new_recording` is written only at build; the Word upsert of a Patch leaves it out and nothing else clears it. `CONTEXT.md:507-508` says a Patch with the new Recording "clears the mark" (ADR 0099), so the code contradicts the glossary.
- Consequence: a Word marked at build time has no Pronunciation until the next store build, even after its new Recording arrives. The local pack `editions/uk/dist/language-pack.db` (16.11) has 28 marked Words of 2045. The reverse case (edited after the build, old Recording keeps playing) was not verified; it depends on whether the backend retires the old rows in the same Patch.
- Fix: clear the mark in `applyPatch` when a Patch brings a live `media_recordings` row for the Word (and set it when the Patch changes a Word's lemma or stress, or carry the flag in the Patch).

## Medium

### 6.M1 — CONFIRMED, medium
- Where: `apps/mobile/src/user-state/stored-user-state.ts:46-51`, `apps/mobile/src/shell/app-shell.ts:215-219`, `packages/core/src/account/account.ts:420-427`.
- Defect: a failed user-state open falls back to an empty in-memory state; the Account opens over it, finds no `installed` marker, and ends the Keychain Session and tells the server to sign out.
- Consequence: one transient SQLite failure at launch signs the reader out for good and shows the onboarding again.
- Fix: mark the fallback user state and keep the Account (and Sync) closed or failed-with-retry over it.

### 7.1 — CONFIRMED, medium
- Where: `apps/mobile/src/entries/pronunciation.ts:126-152`, `apps/mobile/src/entries/pronunciation-button.tsx:131-143`.
- Defect: while `recordingOf(id)` is awaited the Word is not `playing`, so the unmount cleanup and the «Звуки» effect stop nothing, and `soundsOn()` is not asked again before `player.play`.
- Consequence: on a slow network a Recording starts over another card after the reader swiped on, or after «Звуки» was turned off.
- Fix: give the pending tap a state (or let `stop()`/unmount drop `latestTap`) and re-check `soundsOn()` after the await.

### 7.2 — CONFIRMED, medium
- Where: `apps/mobile/src/feed/feed.ts:87-97` (`turn` depends on `feed`), `:189-194` (effect deps `[landed, landing, pager, turn]`).
- Defect: a composition reopen gives a new `feed`, so `turn` changes and the landing effect runs again with the old `landed`, calling `showPage(landed.page)` and `turn(landed.page)`.
- Consequence: after landing on the Word of the Day and reading on, a sync, Patch or switch change jumps the Feed back to the landing page.
- Fix: land once per ask (clear `landed` after the effect, or key the effect on `landed` alone through a ref to `turn`).

### 8.1 — CONFIRMED, medium
- Where: `packages/ui/src/primitives/PressedTile.tsx:121-125`; RN 0.88 `Pressable.js:259-260`; callers `game/PickRound.tsx:275`, `PairsGrid`, `VowelButtons`, `OrderedChips`.
- Defect: `disabled={disabled || inert}` makes `Pressable` overwrite `accessibilityState.disabled` with `true` for every inert tile.
- Consequence: after an answer VoiceOver reads every option as dimmed, the right one and the reader's pick too.
- Fix: block presses for `inert` without `Pressable`'s `disabled` (guard `onPress`, or `pointerEvents`), keep `disabled` for really disabled tiles.

### 9.M1 — CONFIRMED, medium
- Where: `packages/ui/src/dashboard/DashboardHero.tsx:173-229`, tokens `packages/ui/src/tokens/feed.ts:156-188`; value from `packages/core/src/dashboard/dashboard.ts:205`.
- Defect: fixed 470 pt hero, card absolute at top 116, button top at y 336; the full `primaryDefinition` has no line limit, fit or text-size cap.
- Consequence: a Definition longer than about 4 lines pushes the rarity line under «Ще про слово →». In the local pack 81 of 2045 primary Definitions are over 130 characters (12 over 160, longest 218), so it shows at the default text size too.
- Fix: let the hero grow with the card, or fit/limit the Definition (shrink to fit, then `numberOfLines`), and cap its scaling.

### 10.M2 — CONFIRMED, medium
- Where: `apps/admin/src/components/content-editor/field-controls.tsx:196-231`.
- Defect: Stress positions stay by index when the Lemma changes; a position on a consonant or past the end is not drawn and cannot be removed; nothing resets them.
- Consequence: after editing a Lemma the save is refused by the Stress check and the form gives no way to drop the stale position but a reload.
- Fix: drop positions that no longer point at a vowel when the text changes (or draw them as removable).

### 10.M3 — CONFIRMED, medium
- Where: `apps/admin/src/components/services/service-entries.tsx:397-405` (type `recovery-codes` at `:23`).
- Defect: every sealed value is typed into a single-line `<input type="password">`, which strips line breaks.
- Consequence: recovery codes pasted one per line are stored glued together with no separator.
- Fix: a `<textarea>` (masked) for multi-line types, or split on whitespace and store with a separator.

### 10.M4 — PLAUSIBLE, medium
- Where: `apps/admin/src/components/services/service-entries.tsx:234-255`.
- Defect: `navigator.clipboard.writeText` runs after an awaited request (two after the unlock dialog), outside the user gesture.
- Consequence: in Safari «Копіювати» answers «Не вдалося» every time; in Chrome only after a slow unlock. Browser behaviour not tested here.
- Fix: write a `ClipboardItem` built from the promise inside the click handler, or show the value with a second «Копіювати» tap.

### 10.M5 — CONFIRMED, medium
- Where: `apps/admin/src/switches/switch-state.ts:89-96`, `switches-screen.tsx:96-105`; the rule editor appends a new Rule at the end (`rule-editor.tsx:144-150`), so a targeted Rule after the everyone Rule is easy to make.
- Defect: a cell toggle moves the everyone Rule to the end, so targeted Rules that stood after it (and never matched) start deciding.
- Consequence: turning a feature on in the matrix can turn it off for the readers of a shadowed Rule, with nothing in the confirmation about it.
- Fix: keep the Rules' order and replace the everyone Rule in place (or say in the confirmation which Rules start to match).

## Low

### Lowered from medium

- **6.M2 — PLAUSIBLE, low (was medium).** `apps/mobile/src/account/google-sign-in-sheet.ts:54-57`. `revokeAccess` runs without `configure` or a restored user after a restart, and errors are swallowed. Why lower: the native call is `GIDSignIn.disconnectWithCompletion` (`RNGoogleSignin.mm:182-192`), and Google's iOS SDK, as far as known, loads the saved auth state from the Keychain when there is no current user, so the revoke most likely still happens; the SDK source is not in the repo to prove it. Consequence if it fails: the app's grant stays at Google after the Account is deleted. Fix: test the restart case on a device; if it fails, restore the previous sign-in before revoking or revoke on the backend.
- **6.M3 — PLAUSIBLE, low (was medium).** `apps/mobile/src/notifications/notification-scheduler.ts:131-134`; `apps/mobile/src/opening.ts:129-142` opens the new composition before closing the old, and `packages/core/src/composition.ts:293-300` lets a started `replacePlan` finish. Why lower: narrow timing, and the next replan (every return to the app, every day turn) cancels the strays, so "up to 14 days" is overstated. Consequence: a duplicate notification at the old time until the next replan. Fix: one promise queue for `replacePlan` in the adapter.
- **7.3 — PLAUSIBLE, low (was medium).** `apps/mobile/src/categories/list-feed.tsx:41-47`. All cards of a list are read at once. Why lower: the largest Category has 216 Words, read from local SQLite; no measurement shows a slow open. Consequence: a possibly slower first open of a big Category's Feed. Fix: read cards for the drawn pages only.
- **9.M2 — CONFIRMED, low (was medium).** `packages/ui/src/progress/ActiveDaysCalendar.tsx:72-76`, `StreakFreezeCard.tsx:40,96-100`. Day numbers and the chip scale without a cap in fixed cells. Why lower: 15 pt in a 42 pt tile clips only from about 2.3× (accessibility sizes). Consequence: clipped day numbers at the largest iOS text sizes. Fix: `maxFontSizeMultiplier={fontScaleCap.fixed}` (or `.number`).
- **9.M3 — CONFIRMED, low (was medium).** `packages/ui/src/settings/NarratorVoicePicker.tsx:157-168`, tile height 64. Two uncapped lines in a fixed tile. Why lower: 32 pt of content clips only from 2×. Consequence: clipped voice name and description at accessibility sizes. Fix: cap the scaling or let the tile grow (`minHeight`).
- **10.M1 — CONFIRMED, low (was medium).** `packages/content-rules/src/check.ts:123`, `crossword-days.ts:119`; called from `apps/backend/src/content/content-writes.ts:487` with `clock.now()`, while `publishedOn` there uses `editionDateOf(now)`. "Published day never changes" is judged by the UTC date. Why lower: it needs an edit of exactly today's day between 00:00 and 02:00-03:00 Kyiv. Consequence: a crossword changed under readers already playing it. Fix: pass `editionDateOf(now)` as `today`.

### Zone 6

- **6.L1 — PLAUSIBLE.** `apps/mobile/src/app/settings/rarity-test.tsx:34-50`, `apps/mobile/src/onboarding/onboarding.tsx:258-277`. The effect that draws the Rarity Test depends on the module, which a reopen replaces. Consequence: questions change mid-test. Fix: draw once per round (ref or key), not per module identity.
- **6.L2 — CONFIRMED.** `apps/mobile/src/app/c/[linkId].tsx:147-166`. In-flight guard is React state. Consequence: a fast double tap can make two copies. Fix: a ref guard.
- **6.L3 — CONFIRMED.** `apps/mobile/src/settings/questionnaire-screen.tsx:42-50`. No rejection handler. Consequence: an unhandled rejection, nothing logged. Fix: `.catch` with `logError`.
- **6.L4 — CONFIRMED.** `apps/mobile/src/shell/lifecycle.tsx:116-130`. `followForeground()` starts after an await with no check that the app is still in the foreground. Consequence: the Patch timer can run in the background until the next return. Fix: remember the last moment and skip when it is `background`.
- **6.L5 — PLAUSIBLE (not opened beyond the report).** `apps/mobile/src/settings/privacy-screen.tsx:65-84`. The export file stays in Caches. Consequence: the reader's data sits in plain text until iOS purges it. Fix: delete the file after the share sheet closes.
- **6.L6 — PLAUSIBLE.** Test gaps; the first item is the reason 6.H1 got through and is fixed with it; the two `google-sign-in-sheet.test.ts` items stand. Fix: assert the call order and a restart case.

### Zone 7

- **7.4 — CONFIRMED.** `apps/mobile/src/categories/list-feed.tsx:80-147`. A failed read leaves `list` undefined: an empty pager and a back tile with no label, no retry. Fix: show the failure with a retry.
- **7.5 — CONFIRMED.** `apps/mobile/src/search/search.ts:94-107`. A failed read returns `searching` for good. Consequence: the loader never ends. Fix: a failed state with a retry. (7.4 and 7.5 are the same gap: `useCompositionRead` failures have no screen.)
- **7.6 — PLAUSIBLE (not opened).** `pronunciationPlayed` sent on every tap. Consequence: inflated analytics. Fix: send from the play callback.
- **7.7 — PLAUSIBLE (not opened).** `indexed-media-cache.ts:40-41`. One failed `readIndex` is kept. Consequence: no media cache for the session. Fix: drop the failed promise.
- **7.8 — PLAUSIBLE (not opened).** Crossword screen stays on yesterday's puzzle after midnight. Fix: follow the day turn.
- **7.9 — PLAUSIBLE (not opened).** Double tap on a Feed Notice pages twice. Fix: guard the turn.
- **7.10 — PLAUSIBLE (not opened).** Widget link key from `Math.random`. Consequence: randomness not injected; no reader-visible effect named. Fix: inject it.
- **7.11 — PLAUSIBLE (not opened).** `collections.create` can reject silently. Fix: log and toast.

### Zone 8

- **8.2 — PLAUSIBLE.** `packages/ui/src/game/VowelButtons.tsx:31,269-275`. Fixed 3 pt slop on narrowed cells. Consequence: vowel tap areas under the touch target on long Words. Fix: slop from the cell width.
- **8.3 — PLAUSIBLE.** `packages/ui/src/game/RoundCard.tsx:309-321`. Plain `Text` with no one-line fit. Consequence: a long Word can break inside itself at 1.5×. Fix: `WholeWordsText` or fit.
- **8.4 — CONFIRMED.** `packages/ui/src/game/AnswerBanner.tsx:72-78`. `isScreenReaderEnabled()` has no `.catch`. Consequence: a rejection reaches `onWaitFor`. Fix: `.catch(() => false)` as `UndoToast` does.
- **8.5 — PLAUSIBLE.** `packages/ui/src/game/AnswerCard.tsx:32-34`. Announcement keyed on `[verdict, line]`. Consequence: a same-verdict answer inside the slide-out is not announced. Fix: key by the Round.
- **8.6 — PLAUSIBLE.** `packages/ui/src/onboarding/OnboardingStep.tsx:245-259,306-312`. No `accessibilityLabel`, no `minWidth`/`hitSlop`. Consequence: small; VoiceOver reads the child text. Fix: add them.
- **8.7 — PLAUSIBLE.** `packages/ui/src/onboarding/SplashOverlay.tsx:178-180`. Label on a non-`accessible` View. Consequence: the wordmark is never spoken. Fix: `accessible`. (Same pattern as 9.L3.)
- **8.8 — PLAUSIBLE.** `packages/ui/src/primitives/TabBarButton.tsx:94`. Uncapped label in a fixed-height tab. Consequence: clipped tab label at the largest sizes. Fix: cap the scaling. (Same class as 9.M2, 9.M3.)
- **8.9 — CONFIRMED.** `packages/ui/src/game/useTraceDrag.ts:73-77`. `onFinalize` always releases, a cancel included. Consequence: a half-drawn trace cancelled by the system is checked as an answer. Fix: release only when the gesture ended with success.
- **8.10 — PLAUSIBLE.** `packages/ui/src/onboarding/OnboardingStep.tsx:163-166`. Focus event at mount. Consequence: VoiceOver may stay on the old step. Fix: send it after the enter ends.
- **8.11 — PLAUSIBLE.** `packages/ui/src/game/CrossingGrid.tsx:81-88`, `LetterWheel.tsx:312`. No lower bound, no wrap. Consequence: tiny cells or overflow in a short room. Fix: a minimum side, `flexWrap`.

### Zone 9

- **9.L1 — CONFIRMED.** `packages/ui/src/entries/WordCard.tsx:373,384-386`. The full-stop check runs on the quoted text, which ends in «»». Consequence: VoiceOver gets a stray comma before the author. Fix: test `example.text`.
- **9.L2 — PLAUSIBLE.** `packages/ui/src/entries/WordCard.tsx:295-297`, `WordTabs.tsx:105-107`. `onShown` fires on mount under the first tab. Consequence: «Word History opened» counts nearly every open; the owner decides whether drawn means seen. Fix: fire when the History is in view.
- **9.L3 — PLAUSIBLE.** `packages/ui/src/progress/ActiveDaysCalendar.tsx:150`. Label on a non-`accessible` View. Consequence: the calendar's name is never read. Fix: a header or `accessible` wrapper.
- **9.L4 — PLAUSIBLE (latent).** `packages/ui/src/feed/FeedNoticeCard.tsx:236,322`, `GoalReachedCard.tsx:350`. Buttons call `turnToNext?.()`. Consequence: none today; dead buttons outside a pager. Fix: hide the button without a pager.
- **9.L5 — PLAUSIBLE.** Ten absence-only tests (list in zone-9.md). Consequence: they pass on an empty render. Fix: one positive anchor each.

### Zone 10

- **10.L1 — PLAUSIBLE.** `apps/admin/src/components/sign-in.tsx:108-151`. No way back from the TOTP step once the emailed code expired. Consequence: «Код неправильний» until a reload. Fix: a back link and an expiry message.
- **10.L2 — PLAUSIBLE.** `apps/admin/src/components/account-menu.tsx:38-41`, `routes/sessions.tsx:17-20`. Sign-out invalidates `ME_KEY` only. Consequence: the next Admin user on the tab briefly sees cached pages. Fix: `queryClient.clear()`.
- **10.L3 — PLAUSIBLE.** `apps/admin/src/components/content-queue/content-queue.tsx:121-145,208-211`. A retry resends finished batches. Consequence: the retry fails again and the owner is not told what went through. Fix: drop finished batches from `chosen`.
- **10.L4 — PLAUSIBLE.** `apps/admin/src/components/content-editor/field-controls.tsx:23`. Hard-coded vowels instead of `languageTraits.stress.vowels`. Consequence: none for the UA Edition; breaks another Edition. Fix: read the Edition config.
- **10.L5 — PLAUSIBLE (may be intended).** `packages/content-rules/src/entries.ts:322-336`. A single Latin letter between Cyrillic words is refused. Consequence: «вітамін C» cannot be saved; the rule exists to catch look-alike letters, so the owner decides. Fix: an allow-list or a per-record exception.
- **10.L6 — CONFIRMED.** `packages/content-rules/src/public-domain.ts:18`. `today.getFullYear()` in the host's time zone. Consequence: a few hours' drift around 1 January. Fix: the Edition's date.

## Merged duplicates and shared causes

- 6.L6 (first item) is the test gap behind 6.H1: one fix.
- 7.4 and 7.5: a failed `useCompositionRead` has no failed screen.
- 9.M2, 9.M3, 8.8 (and 8.3): text without `maxFontSizeMultiplier` in a fixed box; one pass with `fontScaleCap`.
- 8.7 and 9.L3: `accessibilityLabel` on a View that is not `accessible`.
- 7.2 and 6.L1 (and 6.M3): effects or work keyed on a module identity that a composition reopen replaces.
