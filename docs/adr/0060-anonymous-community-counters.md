# Anonymous Community Counters

Until 0.8.14 a reader was alone with the app: they never learned whether a word is rare for others too, or which word other readers saved this week. Spec #886 adds Community Counters under an Entry's mark buttons («Знають 3 з 5 читачів · зберегли 0») and the Community Word («Слово тижня спільноти»), the Entry most added to Favorites last week. Both must work for a reader without an Account and must not let anyone, the owner included, tell what one reader marked or saved. The decisions come from the owner's grilling of 2026-10-25 and 2026-10-26.

**Feature Switches.** `communityCounters` (the line and the events) and `communityWord` (the Feed Notice) are required of every Edition and on in the Ukrainian Edition. A feature whose switch is off is absent and sends nothing. A remote switch only turns a feature off (ADR 0040), so the owner can stop the counters at once; the backend then answers the counters' requests for that Edition as for an Edition it doesn't find (`NOT_FOUND`).

**A channel apart from Sync.** Sync (ADR 0041) keeps an Account's own records and needs a Session; the counters keep no reader's records at all. Their requests carry no Session, even when the reader is signed in, and no device id, and the backend never stores the IP address. Like the Mistake Reports' (ADR 0056), their addresses are the owner's choice of 2026-10-26 and not Edition-scoped like Sync's: the Edition travels in the body or the query.

**The server keeps aggregates only.** Per Edition and Entry: known, unknown and saved, each never below zero. Per Edition, Entry and ISO week (UTC, by the time an event arrives): the Favorites adds. There are no per-reader rows, so nothing links two changes to one reader.

**The device sends deltas.** `POST /v1/counters/events` carries the Edition and a list of events, each an Entry id with its change of known, unknown and saved, each −1, 0 or +1; it answers `202`.

- **What counts.** A new Known or Unknown mark adds one; Known → Unknown, or back, moves one; removing a mark takes one away. Adding a Favorite adds one to saved and one to the week's adds; removing it takes one from saved, while the week's adds keep counting adds. Marks set on the Yesterday card count (ADR 0054); answers in the Game never send events, though a wrong one sets an Unknown mark.
- **Only what this device counted.** The device keeps, `device-only`, what it has counted for each Entry, and sends only the difference between that and the reader's new state. It starts empty with the update, so marks and Favorites from before it are never sent, and a later change to one of them counts as new rather than taking away what was never counted. A mark or Favorite that arrives by Sync was counted, if at all, by the device it was made on.
- **Batched.** Changes wait in a `device-only` queue, merged per Entry, so a mark set and removed again sends nothing; the queue is sent at launch, on each return to the foreground and while the app is open, through the one retry rule (ADR 0037), every 5 minutes while the app is open, at most 100 Entries a request. A 429 waits for `Retry-After`, as Sync does; a batch stays offline, after a server error and for a `NOT_FOUND`, and only a request the backend refuses as malformed is dropped. A change counted while a batch is out stays for the next.
- **Limited.** 500 events a day per IP, a window of the existing rate limits keyed by the HMAC-SHA256 like them, so the `rate_limits` table names no IP (ADR 0030); a request over it answers `TOO_MANY_REQUESTS` (429) and counts nothing.

**«Ділитися анонімною статистикою»** is a `device-only` setting, on by default, with «Лише анонімні лічильники: скільки читачів знають і зберегли слово. Без акаунта й без даних пристрою.» and a link to the privacy policy under it. Off sends nothing and queues nothing: turning it off empties the queue and takes what the device counted back to what it had sent, so a change after it is turned on again counts from what the server has; the line and the Community Word still show, with the server's numbers alone. It is not synced: whether this device shares is the reader's choice for this device, and syncing it would tie the counters to an Account.

**The device reads counters.** `GET /v1/counters?edition=…&entries=…` answers known, unknown and saved for a batch of Entries, those near the current Feed card or the one on the Entry screen; an Entry nobody counted answers zeros, and more than 100 Entries is refused. The answer names no reader, so it says any cache may keep it for 24 hours (`Cache-Control: public, max-age=86400`). The device keeps each Entry's numbers for 24 hours, `device-only`, and asks again only after that. The reader's own change not yet sent is applied on top, so their mark counts at once, no count going below zero. With no numbers kept from the last 24 hours and no answer, as offline, there is no line rather than wrong zeros.

**The line.** «Знають {known} з {total} читачів · зберегли {saved}», total = known + unknown, in the Edition's plural forms (ADR 0020), zeros shown, under the mark buttons on cards of every kind with Knowledge Marks; a card without its mark buttons shows no line. VoiceOver reads it as one sentence, its two parts joined by a comma.

**The Community Word.** `GET /v1/community/week?edition=…` answers the Entry with the most Favorites adds in the last full ISO week (UTC) with its count, the lower Entry id by code points winning a tie, or nothing when nobody added anything; with `communityWord` switched off, locally or remotely, it answers `NOT_FOUND`. On a local Monday the Feed shows it as a Feed Notice right after the Weekly Recap (ADR 0054): a mini Entry card with «додали {n} читачів» in plural forms. There is none when the answer is empty or the Entry is Hidden or Retired for this reader. Swiping past it closes it for the local day like other Feed Notices; a tap opens the Entry, which, like every Feed Notice, makes nothing Seen.

**The privacy policy** (ADR 0049) says what the counters send, that no Account or device data goes with them, and how to turn sharing off, beside what a Mistake Report carries and how long it is kept.

## Considered Options

- **Counters through Sync**: rejected. Sync needs an Account and keeps a reader's own records; most readers have no Account, and counters must not be per reader.
- **An anonymous device id to deduplicate**: rejected. A stable id is a tracking id, whatever it is called.
- **Per-reader rows aggregated later**: rejected. Rows that link one reader's changes are what the counters promise not to keep.
- **Count marks and Favorites from before the update**: rejected. Readers would be counted by surprise, and every device would send its whole history at once.
- **Count Game answers**: rejected. A wrong guess in a Game is not the reader's judgement of a word.
- **A synced sharing setting**: rejected. It would tie an anonymous channel to an Account.
- **Ask the server on every card**: rejected. Counters change slowly; a day's cache spares the server and the reader's data.
- **Show zeros offline without numbers**: rejected. «Знають 0 з 0» would be wrong, not unknown.
- **The Community Word by saved totals**: rejected. The oldest favourites would win every week; adds within the week show what readers liked lately.
