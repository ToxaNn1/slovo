# Audit 28.11, part adr-a: ADRs 0001 to 0103

Scope: the first 26 files of `docs/adr` (0001, 0003, 0004, 0006, 0007, 0010, 0013, 0030, 0031, 0041, 0044, 0047, 0048, 0049, 0062, 0063, 0064, 0065, 0066, 0068, 0088, 0089, 0090, 0094, 0099, 0103), each read whole and checked against the code on `origin/main` (8665bce) and `CONTEXT.md`. ADRs outside the scope were read only through `pnpm -s adr:index` and `docs/adr/retired.md`. Nothing but this file was changed.

CONFIRMED: the evidence was read in the code. PLAUSIBLE: likely, not provable from the repository.

## Findings

### 1. ADR 0066: the body states the Daily Goal, the Active Day and the XP sources that the code no longer has (CONFIRMED)

The three opening paragraphs were put on top of the first text and the first text was left as it was, so the ADR says two things at once.

- «The Daily Goal. 10, 20, 30 or 50 XP, chosen in onboarding with 20 highlighted … an existing reader defaults to 20» against the opening line «a number of Words Seen per local day». The code and the glossary follow the opening line: `editions/uk/edition.json:499` (`"options": [10, 25, 50], "highlighted": 10`), `CONTEXT.md:304` (Words Seen, «or none when skipped»), record kinds `word-goal` and `goal-met` in `packages/core/src/progress/records.ts:87,93`.
- «A day counts once it has 5 XP, separately from the Daily Goal» and «Active Days (a local date with at least 5 XP …)» against the opening line and `packages/core/src/progress/xp-log.ts:638-645` (a day with a goal is active only once met; 5 XP counts on a day without one), `CONTEXT.md:276`.
- «XP comes only from learning actions … the Word of the Day give 0» and the list of kinds have no Seen Word, while a Seen Word earns XP: `editions/uk/edition.json:497` (`"seenWord": 1`), `packages/core/src/progress/records.ts:23` (`'seen-word'`), and ADR 0202 builds on it.
- «merge as a set union by id, like Knowledge Marks»: Knowledge Marks carry no mark, so they sync last write wins (`packages/core/src/knowledge/records.ts` has no `sync:`; ADR 0013 lists them under last write wins). The XP log is `union` (`packages/core/src/progress/records.ts:153`).
- `summary:` says «Active Day (≥5 XP)», which is only the no-goal half of the rule.

Proposed action: amend. New text of the Daily Goal paragraph: «The Daily Goal is a number of Words Seen per local day, one of the Edition's options (UA: 10, 25, 50, 10 highlighted) or none; a day with a goal is an Active Day once the goal is met, a day without one at 5 XP; a Seen Word earns the Edition's `seenWord` XP (ADR 0202).» Drop the «10, 20, 30 or 50 XP» paragraph and «like Knowledge Marks»; summary: «Active Day (goal met, or ≥5 XP with no goal)».

### 2. ADR 0010: the body describes a registry file and a command that no longer exist (CONFIRMED)

The first sentence says the repo keeps no `content/ids.json`; the next three paragraphs and the Considered Options describe `content/ids.json`, `pnpm build:pack <edition-id> --record` and `content/manifest.json`. None exists: `git grep 'ids\.json'` and `git grep -- '--record'` outside `docs/adr` find nothing, and `editions/uk/content` is gone. What is left of the decision (an id is never reused, a record is Retired, the database issues ids) is already in ADR 0090 («The database issues ids», «Retire, never delete»).

Proposed action: merge into 0090 (it loses nothing: one line «an Entry id is never reused» is there already). If kept: amend to the summary's two sentences and delete the rest.

### 3. ADR 0062: the section «One channel for the one app» is not what the code does (CONFIRMED)

- «the app has one Update channel, `updateChannel` in the AppConfig (`app/app.json`), today `uk`»: `app/app.json` has no `updateChannel` (the test `apps/mobile/src/edition/edition-files.test.ts:1247` refuses it); the channels are `beta` and `production` in `apps/mobile/eas.json:20,28`.
- «a `workflow_dispatch` workflow that takes a rollout percentage and publishes to the AppConfig's channel»: `.github/workflows/ota-update.yml:35-37` takes the channel as an input, and has a third action, promote a beta update group to production.
- «Testing … the updates block names the AppConfig's channel»: the block names no channel (`apps/mobile/app.config.ts:311-345`).
- The title «…ship on the app's one channel» contradicts the note two lines below it. The summary is right.

