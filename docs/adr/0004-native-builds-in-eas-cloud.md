# Native builds run in EAS cloud, not locally

The development machine is a work laptop pinned to macOS Sonoma 14.5 and Xcode 16.2. That combination can only build Expo SDK 54 locally, and its builds can't be uploaded to the App Store, which has required Xcode 26 since April 2026. So native binaries, including the development build and the widget extension, are built in EAS Build. JavaScript work happens locally against that prebuilt development client. Only native changes cost a cloud build, and the free tier allows 15 iOS builds a month. Release builds, device builds and the development build the owner installs stay in EAS; a simulator build for tests may also run on a CI macOS runner (below).

## A CI macOS runner builds the simulator app and runs Maestro

The repo is public, so GitHub-hosted macOS runners cost nothing, and they carry a current Xcode that builds the app for the iOS Simulator. The manual workflow `.github/workflows/maestro.yml` (`workflow_dispatch` only) makes the native project with `expo prebuild`, as EAS does, and builds the development client with `xcodebuild` for the iOS Simulator, signed to run locally with no team or profile so the simulator grants it its Keychain and App Group. That build is for tests on the runner and never leaves it.

- **Maestro may run in CI as well as on the laptop.** The workflow boots a simulator, installs the app, starts Postgres from Homebrew (a macOS runner has no Docker), the backend and Metro, and runs `apps/mobile/maestro/launch.yaml`, which opens the app from Metro and checks the four tabs. It uploads the Maestro output, a simulator screenshot and the logs of the build, Metro and the backend as the run's artifact. When a flow runs stays ADR 0028's rule: the workflow starts by hand, so the regular CI keeps its time and nothing blocks a merge on it.
- **No secrets.** The workflow uses only local dev values: the same Postgres user and password as `compose.yaml` and the CI's backend job, an SMTP address nothing listens on, and an `AUTH_SECRET` made fresh with `openssl rand` on each run.
- **The built app is cached by its native inputs.** The development client changes only with a native change; the JavaScript comes from Metro. So the workflow caches the built `.app` under a key made from the lockfile, the workflow, the app config and its plugins, the prebuilt `ios/` folder (without the Xcode project file, whose object ids change on every prebuild), the widget's prebuilt files, the Edition's `edition.json`, assets and Decor, and the Xcode version. A run with the cache skips `pod install` and `xcodebuild`; the first run after a native change pays the full build. The runner's Xcode moves with GitHub's images, so a new image may need a fix in the workflow, and its version is part of the cache key so a new Xcode builds the app again.

## Considered Options

- **An EAS simulator build, downloaded by the CI run**: rejected. Each run would cost one of the 15 iOS builds a month, or need a build kept in step with the native code by hand.
- **A Release build with the JavaScript bundled in, without Metro**: rejected for now. It would not be the development client the flows are written for (`open-in-dev-client.yaml`), and the flows would need a second way to open the app.
- **Caching DerivedData and the Pods instead of the app**: rejected. A fresh checkout and install give every source a new modification time, so Xcode rebuilds most of it anyway, while a cached app skips the build entirely.

## Consequences

Native changes are slow to iterate on, so they should be batched. A native change can be checked on a simulator in CI without an EAS build and without the laptop. If the laptop is ever upgraded to macOS Tahoe with Xcode 26.4+, local builds become possible and this ADR can be superseded.
