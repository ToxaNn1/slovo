# Mistake Reports

Until 0.8.14 a reader who spotted a wrong Stress or a typo in a Definition couldn't say so, and the mistake stayed until the owner happened to find it. Spec #886 adds the Mistake Report («Повідомлення про помилку»): a reader reports a mistake from an Entry's card, anonymously, and the owner works through the reports with a backend script. The decisions come from the owner's grilling of 2026-10-25 and 2026-10-26.

**Feature Switch.** `mistakeReports` is required of every Edition and on in the UA Edition. While it is off in effect the card menu has no «Повідомити про помилку» and nothing is sent; reports already queued stay until it is on again. The backend answers an Edition with the switch off as one it doesn't find (`NOT_FOUND`), as content does (ADR 0032). A remote switch only turns it off (ADR 0040).

**On the card.** «Повідомити про помилку» is an item of the card menu on cards of all five kinds of Entry: Word, Correction, Idiom, Synonym Row and Tip. The card menu is the action row under the card (ADR 0017): the item is a flag in its last slot, which VoiceOver reads as «Повідомити про помилку», so it takes no new text and the actions stay one tap away. It opens a sheet:

- **The type**, required, one of «Друкарська помилка» (`typo`), «Наголос» (`stress`), «Визначення» (`definition`) and «Інше» (`other`).
- **«Коментар (необов'язково)»**, at most 500 characters, with a counter. «Інше» needs a comment, since the owner can't guess what it means.
- **«Надіслати»** closes the sheet with «Дякуємо! Ми перевіримо.», online or not; over the daily limit it shows «Забагато повідомлень сьогодні. Спробуйте завтра.» instead.

**The request.** `POST /v1/reports` is a procedure of the API contract like the others (ADR 0031), so the contract only grows and the committed description changes with it (`pnpm describe:api`). Its body carries the Edition, the Entry id, the type, the comment (trimmed, at most 500 characters, empty when there is none; non-empty for `other`), the app version (ADR 0044) and the content version of the open Language Pack. The backend checks the shape, not whether the Entry is in a pack, and answers `202` with no body; a body it refuses answers `400`.

**Anonymous.** A report carries no Account and no device id: the request sends no Session even when the reader is signed in, and the body has no field for either. The backend keeps the report with its time of arrival and nothing else; it never stores the IP address. The limit is 10 reports a day per IP, a window of the existing rate limits, keyed by the HMAC-SHA256 like them, so the `rate_limits` table names no IP (ADR 0030); a request over it answers `TOO_MANY_REQUESTS` (429) with `Retry-After`.

**The address is not Edition-scoped.** Sync and content live under `/v1/editions/{edition}/…`; `/v1/reports` is the owner's choice of 2026-10-26 and carries the Edition in its body. A report is a one-way message to the owner, not a resource of an Edition a reader reads back, and the counters' addresses follow the same pattern (ADR 0060). The backend keeps reports per Edition like all its data (ADR 0030).

**The device queue.** «Надіслати» puts the report in a `device-only` queue of at most 20 unsent reports and tries to send it at once; a 21st unsent report pushes out the oldest. The queue sends through the one retry rule (ADR 0037), oldest first and one report at a time, again at launch, on each return to the foreground and after a report the backend took, so a report written offline goes out later and is never lost to a dropped connection. The sheet's answer waits for the tries of the report just written.

- **`202`** takes the report off the queue.
- **`429`** on the report just written shows «Забагато повідомлень сьогодні. Спробуйте завтра.» and takes it off the queue, since the reader was told to try tomorrow; a queued report that meets a 429 later waits for `Retry-After`, as Sync does (ADR 0041).
- **Any other 4xx** takes the report off the queue: sending it again would be refused again.

**The owner's scripts.** Two backend scripts work on the database directly, like `switch-off` (ADR 0040), and no API route reads reports:

- **`reports list`** prints the kept reports, newest first, each with its id, time, Edition, Entry id, type, comment, app version and content version; `--edition <id>` keeps one Edition's and `--since <date>` those received from that date on.
- **`reports resolve <id>`** deletes the report once the owner has checked it and fixed what needs fixing. A report is kept only until then: the database holds the reports still to check, and nothing else.

## Considered Options

- **Reports with the Account or a device id**: rejected. The owner needs to find the mistake, not the reader, and anonymous reports need no consent.
- **Reports by email**: rejected. A reader would need a mail account on the phone, leave the app and write a free text the owner has to decode.
- **An Edition-scoped address, `/v1/editions/{edition}/reports`**: rejected by the owner (2026-10-26). The Edition travels in the body.
- **Store the IP address to stop abuse**: rejected. The hashed window of the rate limits stops a flood without keeping who sent what.
- **The backend checks that the Entry is in the Edition's pack**: rejected. An older pack's Entry is still a real report, and the owner reads every one anyway.
- **A «…» menu on the card with «Повідомити про помилку» in it**: rejected for now. A menu of one item is one more tap and needs a name of its own; a flag in the action row does the same.
- **Send at once, with no queue**: rejected. A reader on a train would lose their report.
- **An unbounded queue**: rejected. Twenty reports cover any honest reader; the cap keeps a stuck queue from growing without end.
- **Keep resolved reports**: rejected. A checked report has done its job, and deleting it keeps the comments readers wrote no longer than needed.
- **A web dashboard for reports**: rejected for now. One owner reads them; a script is enough.
