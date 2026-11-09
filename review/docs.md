# Global consistency review: docs, ADRs, glossary, CI (SLOVO main @ bf792f89)

Read-only review, 2026-11-06. Scope: docs/adr (+ README index), CONTEXT.md, docs/agents, .github/workflows, root package.json scripts, knip/turbo/dependency-cruiser config.
Complete (the pause on machine load was resumed and every spot-check finished).

Counts: HIGH 1 · MEDIUM 4 · LOW 6 · notes 1.

---

## HIGH

### 1. The authorship / AI-attribution check is not a required check, so auto-merge ignores it
- **Where:** `.github/workflows/commitlint.yml:17-47` (job `commits`, name "Commit messages": commitlint on title and commits, then "Check the authors and that no AI attribution is left"); `CLAUDE.md:40-41` ("CI checks that every commit is the owner's and that no AI attribution is left; a PR with auto-merge on merges itself once every check is green").
- **Drift:** the `main` ruleset "green CI before merge" requires only three contexts: `Lint, typecheck, test and Language Pack`, `Backend`, `Secret scanning` (read with `gh api repos/ToxaNn1/slovo/rulesets/<id>`). GitHub auto-merge waits for required checks only, so a PR with a foreign author or a `Co-Authored-By` trailer merges while "Commit messages" is red. The `checks` aggregator in `ci.yml:152-158` also does not `need` it (it lives in another workflow).
- **Fix:** owner adds "Commit messages" to the ruleset's required status checks (GitHub settings), or the check moves into `ci.yml` and into `checks.needs`. Until then CLAUDE.md overstates what CI enforces.
- **Confidence:** confirmed.

## MEDIUM

