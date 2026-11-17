# The Cron services run hourly at :00 together, and the Recordings job stops when it makes nothing

Owner decision of 2026-11-17, after the cost audit (items 2 and 3). This ADR amends ADR 0088 (the alerts cadence and the API 5xx window) and ADR 0083 (the Recordings job).

**What it cost.** From 14.11 to 17.11 the Recordings job asked the generator for about 200 clips per run, the generator hit its time limit, and every hourly run burnt about $0.10 of Railway compute and recorded nothing: about $6.9 in three and a half days, 95 % of the month's Railway bill, and about $72 a month had it lived on (fixed by #1969). The `alerts` Cron service ran every 15 minutes, `quote-check` and `recordings` hourly at :00, so Neon's compute, which suspends after 5 idle minutes, woke four times an hour, day and night: about 3.5 CU-hours a day, about $11 a month.

**Every Cron service runs at `0 * * * *`.** `alerts` moves from every 15 minutes to hourly at :00, the minute `quote-check` and `recordings` run, so the database wakes once an hour instead of four times: about $2–3 a month on Neon. The digest still goes out on the first run from 09:00 Kyiv, now 09:00 itself. The API 5xx alert reads the backend's 5xx share of the last hour, the time since the run before, and fires at most once an hour; at 15 minutes it would miss three quarters of each hour. An alert reaches the owner up to an hour later than before, the backend-down one included.

**The Recordings job stops when it makes nothing.** A run counts, per Edition, a run whose generator made no file of the Words it had. After two such runs in a row (`STALL_RUNS`) the job tells the owner in Telegram, through the Alerts of ADR 0088 (`recordings-stalled`, kept for Огляд), and from then on a run skips the Edition without starting the generator. It tries again once the Edition's content version changes or the job runs on a new Railway deployment (`RAILWAY_DEPLOYMENT_ID`), which is how a fix reaches it. A run in which the generator made a file starts the count again; a run with nothing to record does not count. The count lives in the table `recording_stalls` (Edition, empty runs, deployment, content version).

**The failure mode, costed.** Stuck, the job now burns at most two runs, about $0.20 of Railway compute, and then a few seconds an hour: two small reads per Edition, inside the hour the database is awake for anyway. The `recordings` service takes the backend's `TELEGRAM_BOT_TOKEN` and `TELEGRAM_CHAT_ID` by reference.

Consequences:

- `.railway/railway.ts`: `alerts` on `0 * * * *`; `recordings` gains the two Telegram variables.
- The admin's threshold label and the Telegram text say «за годину» for the API 5xx share.
- A new Cron service runs at `0 * * * *` unless its ADR costs another schedule.
