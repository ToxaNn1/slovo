# The app version follows the release

The app's version, `version` in `apps/mobile/app.config.ts`, is the version of the release the code on `main` belongs to: the milestone (`0.1` to `1.0`), such as `0.8.6`, `0.8.7`, `0.9` and `1.0`. When the work moves on to the next milestone, the version moves with it. The native build gets the version from the app config, and About shows it («Версія 0.9 · збірка 42»). It stayed `0.1.0` from the first build until 0.8.6, so About named a version long gone.

The build number is EAS's (`appVersionSource: remote` in `eas.json`): the TestFlight profile raises it on every build (`autoIncrement`), since App Store Connect refuses an upload whose build number it has seen, and the version stays the app config's.

The rule covers the app version only. The content version of a Language Pack follows its content checksum (ADR 0011). The `version` fields of the workspace `package.json` files are not published and stay `0.0.0`.

## Considered Options

- **Keep one fixed version until the store release**: rejected. About and the builds made before it would all name the same stale version.
- **Keep the build number in the app config (`appVersionSource: local`)**: rejected at 0.9. EAS would have to write the raised number back into the config, and `app.config.ts` is code it cannot write; a number raised by hand is one more step to forget before each TestFlight build.
- **Raise the version for each native build only**: rejected. Builds are batched (ADR 0004), so the version would say little about the code a build runs.
