---
summary: Statistics consent is also asked where the phone's time zone is in the EEA, whatever its region (supersedes "Who is asked" of 0210); a reader who finished the onboarding before 0210 with no choice kept gets the switch stored off once, where they would be asked.
---

# Statistics consent is also asked where the phone's time zone is in the EEA

Owner decision of 2026-11-28 (questions in PRs #2159 and #2160). This ADR supersedes the paragraph "Who is asked" of ADR 0210 and replaces its line on readers who finished the onboarding before it; the rest of ADR 0210 holds.

**Who is asked.** A reader whose phone's region is in the EEA or unknown, as in ADR 0210, and also a reader whose phone's time zone is one of the EEA, whatever the region: a phone set to region `UA` in `Europe/Berlin` is asked. The EEA time zones are those of the 27 states of the EU, Iceland, Liechtenstein and Norway, and of the parts of an EU state with a zone of their own (Büsingen, Åland, the Canary Islands, Ceuta, Madeira, the Azores, the French overseas regions). The time zone is the one the phone is set to, read on the phone like the region: nothing is sent to find it, and no IP or store front is read.

**Readers who finished the onboarding before ADR 0210.** A one-time migration (user-state schema version 10) marks a reader who finished the onboarding and has no choice of «Ділитися анонімною статистикою» kept. On the next opening, where that reader would be asked (the EEA by region or time zone, or an unknown region), the switch is stored off; they turn it on in «Конфіденційність». Any other such reader keeps the switch on, as before. The mark goes either way, so a later trip abroad changes nothing for them.

## Considered Options

- **The region alone** (ADR 0210): rejected by the owner. A reader in the EEA with a phone set to another region would be sent from without consent.
- **Leave the old readers to the in-effect answer**: rejected. Off in effect only while the phone reads as the EEA, the switch would turn on by itself after a change of region or zone; a stored off holds until the reader chooses.
