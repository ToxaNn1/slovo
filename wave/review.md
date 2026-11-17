# Review: feat/1961-release-channels vs origin/main

Hard rules: PASS. New workflows (ota-update, staging-deploy, staging-reset) are `workflow_dispatch` only, with no `schedule:` and no `push`. The Staging Deployment has `sleepApplication: true`, no Cron service and no pinger. The healthcheck runs only during a deploy (ADR 0168). Both store profiles get the same runtime/updates block with `policy: 'fingerprint'` (app.config.ts:263-325, ADR 0062). The secrets scan finds only test fakes (br-staging-1 in staging-tools.test.ts).
Owner rule: every commit is authored `anton <80415431+ToxaNn1@users.noreply.github.com>`, not antondemydenko113@gmail.com. Reset the authors before the push or merge (CLAUDE.md rebase --exec).

## High
1. .github/workflows/ota-update.yml:96-103: "Read the production Deployment's address" runs `eas env:exec` before `pnpm install`. Install exists only for publish (l.118-119); widen and promote never run it. eas-cli evaluates app.config.ts, which imports `tsx/cjs/api` at the top (app.config.ts:10). setup-node caches only the pnpm store, so node_modules is empty and every action fails at step 1. Promote fails a second time later: env:exec in "Fetch the code-signing key" (l.143) and update:republish both run without an install. On main, install came before every env:exec.
   Fix: `pnpm install --frozen-lockfile` unconditionally, right after setup-node.

## Medium
2. ota-update.yml:205-214: promote never checks that the source group is on `beta`. Its only guard is the free-text `[built against ` mark in the message. Groups with no mark pass: anything published on the old channel, or a group with the mark edited out. A legit message that contains the substring is refused.
   Fix: assert the branch/channel from `update:view --json` is `beta`.
3. apps/mobile/ota-plan.ts:126: `address=${plan.address}` goes into $GITHUB_OUTPUT unescaped. Validation is only startsWith('https://'). A dispatch input with a newline (API) can inject `production=true`. The staging update is then treated as a production build (PostHog key, no staging mark) and later becomes promotable (ADR 0168).
   Fix: a strict URL regex with no whitespace or control characters, or the heredoc output delimiter.

## Low
4. ota-update.yml:96: the EAS env round-trip runs for every action before the input checks. A widen gets a needless EAS-env dependency, and typos fail late. Validate the plain inputs first and read PRODUCTION_ADDRESS only when it is needed.
5. apps/mobile/app.config.ts:~287 profileChannel reads `build[profile].channel` literally and ignores eas.json `extends`. If someone dedupes the two profiles (see 6), requireReleaseChannel refuses the release build.
6. apps/mobile/eas.json:16-31: beta and production duplicate every field except `channel`. If they drift (node/pnpm), the two native builds stop being the same, which silently breaks the shared-fingerprint premise of ADR 0167. Use a shared base with `extends`, together with 5.
7. apps/mobile/ota-plan.ts:16: CHANNELS duplicates UpdateChannelSchema, held together by a sync test. The stated reason (the plan runs before install) goes away with fix 1. Then import it from @slovo/contracts.
8. .railway/railway.ts:126-128 and scripts/staging.ts:185-187: staging keeps production's ZEPTOMAIL_TOKEN/MAIL_FROM, and the reset copies production's real Accounts. A sign-in on staging mails real addresses from the production sender. ADR 0168's "sends nothing" covers only PostHog and R2, so this is a gap more than a violation. Consider refusing mail variables under DEPLOYMENT=staging, or adding a log-only mailer.
9. docs/adr/README.md:11: the index lines for 0007 and 0062 still state the single-channel decision ("one Update channel", "the app's one channel from the AppConfig") that 0167 amends. Also, docs/deploy.md says staging updates use the EAS env `development`, but the workflow uses `production` with overrides.
10. apps/backend/src/media/media-store.ts:57: publicMediaStore.head reports size 0 when Content-Length is missing (CDN chunked or compressed). No non-test caller exists today, so the risk is latent. Return an undefined size instead.
