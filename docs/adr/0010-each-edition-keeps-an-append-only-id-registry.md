# Each Edition keeps an append-only registry of the Entry ids it has issued

Every Entry id an Edition has ever issued is listed in `content/ids.json`, oldest first. The Language Pack build fails when a listed id has no Entry file, and when an Entry's id is not listed yet. An id therefore never becomes free again: a Word that should go is marked retired, so it stays reachable from Favorites, Collections and History, and no later Entry can take its id over. `pnpm build:pack <edition-id> --record` appends the ids of new Entries; nothing in the tooling removes one, and a line removed by hand shows up as a deletion in review.

The registry only guards the ids. Editing a Word under its id, including its Lemma, stays allowed, because ids are opaque and never derived from the Lemma.

## Considered Options

- **Compare against the last built pack**: rejected. The pack is a build artefact that is never committed, so CI has nothing to compare with.
- **Known ids in `content/manifest.json`**: rejected. The manifest changes with every content version, and a long id list there would bury that change in review.
- **Let the build add new ids by itself**: rejected. A build that edits the content it checks would hide a deleted Entry behind a regenerated list.

## Amendment: `--record` starts a registry only for an Edition never recorded (whole-project review fix, B8)

`--record` used to start a registry from the current Entry ids whenever `content/ids.json` was missing. A registry lost with an Entry file, by a bad merge or a stray `rm`, would then come back without that id and free it. Now `--record` starts a registry only while `content/manifest.json` records no `contentChecksum`, an Edition never recorded and so never shipped. An Edition recorded before fails with an error on `content/ids.json`: restore it from git.
