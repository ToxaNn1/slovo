# The content version follows the content checksum

`content/manifest.json` records the content version together with the checksum of the pack built at that version. The Language Pack build fails when the checksum of the content no longer matches, so a content change that leaves the version behind fails CI, and two different packs never share one version. `pnpm build:pack <edition-id> --record` raises the version by one and records the new checksum; it leaves both alone when the content is unchanged.

The checksum covers the version, so copying a new checksum without raising the version still fails the build. A version may skip numbers when the content is recorded several times before it ships; only its growth matters to over-the-air updates (0.7).

## Considered Options

- **Derive the version from the checksum or the commit**: rejected. Over-the-air updates need a number that grows, which neither gives.
- **Raise the version on release only**: rejected. Nothing would tie the version to the content between releases, which is the gap this closes.

## Amendment: the content checksum is named for the content (before 0.7)

Content updates (0.7) bring a second checksum, the SHA-256 of the pack file, which changes with the pack's layout as well as its content. So the checksum this decision records is the content checksum: `contentChecksum` in `content/manifest.json`, in the pack metadata of `@slovo/contracts` and in the code that reads either. The pack's `metadata` table keeps its key `checksum`, so the layout of a pack, and the file built from unchanged content, stay as they were; only the Language Pack package names that key.

### Considered Options

- **Rename the table key to `content_checksum` too**: rejected. It changes the layout for a name only the package that reads the layout ever sees.
