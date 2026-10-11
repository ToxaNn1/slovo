# Native builds run in EAS cloud, not locally

The development machine is a work laptop pinned to macOS Sonoma 14.5 and Xcode 16.2. That combination can only build Expo SDK 54 locally, and its builds can't be uploaded to the App Store, which has required Xcode 26 since April 2026. So native binaries, including the simulator development build and the widget extension, are built in EAS Build. JavaScript work happens locally against that prebuilt development client. Only native changes cost a cloud build, and the free tier allows 15 iOS builds a month.

## Consequences

Native changes are slow to iterate on, so they should be batched. If the laptop is ever upgraded to macOS Tahoe with Xcode 26.4+, local builds become possible and this ADR can be superseded.
