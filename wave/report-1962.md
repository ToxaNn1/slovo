# #1962 notes
- Channel delivery: `channel` in each eas.json store profile (`beta`, `production`); app config carries no `expo-channel-name` header (EAS writes the channel into Expo.plist at build), so all profiles give the same JSON config -> one fingerprint (ADR 0062). Release build reads its profile's channel from eas.json and throws when missing / not beta|production.
- AppConfig: `updateChannel` removed; `buildProfiles.ios.release` is now `{ beta, production }` (profile per channel). `UpdateChannelSchema`/`UpdateChannel` exported from @slovo/contracts (for #1965's Rule target).
- App seam: `deviceFacts.updateChannel` (apps/mobile/src/device/device-facts.ts), lazy getter, read once from expo-updates `channel`, parsed with UpdateChannelSchema; undefined in dev/Metro.
- About: new string `settings.about.channelLine` «Канал оновлень {channel}».
- For #1963: `.github/workflows/ota-update.yml` line 122 still reads `.updateChannel` from app/app.json, which no longer exists (jq gives `null`): the workflow must take the channel as its input. Left untouched (hot file of #1963).
- Flake: `pnpm turbo ... test` for @slovo/mobile failed twice under parallel load, passed alone and with --force; failing test not identified.