### 2. ADR index skips 0083 without marking the gap
- **Where:** `docs/adr/README.md:86-87` (0082 → 0084); header line 3 promises "a gap is marked unused".
- **Drift:** 0083 has no line. It is reserved by the Narrator Voice spec (#1633, PR #1639, unmerged). Numbers 0034/0038 are marked `unused`; 0083 is not.
- **Fix:** add `- 0083: reserved for Narrator Voice (#1633, PR #1639).` now; the PR replaces the line.
- **Confidence:** confirmed.

### 3. ADR 0066 is amended by 0074 without saying so (Active Day definition)
- **Where:** `docs/adr/README.md` line for 0066 ("Active Day (≥5 XP) … (amends 0054)"); `docs/adr/0066-*.md` (0 mentions of 0074); `docs/adr/0074-*.md` and `CONTEXT.md:175-176` (Active Day = Daily Goal met via `goal-met`, or ≥5 XP only on a day with no goal).
- **Drift:** two ADRs in force define Active Day differently; the glossary and code (`packages/core/src/progress/streak.ts:5 ACTIVE_DAY_XP = 5` plus goal logic) follow 0074. A reader of the index or of 0066 alone gets the superseded rule.
- **Fix:** append "Active Day amended by 0074" to the 0066 index line and a one-line note at the top of 0066.
- **Confidence:** confirmed.

### 4. "Amends" are recorded one-way and unevenly
- **Where:** `docs/adr/README.md`: 0081 says it amends 0019, 0033, 0076; 0072 says it amends 0015, 0040, 0052, 0054, 0067. None of the amended lines says "amended by …" (0 hits for 0081/0072 on those lines), while 0043 ("marking amended by 0077") and 0060 ("(0068)") do carry the back-reference. Bodies: `docs/adr/0033-*.md` and `0076-*.md` have 0 mentions of 0081 (0019 has one); 0015/0040/0052/0054/0067 do mention 0072.
- **Fix:** one convention: every amended ADR's index line ends with "amended by NNNN", and the amended ADR body gets a one-line note. Add the 0081 note to 0033 and 0076.
- **Confidence:** confirmed.

### 5. Glossary _Avoid_ word «SLOVO ID» is the working name across code and docs
- **Where:** `CONTEXT.md:229` lists "SLOVO ID (the old name)" under Account's _Avoid_. Uses (tracked files, ~45): `apps/mobile/src/settings/account-screen.tsx:57,65,328`, `packages/core/src/account/account.ts:81`, `packages/core/src/sync/sync.ts:13`, `packages/core/src/composition.ts:169`, `packages/contracts/src/edition-strings/account.ts:29,46`, `packages/ui/src/account/DeleteAccountButton.tsx:7`, `apps/mobile/maestro/flows/{account,sync,settings}.yaml`, `apps/mobile/maestro/sign-in.yaml`, `README.md:157`, `docs/owner-checks.md:36`, `docs/react-native.md:8`, language-pack fixtures `edition.json` (`accountName: "SLOVO ID"`).
- **Drift:** `account-screen.test.tsx:131` asserts the UI is "never «SLOVO ID»" while its own comments call it "the SLOVO ID screen". Glossary and code disagree on the name of the screen and the Account.
- **Fix:** in comments, docs and Maestro flow comments say "the Account screen" / "the Account"; keep the literal only where it is the thing under test (fixtures, the «never SLOVO ID» test). Or, if the owner wants the name back, drop it from _Avoid_.
- **Confidence:** confirmed (wording); severity depends on how strictly _Avoid_ is enforced.

## LOW

### 6. "Ukrainian Edition" (_Avoid_, `CONTEXT.md:11`) in an ADR and tests
- `docs/adr/0070-klyn-2-rupor-is-the-apps-design.md:16` ("Rupor is the Ukrainian Edition's Mascot"), `packages/language-pack/src/build.test.ts:2215`, `packages/ui/src/entries/SwipeMarks.test.tsx:88`, `packages/ui/src/progress/ActiveDaysCalendar.test.tsx:88`, `packages/ui/src/tokens.test.ts:54` (6 hits in all, excluding the glossary).
- **Fix:** "UA Edition". **Confidence:** confirmed.

### 7. `rarityFloor` reuses the name of the removed Rarity Floor
- `packages/language-pack/src/content-targets.ts:51` (`export function rarityFloor`), `packages/language-pack/src/index.ts:12`, `tools/content/src/have.ts:14,86`. ADR 0072 removed the Rarity Floor and `CONTEXT.md:290` lists it under _Avoid_ for Rarity Ceiling; the Core drops `mix.rarityFloor` on migration (`packages/core/src/user-state-schema.ts:265-271`). The language-pack function means the per-rarity content floor of ADR 0009, a different concept.
- **Fix:** rename to `wordsPerRarityFloor` (or `perRarityTarget`). **Confidence:** confirmed name clash; plausible as a glossary violation.

### 8. `docs/agents/waves.md:3` depends on a skill the repo does not carry
- It names `/mattpocock-skills:implement-spec`. The skill is not in the repo (`.claude/` has only `hooks`, `settings*.json`, `worktrees`) and exists only in the plugin cache (`~/.claude/plugins/cache/claude-plugins-official/mattpocock-skills/1.3.1/skills/engineering/implement-spec`; 1.2.3 kept it under `in-progress/`). A cloud session or another machine without that plugin version cannot follow waves.md; the two plugin versions also differ in where the skill sits.
- **Fix:** name the plugin and version in waves.md, or copy the SLOVO-relevant steps into waves.md so the doc stands alone. **Confidence:** plausible.

### 9. ADR 0027 "the same name everywhere" vs two folder names
- `docs/adr/0027-*.md:7` "One folder per domain, the same name everywhere"; `:10` names the app's own layers `device/`, `foreground/`, `shell/`, `diagnostics/` (so `shell/` and `foreground/` are in line; the rejected option on line 29 was moving `opening` into `shell/`). `edition/`, `sync/`, `user-state/`, `widget/`, `spotlight/` exist in the Core too, so they are domain folders.
- **Drift:** (a) `apps/mobile/src/mascot/` while the Core and the UI keep the Mascot under `decor/` (ADR 0014: the Mascot is Decor); (b) `packages/ui/src/categories/` and `apps/mobile/src/categories/` while the Core has no `categories/` and keeps Category reads in `entries/` (`packages/core/src/category-reads.test.ts` even sits at the root). CONTEXT.md has no "Categories" domain heading; Category is an Entries term.
- **Fix:** `mascot/` → `decor/`; either a `categories/` folder in the Core too (and the root `category-reads*` into it) or `entries/` in the UI and the app; or amend 0027 to allow a UI/app-only domain folder.
- **Confidence:** confirmed (names), plausible (which way to fix).

### 10. "Mix toggle" in the 0082 index line
- `docs/adr/README.md` line for 0082 says "Mix toggle"; `CONTEXT.md:35` lists "Toggle" under Feature Switch's _Avoid_. Say "Mix button" (as the 0081 line does). **Confidence:** confirmed, cosmetic.

### 11. ADR 0012 citation rule is not held by any schema or build rule
- ADR 0012: Ukrainian Definitions and Examples come from goroh «Тлумачення», citing СУМ-20 or СУМ-11. `packages/contracts/src/shared.ts:28-33` `SourceSchema` is `{ title, shortName?, url?, archivedUrl? }`, free text; `git grep 'СУМ' -- tools packages/language-pack packages/contracts` (non-test) hits only `tools/sourcing/README.md` and goroh fixtures. `pnpm content verify` (0084) checks the quote against the page, not that the source is one of the two dictionaries.
- **Fix:** either a `shortName` enum (or a check rule in the pack build) for the dictionaries 0012 names, or soften 0012 to "cites the dictionary goroh names".
- **Confidence:** confirmed (no rule exists); whether a rule is wanted is the owner's call.

## Notes (no drift)
- `content verify` runs only on `pull_request` (`ci.yml:95,122,131`); ADR 0084 promises exactly that, so a push to `main` is not re-verified by design.
- `pnpm knip` is report-only (`housekeeping.yml:51 … || true`); README.md:294 says so. No `knip.json`: Knip runs on defaults.
- Required checks do include `Backend` and `Secret scanning`, which the `checks` aggregator omits; that is covered by the ruleset, not a gap.

## Verified and in line with the code (spot-checks)
0065/0006 Core has no React import (0 files) · 0029 Jest in `packages/ui`, `apps/mobile`; Vitest in `packages/core` (+ `apps/mobile/vitest.config.js` for non-UI) · 0059 `reactCompiler` on, 43 files `'use no memo'` · 0062 code signing in `app.config.ts`, `ota-update.yml` is `workflow_dispatch` only · 0028/0004 `maestro.yml` is `workflow_dispatch` only on `macos-26` · 0031 `packages/contracts/src/api/v1.openapi.json` compared with `pnpm describe:api` in CI · 0069 `/admin`, `OWNER_EMAIL` · 0056 `POST /v1/reports` · 0073 `CROSSWORD_SIZE = 5` · 0043 waits `[1, 3, 7, 30, 90]` · 0024 "at least 15" in `game.ts:380` · 0066 `ACTIVE_DAY_XP = 5` · 0078 `MARK_SHARE = 0.4`, `OFF_SCREEN = 520`, `FLY.duration = 300` (`SwipeMarks.tsx:48,54,63-66,280`) · 0075 «ти» everywhere: exactly one «ви» line in `editions/uk/strings.json:612`, the swipe hint sheet 0077 keeps · 0052 thirteen Game Modes: 12 `*-mode.ts` + `guess-word.ts` in `packages/core/src/game` · 0079/0070/0081/0082 switches `dashboard`, `dashboardWordmark`, `sounds`, `categoryScreens`, `correctionCategoryScreens`, `quietCategories`, `collectionBoardStyle` present in `editions/uk/edition.json` · 0014 `decor/decor.json` · 0035/0036/0025 `edition-folder.ts`, `opening.ts`, `game-haptics.ts` · 0009/0010/0011 `targets.json`, `ids.json`, `manifest.json` · 0048 `SENTRY_DSN` · 0063 `Dockerfile` · 0030 `pnpm deps` (17 dependency-cruiser rules) runs in the CI typecheck job · every backticked repo path in CLAUDE.md, docs/agents/*, docs/react-native.md, docs/adr/README.md, README.md exists · index ↔ ADR files: every file indexed, every link resolves.
