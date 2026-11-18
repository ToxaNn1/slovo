# A signed-in reader's Mistake Report names their Account

Status: accepted (owner, 16.11). Supersedes ADR 0056's «Anonymous» for a signed-in reader. Amends ADR 0056 and 0088.

## Context

ADR 0056 kept every Mistake Report anonymous: the app sent no Session even when the reader was signed in, and the Content queue showed the Entry id, the type, the comment and two versions. The owner had to open the Entry elsewhere to see what the reader meant, and could not thank a reader whose report was right.

## Decision

- **Who sent it.** A device signed in to an Account sends its Session with `POST /v1/reports`; a device that is not sends none, as before. The body is unchanged and still has no field for an Account or a device id. The backend keeps the Account of a Session that is on in `mistake_reports.account_id`; without a Session, or with one that is not on, the report is anonymous and still answered `202`, so a reader whose Session ended on the way loses no report. The app sends the Session it holds when the report goes out of the queue, not when it was written.
- **Nothing else.** No device id, no Install id and no IP address are kept; the limit stays 10 a day per IP, hashed (ADR 0056).
- **Account deletion.** `account_id` references the Account with `on delete set null`: deleting the Account, by the reader or by a Власник (ADR 0162), leaves its reports anonymous and kept. No email is ever copied into a report.
- **The Content queue.** `contentQueue.reports` answers each report with `entry`, the Entry its id names in its Edition as the content database keeps it now (kind, every field, retired), or none when there is no record of that id, and `accountEmail`, the email of its Account, or none. «Помилки в записах» shows the email as a `mailto:` link, «анонімно» otherwise, and «Показати запис» opens the Entry's fields read as in «Перегляд» (ADR 0143).
- **«Вирішено».** The Action log row `report.resolve` keeps what the report said and not its Account: once resolved, nothing ties the reader to it.
- The reader-facing texts, the privacy policy included, change only on the owner's word.

## Considered Options

- **A field for the Account in the body**: rejected. The Session proves who the reader is; a body field could name anyone.
- **Refuse a report with a Session that is not on (`401`)**: rejected. The queue drops a report on any 4xx (ADR 0056), so a reader would lose it.
- **Keep the email in the report**: rejected. Deleting the Account would leave it behind.
- **Look the Entry up in the admin with a second request per report**: rejected. One answer with the Entry keeps the queue one read per kind of Entry.
- **Ask the reader in the sheet whether to send their email**: deferred to the owner; today a signed-in reader's report always names the Account.
