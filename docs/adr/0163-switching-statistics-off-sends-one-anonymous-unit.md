---
summary: Switching «Ділитися анонімною статистикою» off sends one anonymous unit (no Session, no Install id) counted per Edition and day, nothing after; Аналітика shows registered readers, unregistered readers at least (PostHog's active over 1 day minus Accounts, never below 0) and switch-offs; switch `statisticsOffCounter` (amends 0068, 0135).
---

# Switching statistics off sends one anonymous unit; the admin estimates unregistered readers

Owner decision of 2026-11-17. ADR 0068 says of the one privacy switch «Off, nothing is sent and nothing is queued». The owner cannot then tell how many readers turn statistics off, nor how many people read SLOVO without an Account. This ADR amends ADR 0068 and ADR 0135.

**One unit at the moment of switching off.** When the reader turns «Ділитися анонімною статистикою» off on the screen «Конфіденційність», the app sends one anonymous +1 to the backend, like a questionnaire counter: no Session, no Install id, no device id, the Edition in the body, rate-limited by the hashed IP as every counter is. The server adds it to a count per Edition and day and keeps no per-reader row. Nothing else is sent while the switch stays off, and nothing is queued: offline, the unit is lost. Switching on sends nothing. Each switch-off counts, so the number shows switch-offs, not how many readers have the switch off now.

**Counts in the admin.** Аналітика shows, for the period and Edition filter:

- **Registered readers**: the number of Accounts (ADR 0162).
- **Unregistered readers, at least**: the people active over the last day in PostHog (the `activeByDay` query, only readers who share statistics) minus the number of Accounts, never below 0, labelled as a lower estimate.
- **Statistics switched off**: the sum of switch-off units.

**The privacy policy** names the unit: switching off sends one anonymous unit at that moment and nothing after. The text waits for the owner's approval (ADR 0068).

Consequences:

- The backend gains an anonymous endpoint for the switch-off unit and a table `statistics_off_counters` (Edition, day, count).
- The Core's privacy switch reports the off transition through the counters port, never through `track`, which is already off.
- Own Feature Switch `statisticsOffCounter`; off, nothing is sent at switch-off, as before.

## Considered Options

- **Nothing sent when off (ADR 0068 as it stands)**: rejected by the owner; switch-offs stay unknown.
- **A PostHog event at switch-off**: rejected. It would carry the Install id and tie the switch-off to the reader's past events.
- **A daily «I am off» ping**: rejected. It sends while the switch is off, which the reader turned off to stop.