Proposed action: amend. Replace the section with: «Two Update channels, `beta` and `production`, each named by its store build profile in `eas.json`; the app config names none (ADR 0167). The `ota-update` workflow takes the channel, a Rollout share and publishes, widens or promotes a beta update group to production.» Retitle «OTA updates are signed and ship on the build's Update channel». Or merge 0167 into 0062, if 0167 holds nothing else.

### 4. ADR 0007 and 0065: «one build profile per platform» and «one Update channel» (CONFIRMED)

- 0007, last paragraph: «one store build of the app, from one build profile per platform, and an OTA update reaches every Edition at once on the app's one Update channel», against its own «Amended by ADR 0167» note and `app/app.json:13` (`"release": { "beta": "beta", "production": "production" }`), `apps/mobile/eas.json:15-31`.
- 0065: «every build of the app bundles it, from one build profile per platform» (same evidence), and «The id also names … the Update channel (ADR 0062)»: no channel is named `uk`.
- 0007 and 0065 repeat each other on «one app, every Edition inside, no build names an Edition».

Proposed action: amend both. 0007: «…ships as one store build per Update channel (`beta`, `production`, ADR 0167), and an OTA update reaches every Edition at once on its channel». 0065: «from one store build profile per Update channel» and drop «the Update channel (ADR 0062)» from the list of what the id names. The first two paragraphs of 0007 could merge into 0065; then 0007 can be retired.

### 5. ADR 0006: Core fonts, the sound reader's path and the Update channel (CONFIRMED)

- «`packages/ui/assets/fonts/` holds the Core's own font files while any remain, and `packages/ui/src/fonts.ts` is the one place that names that folder (`coreFonts()`) … `app.config.ts` embeds the Core's fonts, then the Edition's own»: the folder, the file and `coreFonts` do not exist; `apps/mobile/app.config.ts:446-447` embeds the Edition's fonts only («the Core brings none»). `.dependency-cruiser.mjs:237` still lists `fonts` among entry points.
- «the header reader … sits next to it (`apps/mobile/notification-sound.ts`)»: it is `apps/mobile/plugins/notification-sound.ts` (`apps/mobile/app.config.ts:14,50`).
- «No app identity. The app's name … Update channel and build profiles … live in the AppConfig, `app/app.json`»: the Update channel is not there (finding 3).
- Considered Options «Core fonts in each Edition's folder: rejected» and «A Core font package of its own: rejected» argue about files that are gone.

Proposed action: amend. «The Core brings no font: its tokens name no family, and `app.config.ts` embeds the Edition's fonts only.» Fix the path to `apps/mobile/plugins/notification-sound.ts`; drop «Update channel» from the AppConfig list; drop the two font options.

### 6. ADR 0041: «tombstones included» and «kept for good» against its own amendment (CONFIRMED)

«Tombstones are kept for good» and «An Account keeps at most 20 000 records per Edition, tombstones included» stand next to «Amended by ADR 0205. A tombstone does not count … the backend keeps the latest 20 000 tombstones». The code follows 0205: `packages/server-core/src/sync/sync.ts:14-21`.

Proposed action: amend in place. «The backend keeps the latest 20 000 tombstones of an Account in an Edition (ADR 0205)» and «at most 20 000 records per Edition, a tombstone not one»; then the amendment paragraph can go.

### 7. ADR 0013: the lists of marks have drifted from `records.ts` (CONFIRMED)

- «`union` keeps every device's records: the Active Days»: also the XP log, the XP days (`packages/core/src/progress/records.ts:153,162`), the Corrections worked through and the Curated Collections opened (`packages/core/src/dashboard/records.ts:13,21`).
- The `device-only` list misses the sounds setting, the privacy switch, «Менше руху» (`packages/core/src/settings/records.ts:47,86,92`), the Install id (`packages/core/src/edition/records.ts:41`), the questionnaire, Community Counters and Mistake Report records.
- «the Daily Limit and the other synced settings»: the Daily Limit is retired (`CONTEXT.md:472`); its record stays declared only for older apps (`packages/core/src/settings/records.ts:94-98`).

Proposed action: amend. Replace the three enumerations with the rule and one example each, and «the marks are declared in each domain's `records.ts`»; a list in an ADR goes stale with every new record.

### 8. ADR 0031: the summary's admin rule is not in the body; the router list is old (CONFIRMED)

- `summary:` ends «admin inputs are strict and may narrow»; the body never mentions the admin. The rule is in code: `packages/contracts/src/api/breaking-changes.ts:360-369` (an admin input may narrow, an admin procedure may go, an admin strict output may gain a field, a retired Feature Switch may leave an admin `states`).
- «The contract has one router per domain (`account`, `content`, `edition`, `sync`)»: there are eight (`packages/contracts/src/api.ts:44-51`: also `admin`, `collectionLinks`, `counters`, `reports`).

