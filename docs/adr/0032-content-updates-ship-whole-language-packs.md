# Content updates ship whole Language Packs

Until 0.7 the Language Pack shipped inside the app, so a new Word, a corrected Definition or a Retired Word reached a reader only with the next App Store build. 0.7 brings Content updates: a newer Language Pack of the Edition that the app downloads by itself, without an Account, and opens from the next launch. What travels, how the backend keeps it and how the owner hands it over had to be decided before the app could ask for one.

A Content update is the Edition's whole Language Pack of a newer content version, the file `pnpm build:pack` builds, not a delta of Entries:

- **Whole packs.** The app already opens packs, so there is no merge logic on the device and nothing to get wrong between two versions. The cost is downloading the whole pack (about 2 MB) for any change, at most once a day.
- **The pack format.** The pack's metadata records a pack format beside the content version and the content checksum (1 for today's layout). It rises only when the layout changes in a way an older app can't read. The app asks for the newest pack of the highest format it reads, and the backend answers with the newest pack published in that format, or none, so a pack in a new format never reaches an app that can't read it.
- **Two checksums.** The content checksum stays as ADR 0011 defines it. Publishing also records the SHA-256 of the pack file, which `content.latest` announces with its size and which the app checks after downloading; a download that fails the check is thrown away.
- **Storage in Postgres.** Each published pack is one row of `content_packs` with the bytes of the file, partitioned by `edition_id` (ADR 0030). A row is never updated: a content version, once published, is immutable.
- **One local publish command.** `pnpm publish:pack <edition-id>` publishes the Edition's built pack. It reads the pack's metadata, computes the file's SHA-256 and size, and stores the row. The rules live in the server Core's `content` domain: it refuses a pack of an Edition the backend doesn't find, a pack whose content checksum isn't the one the Edition's `content/manifest.json` records (a pack built before the content changed, or a pack of another Edition), a content version not higher than one already published for the Edition, in any pack format, and a version already published. So two different packs never share a content version (ADR 0011). The Drizzle adapter of the `ContentPackStore` port runs the check against the published versions and the insert in one transaction, under a lock per Edition, so two publishings of one Edition never pass the check together; the server Core never sees the transaction. Publishing from CI waits for a deployed server (0.9).
- **Opening at the next launch.** A downloaded pack never opens under the reader's finger: the pack never changes while it is open (ADR 0015). At launch, before the Language Pack opens, the app opens the newer of the pack bundled with it and the downloaded one, among the formats it reads, so an App Store update that ships newer content never goes back to an older download.

Entry ids never change meaning (ADR 0010), so Favorites, Collections, History, Hidden Entries and the Mix carry over to the new pack, and a Category new in the pack joins a Mix that follows the Edition's default (ADR 0019, 0033).

## Considered Options

- **Deltas of Entries**: rejected. The app would need merge logic for every kind of change, Retired Words included, and a broken merge would corrupt the content a reader has. The pack is small enough to send whole.
- **Packs in object storage**: rejected for now. One backend instance and packs of a few megabytes need none; it returns when packs grow too large for a row or there are several instances.
- **Overwrite a published version**: rejected. Two devices could hold different packs under one content version, which ADR 0011 rules out.
- **The rules of publishing in the adapter**: rejected. The server Core holds the backend's rules (ADR 0030); the adapter only keeps them atomic.
