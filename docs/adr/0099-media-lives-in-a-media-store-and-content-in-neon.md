# Media lives in a Media Store behind a CDN, content in Neon

Owner grilling of 2026-11-09. With tens of thousands of Words, the Recordings of every Narrator Voice (about 8 KB per Word per voice, about 1 GB at 30 000 Words and four voices) and the Illustrations no longer fit in the app, and a Word saved in the admin waits for the next app build to get its voice. This moves media out of the app and the repo and moves the Deployment's Postgres to Neon. It amends ADR 0055, 0083 and 0090.

**Amended 2026-11-10 (#1771).** Railway has no Frankfurt region, so the backend and Neon cannot share one: the owner read the Deployment's Railway region from the dashboard as «EU West (Amsterdam, Netherlands)», and Neon runs in Frankfurt, about 10 ms away. The Patch route answers `cache-control: public, max-age=0, s-maxage=60`: the CDN keeps a Patch for a minute under its URL (the Edition, the device's content version and the Patch format), the device revalidates it by its ETag and still gets 304, and an edit reaches every device within that minute with no purge.

**Decision.**

- **Content in Neon.** The Deployment's Postgres (ADR 0090) runs on Neon in Frankfurt (`aws-eu-central-1`), beside the backend on Railway in EU West, Amsterdam. Neon gives a database branch per pull request and point-in-time restore; it scales to zero while idle, which costs about half a second on the first query after sleep. The backend stays on Railway (ADR 0063). The CDN caches the Patch responses, keyed by Edition and content version, so most devices never reach the database.
- **Media in a Media Store.** Recordings and Illustrations live in Cloudflare R2, served to devices through Cloudflare's CDN at public, immutable URLs: `recordings/<voice>/<kind>/<Word id>.<hash>.mp3` and `illustrations/<Word id>.<hash>.png`, the hash taken from the file's content. Listing the bucket is closed. R2 is chosen for free egress.
- **Postgres describes, the Media Store holds.** Postgres keeps one row per media file: Word id, Narrator Voice, Recording Kind (for Recordings), hash, size and duration. A Patch carries these rows, never a file. A Recording is keyed by Word, Narrator Voice and Recording Kind.
- **Recording Kinds.** The model knows Recording Kinds from the start; the first release has one, `plain` (the Lemma in its first Stress, as ADR 0083 records it). A later Kind (such as slow by syllables, or in a sentence) is new files and its own Feature Switch, not a new schema.
- **Recordings are generated on the Deployment.** An hourly Railway Cron command, like the quote check (ADR 0095), generates the missing Recordings of new and changed live Words in every declared voice and Kind with ukrainian-tts, uploads them and writes their rows. It replaces the `Recordings` GitHub workflow of ADR 0083. Until a Word has its Recording, the device voice reads it, as before.
- **Old files.** A file a changed Word no longer names stays in the Media Store for 30 days, for apps that still hold its row, and is then deleted.
- **On the device.** The app downloads the media of the next 20 Feed cards ahead, on any network, in the chosen Narrator Voice only, and keeps what it played or showed in a media cache of at most 100 MB, the least recently used file evicted first. A tap on a Recording not yet cached downloads and plays it; offline, the device voice reads the Word.
- **Starter Media.** The app bundles the Recordings in the default Narrator Voice (UA: Оксана) of the first 300 Words of the default Mix, the sample Word in every voice (ADR 0083), and the Illustrations of those 300 Words, so a first launch works offline.
- **Switches.** No new Feature Switch: where media lives is not a feature. `narratorVoice`, `pronunciation` and `illustrations` keep their meaning.
- **The repo.** The 7 972 Recordings in `editions/uk/assets/recordings/` move to the Media Store once and leave the repo, except the Starter Media. Illustration sources and the build's checks of ADR 0055 (PNG, square, at most 150 KB, one for both Themes) stay; the checks run where an Illustration is saved.

**Consequences.**

- ADR 0083: «all voices ship inside the app as JS assets» and «a Content update carries no audio» no longer hold; a new Word gets its voice within the hour. Its generation workflow, `tools/recordings/request.json` and the per-voice `texts.json` go to the Deployment.
- ADR 0055: Illustrations are no longer Edition assets bundled in the app, except the Starter Media; a Word's `illustration` field becomes its media row.
- ADR 0090: the Deployment's Postgres is on Neon; the Patch route is cached by the CDN.
- Offline-first (ADR 0041) holds for text in full and for media through the cache and the Starter Media.
- Two more vendors (Neon, Cloudflare R2); their keys live in the Deployment's environment. The media domain (`media.<domain>`) waits for the domain choice; until then the Media Store serves on a temporary address and nothing ships to the App Store.
- Deferred by the owner: rate limiting and other anti-copy measures, further Recording Kinds, who draws Illustrations and in what style.

**Considered options.**

- **Media bundled in the app, as now**: rejected. About 1 GB at 30 000 Words, and new Words wait for a build.
- **Media in the Language Pack or the Patch**: rejected, as in ADR 0055 and 0083.
- **Amazon S3 with CloudFront**: rejected. It charges for egress, which grows with readers.
- **The Railway disk**: rejected. No CDN, and the disk is bound to one container.
- **Signed, expiring URLs**: rejected. The content is not secret, a scraper can take tickets through the app, and signed URLs cache worse and need the backend online.
- **Postgres on Railway**: rejected for Neon's database branches and point-in-time restore, at a similar price.
- **A whole voice bundled**: rejected. About 250 MB per voice at 30 000 Words.