Proposed action: amend. Add: «The admin's paths (`/v1/admin/`) are the exception: the admin and the Агент tooling ship with the backend, so an admin input may narrow and an admin procedure may go.» Drop the list of routers.

### 9. ADR 0047: the Apple client id's source and the retired `AccountApi` port (CONFIRMED)

- «Apple's client id is the Edition's bundle id, which the backend already knows from the Edition's config» contradicts the same ADR two paragraphs above («the app's bundle id from the AppConfig»), ADR 0006 (the Edition config refuses a bundle id) and the code: `apps/backend/src/app.ts:263` (`bundleId: appConfig.bundleId`).
- «`AccountApi` gains `signInWithApple`», «a `GoogleSignInSheet` port beside `AccountApi`», «a fake Account API in `@slovo/core/testing`»: ADR 0064 replaced the eight ports with the one `Backend` port; `AccountApi` is in no code (only the derived type `AccountApiFailure`, `packages/core/src/account/account-requests.ts:8`).
- ADR 0030's limits table has no row for Apple; the code has one (`packages/server-core/src/account/sign-in-limits.ts:28`, `appleSignInsPerIp`, 30 in 10 minutes), and 0047 names only Google's limit.

Proposed action: amend. «Apple's client id is the app's bundle id from the AppConfig»; «the Account module calls `account.signInWithGoogle` and `account.signInWithApple` through the Backend port (ADR 0064)»; add «Apple sign-ins per IP: 30 in 10 minutes» to the table of 0030.

### 10. ADR 0088: «no list of Accounts» against the Accounts block of Безпека (CONFIRMED)

Consequences: «no list of Accounts, as before»; body: «it shows aggregates only, never a list of people». The admin lists and opens readers' Accounts and deletes one: `packages/contracts/src/api/admin.ts:1274,1300,1313` (`/admin/accounts`, `/admin/accounts/{accountId}`, `/admin/accounts/{email}/delete`), `apps/admin/src/routes/security.tsx:378` («Акаунти читачів»), `apps/admin/src/routes/security_.accounts.$accountId.tsx`, `packages/server-core/src/account/accounts.ts:280-285`. ADR 0204 presupposes the deletion, yet no ADR in the index records the decision to show Accounts by email to an admin, which is a privacy decision.

Proposed action: amend 0088 (or a short new ADR, since this is one an owner could argue about later): «Безпека lists readers' Accounts (email, search, one Account's page) for the Власник and deletes one with a reason into the Action log (ADR 0204); analytics still show aggregates only.»

### 11. ADR 0089: dependencies «stay in the Core»; the body's rule fields lack the Update channel (CONFIRMED)

- «Dependencies stay in the Core. The Core's Edition module holds the one list of dependencies» contradicts ADR 0199 and the code: the list is derived from the catalogue in the contracts (`packages/contracts/src/feature-switch-dependencies.ts:4-13`).
- `summary:` lists «Update channel» among what a Rule targets; the body's «Rules» bullet does not. The code has it: `packages/contracts/src/feature-switch-rules.ts:73-74`.

Proposed action: amend. «The dependencies are declared in the Feature Switch catalogue of the contracts (ADR 0199); `isFeatureEnabled` applies them to the answer in effect.» Add «the Update channel (`beta`, `production`)» to the Rules bullet.

### 12. ADR 0090: the summary keeps the server-rendered site the body withdrew; three body lines are overtaken (CONFIRMED)

- `summary:` says «the site renders on the server on Pages from the API with a ~5 min cache and Слово дня by the Kyiv date». The body's second paragraph says the opposite («built daily from the content snapshot instead of rendering on a server, and picks its own Слово дня»), and so does the code: `.github/workflows/pages.yml:30-34` (two daily `schedule` runs), `apps/site/astro.config.*` has no server adapter. The body's «The site» bullet still says «Astro on Cloudflare Pages renders on the server per visit», against ADR 0049 (GitHub Pages) too.
- «Recordings stay app assets» and «A Word changed in text or stress loses Pronunciation until the next build with a new Recording»: ADR 0099 moved Recordings to the Media Store, generated hourly (`.railway/railway.ts:107`), the device voice reading until then.
- «The repo files go … stay read-only after the import until …»: done; `editions/uk/content` and `publish-pack` do not exist, the `content_packs` table is dropped (`apps/backend/migrations/0016_drop_content_packs.sql:1`).

Proposed action: amend. Summary: «the site is a static Astro build on GitHub Pages, rebuilt daily from the content snapshot, with its own Слово дня». Rewrite the «The site» bullet the same way, drop «Recordings stay app assets», point «Needs new recording» at ADR 0099 and cut the finished migration steps to one sentence.

### 13. ADR 0063 and 0030: sentences about publishing a pack, which is gone (CONFIRMED)

