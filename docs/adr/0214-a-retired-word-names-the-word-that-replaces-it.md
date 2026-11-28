---
summary: A Retired Word may name the Word that replaces it (`replacedBy`, a live Word of the Edition at the time of the write); as the composition opens, every per-Entry record of the user state moves to the replacing Word, the earlier add and the later answer winning when both hold one, idempotently, so devices converge through Sync; a Retired Entry is never among the Entries due for Review; Patch format 3 and pack format 14 stay, with a nullable pack column.
---

# A Retired Word names the Word that replaces it

Decision of 2026-11-28 (ticket #2155), proposed by the ticket; the owner confirms it with the merge.

435 Lemmas are live twice or more, and the poorer copy of each is Retired. The copy that stays has another id, so for the reader it is a new Word: no Knowledge Mark, not in Favorites, and the Feed brings it again. And a Retired Word due for Review counted in «на повторення» for good, since nothing brings it back to be answered.

## Decision

- **The link.** A Retired Word may carry `replacedBy`, the id of the Word that replaces it. Only a Retired Word carries one, and never its own id (the Word schema). It lives in the Word's fields in the content database (jsonb, no migration), in the snapshot, in the Patch and in the pack.
- **The write.** A retire may name the replacing Word (`replacedBy` of the admin `retire`, `pnpm content retire word <id> --replaced-by <id>`). The backend refuses a link, new or changed, unless the named Word is a live Word of the same Edition and another Word. The content rule `replaced-by` holds for the whole content only that the named Word exists, so a replacing Word may itself be Retired later.
- **The move.** As the Core composition opens, before any module reads the user state, every record the reader keeps of a Retired Word with a link moves to the replacing Word: Favorites, Collection entries, History, the Word of the Day archive, the Knowledge Mark, confirmed, the Review answer's day, Seen and Hidden. The composition opens after the pack does, after each applied Patch and after each sync that wrote, so each of them runs the move. A replacing Word Retired and replaced in turn is followed to the last Word; a chain that loops moves nothing. A link whose Word the pack lacks moves nothing.
- **The merge rule**, when both ids hold a record: the earlier instant for Favorites, a Collection entry, confirmed and Hidden; the later for History (with its Word of the Day flag), the Review answer's day and Seen (the higher Cycle); the Knowledge Mark answered later by its mark time, the replacing Word's own when neither tells or they tie.
- **Sync.** The move is one tracked write of deletions and records, and none when nothing is left to move. A second run changes nothing. A device still on the older pack may write the Retired id again; the record reaches the other device by Sync, whose write reopens the composition, which moves it. The devices converge on the replacing Word.
- **Due for Review.** A Retired Entry of any kind, linked or not, is never among `knowledge.state.due`, so the Feed, the Game, the Due Quiz and `progress.dueToday` leave it out. Its card, where the reader keeps it, reads as before.
- **Formats.** The Patch format stays 3: a build before the link reads a Word as an output, open to later fields (ADR 0031), and drops it. The pack gets the nullable column `words.replaced_by` under pack format 14, as with the Short Definition (ADR 0211): a build before it never reads the column, and `openPack` refuses a pack without it, so the app copies the bundled one over it.
- **No Feature Switch**: without a link nothing moves, and the data is the switch.

## Rejected

- A map of pairs apart from the Words (a table or an Edition file): a second place to keep in step with the Retired flag.
- Moving the records on the server: the user state syncs as opaque records, and a signed-out reader has no server.
- Showing the replacing Word's card in place of the Retired one without moving the records: the same Lemma would stay in Favorites twice and its Knowledge Mark apart.
- A new Patch or pack format: every build before it would refuse the content for a field it ignores.
