# The content version follows the content checksum

`content/manifest.json` records the content version together with the content checksum (`contentChecksum`) of the pack built at that version. The Language Pack build fails when the content checksum no longer matches, so a content change that leaves the version behind fails CI, and two different packs never share one version. `pnpm build:pack <edition-id> --record` raises the version by one and records the new checksum; it leaves both alone when the content is unchanged.

The checksum covers the version, so copying a new checksum without raising the version still fails the build. A version may skip numbers when the content is recorded several times before it ships; only its growth matters to Content updates.

The content checksum is apart from the SHA-256 of the pack file, which Content updates use and which changes with the pack's layout as well as its content. It is named `contentChecksum` in the manifest, in the pack metadata of `@slovo/contracts` and in the code that reads either; inside the pack's `metadata` table it keeps the key `checksum`, which only the Language Pack package reads.

## Considered Options

- **Derive the version from the checksum or the commit**: rejected. Content updates need a number that grows, which neither gives.
- **Raise the version on release only**: rejected. Nothing would tie the version to the content between releases.
- **Rename the table key to `content_checksum` too**: rejected. It changes the pack layout for a name only the package that reads the layout ever sees.