- 0063: «The Language Pack is published to the Deployment with the existing publish command, which writes to the database `DATABASE_URL` names».
- 0030: «Publishing a pack asks only that the Edition was found.»
- 0063: «A Railway config names the release command and the health route»: it is `.railway/railway.ts:31-32` now (ADR 0103), no `railway.json`.

No publish command exists (`git grep 'publish-pack'` finds only old migrations); ADR 0090 removed it.

Proposed action: amend both: delete the two sentences; in 0063 say «`.railway/railway.ts` (ADR 0103) names the release command and the health route».

### 14. ADR 0044: «the TestFlight profile» (CONFIRMED)

«the TestFlight profile raises it on every build (`autoIncrement`)» and «before each TestFlight build»: there is no `testflight` profile; `beta` and `production` both raise it (`apps/mobile/eas.json:17-31`, ADR 0167).

Proposed action: amend: «the store build profiles (`beta`, `production`) raise it on every build».

### 15. ADR 0099: the summary's last sentence is not in the body (CONFIRMED)

`summary:` ends «The Recordings service runs on 2 vCPU and 5 GB, its generator on two threads»; the body says nothing of it. The code has it (`.railway/railway.ts:105-108`). It is a size, not a decision.

Proposed action: amend: drop the sentence from the summary (the comment in `.railway/railway.ts` holds it).

### 16. ADR 0103: a wrong cross-reference, and the staging environment (CONFIRMED)

- «`TRUSTED_PROXY_HOPS` … changes from `1` to `2` once Cloudflare is in front (ADR 0099)»: the decision is ADR 0125 (0063's amendment names it); 0099 says nothing about proxy hops.
- The file now also declares the `staging` environment (`.railway/railway.ts:4,133`, ADR 0168); the ADR and its summary know one project of four services.

Proposed action: amend: «(ADR 0125)»; add «and the `staging` environment (ADR 0168)».

### 17. ADR 0094: binds only content not yet rewritten (PLAUSIBLE)

The ADR's own note and summary say its rules bind only Entries not yet rewritten under ADR 0146. Such content still exists in the seed (`editions/uk/seed-snapshot.json` has records with `sources` of goroh, СУМ and Янко), and the terms still name the dictionaries (`editions/uk/legal/terms.md:38-40`), so it is in force today. The live database could not be read from here.

Proposed action: keep until the ADR 0146 rewrite pass is done; then retire it in the same change that rewrites «Джерела» (0146 already says that section changes).

### 18. ADR 0003: no longer a decision of its own (PLAUSIBLE)

Five lines; everything it says is restated and carried further by 0030 (our own backend, one Postgres), 0063 (the container on Railway, local Docker) and 0064. The code matches it. Only its Considered Options (Supabase, Firebase) are not elsewhere, and 0063 already repeats the first.

Proposed action: merge into 0030 (move the two rejected options there), or keep; the owner's call.

## Checked, no defect

0001, 0004, 0048, 0049, 0064, 0068.

Notes on these: 0004's «checks the four tabs» repeats the flow's own comment (`apps/mobile/maestro/launch.yaml:2`) while ADR 0201 has five tabs; the flow's assertions were not read. 0049's workflow now runs on more paths and on a schedule (`.github/workflows/pages.yml:18-34`); the ADR's rule holds.

Sound apart from the findings above: 0030 (sign-in limits, Session life, body limit, trusted hops, server Core boundary all match the code), 0063, 0065, 0088 (sign-in numbers, roles, sections, the boundary rule, alert defaults match), 0089 (2-minute fetch, `rarityCeiling`, region), 0099 (prefetch 20, 100 MB, 30 days, `s-maxage=60`, CI on a Postgres container), 0103.

## Not finished

- 0004: the 15 builds a month of the EAS free tier and the laptop's Xcode are outside the repository.
- 0044: whether `version: '0.9'` (`apps/mobile/app.config.ts:406`) is still the milestone the code on `main` belongs to; the milestones were not read (issues stay untouched).
- 0048: the Sentry project's own settings (no IP stored, scrubbing) are the owner's.
- 0062: signing, the launch timeout of 3 s and the fingerprint were read in `app.config.ts`; the About screen's lines were not compared with the ADR word by word (it now also shows a channel line, `apps/mobile/src/settings/about-screen.tsx:82-84`).
- 0088: the action log's coverage of every write, the Vite proxy and `--mock` fixtures, `docs/deploy.md` rows.
- 0090: the Patch transaction under the open reader, the batch rollback rules and the Content queue were not traced in code.
- 0013, 0041: the merge invariants, the first-sign-in rule and the Sync moments were not traced line by line; only the marks, limits and constants were.
