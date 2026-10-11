# The content version follows the content checksum

`content/manifest.json` records the content version together with the checksum of the pack built at that version. The Language Pack build fails when the checksum of the content no longer matches, so a content change that leaves the version behind fails CI, and two different packs never share one version. `pnpm build:pack <edition-id> --record` raises the version by one and records the new checksum; it leaves both alone when the content is unchanged.

The checksum covers the version, so copying a new checksum without raising the version still fails the build. A version may skip numbers when the content is recorded several times before it ships; only its growth matters to over-the-air updates (0.7).

## Considered Options

- **Derive the version from the checksum or the commit**: rejected. Over-the-air updates need a number that grows, which neither gives.
- **Raise the version on release only**: rejected. Nothing would tie the version to the content between releases, which is the gap this closes.
