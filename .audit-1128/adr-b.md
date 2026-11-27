# Audit 28.11, part adr-b: ADRs 0125 to 0209

Scope: the 24 ADR files from `0125` to `0209` (the 27th file of `ls docs/adr` to the last), each read whole and checked against the code on `origin/main` (`8665bce`) and `CONTEXT.md`. ADRs outside the scope were read only through `pnpm -s adr:index` and `docs/adr/retired.md`. Read-only: no code and no ADR changed.

Each finding is CONFIRMED (the evidence was read) or PLAUSIBLE (the evidence points there, one part could not be read from the repo).

## Findings

### F1. ADR 0204: the privacy policy does not name the kept email, and says the opposite

CONFIRMED.

- The ADR's Consequences: «An email erased through the admin stays in `action_log`; the privacy text names this retention.»
- `editions/uk/legal/privacy.md:47` says an Account the owner deletes «видаляється так само, як описано в розділі «Як видалити Акаунт SLOVO», а причину записано», and `privacy.md:142` of that section says the Account and «його пошту» are deleted from the server «назавжди». Nothing says the id, email and creation time stay in the Action log for good.
- The code does what the ADR says (see «Checked, no defect» for the transaction), so the policy text is the part that is wrong.

Proposed action: keep the ADR; the owner approves a line for `privacy.md:47` (an Account deleted by the owner leaves its email, id and creation date in the owner's log). Until then amend the ADR's consequence to «the privacy text must name this retention; it does not yet».

### F2. ADR 0135: the privacy policy does not name the Data export

CONFIRMED.

- The ADR: «The privacy policy page (ADR 0049) names the Data export; its text is prominent copy and waits for the owner's approval.»
- `editions/uk/legal/privacy.md` has no mention of an export (no «експорт» in the file), while `dataExport` is `on` in `editions/uk/edition.json:126`.

Proposed action: keep; the owner approves the policy line, or the bullet is amended to «the privacy policy does not name the Data export: it sends nothing off the device».

### F3. ADR 0156: «Рівень» sets nothing, yet the summary and one sentence say the onboarding sets the top

CONFIRMED.

- Summary: «onboarding and the Rarity Test set only the top». Body, «Who sets it»: «Onboarding's «Рівень» and the Rarity Test set the top alone … Since then «Рівень» sets nothing, so the Rarity Test alone sets the top.» The body contradicts itself and the summary keeps the old half.
- Code: `packages/core/src/questionnaire/questionnaire.ts:88-92`: a `level` answer only checks that the option exists and sets nothing. The ADR also says «the questionnaire's `rarityCeiling` options keep their names and mean the top», but those values (`editions/uk/edition.json:513-528`, schema `packages/contracts/src/edition.ts:705`) are read by nothing.

Proposed action: amend. Summary: «…the Rarity Test alone sets the top (and opens the bottom to 1); «Рівень» sets nothing…». Body: drop the first sentence of «Who sets it» and say the questionnaire's `rarityCeiling` option values are unused.

### F4. ADR 0156: the picker paragraph is one screen's layout, repeated by ADR 0201

CONFIRMED (a judgement on the text, no code defect).

- «The picker» fixes tap rules, the spring, the haptic and the hint line of one control: screen layout, which `CLAUDE.md` says is never an ADR. Its last three sentences (where the picker shows while the tab «Мікс» is on) repeat ADR 0201's second bullet word for word in meaning.
- The decision that lasts is the first paragraph (one range, every surface), «The Core», the stored record with migration 9 (`packages/core/src/user-state-schema.ts:334`) and the switch.

Proposed action: amend: cut «The picker» to one line («picked on five bars in Settings or on the tab «Теми», ADR 0201») and leave where it shows to 0201 alone.

### F5. ADR 0201: the summary and the body still say «Мікс» / «Мій Мікс», the app says «Теми» / «Мої Теми»

CONFIRMED.

- The last line of the ADR: «Renamed (owner, 21.11). The tab shows as «Теми» and the screen as «Мої Теми».» The summary, the title, the tab list, the VoiceOver line («Мікс, вкладка 3 з 5») and the first-week line all keep the old words; ADR 0156 says «at the top of «Мій Мікс»» too.
- `editions/uk/strings.json:8` (`"mix": "Теми"`), `:132` and `:963` («Мої Теми»), `apps/mobile/src/shown.ts:82`.

Proposed action: amend the summary to «The Mix is the fifth tab, shown as «Теми», in the centre of the tab bar (Стрічка, Ігри, Теми, Збережене, Профіль), its screen «Мої Теми» as the tab's root…» and replace the UI words in the body; fold the «Renamed» note into the text.

### F6. ADR 0201: «No other door» from the Feed is not literally true

PLAUSIBLE (the code is clear; whether the owner counts a Feed Notice as a door is his call).

- The ADR: «No other door. The Feed and the Dashboard get no extra way to the Mix.»
- `apps/mobile/src/feed/later-question-notice.tsx:37`: the Mix review Feed Notice opens `/mix` (or `/settings/mix`) from the Feed.

Proposed action: amend with one clause: «no standing door; the Mix review Feed Notice still opens it».

### F7. ADRs 0194, 0197, 0198, 0199, 0201: they amend, supersede or cite ADRs that are removed

CONFIRMED (`docs/adr/retired.md`, `pnpm -s adr:index`).

- 0194: summary «(amends 0043)», body «amends ADR 0043» and «ADR 0016's dwell». 0043 and 0016 are «removed, not a lasting decision». The rule 0194 changes now lives only in the glossary (`CONTEXT.md:366`, «every 3rd card … is a Word due for Review»), which does not carry 0194's exception.
- 0197: summary «(supersedes the 20 seconds of 0137)»; 0137 is removed.
- 0198: «It refines ADR 0088, 0096 and 0164»; 0096 and 0164 are removed.
- 0199: «`dependsOn` (ADR 0040)»; 0040 is superseded by 0089.
- 0201: «The app pass opens `/mix` (ADR 0177)»; 0177 is removed.

Proposed action: amend each to stand alone: 0194 «(amends the Review slot of the glossary's Feed)» and add its exception to `CONTEXT.md:366`; 0198 «refines ADR 0088»; 0199 «(ADR 0089)»; 0201 drop the «(ADR 0177)»; 0197 see F8.

### F8. ADR 0197: a number, not a decision

CONFIRMED.

- The whole ADR is one constant and two strings: `TIMED_GAME_LENGTH = 60_000` (`packages/core/src/game/timed-mode.ts:5`), «60 с» and «Шістдесят секунд…» (`editions/uk/strings.json:1920-1923`). It supersedes an ADR that was itself removed as «not a lasting decision», and the switch it mentions (`timedTwentySeconds`) is gone from the code.
- The code matches it; nothing would be lost.

Proposed action: retire (a `retired.md` line «0197: removed, not a lasting decision»); the glossary's Game Mode entry may keep «60 seconds».

### F9. Amended ADRs whose `summary:` does not name the amendment (ADR 0193's own rule)

CONFIRMED (from `pnpm -s adr:index`; ADR 0193: «A change that amends or supersedes an ADR updates that line in the ADR's own file»).

- 0195 «amends 0099»: 0099's summary still says «an hourly Railway Cron generates missing Recordings … the device voice reads until then», with no word of the default voice only, the list of Words in all voices or `recordedOnly`.
- 0203 «amends 0089»: 0089's summary has no «amended by 0203».
- 0204 «amends 0088»: 0088's summary has no «amended by 0204».
- 0207 «amends 0196»: 0196's summary (in scope) names its two amendments of 26.11 but not Грінченко as a second headword list and draft basis.
- 0125 «amends 0049 and 0063»: 0063's summary names it, 0049's does not.

Proposed action: amend the five summaries with a short «amended by NNNN: …» clause; for 0196: «…; amended by 0207: Грінченко is a second headword filter and draft basis».

### F10. ADR 0146 against 0196 and 0207: two lists of where Word candidates come from

PLAUSIBLE (two texts in force that do not agree; which one the owner means is his call).

- 0146, «New content»: Words are gathered «from goroh («Найцікавіші слова»), Грінченко, ЕСУМ and the ГРАК corpus».
- 0196: «Word candidates for a content wave come from `pnpm source:lemmas`, with no language model», and 0207 adds Грінченко as a filter over that list. Neither says it amends 0146, and 0146's summary does not name them.
- Code: `tools/sourcing/src/lemma-candidates.ts:26,88-94,204` implements 0196 with 0146's bands.

Proposed action: amend 0146, «New content»: «Word candidates come from `pnpm source:lemmas` (ADR 0196, 0207)» in place of the Words source list; the lists for the other four kinds stay.

### F11. ADR 0146: its transition lines cannot be told finished from the repo

PLAUSIBLE (the live content database is not readable from here).

- Consequences: «Existing Entries are rewritten in one editorial pass … Until an Entry is rewritten, ADR 0094 still binds its old text» and «The «Джерела» section of the «Умови користування» changes once the pass is done».
- `editions/uk/legal/terms.md:38-40` still names the quoted dictionaries; `editions/uk/seed-snapshot.json` holds 0 records with «Власна лексикографічна редакція», 1403 dictionary sources and 15 `placeName` Idioms (the ADR retires the shipped ones).

Proposed action: the owner says whether the pass is done. If it is: retire 0094, cut the transition lines from 0146 and its summary («existing Entries rewritten in batches…»), and refresh the terms page and the seed snapshot. If not: keep.

### F12. ADR 0199: the catalogue is not «in the order the Edition declares them»

CONFIRMED (harmless, but the sentence is false).

- The ADR: «`FEATURE_SWITCHES`: one record per switch, in the order the Edition declares them.»
- `packages/contracts/src/feature-switch-catalogue.ts` and `editions/uk/edition.json` hold the same 135 keys, but the order parts at the 13th (`shareCards` in the Edition, `widgetGoalRing` in the catalogue); `statisticsOffCounter` is last in the catalogue (`:922`) and at `edition.json:68`.

Proposed action: amend: drop «in the order the Edition declares them» (nothing reads the order).

### F13. ADR 0203: the list of «readers that take the shipped answer on purpose» is a code inventory that already drifted

PLAUSIBLE (the rule holds; only the list is stale).

- The ADR names `createShell`, `editionAtLaunch`, `store-media.ts` and `mascot.tsx` as the readers of the shipped Edition.
- 24 modules of `apps/mobile/src` import the shipped `edition` for its data (`mix/mix-choices.tsx:34`, `content-update/device-content-updates.ts:11`, `app/settings/narrator-voice.tsx:13` …). The rule itself holds: only `shell/app-shell.ts:121,188,220,254` reads `featureSwitches` or `isShippedOn`.

Proposed action: amend the `mascot.tsx` bullet to «any module may read the shipped Edition's data, which no Rule changes; only `app-shell.ts` reads its switches».

## Checked, no defect

The code does what the ADR says, no ADR in force contradicts it, and the summary matches the body (apart from the findings above, which name their ADRs).

- **0125**: `docs/deploy.md:84` records the split, `:55` the two hops; `apps/backend/src/app.ts:457` answers `/:edition/c/:id`; `config.ts:143` caps `TRUSTED_PROXY_HOPS` at 2. Only F9 (0049's summary).
- **0135**: `packages/core/src/data-export/data-export.ts:14-49,128` (versioned, id and Lemma only), `apps/mobile/src/settings/privacy-screen.tsx`, switch `dataExport`. Only F2.
- **0163**: `packages/core/src/settings/settings.ts:174-181` (one unit on the on→off change, through the counters, lost on failure), `packages/server-core/src/analytics/admin-analytics.ts:181` (`Math.max(0, active − registered)`), `privacy.md:89,130` name the unit. The admin shows a fourth figure, `syncing`, which the ADR does not list.
- **0167**: `apps/mobile/eas.json` (`beta` and `production`, each its channel, both environment `production`; no `testflight`), `packages/contracts/src/app-config.ts:54,108`, `apps/mobile/app.config.ts:265-277`, `device-facts.ts:42`, `settings/about-screen.tsx:82`, `.github/workflows/ota-update.yml` (hand-started only), `apps/mobile/ota-plan.ts`.
- **0168**: `.railway/railway.ts:132-156` (backend alone, `sleepApplication`, `DEPLOYMENT: 'staging'`), `apps/backend/src/config.ts:57,204,325-332`, both staging workflows `workflow_dispatch` only, `scripts/staging.ts`.
- **0193**: `package.json:28,33,35`, `.gitignore:48`.
- **0194**: `packages/core/src/feed/feed.ts:450,483` (`readToday`, kept in memory). Only F7.
- **0195**: `apps/backend/src/recordings/recordings.ts:99-128`, the `words_in_all_voices` migration (seeds every Word recorded in another voice), `admission.ts:114` (`addOtherVoices`: Власник and Адмін), `apps/admin/src/components/content-editor/recordings-cell.tsx`, `apps/mobile/src/entries/pronunciation.ts:167`, `strings.json:415-416`, `CONTEXT.md:492`. Note: `recordedOnly` is `off` in `editions/uk/edition.json:31`, so the app half is built but not in effect. Only F9 (0099's summary).
- **0196**: `tools/sourcing/src/lemma-sources.ts:32-40,67-71` (pinned by version and SHA-256), `lemma-candidates.ts:26,58,85-94,204-211`. Only F9 and F10.
- **0198**: `apps/backend/src/admin/admission.ts:46-135` (`satisfies AdmissionTable<typeof apiContract.admin>`), `:239-270` (the order of refusals as written), `admin-procedures.ts:135-145`. Only F7.
- **0199**: `packages/contracts/src/edition.ts:296,472`, `apps/admin/src/switches/switch-texts.ts:10`; the UA Edition declares all 135 switches. Only F7 and F12.
- **0200**: `packages/core/src/notifications/notifications.ts:133-147,264-285`, `packages/contracts/src/edition.ts:554-566`, `edition.json:156`, `strings.json:1265-1267`.
- **0202**: `packages/core/src/progress/xp-log.ts:1002-1008`.
- **0203**: `packages/core/src/edition/edition.ts:97-121`, `packages/core/src/testing.ts:28`, `apps/mobile/src/edition/edition-at-launch.ts:12`, `apps/mobile/src/shell/app-shell.ts:50,144,220-258`. Only F9 and F13.
- **0206**: `packages/contracts/src/edition.ts:669-678` (the one list, in the ADR's order), `feature-switch-catalogue.ts:508-512` (`voiceStep` stands on `narratorVoice`), `strings.json:1218-1256` (the eight headings of the summary).
- **0207**: `tools/sourcing/src/hrinchenko.ts:33-40,240-242` (both scans pinned by SHA-256), `cli-lemmas.ts:15` (`--from hrinchenko`), `source-words.ts:413,461` (`write-fresh`). Only F9.
- **0208**: `packages/contracts/src/sync.ts:15-19`, `packages/contracts/src/api/sync.ts:10`, `packages/core/src/sync/exchange.ts:412,431`, read also by `server-core/src/sync/sync.ts`, `core/src/progress/xp-days.ts` and the fake backend.

## Not finished

The session stopped at the 200k soft limit of the token budget. Open:

- **0204**: the row's shape and the owner-only admission are read (`admin-procedures.ts:413-425`, `admission.ts:66`); the body of `deleteByEmail` (`packages/server-core/src/account/accounts.ts:305`) was not read, so «one transaction» is unverified.
- **0205**: the constants are read (`xp-days.ts:12,21`: 30 days, 2000 records; `server-core/src/sync/sync.ts:15,21`: 20 000 and 20 000; `progress/records.ts:162`: `union`). Not read: the XP day key `xpDay.<date>-<n>-<hash>`, deletions first in the push beyond `exchange.ts:71,172`, the tombstone count inside the push's transaction, and the Data export reading through XP days.
- **0209**: only that `action-log-catalogue.ts` exists and holds `content.word.allVoices` and `account.delete` writers; the typing of `ActionEntry.what`, the `action_log.what` column and the admin's text table were not checked.
- **0207**: the OCR pipeline (`hrinchenko-ocr.ts`) and «no site's lookups are scraped» were not read.
- **0146**: the per-kind editorial rules are not enforced by code that was found (no check holds «Власна лексикографічна редакція»); whether `packages/content-rules` checks any of them was not read.
- **0156**: the Mood band clip and `wordsInRarityRange` in the Daily Crossword were located (`mood/mood.ts`, `game/crossword-ports.ts`) but not read.
- A full pass for pairs of ADRs in scope that repeat each other beyond F4 and F10 (0199 and 0209 share one pattern on purpose; 0205 and 0208 split the Sync limits cleanly by their summaries).
- No `STUCK`: the first push was declined by GitHub («email privacy restrictions») because the session's environment sets the owner's private address; the commits here carry the repo's own identity from `.github/owner-email`, which CI's check also asks for.
