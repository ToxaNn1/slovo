# Owner checks

The steps only the owner can take or check, by version: accounts, consoles and devices no agent reaches.

## 0.9 build

The one native build of 0.9 goes to TestFlight (ADR 0004). It carries every native feature since 0.6, so each is checked here, on a real iPhone, once the build is installed from TestFlight.

### Before the build

1. In `editions/uk/edition.json`, set `linkDomain` and `legalDomain` to the Edition's real domains and `appleTeamId` to the Team ID the app is signed with: the release build refuses the `slovo.example` placeholder and an empty Team ID.
2. Create the app in App Store Connect (bundle id `app.slovo.uk`), set its id as `appStoreConnectAppId` in `app/app.json` and as `submit.testflight.ios.ascAppId` in `apps/mobile/eas.json` (a test keeps the two equal).
3. Turn on the Sign in with Apple, App Groups and Associated Domains capabilities for `app.slovo.uk` in the Apple Developer account.
4. Check that `apps/mobile/certs/certificate.pem`, the public certificate of OTA updates, is on `main`; its private key lives only in EAS (ADR 0062). The release build refuses to start without the certificate.
5. Set the EAS `production` environment's variables: `EXPO_PUBLIC_SLOVO_API_URL` (the backend's `https://` address; the release build refuses any other), `EXPO_PUBLIC_SENTRY_DSN` and `EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID`.
6. Build and submit from `apps/mobile`: `npx eas-cli build -p ios --profile testflight`, then `npx eas-cli submit -p ios --profile testflight --latest`. Neither needs another flag; the build number rises by itself. Install the build from TestFlight.

### Native features since 0.6

1. **Widget.** Add the SLOVO widget to the Home Screen: it shows the Word of the Day; open the Word in the app and the widget shows the ✓ («Слово дня переглянуто»). In the widget's settings, «Тло» switches between «Авто», «Світлий», «Темний» and «Пергамент», and the widget redraws in each.
2. **Notification sound.** Turn on the Word of the Day notification and wait for it with the phone not muted: it plays the Edition's own sound, not the iOS default.
3. **Calligraphic Lemma.** The Lemma on the Word of the Day card is set in the Edition's calligraphic font (Kurale), every letter and the Stress mark included.
4. **Spotlight.** Search for a Seen Word in Spotlight: it is found, and a tap opens its Entry in the app.
5. **App Intents.** Say «Слово дня в SLOVO» and «Відкрий гру в SLOVO» to Siri, and find both in the Shortcuts app: each opens the app on its screen.
6. **Collection Links.** Share a Collection; open its `https://<domain>/c/<id>` link from Notes on a phone with the app: it opens in the app and offers the copy. On a phone without the app the link opens the web page.

### OTA updates (ADR 0062)

1. About («Про застосунок») shows «Версія 0.9 · збірка {build}» with the TestFlight build number.
2. Publish a signed update to the `uk` channel; launch the app twice: it runs the update, and About shows «Оновлення {id}» with its id.
3. Publish an update signed with another key, or unsigned: the app refuses it and keeps running the code it has.
4. Publish to a share of readers, then widen the rollout with a second run: both runs reach the channel.

### Sign in with Apple and Sign in with Google

1. **Sign in with Apple on a device.** On the SLOVO ID screen, Apple's own button stands after «Увійти через Google»; tap it and dismiss Apple's sheet: the screen stays signed out with no problem. Sign in sharing the email: the screen shows the email, signed in. Sign out and sign in with a Sign-in code for the same email: the same Account opens, with the same words. Sign in with another Apple ID hiding the email: the screen shows the private relay address, and a Sign-in code to that address opens the same Account.
2. **Sign in with Google.** With the backend's `GOOGLE_CLIENT_IDS` naming the build's `EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID` (README, «Sign in with Google»), open the SLOVO ID screen and tap «Увійти через Google»: Google's own sheet opens. Dismiss it: the screen stays signed out with no problem. Tap again and sign in with a Google account: the screen shows its email, signed in. Sign out and sign in with a Sign-in code for the same email: the same Account opens, with the same words.

### Railway (ADR 0063, `docs/deploy.md`)

1. Create a Railway project and, in it, a service from this GitHub repository (branch `main`); Railway finds `railway.json` and builds the `Dockerfile`.
2. Add a Postgres service to the project.
3. Set the backend service's variables as the table of `docs/deploy.md` gives them: `DATABASE_URL=${{Postgres.DATABASE_URL}}`, `AUTH_SECRET`, the SMTP settings and `MAIL_FROM`, `GOOGLE_CLIENT_IDS`, `SENTRY_DSN` and `TRUSTED_PROXY_HOPS=1`.
4. Deploy, and check in the deploy log that the pre-deploy step printed `migrated` and the health check passed; `https://<railway address>/health` answers `{"status":"ok","migration":"…"}`.
5. Add the Edition's API domain to the service (Settings, Networking, Custom Domain), set the CNAME record Railway names at the domain's DNS, and wait for Railway's certificate; `https://<api domain>/health` answers `200`, and `http://` is never served.
6. Publish the Language Pack to the Deployment as `docs/deploy.md` describes, and check that `content.latest` announces it.
7. Request a Sign-in code from a release build of the app and check that it arrives in a real inbox.

### OTA updates (ADR 0062, `.github/workflows/ota-update.yml`)

1. Create the repository secret `EXPO_TOKEN` (an Expo access token of the account that owns the EAS project), and in the EAS environment `production` the file variable `UPDATES_PRIVATE_KEY` with visibility «sensitive», holding the private key of `apps/mobile/certs/certificate.pem`, beside the bundle's `EXPO_PUBLIC_*` variables.
2. Publish a first staged update: Actions → OTA update → Run workflow with a rollout of `10` and a message. Check that the run prints the update group and the update id, and that the EAS dashboard shows the update on the channel `uk` at 10%.
3. On a TestFlight build of the channel `uk` that receives the update, check that «Про застосунок» shows its update id after the next launch.
4. Run the workflow again with that update group and a rollout of `100`, and check that the EAS dashboard shows the update at 100%.
