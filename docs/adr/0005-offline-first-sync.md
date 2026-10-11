# Offline-first with last-write-wins sync

The app always reads and writes a local database. When it is online and the user has an Account, it syncs changes with the server in the background. Conflicts are resolved per record by last write wins, and deletions are kept as tombstones so they can't be resurrected by another device. The Streak is derived from synced Active Days, never stored, so merging two devices always gives the right number. Notification times stay per device. One Account (SLOVO ID) spans every Edition, with data partitioned per Edition.
