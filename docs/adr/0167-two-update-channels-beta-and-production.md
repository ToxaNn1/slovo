# Two Update channels, beta and production, each bound to its store build profile

Owner decision of 2026-11-17 (spec #1961). ADR 0062 gives the app one Update channel, `updateChannel` in the AppConfig (`uk`), and ADR 0007 one build and one channel for the one app, so a JavaScript update published to test it reaches every reader at once. This ADR amends ADR 0007 and ADR 0062: the app gets a second channel for the owner and one more tester.

**Two Update channels: `production` for readers, `beta` for testers.** The names are fixed in the contracts (`UpdateChannelSchema`), not named after an Edition: channels are per app, never per Edition (ADR 0065), and `updateChannel` leaves the AppConfig. An update is published to one channel; a tested `beta` update reaches readers by being promoted to `production` (spec #1961).

**Each store build profile names its channel.** `eas.json` has the store profiles `beta` and `production`, each with its `channel`, both built from the EAS `production` environment, so the `beta` build talks to the production Deployment by default; the `testflight` profile goes, and the development profile stays without a channel. The AppConfig's `buildProfiles.ios.release` names the store profile of each channel. The channel comes from the build profile, never from the Core (ADR 0006).

**The channel stays out of the fingerprinted app config.** EAS writes the profile's channel into the native project (`Expo.plist`, which `.fingerprintignore` leaves out) when it builds, so the app config carries no `expo-channel-name` header and `beta` and `production` give the same config, and the same fingerprint, for the same native code (ADR 0062 holds). One native build of each profile is needed, but one update group can serve both, since both share the runtime version.

**A release refuses a missing or unknown channel.** The app config reads the current profile's `channel` from `eas.json` and refuses a release build whose profile names none or one that is neither `beta` nor `production`, so no store build listens to a channel nobody publishes to.

**The app reads its channel once, at the device facts.** `deviceFacts` (`apps/mobile/src/device/device-facts.ts`), which carries the app version and platform to the Rules and the force-update minimums, also carries `updateChannel`, the channel `expo-updates` reports, parsed with `UpdateChannelSchema`; it is undefined in a development build, under Metro or on a binary without `expo-updates`. About («Про застосунок») shows it beside the version, build and update id («Канал оновлень {channel}»), so a bug report names the channel too.

**Testing.** Vitest: each store profile in `eas.json` is bound to its channel and the development one to none; the app config refuses a release with no or an unknown channel and gives `beta`, `production`, the development profile and Metro the same JSON config. Jest: About shows the channel. Whether a build listens to its channel is the owner's check on the first store builds (ADR 0004).

## Considered Options

- **The channel in the app config** (`updates.requestHeaders` or `extra`): rejected. The fingerprint hashes the app config, so the two profiles would get different runtime versions for the same native code, and the laptop, with no profile, would compute a third (ADR 0062).
- **A channel per Edition**: rejected by ADR 0065; every Edition ships in the one app.
- **One channel with a small Rollout share for testing**: rejected. A share is random readers, not the testers, and a broken update still reaches readers.
