# Content updates ship whole Language Packs

Until 0.7 the Language Pack shipped inside the app, so a new Word, a corrected Definition or a Retired Word reached a reader only with the next App Store build. 0.7 brings Content updates: a newer Language Pack of the Edition that the app downloads by itself, without an Account, and opens from the next launch. What travels, how the backend keeps it and how the owner hands it over had to be decided before the app could ask for one.

A Content update is the Edition's whole Language Pack of a newer content version, the file `pnpm build:pack` builds, not a delta of Entries:

- **Whole packs.** The app already opens packs, so there is no merge logic on the device and nothing to get wrong between two versions. The cost is downloading the whole pack (about 2 MB) for any change, at most once a day.
- **The pack format.** The pack's metadata records a pack format beside the content version and the content checksum (1 for today's layout). It rises only when the layout changes in a way an older app can't read. The app asks for the newest pack of the highest format it reads, and the backend answers with the newest pack published in that format, or none, so a pack in a new format never reaches an app that can't read it.
- **Two checksums.** The content checksum stays as ADR 0011 defines it. Publishing also records the SHA-256 of the pack file, which `content.latest` announces with its size and which the app checks after downloading; a download that fails the check is thrown away.
- **Storage in Postgres.** Each published pack is one row of `content_packs` with the bytes of the file, partitioned by `edition_id` (ADR 0030). A row is never updated: a content version, once published, is immutable.
- **One local publish command.** `pnpm publish:pack <edition-id>` publishes the Edition's built pack. It reads the pack's metadata, computes the file's SHA-256 and size, and stores the row. The rules live in the server Core's `content` domain: it refuses a pack of an Edition the backend doesn't find, a pack whose content checksum isn't the one the Edition's `content/manifest.json` records (a pack built before the content changed, or a pack of another Edition), a content version not higher than one already published for the Edition, in any pack format, and a version already published. So two different packs never share a content version (ADR 0011). The Drizzle adapter of the `ContentPackStore` port runs the check against the published versions and the insert in one transaction, under a lock per Edition, so two publishings of one Edition never pass the check together; the server Core never sees the transaction. Publishing from CI waits for a deployed server (0.9).
- **Serving the file.** `content.download` answers the file of an Edition's pack by content version. Since a published version never changes, the server Core reads its file from the `ContentPackStore` once and keeps it in memory, and downloads that arrive while it is being read wait for that one read, so a release that every device downloads at once reads the row once. The answer carries the file's SHA-256 as its ETag and `Cache-Control: immutable`; a request whose `If-None-Match` names the ETag gets 304 without the bytes. An Edition with the `contentUpdates` Feature Switch off is `NOT_FOUND` for `content.latest` and `content.download` alike, as an Edition the backend doesn't find.
- **Opening at the next launch.** A downloaded pack never opens under the reader's finger: the pack never changes while it is open (ADR 0015). At launch, before the Language Pack opens, the app opens the newer of the pack bundled with it and the downloaded one, among the formats it reads, so an App Store update that ships newer content never goes back to an older download.

Entry ids never change meaning (ADR 0010), so Favorites, Collections, History, Hidden Entries and the Mix carry over to the new pack, and a Category new in the pack joins a Mix that follows the Edition's default (ADR 0019, 0033).

## Considered Options

- **Deltas of Entries**: rejected. The app would need merge logic for every kind of change, Retired Words included, and a broken merge would corrupt the content a reader has. The pack is small enough to send whole.
- **Packs in object storage**: rejected for now. One backend instance and packs of a few megabytes need none; it returns when packs grow too large for a row or there are several instances.
- **Overwrite a published version**: rejected. Two devices could hold different packs under one content version, which ADR 0011 rules out.
- **The rules of publishing in the adapter**: rejected. The server Core holds the backend's rules (ADR 0030); the adapter only keeps them atomic.

## Amendment: the shell opens the chosen pack, and a client without the file system keeps content updates off (0.7, #347)

The Language Pack's opening (ADR 0036) now opens the pack of the app run with `openLaunchPack` (`apps/mobile/src/content-update/launch-pack.ts`). It opens the bundled pack first, since the Content update module needs its version, and then, when content updates are on, asks the module's `choosePack`. When the kept pack wins, it opens it through `openPack` like the bundled one, so a pack of another Edition is refused, and closes the bundled one. A kept pack that fails to open is forgotten and the bundled one opens; the next due check downloads a pack again. The opening is ready with the reader and the Content update module, which the lifecycle adapter asks to check at launch and on each return to the foreground; the module limits the checks to one a day.

Content updates are on only when the Edition's `contentUpdates` Feature Switch is on and the native-modules check reports `expo-file-system`, which keeps the downloaded pack. Otherwise, or when the module fails to open, the bundled pack opens as before content updates, so a development client built before the 0.6 native batch starts as it did.

The `PackFiles` adapter keeps each downloaded pack as its own file, named by its content version, in `content-update/` in the app's documents directory, with a record of the kept one's version beside it. Keeping a newer pack writes a new file and never touches the file of the pack open in this run; the files of older packs are thrown away at the next launch, before a pack opens. The file comes from the contract's client as a `Blob`, read with `FileReader`, since React Native's `Blob` has no `arrayBuffer()`.

### Considered Options

- **Copy the kept pack over the bundled one's file at launch**: rejected. The bundled pack is copied into place on every launch, so the app always has the pack it shipped with, and a copy of 2 MB on every launch costs time the splash would show.
- **Turn content updates on without the file-system module, keeping the pack in memory**: rejected. A pack that opens from the next launch must outlive the app run.

## Amendment: the Content update module opens the kept pack and forgets one that fails (after 0.7, architecture review 2)

The decision stands; what moved is who carries it out. The shell held the `PackFiles` port beside the Core: it read the kept pack's version again after `choosePack` answered `'kept'`, and it forgot a kept pack that failed to open. Now the Content update module's `openKept(open)` does both. At launch, once the bundled pack is open, it calls the shell's `open` with the version of the kept pack when that pack wins over the bundled one, and answers the reader, or nothing when the bundled pack stays, after forgetting any other kept pack. When `open` rejects, such as for a pack of another Edition, or the kept pack's version fails to be read, it forgets the kept pack and rejects with that failure, which the shell reports while the bundled pack stays open. A failure to forget it then is not reported: the next launch fails to open the pack again and forgets it then. The rule is tested in the Core; `openLaunchPack` only opens what the module says, closes the bundled pack when the kept one opens, and never touches `PackFiles`.

The device's `PackFiles` adapter names what it does at launch: `throwAwayAllBut(version)` throws away every pack file but the one about to open and answers where that one is, and it runs only at launch, before a kept pack opens, so the file of an open pack is never thrown away (ADR 0015); the bundled pack's file lies elsewhere.

### Considered Options

- **The choice answers the version, and a second method forgets a pack that failed to open**: rejected. The shell would have to call the two in order, so half of the rule would live in the shell again, and a shell that skipped the second call would keep a pack that fails at every launch.
