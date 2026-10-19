# A CI macOS runner builds the simulator app and runs Maestro

ADR 0004 sends every native build to EAS, because the owner's laptop (macOS 14.5, Xcode 16.2) cannot build the current Expo SDK. ADR 0028 keeps Maestro on that laptop, because CI had no app to drive. Both reasons have changed. The repo is public, so GitHub-hosted macOS runners cost nothing, and they carry a current Xcode that builds the app for the iOS Simulator. On the laptop the full smoke flow takes 30 to 50 minutes and competes with other projects for the machine.

**A simulator build for tests may run on a CI macOS runner.** The manual workflow `.github/workflows/maestro.yml` (`workflow_dispatch` only) makes the native project with `expo prebuild`, as EAS does, and builds the development client with `xcodebuild` for the iOS Simulator, unsigned. That build is for tests on the runner and never leaves it. Release builds, device builds and the development build the owner installs stay in EAS.

**Maestro may run in CI as well as on the laptop.** The workflow boots a simulator, installs the app, starts Postgres from Homebrew (a macOS runner has no Docker), the backend and Metro, and runs `apps/mobile/maestro/launch.yaml`, which opens the app from Metro and checks the four tabs. It uploads the Maestro output, a simulator screenshot and the logs of the build, Metro and the backend as the run's artifact. The rules of ADR 0028 for which flows a PR runs, and where, stay as they are: this proves that a flow can run in CI, and a later decision may move more flows there.

**No secrets.** The workflow uses only local dev values: the same Postgres user and password as `compose.yaml` and the CI's backend job, an SMTP address nothing listens on, and an `AUTH_SECRET` made fresh with `openssl rand` on each run.

**The built app is cached by its native inputs.** The development client changes only with a native change; the JavaScript comes from Metro. So the workflow caches the built `.app` under a key made from the lockfile, the app config and its plugins, the prebuilt `ios/` folder (without the Xcode project file, whose object ids change on every prebuild), the widget's prebuilt files, the Edition's `edition.json`, assets and Decor, and the Xcode version. A run with the cache skips `pod install` and `xcodebuild`.

This amends ADR 0004 (a test build may run on a CI runner) and ADR 0028 (Maestro may run in CI).

## Considered Options

- **An EAS simulator build, downloaded by the CI run**: rejected. Each run would cost one of the 15 iOS builds a month, or need a build kept in step with the native code by hand.
- **A Release build with the JavaScript bundled in, without Metro**: rejected for now. It would not be the development client the flows are written for (`open-in-dev-client.yaml`), and the flows would need a second way to open the app.
- **Caching DerivedData and the Pods instead of the app**: rejected. A fresh checkout and install give every source a new modification time, so Xcode rebuilds most of it anyway, while a cached app skips the build entirely.

## Consequences

A native change can be checked on a simulator in CI without an EAS build and without the laptop. The first run after a native change pays the full build; later runs reuse the app. The workflow starts by hand, so the regular CI keeps its time and nothing blocks a merge on it. The runner's Xcode moves with GitHub's images, so a new image may need a fix in the workflow, and its version is part of the cache key so a new Xcode builds the app again.
